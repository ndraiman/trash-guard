# trash-guard

[![Release](https://img.shields.io/github/v/release/ndraiman/trash-guard?label=release)](https://github.com/ndraiman/trash-guard/releases)
[![Test](https://github.com/ndraiman/trash-guard/actions/workflows/test.yml/badge.svg)](https://github.com/ndraiman/trash-guard/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that blocks dangerous `rm -rf` commands and suggests using the `trash` CLI for safer file deletion.

**Now includes a built-in cross-platform `trash` CLI!**

## Why?

`rm -rf` permanently deletes files with no way to recover them. The `trash` CLI moves files to the system Trash instead, allowing recovery if needed.

This plugin intercepts bash commands before execution and blocks any that contain dangerous recursive+force delete patterns.

## Installation

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/install.sh | bash
```

Install a specific version:
```bash
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/install.sh | VERSION=v1.0.0 bash
```

Install to custom directory (no sudo needed):
```bash
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/install.sh | INSTALL_DIR=~/.local/bin bash
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

### Go Install

```bash
go install github.com/ndraiman/trash-guard/cli@latest
# Rename the binary
mv $(go env GOPATH)/bin/cli $(go env GOPATH)/bin/trash
```

## Trash CLI

This repo includes a cross-platform `trash` CLI written in Go that moves files to the system Trash instead of permanently deleting them.

### Supported Platforms

- **macOS**: Uses `~/.Trash` folder
- **Linux**: Uses freedesktop.org trash spec (`~/.local/share/Trash`)

### Usage

```bash
# Move a single file to trash
trash file.txt

# Move a folder to trash
trash folder/

# Move multiple items to trash
trash file1.txt file2.txt folder/

# Show help
trash --help

# Show version
trash --version
```

### Features

- ✅ Cross-platform (macOS and Linux)
- ✅ Handles name conflicts (appends counter if file exists in trash)
- ✅ Linux: Creates `.trashinfo` files per freedesktop.org spec
- ✅ Handles cross-device moves (copy + delete fallback)
- ✅ Proper error handling and helpful messages

## Claude Code Plugin Installation

### Prerequisites

Install the `trash` CLI using one of the methods above (the quick install is recommended).

### Install the Plugin

Using Claude Code's plugin system:

```bash
# From the official marketplace (when available)
claude plugin install trash-guard

# Or from GitHub directly
claude plugin install --url https://github.com/ndraiman/trash-guard
```

## What it Blocks

The plugin blocks these patterns:

- `rm -rf <path>`
- `rm -fr <path>`
- `rm -r -f <path>`
- `rm -f -r <path>`
- `rm --recursive --force <path>`
- `rm --force --recursive <path>`
- Mixed variants like `rm -r --force` or `rm --recursive -f`

## Using trash CLI

The `trash` command works just like `rm` but moves to Trash:

```bash
# Instead of: rm -rf folder/
trash folder/

# Instead of: rm -rf file.txt
trash file.txt

# Multiple items
trash file1.txt file2.txt folder/
```

Recover files by opening Trash and restoring them.

## Manual Setup (Alternative)

If you prefer not to use the plugin system, add this to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/trash-guard.sh"
          }
        ]
      }
    ]
  }
}
```

And add to your `CLAUDE.md`:

```markdown
## REQUIRED

- **NEVER use `rm -rf`** - it's blocked by the trash-guard hook for safety
- Use `trash` instead: `trash folder-name` or `trash file.txt`
  - Works exactly like `rm -rf` but moves to Trash instead of permanent deletion
```

## License

MIT
