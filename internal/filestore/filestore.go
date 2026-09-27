// Package filestore provides a sandboxed directory listing limited to a root.
package filestore

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Entry is a single file/dir listing row.
type Entry struct {
	Name  string `json:"name"`
	Path  string `json:"path"` // virtual path relative to root, "/" separator
	IsDir bool   `json:"is_dir"`
	Size  int64  `json:"size"`
	Mod   int64  `json:"mod"`
}

// Err escapes when a traversal attempt leaves the root.
var ErrEscape = errors.New("path escapes root")

// List returns children of rel ("" = root) under the sandboxed root dir.
func List(root, rel string) (dir string, entries []Entry, err error) {
	root, err = filepath.Abs(root)
	if err != nil {
		return "", nil, err
	}
	target := filepath.Join(root, filepath.FromSlash(rel))
	clean, err := filepath.Abs(target)
	if err != nil {
		return "", nil, err
	}
	if !within(root, clean) {
		return "", nil, ErrEscape
	}
	fi, err := os.Stat(clean)
	if err != nil {
		return "", nil, err
	}
	if !fi.IsDir() {
		return "", nil, errors.New("not a directory")
	}
	f, err := os.Open(clean)
	if err != nil {
		return "", nil, err
	}
	defer f.Close()
	names, err := f.Readdirnames(-1)
	if err != nil {
		return "", nil, err
	}
	for _, n := range names {
		st, err := os.Lstat(filepath.Join(clean, n))
		if err != nil {
			continue
		}
		vp := n
		if rel != "" {
			vp = filepath.ToSlash(filepath.Join(filepath.FromSlash(rel), n))
		}
		entries = append(entries, Entry{
			Name:  n,
			Path:  vp,
			IsDir: st.IsDir(),
			Size:  st.Size(),
			Mod:   st.ModTime().Unix(),
		})
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
	return filepath.ToSlash(filepath.Join("/", rel)), entries, nil
}

// Download opens a file for reading, sandboxed; caller closes it.
func Download(root, rel string) (*os.File, int64, string, error) {
	root, _ = filepath.Abs(root)
	clean, err := filepath.Abs(filepath.Join(root, filepath.FromSlash(rel)))
	if err != nil {
		return nil, 0, "", err
	}
	if !within(root, clean) {
		return nil, 0, "", ErrEscape
	}
	st, err := os.Stat(clean)
	if err != nil {
		return nil, 0, "", err
	}
	if st.IsDir() {
		return nil, 0, "", errors.New("is a directory")
	}
	f, err := os.Open(clean)
	if err != nil {
		return nil, 0, "", err
	}
	return f, st.Size(), filepath.Base(clean), nil
}

// Mkdir creates a directory under root, sandboxed.
func Mkdir(root, rel string) error {
	root, _ = filepath.Abs(root)
	clean, err := filepath.Abs(filepath.Join(root, filepath.FromSlash(rel)))
	if err != nil {
		return err
	}
	if !within(root, clean) {
		return ErrEscape
	}
	return os.MkdirAll(clean, 0o755)
}

// Delete removes a file or empty dir under root, sandboxed.
func Delete(root, rel string) error {
	root, _ = filepath.Abs(root)
	clean, err := filepath.Abs(filepath.Join(root, filepath.FromSlash(rel)))
	if err != nil {
		return err
	}
	if !within(root, clean) || clean == root {
		return ErrEscape
	}
	return os.Remove(clean)
}

// Save writes an uploaded file (streamed from src) into dir under root, sandboxed.
func Save(root, dir, name string, src io.Reader) error {
	root, _ = filepath.Abs(root)
	target := filepath.Join(root, filepath.FromSlash(dir), name)
	clean, err := filepath.Abs(target)
	if err != nil {
		return err
	}
	if !within(root, clean) {
		return ErrEscape
	}
	if fi, err := os.Stat(clean); err == nil && fi.IsDir() {
		return errors.New("target is a directory")
	}
	tmp := clean + ".upload.tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, src); err != nil {
		f.Close()
		os.Remove(tmp)
		return err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, clean)
}

// DiskFree reports free/total bytes of the volume holding root.
func DiskFree(root string) (free, total uint64) {
	return statVolume(root)
}

func within(root, p string) bool {
	r := filepath.Clean(root)
	s := strings.TrimSuffix(filepath.ToSlash(p), "/")
	t := strings.TrimSuffix(filepath.ToSlash(r), "/")
	return s == t || strings.HasPrefix(s, t+"/")
}
