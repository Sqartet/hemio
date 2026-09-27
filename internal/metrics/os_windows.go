//go:build windows

package metrics

import (
	"net"
	"os"
	"strings"
	"syscall"
	"unsafe"
)

var (
	kernel32      = syscall.NewLazyDLL("kernel32.dll")
	procGetTimes  = kernel32.NewProc("GetSystemTimes")
	procMemStatus = kernel32.NewProc("GlobalMemoryStatusEx")
	procTickCount = kernel32.NewProc("GetTickCount64")
	procDiskFree  = kernel32.NewProc("GetDiskFreeSpaceExW")
	procPower     = kernel32.NewProc("GetSystemPowerStatus")
)

var prevIdle, prevKernel, prevUser uint64

type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtentedVirtual uint64
}

type filetime struct{ Low, High uint32 }

func ft64(f filetime) uint64 { return uint64(f.High)<<32 | uint64(f.Low) }

type systemPowerStatus struct {
	ACLineStatus       byte
	BatteryFlag        byte
	BatteryLifePercent byte
	SystemStatusFlag   byte
	BatteryLifeTime    uint32
	_                  uint32
}

func collectOS(s *Snapshot) {
	s.Host, _ = os.Hostname()

	// CPU % via GetSystemTimes deltas (kernel time includes idle).
	var idle, kern, user filetime
	if r, _, _ := procGetTimes.Call(
		uintptr(unsafe.Pointer(&idle)),
		uintptr(unsafe.Pointer(&kern)),
		uintptr(unsafe.Pointer(&user)),
	); r != 0 {
		i, k, u := ft64(idle), ft64(kern), ft64(user)
		if prevIdle != 0 {
			di := i - prevIdle
			total := (k - prevKernel) + (u - prevUser) // kernel incl. idle + user
			if total > 0 {
				s.CPUPct = 100 * float64(total-di) / float64(total)
			}
		}
		prevIdle, prevKernel, prevUser = i, k, u
	}

	// Memory
	var ms memoryStatusEx
	ms.Length = uint32(unsafe.Sizeof(ms))
	if r, _, _ := procMemStatus.Call(uintptr(unsafe.Pointer(&ms))); r != 0 {
		s.MemTotal = ms.TotalPhys
		s.MemUsed = ms.TotalPhys - ms.AvailPhys
	}

	// Uptime
	if t, _, _ := procTickCount.Call(); t != 0 {
		s.UptimeSec = uint64(t) / 1000
	}

	// System drive free space
	drive := os.Getenv("SystemDrive")
	if drive == "" {
		drive = "C:"
	}
	drive += `\`
	w := syscall.StringToUTF16Ptr(drive)
	var freeAvail, totalBytes, freeBytes uint64
	if r, _, _ := procDiskFree.Call(
		uintptr(unsafe.Pointer(w)),
		uintptr(unsafe.Pointer(&freeAvail)),
		uintptr(unsafe.Pointer(&totalBytes)),
		uintptr(unsafe.Pointer(&freeBytes)),
	); r != 0 {
		s.DiskFree = freeAvail
		s.DiskTotal = totalBytes
		s.DiskLabel = strings.TrimSuffix(drive, `\`)
	}

	// Battery (graceful: BatteryFlag 128 / 255 => no battery => Has=false)
	s.Bat = Battery{Health: "unknown", Plugged: "—"}
	var sp systemPowerStatus
	if r, _, _ := procPower.Call(uintptr(unsafe.Pointer(&sp))); r != 0 {
		noBattery := sp.BatteryFlag == 128 || sp.BatteryFlag == 255 || sp.BatteryLifePercent == 255
		if !noBattery {
			s.Bat.Has = true
			s.Bat.Pct = int(sp.BatteryLifePercent)
			s.Bat.Health = "ok"
			s.Bat.Plugged = "Battery"
			if sp.ACLineStatus == 1 {
				s.Bat.Plugged = "AC"
			}
			s.Bat.Charging = sp.BatteryFlag&8 != 0 || (sp.ACLineStatus == 1 && sp.BatteryLifePercent < 100)
		}
	}
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
		lower := strings.ToLower(ifi.Name)
		typ := "ethernet"
		switch {
		case strings.Contains(lower, "wi-fi"), strings.Contains(lower, "wifi"),
			strings.Contains(lower, "wlan"), strings.Contains(lower, "wireless"),
			strings.Contains(lower, "802.11"):
			typ = "wifi"
		case strings.Contains(lower, "loopback"), strings.Contains(lower, "virtual"),
			strings.Contains(lower, "tap"), strings.Contains(lower, "vpn"),
			strings.Contains(lower, "isatap"), strings.Contains(lower, "teredo"),
			strings.Contains(lower, "bluetooth"):
			continue // skip virtual/adapter noise
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
		// drop down adapters holding only a link-local (169.254.x) address
		if !up && (ip == "" || strings.HasPrefix(ip, "169.254.")) {
			continue
		}
		out = append(out, Iface{Name: ifi.Name, IP: ip, Type: typ, Up: up, Active: up && ip != ""})
	}
	return out
}
