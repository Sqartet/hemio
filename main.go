// Hemio Dashboard — ultra-lightweight single-binary HomeLab dashboard.
package main

import (
	"context"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"hemio/internal/auth"
	"hemio/internal/config"
	"hemio/internal/health"
	"hemio/internal/server"
	"hemio/web"
)

func main() {
	log.SetPrefix("hemio: ")
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	assets, err := fs.Sub(web.Assets, "static")
	if err != nil {
		log.Fatal(err)
	}

	au, err := auth.Load(cfg.DataDir, strings.EqualFold(os.Getenv("HEMIO_NO_AUTH"), "1"))
	if err != nil {
		log.Fatalf("auth: %v", err)
	}
	if au.CreatedDefault {
		log.Println("login created: user 'admin' / password 'admin123' — change it in Settings → Users & Access (or set HEMIO_NO_AUTH=1 to disable)")
	}

	// first health sweep, then background loop
	go health.CheckAll()
	stop := make(chan struct{})
	go func() {
		t := time.NewTicker(time.Duration(cfg.HealthIntervalSec) * time.Second)
		defer t.Stop()
		for {
			select {
			case <-t.C:
				health.CheckAll()
			case <-stop:
				return
			}
		}
	}()

	addr := cfg.Host + ":" + strconv.Itoa(cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           server.New(assets, au),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("Hemio Dashboard listening on http://%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("serve: %v", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig
	log.Println("shutting down...")
	close(stop)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
