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
