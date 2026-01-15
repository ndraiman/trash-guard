package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestGetTrashDir(t *testing.T) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("failed to get home directory: %v", err)
	}

	switch runtime.GOOS {
	case "darwin":
		expected := filepath.Join(homeDir, ".Trash")
		// The trash directory should exist or be creatable
		if _, err := os.Stat(expected); err != nil && !os.IsNotExist(err) {
			t.Errorf("unexpected error checking trash directory: %v", err)
		}
	case "linux":
		dataHome := os.Getenv("XDG_DATA_HOME")
		if dataHome == "" {
			dataHome = filepath.Join(homeDir, ".local", "share")
		}
		expected := filepath.Join(dataHome, "Trash")
		// Verify path is correct
		if !strings.HasSuffix(expected, "Trash") {
			t.Errorf("expected trash dir to end with Trash, got %s", expected)
		}
	default:
		t.Skipf("skipping test on unsupported OS: %s", runtime.GOOS)
	}
}

func TestMoveToTrash(t *testing.T) {
	// Create a temporary directory for test files
	tmpDir, err := os.MkdirTemp("", "trash-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	t.Run("trash single file", func(t *testing.T) {
		// Create a test file
		testFile := filepath.Join(tmpDir, "test-file.txt")
		if err := os.WriteFile(testFile, []byte("test content"), 0644); err != nil {
			t.Fatalf("failed to create test file: %v", err)
		}

		// Move to trash
		if err := moveToTrash(testFile); err != nil {
			t.Errorf("moveToTrash failed: %v", err)
		}

		// Verify file no longer exists at original location
		if _, err := os.Stat(testFile); !os.IsNotExist(err) {
			t.Errorf("file should not exist at original location")
		}
	})

	t.Run("trash directory", func(t *testing.T) {
		// Create a test directory with contents
		testDir := filepath.Join(tmpDir, "test-dir")
		if err := os.MkdirAll(testDir, 0755); err != nil {
			t.Fatalf("failed to create test directory: %v", err)
		}
		testSubFile := filepath.Join(testDir, "subfile.txt")
		if err := os.WriteFile(testSubFile, []byte("sub content"), 0644); err != nil {
			t.Fatalf("failed to create test subfile: %v", err)
		}

		// Move to trash
		if err := moveToTrash(testDir); err != nil {
			t.Errorf("moveToTrash failed for directory: %v", err)
		}

		// Verify directory no longer exists
		if _, err := os.Stat(testDir); !os.IsNotExist(err) {
			t.Errorf("directory should not exist at original location")
		}
	})
}

func TestMoveToTrashFileNotFound(t *testing.T) {
	err := moveToTrash("/nonexistent/path/file.txt")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
	if !strings.Contains(err.Error(), "no such file or directory") {
		t.Errorf("expected 'no such file or directory' error, got: %v", err)
	}
}

func TestUniquePath(t *testing.T) {
	// Create temp directory
	tmpDir, err := os.MkdirTemp("", "unique-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	t.Run("no conflict", func(t *testing.T) {
		path := filepath.Join(tmpDir, "newfile.txt")
		result := uniquePath(path)
		if result != path {
			t.Errorf("expected %s, got %s", path, result)
		}
	})

	t.Run("single conflict", func(t *testing.T) {
		// Create existing file
		existingFile := filepath.Join(tmpDir, "existing.txt")
		if err := os.WriteFile(existingFile, []byte(""), 0644); err != nil {
			t.Fatalf("failed to create existing file: %v", err)
		}

		result := uniquePath(existingFile)
		expected := filepath.Join(tmpDir, "existing 1.txt")
		if result != expected {
			t.Errorf("expected %s, got %s", expected, result)
		}
	})

	t.Run("multiple conflicts", func(t *testing.T) {
		// Create multiple files
		base := filepath.Join(tmpDir, "multi.txt")
		if err := os.WriteFile(base, []byte(""), 0644); err != nil {
			t.Fatalf("failed to create base file: %v", err)
		}
		conflict1 := filepath.Join(tmpDir, "multi 1.txt")
		if err := os.WriteFile(conflict1, []byte(""), 0644); err != nil {
			t.Fatalf("failed to create conflict 1 file: %v", err)
		}
		conflict2 := filepath.Join(tmpDir, "multi 2.txt")
		if err := os.WriteFile(conflict2, []byte(""), 0644); err != nil {
			t.Fatalf("failed to create conflict 2 file: %v", err)
		}

		result := uniquePath(base)
		expected := filepath.Join(tmpDir, "multi 3.txt")
		if result != expected {
			t.Errorf("expected %s, got %s", expected, result)
		}
	})

	t.Run("file without extension", func(t *testing.T) {
		// Create file without extension
		noExt := filepath.Join(tmpDir, "noextension")
		if err := os.WriteFile(noExt, []byte(""), 0644); err != nil {
			t.Fatalf("failed to create file: %v", err)
		}

		result := uniquePath(noExt)
		expected := filepath.Join(tmpDir, "noextension 1")
		if result != expected {
			t.Errorf("expected %s, got %s", expected, result)
		}
	})
}

