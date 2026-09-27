// Package health probes app endpoints concurrently and caches results.
package health

import (
	"net/http"
	"sync"
	"time"

	"hemio/internal/config"
)

type Status struct {
	Title   string `json:"title"`
	Healthy bool   `json:"healthy"`
	Latency int64  `json:"latency_ms"`
	Checked int64  `json:"checked_at"`
	Skipped bool   `json:"-"`
}

var (
	mu      sync.RWMutex
	results = map[string]Status{}
	client  = &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        8,
			DisableKeepAlives:   true,
			IdleConnTimeout:     2 * time.Second,
			TLSHandshakeTimeout: 4 * time.Second,
		},
	}
)

// CheckAll probes every app that has a health_check URL.
func CheckAll() {
	apps := config.Apps()
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	for _, a := range apps {
		if a.HealthCheck == "" {
			continue
		}
		wg.Add(1)
		go func(app config.App) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			probe(app)
		}(a)
	}
	wg.Wait()
}

func probe(a config.App) {
	start := time.Now()
	st := Status{Title: a.Title, Checked: start.Unix()}
	req, err := http.NewRequest(http.MethodGet, a.HealthCheck, nil)
	if err == nil {
		req.Header.Set("User-Agent", "HemioDashboard/1.0")
		resp, err := client.Do(req)
		if err == nil {
			resp.Body.Close()
			st.Healthy = resp.StatusCode < 500
			st.Latency = time.Since(start).Milliseconds()
		}
	}
	mu.Lock()
	results[a.Title] = st
	mu.Unlock()
}

// Summary returns per-app status plus healthy/configured/unhealthy counts.
func Summary() (map[string]Status, int, int, int) {
	mu.RLock()
	defer mu.RUnlock()
	apps := config.Apps()
	out := make(map[string]Status, len(apps))
	healthy, unhealthy, configured := 0, 0, 0
	for _, a := range apps {
		if a.HealthCheck == "" {
			configured++
			continue
		}
		s, ok := results[a.Title]
		if !ok {
			continue
		}
		out[a.Title] = s
		if s.Healthy {
			healthy++
		} else {
			unhealthy++
		}
	}
	return out, healthy, configured, unhealthy
}
