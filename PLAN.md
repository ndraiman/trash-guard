# Multi-Architecture Binary Distribution Plan

**Status:** PLANNING (not yet implemented)  
**Created:** 2026-01-15  
**CLI:** `trash` - Cross-platform trash utility

---

## Overview

This plan outlines the strategy for distributing pre-built binaries of the `trash` CLI across multiple platforms and architectures, making installation as simple as a one-liner curl command.

---

## 1. Build Targets

### Supported Platforms

| OS      | Architecture | Binary Name            | Priority | Notes |
|---------|--------------|------------------------|----------|-------|
| macOS   | arm64        | `trash-darwin-arm64`   | P0       | Apple Silicon (M1/M2/M3) |
| macOS   | amd64        | `trash-darwin-amd64`   | P0       | Intel Macs |
| Linux   | amd64        | `trash-linux-amd64`    | P0       | Most servers/desktops |
| Linux   | arm64        | `trash-linux-arm64`    | P0       | Raspberry Pi 4+, ARM servers |

### Deferred (Not in Initial Release)

| OS      | Architecture | Reason |
|---------|--------------|--------|
| Windows | amd64/arm64  | Code doesn't support Windows trash yet (would need `SHFileOperation` or PowerShell) |
| Linux   | arm (32-bit) | Low demand, can add later if requested |
| FreeBSD | *            | Low demand, can add later |

### Decision: Skip Windows Initially
The current code explicitly returns "unsupported operating system" for Windows. Adding Windows support would require:
- Windows API calls (`SHFileOperation`) or PowerShell fallback
- Different trash location (`$RECYCLE.BIN`)
- CGO or syscall complexity

**Recommendation:** Ship macOS + Linux first, add Windows in v1.1+ if there's demand.

---

## 2. Build Automation (GitHub Actions)

### Workflow File: `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - goos: darwin
            goarch: arm64
          - goos: darwin
            goarch: amd64
          - goos: linux
            goarch: amd64
          - goos: linux
            goarch: arm64

    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Build
        env:
          GOOS: ${{ matrix.goos }}
          GOARCH: ${{ matrix.goarch }}
        run: |
          cd cli
          go build -ldflags="-s -w -X main.version=${{ github.ref_name }}" \
            -o ../trash-${{ matrix.goos }}-${{ matrix.goarch }} \
            main.go

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: trash-${{ matrix.goos }}-${{ matrix.goarch }}
          path: trash-${{ matrix.goos }}-${{ matrix.goarch }}

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: binaries
          merge-multiple: true

      - name: Create checksums
        run: |
          cd binaries
          sha256sum trash-* > checksums.txt

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            binaries/trash-*
            binaries/checksums.txt
          generate_release_notes: true
```

### Version Injection

Modify `cli/main.go` to accept version at build time:

```go
// Change from:
const version = "1.0.0"

// To:
var version = "dev"  // Set via -ldflags at build time
```

### Naming Convention

| Format | Example |
|--------|---------|
| Binary | `trash-{os}-{arch}` |
| Archive (optional) | `trash-{os}-{arch}.tar.gz` |

Examples:
- `trash-darwin-arm64`
- `trash-darwin-amd64`
- `trash-linux-amd64`
- `trash-linux-arm64`

---

## 3. Install Script

### File: `install.sh` (root of repo)

```bash
#!/bin/bash
set -euo pipefail

# Configuration
REPO="ndraiman/trash-guard"
BINARY_NAME="trash"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin) echo "darwin" ;;
        Linux)  echo "linux" ;;
        *)      error "Unsupported OS: $(uname -s). Only macOS and Linux are supported." ;;
    esac
}

# Detect Architecture
detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64)  echo "amd64" ;;
        arm64|aarch64) echo "arm64" ;;
        *)             error "Unsupported architecture: $(uname -m)" ;;
    esac
}

# Get latest release version
get_latest_version() {
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | cut -d'"' -f4
}

main() {
    info "Installing ${BINARY_NAME}..."
    
    OS=$(detect_os)
    ARCH=$(detect_arch)
    VERSION="${VERSION:-$(get_latest_version)}"
    
    info "Detected: ${OS}/${ARCH}"
    info "Version: ${VERSION}"
    
    # Construct download URL
    BINARY="trash-${OS}-${ARCH}"
    URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY}"
    
    # Create temp directory
    TMP_DIR=$(mktemp -d)
    trap "rm -rf ${TMP_DIR}" EXIT
    
    # Download binary
    info "Downloading ${URL}..."
    curl -fsSL "${URL}" -o "${TMP_DIR}/${BINARY_NAME}"
    
    # Verify download (optional: check SHA256)
    if [ ! -s "${TMP_DIR}/${BINARY_NAME}" ]; then
        error "Download failed or file is empty"
    fi
    
    # Make executable
    chmod +x "${TMP_DIR}/${BINARY_NAME}"
    
    # Install (may need sudo)
    info "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
    if [ -w "${INSTALL_DIR}" ]; then
        mv "${TMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
    else
        warn "Need sudo to install to ${INSTALL_DIR}"
        sudo mv "${TMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
    fi
    
    info "✓ ${BINARY_NAME} installed successfully!"
    info "Run 'trash --version' to verify."
}

main "$@"
```

### Usage

```bash
# Install latest version
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/install.sh | bash

# Install specific version
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/install.sh | VERSION=v1.0.0 bash

