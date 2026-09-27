//go:build linux

package metrics

import (
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

var prevCPU [2]uint64 // idle, total

func readProcStat() (idle, total uint64) {
	b, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0
	}
	line := strings.SplitN(string(b), "\n", 2)[0]
	f := strings.Fields(line)
	if len(f) < 5 {
		return 0, 0
	}
	for i, v := range f[1:] {
		n, _ := strconv.ParseUint(v, 10, 64)
		total += n
		if i == 3 || i == 4 { // idle + iowait
			idle += n
		}
	}
	return
}

func collectOS(s *Snapshot) {
	s.Host, _ = os.Hostname()

	idle, total := readProcStat()
	if prevCPU[1] != 0 && total > prevCPU[1] {
		dTotal := total - prevCPU[1]
		dIdle := idle - prevCPU[0]
		s.CPUPct = 100 * float64(dTotal-dIdle) / float64(dTotal)
	}
	prevCPU[0], prevCPU[1] = idle, total

	if b, err := os.ReadFile("/proc/meminfo"); err == nil {
		vals := map[string]uint64{}
		for _, ln := range strings.Split(string(b), "\n") {
			f := strings.Fields(ln)
			if len(f) >= 2 {
				v, _ := strconv.ParseUint(f[1], 10, 64)
				key := strings.TrimSuffix(f[0], ":")
				vals[key] = v
			}
		}
		total := vals["MemTotal"]
		avail := vals["MemAvailable"]
		s.MemTotal = total * 1024
		s.MemUsed = (total - avail) * 1024
	}

	if b, err := os.ReadFile("/proc/uptime"); err == nil {
		f := strings.Fields(string(b))
		if len(f) > 0 {
			v, _ := strconv.ParseFloat(f[0], 64)
			s.UptimeSec = uint64(v)
		}
	}
	if b, err := os.ReadFile("/proc/loadavg"); err == nil {
		f := strings.Fields(string(b))
		if len(f) >= 3 {
			s.Load1, _ = strconv.ParseFloat(f[0], 64)
			s.Load5, _ = strconv.ParseFloat(f[1], 64)
			s.Load15, _ = strconv.ParseFloat(f[2], 64)
		}
	}

	var st syscall.Statfs_t
	if err := syscall.Statfs("/", &st); err == nil {
		bs := uint64(st.Bsize)
		s.DiskTotal = st.Blocks * bs
		s.DiskFree = st.Bavail * bs
		s.DiskLabel = "Root"
	}

	s.Bat = readBattery()
}

func readBattery() Battery {
	bat := Battery{Health: "unknown", Plugged: "—"}
	dirs, _ := filepath.Glob("/sys/class/power_supply/BAT*")
	if len(dirs) == 0 {
		dirs, _ = filepath.Glob("/sys/class/power_supply/battery")
	}
	if len(dirs) == 0 {
		return bat // no battery (VPS/desktop): UI falls back gracefully
	}
	bat.Has = true
	d := dirs[0]
	readNum := func(f string) float64 {
		b, err := os.ReadFile(filepath.Join(d, f))
		if err != nil {
			return 0
		}
		v, _ := strconv.ParseFloat(strings.TrimSpace(string(b)), 64)
		return v
	}
	bat.Pct = int(readNum("capacity"))
	if st, err := os.ReadFile(filepath.Join(d, "status")); err == nil {
		s := strings.TrimSpace(string(st))
		bat.Health = s
		bat.Charging = strings.EqualFold(s, "Charging") || strings.EqualFold(s, "Full")
	}
	if t := readNum("temp"); t > 0 {
		switch {
		case t > 10000:
			bat.Temp = t / 10000
		case t > 1000:
			bat.Temp = t / 1000
		case t > 200:
			bat.Temp = t / 10
		default:
			bat.Temp = t
		}
	}
	if v := readNum("voltage_now"); v > 0 {
		bat.Voltage = v / 1e6 // µV -> V
	}
	online, _ := os.ReadFile("/sys/class/power_supply/AC/online")
	if strings.TrimSpace(string(online)) == "1" {
		bat.Plugged = "AC"
	} else {
		bat.Plugged = "Battery"
	}
	return bat
}

func operState(name string) bool {
	b, err := os.ReadFile("/sys/class/net/" + name + "/operstate")
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(b)) == "up"
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
		if _, err := os.Stat("/sys/class/net/" + ifi.Name + "/wireless"); err == nil {
			typ = "wifi"
		}
		up := ifi.Flags&net.FlagUp != 0 && operState(ifi.Name)
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
