//go:build linux

package metrics

import "time"

var (
	lastRx, lastTx uint64
	lastNetAt      time.Time
)

// sampleNet fills the NetDown/NetUp/NetRxMB/NetTxMB fields on the snapshot.
func sampleNet(s *Snapshot) {
	rx, tx := readNetBytes()
	s.NetRxMB = float64(rx) / 1e6
	s.NetTxMB = float64(tx) / 1e6
	now := time.Now()
	if !lastNetAt.IsZero() {
		dt := now.Sub(lastNetAt).Seconds()
		if dt > 0 {
			s.NetDown = mbits(rx-lastRx, dt)
			s.NetUp = mbits(tx-lastTx, dt)
			if s.NetDown > 0 || s.NetUp > 0 {
				s.HasNet = true
			}
		}
	}
	lastRx, lastTx, lastNetAt = rx, tx, now
}

func mbits(delta uint64, dt float64) float64 {
	return float64(delta) * 8 / 1e6 / dt
}