# Install to custom directory (no sudo needed)
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/install.sh | INSTALL_DIR=~/.local/bin bash
```

---

## 4. Homebrew Formula (Optional)

### Option A: Homebrew Tap (Recommended for indie projects)

Create a separate repo `ndraiman/homebrew-tap` with:

**File: `Formula/trash-guard.rb`**

```ruby
class TrashGuard < Formula
  desc "Move files to system Trash instead of permanent deletion"
  homepage "https://github.com/ndraiman/trash-guard"
  version "1.0.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/ndraiman/trash-guard/releases/download/v#{version}/trash-darwin-arm64"
      sha256 "PLACEHOLDER_SHA256_ARM64"
    end
    on_intel do
      url "https://github.com/ndraiman/trash-guard/releases/download/v#{version}/trash-darwin-amd64"
      sha256 "PLACEHOLDER_SHA256_AMD64"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/ndraiman/trash-guard/releases/download/v#{version}/trash-linux-arm64"
      sha256 "PLACEHOLDER_SHA256_LINUX_ARM64"
    end
    on_intel do
      url "https://github.com/ndraiman/trash-guard/releases/download/v#{version}/trash-linux-amd64"
      sha256 "PLACEHOLDER_SHA256_LINUX_AMD64"
    end
  end

  def install
    binary_name = "trash-#{OS.kernel_name.downcase}-#{Hardware::CPU.arch}"
    bin.install binary_name => "trash"
  end

  test do
    assert_match "trash v#{version}", shell_output("#{bin}/trash --version")
  end
end
```

### Installation via Tap

```bash
brew tap ndraiman/tap
brew install trash-guard
```

### Option B: Submit to Homebrew Core (Later)
- Requires meeting Homebrew's criteria (notable project, 50+ stars, etc.)
- More visibility but more maintenance
- Consider after project gains traction

---

## 5. README Updates

### Add Installation Section

```markdown
## Installation

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/install.sh | bash
```

### Homebrew (macOS/Linux)

```bash
brew tap ndraiman/tap
brew install trash-guard
```

### Manual Download

Download the appropriate binary from [Releases](https://github.com/ndraiman/trash-guard/releases):

| Platform | Architecture | Download |
|----------|--------------|----------|
| macOS    | Apple Silicon (M1/M2/M3) | [trash-darwin-arm64](https://github.com/ndraiman/trash-guard/releases/latest/download/trash-darwin-arm64) |
| macOS    | Intel | [trash-darwin-amd64](https://github.com/ndraiman/trash-guard/releases/latest/download/trash-darwin-amd64) |
| Linux    | x86_64 | [trash-linux-amd64](https://github.com/ndraiman/trash-guard/releases/latest/download/trash-linux-amd64) |
| Linux    | ARM64 | [trash-linux-arm64](https://github.com/ndraiman/trash-guard/releases/latest/download/trash-linux-arm64) |

Then:
```bash
chmod +x trash-*
sudo mv trash-* /usr/local/bin/trash
```

### Build from Source

```bash
git clone https://github.com/ndraiman/trash-guard.git
cd trash-guard/cli
go build -o trash main.go
sudo mv trash /usr/local/bin/
```
```

---

## 6. Project Structure Changes

### Files to Add

```
trash-guard/
├── .github/
│   └── workflows/
│       └── release.yml      # NEW: Release automation
├── cli/
│   └── main.go              # MODIFY: Version variable
├── install.sh               # NEW: Install script
├── go.mod                   # NEW: Go module file
└── README.md                # MODIFY: Add installation docs
```

### go.mod (Required for modern Go)

```
module github.com/ndraiman/trash-guard

go 1.22
```

---

## 7. Release Process

### Creating a Release

```bash
# 1. Update version in main.go (optional, will be overridden by ldflags)
# 2. Commit changes
git add .
git commit -m "Prepare for v1.0.0 release"

# 3. Create and push tag
git tag v1.0.0
git push origin v1.0.0

# 4. GitHub Actions automatically:
#    - Builds all binaries
#    - Creates GitHub release
#    - Attaches binaries + checksums
```

### Versioning Strategy

- Follow SemVer: `vMAJOR.MINOR.PATCH`
- Start with `v1.0.0` (already production-ready)
- Bump MINOR for new features (e.g., Windows support)
- Bump PATCH for bug fixes

---

## 8. Implementation Checklist

- [ ] **Phase 1: Prep**
  - [ ] Create `go.mod` file
  - [ ] Modify `main.go` to use `var version` instead of `const`
  - [ ] Test local build with ldflags

- [ ] **Phase 2: GitHub Actions**
  - [ ] Create `.github/workflows/release.yml`
  - [ ] Test with a pre-release tag (e.g., `v1.0.0-rc1`)

- [ ] **Phase 3: Install Script**
  - [ ] Create `install.sh`
  - [ ] Test on macOS (arm64 + amd64)
  - [ ] Test on Linux (amd64 + arm64 if available)

- [ ] **Phase 4: Documentation**
  - [ ] Update README with installation instructions
  - [ ] Add badges (release version, etc.)

- [ ] **Phase 5: Homebrew (Optional)**
  - [ ] Create `ndraiman/homebrew-tap` repo
  - [ ] Add formula
  - [ ] Test `brew install`

---

## 9. Future Considerations

### gimme Integration
Consider adding this to [gimme](https://github.com/ndraiman/gimme) tool catalog for:
```bash
gimme trash
```

### Windows Support (v1.1+)
If adding Windows:
1. Use PowerShell: `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($path, 'OnlyErrorDialogs', 'SendToRecycleBin')`
2. Or CGO with Windows API
3. Add `trash-windows-amd64.exe` to build matrix

### Auto-Update Feature
Consider adding `trash --update` that downloads the latest binary in-place.

---

## Summary

| Component | Status | Effort |
|-----------|--------|--------|
| Build targets (4 platforms) | Planned | Low |
| GitHub Actions release workflow | Planned | Medium |
| Install script | Planned | Low |
| Homebrew formula | Optional | Low |
| README updates | Planned | Low |

**Total estimated effort:** ~2-3 hours for full implementation
