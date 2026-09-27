//go:build darwin || freebsd || openbsd

package metrics

import (
	"net"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"time"
)

func collectOS(s *Snapshot) {
	s.Host, _ = os.Hostname()

	// CPU % from `sysctl -n kern.cputime` (darwin) or `sysctl -n kern.cp_time` (bsd)
	out, err := exec.Command("sysctl", "-n", "kern.cp_time").Output()
	if err != nil {
		out, err = exec.Command("sysctl", "-n", "kern.cputime2").Output()
	}
	if err == nil {
		f := strings.Fields(string(out))
		var total, idle uint64
		for i, v := range f {
			n, _ := strconv.ParseUint(v, 10, 64)
			total += n
			if i == 3 { // idle slot
				idle = n
			}
		}
		if prevTotal != 0 && total > prevTotal {
			dt := total - prevTotal
			di := idle - prevIdle
			s.CPUPct = 100 * float64(dt-di) / float64(dt)
		}
		prevTotal, prevIdle = total, idle
	}

	// Memory via sysctl hw.memsize + vm_stat is heavier; use a rough fallback.
	if out, err := exec.Command("sysctl", "-n", "hw.memsize").Output(); err == nil {
		v, _ := strconv.ParseUint(strings.TrimSpace(string(out)), 10, 64)
		s.MemTotal = v
	}
	if s.MemTotal == 0 || true {
		// vm_stat page size accounting
		if out, err := exec.Command("vm_stat").Output(); err == nil && s.MemTotal > 0 {
			var pageSize uint64 = 4096
			if po, err := exec.Command("sysctl", "-n", "hw.pagesize").Output(); err == nil {
				pageSize, _ = strconv.ParseUint(strings.TrimSpace(string(po)), 10, 64)
			}
			freePages, specPages := uint64(0), uint64(0)
			for _, ln := range strings.Split(string(out), "\n") {
				if i := strings.Index(ln, ":"); i > 0 {
					key := strings.TrimSpace(ln[:i])
					valStr := strings.Trim(strings.TrimSpace(ln[i+1:]), ".")
					n, _ := strconv.ParseUint(valStr, 10, 64)
					switch key {
					case "Pages free":
						freePages = n
					case "Pages speculative":
						specPages = n
					}
				}
			}
			avail := (freePages + specPages) * pageSize
			if avail < s.MemTotal {
				s.MemUsed = s.MemTotal - avail
			}
		}
	}

	// Uptime via sysctl kern.boottime
	if out, err := exec.Command("sysctl", "-n", "kern.boottime").Output(); err == nil {
		// format: { sec = 1600000000, usec = 0 } ...
		fs := strings.Fields(string(out))
		for i, v := range fs {
			if v == "=" && i+1 < len(fs) {
				sec, _ := strconv.ParseInt(strings.Trim(fs[i+1], ", "), 10, 64)
				if sec > 0 {
					s.UptimeSec = uint64(time.Now().Unix() - sec)
				}
				break
			}
		}
	}

	// Load avg via sysctl vm.loadavg { 1min 5min 15min }
	if out, err := exec.Command("sysctl", "-n", "vm.loadavg").Output(); err == nil {
		f := strings.Fields(strings.Trim(string(out), "{} \n"))
		if len(f) >= 3 {
			s.Load1, _ = strconv.ParseFloat(f[0], 64)
			s.Load5, _ = strconv.ParseFloat(f[1], 64)
			s.Load15, _ = strconv.ParseFloat(f[2], 64)
		}
	}

	// Disk
	var st syscall.Statfs_t
	if err := syscall.Statfs("/", &st); err == nil {
		bs := uint64(st.Bsize)
		s.DiskTotal = st.Blocks * bs
		s.DiskFree = st.Bavail * bs
		s.DiskLabel = "Root"
	}

	// Battery: macOS via pmset (best-effort), otherwise absent
	s.Bat = readBatteryDarwin()
}

var prevTotal, prevIdle uint64

func readBatteryDarwin() Battery {
	bat := Battery{Health: "unknown", Plugged: "—"}
	out, err := exec.Command("pmset", "-g", "batt").Output()
	if err != nil {
		return bat
	}
	for _, ln := range strings.Split(string(out), "\n") {
		if !strings.Contains(ln, "%") {
			continue
		}
		bat.Has = true
		for _, tok := range strings.Fields(ln) {
			t := strings.Trim(tok, ";,")
			if strings.HasSuffix(t, "%") {
				n, _ := strconv.Atoi(strings.TrimSuffix(t, "%"))
				bat.Pct = n
			}
			if t == "charging" {
				bat.Charging = true
			}
			if strings.Contains(strings.ToLower(ln), "ac power") {
				bat.Plugged = "AC"
			}
		}
		if bat.Plugged == "—" {
			bat.Plugged = "Battery"
		}
		break
	}
	return bat
}

func scanInterfaces() []Iface {
	var out []Iface
	ifs, err := net.Interfaces()
	if err != nil {
		return out
	}
	for _, ifi := range ifs {
		if ifi.Flags&net.FlagLoopback != 0 {
			continue
		}
		typ := "ethernet"
		if strings.HasPrefix(ifi.Name, "en") {
			if _, err := os.Stat("/System/Library/Extensions"); err == nil {
				typ = "wifi" // heuristic on macOS: en* is usually Wi-Fi
			}
		}
		up := ifi.Flags&net.FlagUp != 0 && ifi.Flags&net.FlagRunning != 0
		var ip string
		addrs, _ := ifi.Addrs()
		for _, a := range addrs {
			if n, ok := a.(*net.IPNet); ok && n.IP.To4() != nil {
				ip = n.IP.String()
				break
			}
		}
		out = append(out, Iface{Name: ifi.Name, IP: ip, Type: typ, Up: up, Active: up && ip != ""})
	}
	return out
}
