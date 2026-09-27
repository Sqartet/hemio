//go:build linux || darwin || freebsd || openbsd

package filestore

import "syscall"

func statVolume(path string) (free, total uint64) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return 0, 0
	}
	bs := uint64(st.Bsize)
	return st.Bavail * bs, st.Blocks * bs
}
