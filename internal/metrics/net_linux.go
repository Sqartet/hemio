//go:build linux

package metrics

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// readNetBytes sums rx/tx octets across non-loopback interfaces.
func readNetBytes() (rx, tx uint64) {
	dirs, _ := filepath.Glob("/sys/class/net/*")
	for _, d := range dirs {
		if filepath.Base(d) == "lo" {
			continue
		}
		for _, f := range []struct {
			name string
			toTx bool
		}{{"statistics/rx_bytes", false}, {"statistics/tx_bytes", true}} {
			b, err := os.ReadFile(filepath.Join(d, f.name))
			if err != nil {
				continue
			}
			n, _ := strconv.ParseUint(strings.TrimSpace(string(b)), 10, 64)
			if f.toTx {
				tx += n
			} else {
				rx += n
			}
		}
	}
	return
}

// readTempC reads the hottest thermal zone if present; graceful when absent.
func readTempC() (float64, bool) {
	zones, _ := filepath.Glob("/sys/class/thermal/thermal_zone*/temp")
	best, found := 0.0, false
	for _, z := range zones {
		b, err := os.ReadFile(z)
		if err != nil {
			continue
		}
		v, _ := strconv.ParseFloat(strings.TrimSpace(string(b)), 64)
		tz := v / 1000 // milli-°C
		if tz < 0 || tz > 150 {
			continue
		}
		if !found || tz > best {
			best, found = tz, true
		}
	}
	return best, found
}
