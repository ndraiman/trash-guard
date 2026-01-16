#!/bin/bash
# trash-guard wrapper installer
# Installs the wrapper script that delegates to native trash commands

set -e

REPO="ndraiman/trash-guard"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
WRAPPER_URL="https://raw.githubusercontent.com/${REPO}/main/bin/trash"

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
error() { echo "[ERROR] $*" >&2; exit 1; }

main() {
    info "Installing trash-guard wrapper..."
    
    TMP_FILE=$(mktemp)
    
    info "Downloading wrapper script..."
    curl -fsSL "$WRAPPER_URL" -o "$TMP_FILE" || error "Download failed"
    chmod +x "$TMP_FILE"
    
    info "Installing to ${INSTALL_DIR}/trash..."
    
    if [[ -w "$INSTALL_DIR" ]]; then
        mv "$TMP_FILE" "${INSTALL_DIR}/trash"
    else
        warn "Need sudo to install to ${INSTALL_DIR}"
        sudo mv "$TMP_FILE" "${INSTALL_DIR}/trash"
    fi
    
    info "✓ trash-guard wrapper installed!"
    
    # Show what it delegates to
    if [[ "$OSTYPE" == darwin* ]] && [[ -x /usr/bin/trash ]]; then
        info "Will use: /usr/bin/trash (macOS built-in)"
    elif [[ "$OSTYPE" == linux* ]] && command -v gio &>/dev/null; then
        info "Will use: gio trash"
    else
        warn "No native trash command found."
        info "Install CLI: curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install-cli.sh | bash"
    fi
}

main "$@"
