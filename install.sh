#!/bin/bash
# trash-guard installer
# Installs the trash wrapper script

set -e

REPO="ndraiman/trash-guard"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
SCRIPT_URL="https://raw.githubusercontent.com/${REPO}/main/bin/trash"

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
error() { echo "[ERROR] $*" >&2; exit 1; }

# Check if native trash is available
check_native() {
    if [[ "$OSTYPE" == darwin* ]]; then
        if [[ -x /usr/bin/trash ]]; then
            info "macOS 15+ detected - built-in trash command available!"
            info "You don't need to install anything. Just use: trash <file>"
            read -p "Install wrapper anyway? (y/N) " -n 1 -r
            echo
            [[ $REPLY =~ ^[Yy]$ ]] || exit 0
        fi
    elif [[ "$OSTYPE" == linux* ]]; then
        if command -v gio &>/dev/null; then
            info "Linux detected - gio trash available!"
            info "You can use: gio trash <file>"
            read -p "Install wrapper for consistent 'trash' command? (y/N) " -n 1 -r
            echo
            [[ $REPLY =~ ^[Yy]$ ]] || exit 0
        fi
    fi
}

install_wrapper() {
    info "Downloading trash wrapper..."
    
    TMP_FILE=$(mktemp)
    curl -fsSL "$SCRIPT_URL" -o "$TMP_FILE" || error "Download failed"
    chmod +x "$TMP_FILE"
    
    info "Installing to ${INSTALL_DIR}/trash..."
    
    if [[ -w "$INSTALL_DIR" ]]; then
        mv "$TMP_FILE" "${INSTALL_DIR}/trash"
    else
        warn "Need sudo to install to ${INSTALL_DIR}"
        sudo mv "$TMP_FILE" "${INSTALL_DIR}/trash"
    fi
    
    info "✓ trash wrapper installed successfully!"
    info "Run 'trash --help' to verify (on macOS) or 'trash file.txt' to test."
}

main() {
    info "trash-guard installer"
    check_native
    install_wrapper
}

main "$@"
