// Package server wires the HTTP API, auth gate, and embedded static frontend.
package server

import (
	"encoding/json"
	"io"
	"io/fs"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"hemio/internal/auth"
	"hemio/internal/config"
	"hemio/internal/filestore"
	"hemio/internal/health"
	"hemio/internal/metrics"
	"hemio/internal/weather"
)

// Version is reported by /api/auth/status and the About window.
const Version = "1.2.0"

// New builds the mux with all routes. assets is the embedded web FS subtree.
func New(assets fs.FS, au *auth.Store) http.Handler {
	mux := http.NewServeMux()

	// ---- public: auth ----
	mux.HandleFunc("POST /api/login", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if au.Disabled {
			writeJSON(w, map[string]bool{"ok": true})
			return
		}
		if !au.Verify(body.Username, body.Password) {
			time.Sleep(600 * time.Millisecond) // slow brute force
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		tok := au.Login()
		au.SetCookie(w, tok)
		writeJSON(w, map[string]bool{"ok": true})
	})

	mux.HandleFunc("POST /api/logout", func(w http.ResponseWriter, r *http.Request) {
		au.Logout(auth.TokenFrom(r))
		auth.ClearCookie(w)
		writeJSON(w, map[string]bool{"ok": true})
	})

	mux.HandleFunc("GET /api/auth/status", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]any{
			"enabled":          !au.Disabled,
			"username":         au.Username,
			"session_minutes":  au.SessionMinutesSafe(),
			"default_password": !au.Disabled && au.Verify(au.Username, "admin123"),
			"version":          Version,
		})
	})

	// ---- auth-gated: settings of access ----
	mux.HandleFunc("POST /api/auth/password", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Current string `json:"current"`
			New     string `json:"new"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if !au.SetPassword(body.Current, body.New) {
			http.Error(w, "current password wrong or new too short (min 4)", http.StatusBadRequest)
			return
		}
		tok := au.Login() // reissue; old sessions revoked
		au.SetCookie(w, tok)
		writeJSON(w, map[string]bool{"ok": true})
	})

	mux.HandleFunc("POST /api/auth/session", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Minutes int `json:"minutes"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1024)).Decode(&body); err != nil || !au.SetSessionMinutes(body.Minutes) {
			http.Error(w, "minutes must be between 5 and 240", http.StatusBadRequest)
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	})

	// ---- API ----
	mux.HandleFunc("GET /api/system", func(w http.ResponseWriter, r *http.Request) {
		s := metrics.Get()
		statuses, healthy, configured, unhealthy := health.Summary()
		writeJSON(w, map[string]any{
			"system":  s,
			"health":  statuses,
			"summary": map[string]int{"healthy": healthy, "configured": configured, "unhealthy": unhealthy},
		})
	})

	mux.HandleFunc("GET /api/apps", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, config.Apps())
	})

	mux.HandleFunc("GET /api/weather", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, weather.Get())
	})

	mux.HandleFunc("GET /api/settings", func(w http.ResponseWriter, _ *http.Request) {
		c := config.Get()
		ui := c.UI
		if len(ui) == 0 {
			ui = json.RawMessage(`{}`)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(ui)
	})
	mux.HandleFunc("POST /api/settings", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(io.LimitReader(r.Body, 200000))
		if !json.Valid(body) {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		if err := config.SaveUISettings(json.RawMessage(body)); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	})

	// ---- Files API (sandboxed to config files_root) ----
	root := func() string { return config.Get().FilesRoot }

	mux.HandleFunc("GET /api/files", func(w http.ResponseWriter, r *http.Request) {
		rel := r.URL.Query().Get("path")
		dir, entries, err := filestore.List(root(), rel)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		free, total := filestore.DiskFree(root())
		writeJSON(w, map[string]any{"dir": dir, "entries": entries, "free": free, "total": total})
	})

	mux.HandleFunc("GET /api/files/download", func(w http.ResponseWriter, r *http.Request) {
		f, size, name, err := filestore.Download(root(), r.URL.Query().Get("path"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Disposition", "attachment; filename*=UTF-8''"+name)
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
		io.Copy(w, f)
	})

	mux.HandleFunc("POST /api/files/mkdir", func(w http.ResponseWriter, r *http.Request) {
		if err := filestore.Mkdir(root(), r.URL.Query().Get("path")); err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	})

	mux.HandleFunc("POST /api/files/delete", func(w http.ResponseWriter, r *http.Request) {
		if err := filestore.Delete(root(), r.URL.Query().Get("path")); err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	})

	mux.HandleFunc("POST /api/files/upload", func(w http.ResponseWriter, r *http.Request) {
		const cap = 64 << 20
		if err := r.ParseMultipartForm(cap); err != nil {
			http.Error(w, "upload too large or malformed (max 64MB)", http.StatusBadRequest)
			return
		}
		defer r.MultipartForm.RemoveAll()
		dir := r.URL.Query().Get("path")
		var saved []string
		for _, fhs := range r.MultipartForm.File["files"] {
			name := filepath.Base(strings.ReplaceAll(fhs.Filename, "\\", "/"))
			if name == "." || name == "/" || name == ".." {
				continue
			}
			src, err := fhs.Open()
			if err != nil {
				continue
			}
			err = filestore.Save(root(), dir, name, src)
			src.Close()
			if err != nil {
				http.Error(w, err.Error(), http.StatusForbidden)
				return
			}
			saved = append(saved, name)
		}
		writeJSON(w, map[string]any{"ok": true, "saved": saved})
	})

	// ---- Static assets ----
	mux.Handle("/", spaHandler(assets))

	return logWare(authMiddleware(au, mux))
}

func authMiddleware(au *auth.Store, next http.Handler) http.Handler {
	public := map[string]bool{
		"/login": true, "/login.html": true,
		"/css/style.css": true,
		"/favicon.ico":   true,
		"/api/login":     true, "/api/auth/status": true,
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if au.Disabled || public[p] || au.Valid(auth.TokenFrom(r)) {
			next.ServeHTTP(w, r)
			return
		}
		if strings.HasPrefix(p, "/api/") {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		http.Redirect(w, r, "/login", http.StatusSeeOther)
	})
}

func spaHandler(assets fs.FS) http.Handler {
	fileServer := http.FileServerFS(assets)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/login" {
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/login.html"
			fileServer.ServeHTTP(w, r2)
			return
		}
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p == "" {
			p = "index.html"
		}
		if f, err := assets.Open(p); err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}
		// SPA fallback to index
		r2 := r.Clone(r.Context())
		r2.URL.Path = "/"
		fileServer.ServeHTTP(w, r2)
	})
}

func logWare(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		h.ServeHTTP(w, r)
		if !strings.HasPrefix(r.URL.Path, "/api/system") {
			log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
		}
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	enc.Encode(v)
}
