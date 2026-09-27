//go:build windows

package filestore

import (
	"syscall"
	"unsafe"
)

func statVolume(path string) (free, total uint64) {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	proc := kernel32.NewProc("GetDiskFreeSpaceExW")
	w := syscall.StringToUTF16Ptr(path)
	var freeAvail, totalBytes, freeBytes uint64
	r, _, _ := proc.Call(
		uintptr(unsafe.Pointer(w)),
		uintptr(unsafe.Pointer(&freeAvail)),
		uintptr(unsafe.Pointer(&totalBytes)),
		uintptr(unsafe.Pointer(&freeBytes)),
	)
	if r == 0 {
		return 0, 0
	}
	return freeAvail, totalBytes
}
