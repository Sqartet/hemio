//go:build linux

package metrics

import (
	"os"
	"strings"
)

func cpuKernel() (model, kernel string) {
	if b, err := os.ReadFile("/proc/cpuinfo"); err == nil {
		for _, ln := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(ln, "model name") {
				if i := strings.Index(ln, ":"); i > 0 {
					model = strings.TrimSpace(ln[i+1:])
				}
				break
			}
		}
		if model == "" { // ARM boards: DeviceTree or Hardware line
			if b, err := os.ReadFile("/proc/device-tree/model"); err == nil {
				model = strings.TrimRight(string(b), "\x00")
			} else if b, err := os.ReadFile("/proc/cpuinfo"); err == nil {
				for _, ln := range strings.Split(string(b), "\n") {
					if strings.HasPrefix(ln, "Hardware") {
						if i := strings.Index(ln, ":"); i > 0 {
							model = strings.TrimSpace(ln[i+1:])
						}
						break
					}
				}
			}
		}
	}
	if b, err := os.ReadFile("/proc/sys/kernel/osrelease"); err == nil {
		kernel = strings.TrimSpace(string(b))
	}
	return
}
