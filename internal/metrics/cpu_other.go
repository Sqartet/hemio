//go:build !linux

package metrics

import (
	"os"
	"runtime"
	"strings"
)

// sampleNet is a graceful no-op off Linux: widgets show 0.0 Mbps.
func sampleNet(s *Snapshot) {}

func readTempC() (float64, bool) { return 0, false }

// cpuKernel returns best-effort values on non-Linux (macOS/Windows/BSD).
func cpuKernel() (model, kernel string) {
	if v := os.Getenv("PROCESSOR_IDENTIFIER"); v != "" { // Windows env var
		model = strings.TrimSpace(v)
	} else if runtime.GOOS == "darwin" {
		if v := os.Getenv("MACHTYPE"); v != "" {
			model = v
		}
	}
	return model, runtime.GOOS + " " + runtime.GOARCH
}
