// Package main provides a cross-platform trash CLI that moves files to the system Trash
// instead of permanently deleting them.
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"time"
)

const (
	version = "1.0.0"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	// Handle flags
	if os.Args[1] == "--help" || os.Args[1] == "-h" {
		printUsage()
		os.Exit(0)
	}

	if os.Args[1] == "--version" || os.Args[1] == "-v" {
		fmt.Printf("trash v%s\n", version)
		os.Exit(0)
	}

	// Process each file/folder argument
	hasErrors := false
	for _, path := range os.Args[1:] {
		if err := moveToTrash(path); err != nil {
			fmt.Fprintf(os.Stderr, "trash: %s: %v\n", path, err)
			hasErrors = true
		} else {
			fmt.Printf("'%s' moved to trash\n", path)
		}
	}

	if hasErrors {
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`trash - Move files to system Trash instead of permanent deletion

Usage:
    trash <file1> [file2] [file3...]
    trash --help
    trash --version

Description:
    Moves files and folders to the system Trash, allowing recovery if needed.
    
    On macOS: Uses ~/.Trash
    On Linux: Uses freedesktop.org trash spec (~/.local/share/Trash)

Examples:
    trash file.txt           Move a single file to trash
    trash folder/            Move a folder to trash
    trash a.txt b.txt c/     Move multiple items to trash

Options:
    -h, --help      Show this help message
    -v, --version   Show version information`)
}

func moveToTrash(path string) error {
	// Get absolute path of the file to trash
	absPath, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("cannot resolve path: %w", err)
	}

	// Check if file/folder exists
	info, err := os.Lstat(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("no such file or directory")
		}
		return fmt.Errorf("cannot access: %w", err)
	}

	switch runtime.GOOS {
	case "darwin":
		return trashMacOS(absPath, info)
	case "linux":
		return trashLinux(absPath, info)
	default:
		return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}
}

// trashMacOS moves a file to the macOS Trash folder
func trashMacOS(absPath string, info os.FileInfo) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("cannot find home directory: %w", err)
	}

	trashDir := filepath.Join(homeDir, ".Trash")

	// Ensure trash directory exists (it should on macOS, but just in case)
	if err := os.MkdirAll(trashDir, 0700); err != nil {
		return fmt.Errorf("cannot create trash directory: %w", err)
	}

	// Generate unique name to avoid conflicts
	baseName := filepath.Base(absPath)
	destPath := filepath.Join(trashDir, baseName)
	destPath = uniquePath(destPath)

	// Move the file to trash
	if err := os.Rename(absPath, destPath); err != nil {
		// If rename fails (e.g., cross-device), try copy+delete
		if err := copyAndDelete(absPath, destPath, info); err != nil {
			return fmt.Errorf("cannot move to trash: %w", err)
		}
	}

	return nil
}

// trashLinux moves a file to trash following freedesktop.org spec
// See: https://specifications.freedesktop.org/trash-spec/trashspec-1.0.html
func trashLinux(absPath string, info os.FileInfo) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("cannot find home directory: %w", err)
	}

	// Use XDG_DATA_HOME if set, otherwise default to ~/.local/share
	dataHome := os.Getenv("XDG_DATA_HOME")
	if dataHome == "" {
		dataHome = filepath.Join(homeDir, ".local", "share")
	}

	trashDir := filepath.Join(dataHome, "Trash")
	filesDir := filepath.Join(trashDir, "files")
	infoDir := filepath.Join(trashDir, "info")

	// Create trash directories if they don't exist
	if err := os.MkdirAll(filesDir, 0700); err != nil {
		return fmt.Errorf("cannot create trash files directory: %w", err)
	}
	if err := os.MkdirAll(infoDir, 0700); err != nil {
		return fmt.Errorf("cannot create trash info directory: %w", err)
	}

	// Generate unique name
	baseName := filepath.Base(absPath)
	destPath := filepath.Join(filesDir, baseName)
	destPath = uniquePath(destPath)
	trashName := filepath.Base(destPath)

	// Create .trashinfo file (required by freedesktop.org spec)
	trashInfoPath := filepath.Join(infoDir, trashName+".trashinfo")
	trashInfoContent := fmt.Sprintf("[Trash Info]\nPath=%s\nDeletionDate=%s\n",
		absPath,
		time.Now().Format("2006-01-02T15:04:05"),
	)

	if err := os.WriteFile(trashInfoPath, []byte(trashInfoContent), 0600); err != nil {
		return fmt.Errorf("cannot create trash info file: %w", err)
	}

	// Move the file to trash
	if err := os.Rename(absPath, destPath); err != nil {
		// If rename fails (e.g., cross-device), try copy+delete
		if err := copyAndDelete(absPath, destPath, info); err != nil {
			// Clean up trashinfo file on failure
			os.Remove(trashInfoPath)
			return fmt.Errorf("cannot move to trash: %w", err)
		}
	}

	return nil
}

// uniquePath generates a unique path by appending a counter if the path already exists
func uniquePath(path string) string {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return path
	}

	dir := filepath.Dir(path)
	ext := filepath.Ext(path)
	base := filepath.Base(path)
	name := base[:len(base)-len(ext)]

	for i := 1; ; i++ {
		newPath := filepath.Join(dir, name+" "+strconv.Itoa(i)+ext)
		if _, err := os.Stat(newPath); os.IsNotExist(err) {
			return newPath
		}
	}
}

// copyAndDelete handles cross-device moves by copying then deleting
func copyAndDelete(src, dst string, info os.FileInfo) error {
	if info.IsDir() {
		return copyDirAndDelete(src, dst)
	}
	return copyFileAndDelete(src, dst, info)
}

func copyFileAndDelete(src, dst string, info os.FileInfo) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}

	if err := os.WriteFile(dst, data, info.Mode()); err != nil {
		return err
	}

	return os.Remove(src)
}

func copyDirAndDelete(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		info, err := entry.Info()
		if err != nil {
			return err
		}

		if entry.IsDir() {
			if err := copyDirAndDelete(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := copyFileAndDelete(srcPath, dstPath, info); err != nil {
				return err
			}
		}
	}

	return os.Remove(src)
}
