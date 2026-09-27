// Package config loads config.json / apps.json with env var overrides.
package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"sync"
)

type Geo struct {
	City string  `json:"city"`
	Lat  float64 `json:"lat"`
	Lon  float64 `json:"lon"`
}

// fileCfg mirrors the on-disk schema with pointers so omitted fields keep defaults.
type fileCfg struct {
	Name              *string          `json:"name"`
	Port              *int             `json:"port"`
	Host              *string          `json:"host"`
	FilesRoot         *string          `json:"files_root"`
	HealthIntervalSec *int             `json:"health_interval_seconds"`
	Geo               *Geo             `json:"geo"`
	UI                json.RawMessage  `json:"ui"`
}

type Config struct {
	Name              string
	Port              int
	Host              string
	FilesRoot         string
	HealthIntervalSec int
	Geo               Geo
	UI                json.RawMessage
	DataDir           string

	fileName  string // preserved for re-serialization
}

type App struct {
	Title       string `json:"title"`
	URL         string `json:"url"`
	Icon        string `json:"icon"`
	Category    string `json:"category"`
	HealthCheck string `json:"health_check"`
	Description string `json:"description"`
}

var (
	mu     sync.RWMutex
	cfg    *Config
	apps   []App
	fileAt string
)

// Load reads config.json and apps.json from the data dir (exe dir or $HEMIO_DATA_DIR),
// then applies environment variable overrides (HEMIO_PORT, HEMIO_HOST, HEMIO_FILES_ROOT).
func Load() (*Config, error) {
	dataDir := os.Getenv("HEMIO_DATA_DIR")
	if dataDir == "" {
		if exe, err := os.Executable(); err == nil {
			dataDir = filepath.Dir(exe)
		} else {
			dataDir = "."
		}
	}

	c := &Config{
		Name:              "Hemio Dashboard",
		Port:              8090,
		Host:              "0.0.0.0",
		HealthIntervalSec: 15,
		DataDir:           dataDir,
	}
	c.fileName = c.Name

	cfgPath := filepath.Join(dataDir, "config.json")
	fileAt = cfgPath
	if b, err := os.ReadFile(cfgPath); err == nil {
		var f fileCfg
		if err := json.Unmarshal(b, &f); err != nil {
			return nil, err
		}
		if f.Name != nil {
			c.Name = *f.Name
		}
		if f.Port != nil {
			c.Port = *f.Port
		}
		if f.Host != nil {
			c.Host = *f.Host
		}
		if f.FilesRoot != nil {
			c.FilesRoot = *f.FilesRoot
		}
		if f.HealthIntervalSec != nil {
			c.HealthIntervalSec = *f.HealthIntervalSec
		}
		if f.Geo != nil {
			c.Geo = *f.Geo
		}
		c.UI = f.UI
	} else if !os.IsNotExist(err) {
		return nil, err
	}

	// env overrides win
	if v := os.Getenv("HEMIO_PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			c.Port = p
		}
	}
	if v := os.Getenv("HEMIO_HOST"); v != "" {
		c.Host = v
	}
	if v := os.Getenv("HEMIO_FILES_ROOT"); v != "" {
		c.FilesRoot = v
	}
	if c.FilesRoot == "" {
		if h, err := os.UserHomeDir(); err == nil {
			c.FilesRoot = h
		} else {
			c.FilesRoot = "."
		}
	}
	if c.HealthIntervalSec < 5 {
		c.HealthIntervalSec = 5
	}
	if c.Port < 1 || c.Port > 65535 {
		c.Port = 8090
	}

	a := []App{}
	if b, err := os.ReadFile(filepath.Join(dataDir, "apps.json")); err == nil {
		if err := json.Unmarshal(b, &a); err != nil {
			return nil, err
		}
	}

	mu.Lock()
	cfg, apps = c, a
	mu.Unlock()
	return c, nil
}

// Get returns the live config snapshot.
func Get() *Config {
	mu.RLock()
	defer mu.RUnlock()
	return cfg
}

// Apps returns a copy of the loaded app list.
func Apps() []App {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]App, len(apps))
	copy(out, apps)
	return out
}

// SaveUISettings persists the UI theme object back into config.json (atomic).
func SaveUISettings(raw json.RawMessage) error {
	mu.Lock()
	defer mu.Unlock()
	cfg.UI = raw

	out := map[string]any{
		"name":                    cfg.Name,
		"port":                    cfg.Port,
		"host":                    cfg.Host,
		"files_root":              cfg.FilesRoot,
		"health_interval_seconds": cfg.HealthIntervalSec,
		"geo":                     cfg.Geo,
		"ui":                      raw,
	}
	b, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return err
	}
	tmp := fileAt + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, fileAt)
}
