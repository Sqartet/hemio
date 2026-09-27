// Package auth provides a minimal local login: PBKDF2-HMAC-SHA256 password
// hashing (stdlib only), an in-memory sliding session store, and cookie helpers.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const CookieName = "hemio_session"

type Store struct {
	mu       sync.RWMutex
	path     string
	Disabled bool `json:"-"`

	Username       string `json:"username"`
	Salt           string `json:"salt"`
	Hash           string `json:"hash"`
	Iters          int    `json:"iterations"`
	SessionMinutes int    `json:"session_minutes"`

	// CreatedDefault is true when auth.json was generated with admin/admin123.
	CreatedDefault bool `json:"-"`

	sessions map[string]time.Time
}

// Load reads auth.json from dir; when missing it creates default admin/admin123.
func Load(dir string, disabled bool) (*Store, error) {
	s := &Store{
		path:           filepath.Join(dir, "auth.json"),
		Disabled:       disabled,
		Username:       "admin",
		SessionMinutes: 15,
		Iters:          60000,
		sessions:       map[string]time.Time{},
	}
	b, err := os.ReadFile(s.path)
	switch {
	case err == nil:
		if err := json.Unmarshal(b, s); err != nil {
			return nil, err
		}
		if s.SessionMinutes <= 0 {
			s.SessionMinutes = 15
		}
		if s.Iters <= 0 {
			s.Iters = 60000
		}
	case os.IsNotExist(err):
		salt := make([]byte, 16)
		rand.Read(salt)
		s.Salt = hex.EncodeToString(salt)
		s.Hash = hex.EncodeToString(hashPW("admin123", salt, s.Iters))
		s.CreatedDefault = true
		return s, s.save()
	default:
		return nil, err
	}
	return s, nil
}

func (s *Store) save() error {
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

// hashPW is a minimal PBKDF2-HMAC-SHA256 (stdlib only), iters rounds.
func hashPW(pw string, salt []byte, iters int) []byte {
	prf := func(counter []byte) []byte {
		m := hmac.New(sha256.New, []byte(pw))
		m.Write(salt)
		m.Write(counter)
		return m.Sum(nil)
	}
	block := make([]byte, 32)
	t := prf([]byte{0, 0, 0, 1})
	copy(block, t)
	u := t
	for i := 1; i < iters; i++ {
		m := hmac.New(sha256.New, []byte(pw))
		m.Write(u)
		u = m.Sum(nil)
		for j := range block {
			block[j] ^= u[j]
		}
	}
	return block
}

func hmacSHA256(key string, msg ...[]byte) []byte {
	m := hmac.New(sha256.New, []byte(key))
	for _, b := range msg {
		m.Write(b)
	}
	return m.Sum(nil)
}

// Verify checks username+password.
func (s *Store) Verify(user, pw string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if user != s.Username {
		return false
	}
	salt, err := hex.DecodeString(s.Salt)
	if err != nil {
		return false
	}
	want, err := hex.DecodeString(s.Hash)
	if err != nil {
		return false
	}
	got := hashPW(pw, salt, s.Iters)
	return subtle.ConstantTimeCompare(got, want) == 1
}

// SetPassword rehashes a new password with a fresh salt.
func (s *Store) SetPassword(current, newPW string) bool {
	if !s.Verify(s.Username, current) || len(newPW) < 4 {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	salt := make([]byte, 16)
	rand.Read(salt)
	s.Salt = hex.EncodeToString(salt)
	s.Hash = hex.EncodeToString(hashPW(newPW, salt, s.Iters))
	s.sessions = map[string]time.Time{} // force re-login
	return s.save() == nil
}

// Login issues a fresh session token.
func (s *Store) Login() string {
	b := make([]byte, 32)
	rand.Read(b)
	tok := hex.EncodeToString(b)
	s.mu.Lock()
	s.sessions[tok] = time.Now().Add(s.ttl())
	s.mu.Unlock()
	return tok
}

func (s *Store) ttl() time.Duration {
	if s.SessionMinutes <= 0 {
		return 15 * time.Minute
	}
	return time.Duration(s.SessionMinutes) * time.Minute
}

// Valid returns true for a live token and slides its expiry.
func (s *Store) Valid(tok string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	exp, ok := s.sessions[tok]
	if !ok || time.Now().After(exp) {
		return false
	}
	s.sessions[tok] = time.Now().Add(s.ttl())
	return true
}

// Logout revokes one token.
func (s *Store) Logout(tok string) {
	s.mu.Lock()
	delete(s.sessions, tok)
	s.mu.Unlock()
}

// SetSessionMinutes updates the configured lifetime (5..240).
func (s *Store) SetSessionMinutes(m int) bool {
	if m < 5 || m > 240 {
		return false
	}
	s.mu.Lock()
	s.SessionMinutes = m
	err := s.save()
	s.mu.Unlock()
	return err == nil
}

// SessionMinutesSafe returns the current lifetime.
func (s *Store) SessionMinutesSafe() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.SessionMinutes
}

// TokenFrom extracts the session cookie.
func TokenFrom(r *http.Request) string {
	c, err := r.Cookie(CookieName)
	if err != nil {
		return ""
	}
	return c.Value
}

// SetCookie writes the session cookie with current lifetime.
func (s *Store) SetCookie(w http.ResponseWriter, tok string) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    tok,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(s.ttl().Seconds()),
	})
}

// ClearCookie logs a browser out.
func ClearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: CookieName, Value: "", Path: "/", MaxAge: -1})
}
