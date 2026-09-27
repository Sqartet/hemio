// Package metrics collects cross-platform system metrics with graceful fallbacks:
// on servers/VPS without battery or thermal sensors, those fields simply report absent.
package metrics

import (
	"runtime"
	"sync"
	"time"
)

// Battery carries power info; Has=false when the machine has no battery (VPS/desktop).
type Battery struct {
	Has      bool    `json:"has"`
	Pct      int     `json:"pct"`
	Charging bool    `json:"charging"`
	Plugged  string  `json:"plugged"`
	Temp     float64 `json:"temp"`
	Voltage  float64 `json:"voltage"`
	Health   string  `json:"health"`
}

// Iface is a network interface with an IP.
type Iface struct {
	Name   string `json:"name"`
	IP     string `json:"ip"`
	Type   string `json:"type"` // ethernet | wifi | unknown
	Up     bool   `json:"up"`
	Active bool   `json:"active"`
}

// Snapshot is the full system state returned by /api/system.
type Snapshot struct {
	Timestamp int64   `json:"ts"`
	Host      string  `json:"hostname"`
	OS        string  `json:"os"`
	Arch      string  `json:"arch"`
	CPUPct    float64 `json:"cpu_pct"`
	MemUsed   uint64  `json:"mem_used"`
	MemTotal  uint64  `json:"mem_total"`
	DiskFree  uint64  `json:"disk_free"`
	DiskTotal uint64  `json:"disk_total"`
	DiskLabel string  `json:"disk_label"`
	UptimeSec uint64  `json:"uptime_sec"`
	Load1     float64 `json:"load1"`
	Load5     float64 `json:"load5"`
	Load15    float64 `json:"load15"`
	Bat       Battery `json:"battery"`
	Ifaces    []Iface `json:"ifaces"`
	NetDown   float64 `json:"net_down_mbps"`
	NetUp     float64 `json:"net_up_mbps"`
	NetRxMB   float64 `json:"net_rx_mb"`
	NetTxMB   float64 `json:"net_tx_mb"`
	HasNet    bool    `json:"has_net"`
	TempC     float64 `json:"temp_c"`
	HasTemp   bool    `json:"has_temp"`
	CPUModel  string  `json:"cpu_model"`
	Kernel    string  `json:"kernel"`
}

var (
	mu    sync.Mutex
	last  *Snapshot
	start = time.Now()
)

// Get returns a fresh snapshot (platform collector + shared iface scan).
func Get() *Snapshot {
	mu.Lock()
	defer mu.Unlock()

	s := &Snapshot{
		Timestamp: time.Now().Unix(),
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
	}
	collectOS(s)
	s.Ifaces = scanInterfaces()
	sampleNet(s)
	if t, ok := readTempC(); ok {
		s.TempC, s.HasTemp = t, true
	}
	s.CPUModel, s.Kernel = cpuKernel()
	if s.UptimeSec == 0 {
		s.UptimeSec = uint64(time.Since(start).Seconds())
	}
	last = s
	return s
}