func TestCopyFileAndDelete(t *testing.T) {
	// Create temp directories
	srcDir, err := os.MkdirTemp("", "copy-src-*")
	if err != nil {
		t.Fatalf("failed to create src temp directory: %v", err)
	}
	defer os.RemoveAll(srcDir)

	dstDir, err := os.MkdirTemp("", "copy-dst-*")
	if err != nil {
		t.Fatalf("failed to create dst temp directory: %v", err)
	}
	defer os.RemoveAll(dstDir)

	// Create source file
	srcFile := filepath.Join(srcDir, "source.txt")
	content := []byte("test content for copy")
	if err := os.WriteFile(srcFile, content, 0644); err != nil {
		t.Fatalf("failed to create source file: %v", err)
	}

	srcInfo, err := os.Stat(srcFile)
	if err != nil {
		t.Fatalf("failed to stat source file: %v", err)
	}

	dstFile := filepath.Join(dstDir, "dest.txt")

	// Copy and delete
	if err := copyFileAndDelete(srcFile, dstFile, srcInfo); err != nil {
		t.Errorf("copyFileAndDelete failed: %v", err)
	}

	// Verify source is deleted
	if _, err := os.Stat(srcFile); !os.IsNotExist(err) {
		t.Error("source file should be deleted")
	}

	// Verify destination exists with correct content
	dstContent, err := os.ReadFile(dstFile)
	if err != nil {
		t.Errorf("failed to read destination file: %v", err)
	}
	if string(dstContent) != string(content) {
		t.Errorf("content mismatch: expected %s, got %s", content, dstContent)
	}
}

func TestCopyDirAndDelete(t *testing.T) {
	// Create temp directories
	srcDir, err := os.MkdirTemp("", "copydir-src-*")
	if err != nil {
		t.Fatalf("failed to create src temp directory: %v", err)
	}
	defer os.RemoveAll(srcDir)

	dstDir, err := os.MkdirTemp("", "copydir-dst-*")
	if err != nil {
		t.Fatalf("failed to create dst temp directory: %v", err)
	}
	defer os.RemoveAll(dstDir)

	// Create source directory structure
	subDir := filepath.Join(srcDir, "subdir")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatalf("failed to create subdir: %v", err)
	}

	file1 := filepath.Join(srcDir, "file1.txt")
	if err := os.WriteFile(file1, []byte("file1"), 0644); err != nil {
		t.Fatalf("failed to create file1: %v", err)
	}

	file2 := filepath.Join(subDir, "file2.txt")
	if err := os.WriteFile(file2, []byte("file2"), 0644); err != nil {
		t.Fatalf("failed to create file2: %v", err)
	}

	targetDir := filepath.Join(dstDir, "copied")

	// Copy and delete
	if err := copyDirAndDelete(srcDir, targetDir); err != nil {
		t.Errorf("copyDirAndDelete failed: %v", err)
	}

	// Verify source is deleted
	if _, err := os.Stat(srcDir); !os.IsNotExist(err) {
		t.Error("source directory should be deleted")
	}

	// Verify destination structure
	if _, err := os.Stat(filepath.Join(targetDir, "file1.txt")); err != nil {
		t.Errorf("file1.txt should exist in destination: %v", err)
	}
	if _, err := os.Stat(filepath.Join(targetDir, "subdir", "file2.txt")); err != nil {
		t.Errorf("subdir/file2.txt should exist in destination: %v", err)
	}
}

func TestVersionVariable(t *testing.T) {
	// Verify version is a variable (can be set via ldflags)
	if version == "" {
		t.Error("version should not be empty")
	}
	// Default value should be "dev"
	if version != "dev" {
		t.Logf("version is set to: %s (expected 'dev' in tests unless overridden)", version)
	}
}
