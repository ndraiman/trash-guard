# trash-guard

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that blocks dangerous `rm -rf` commands and suggests using the `trash` CLI for safer file deletion.

**Now includes a built-in cross-platform `trash` CLI!**

## Why?

`rm -rf` permanently deletes files with no way to recover them. The `trash` CLI moves files to the system Trash instead, allowing recovery if needed.

This plugin intercepts bash commands before execution and blocks any that contain dangerous recursive+force delete patterns.

## Trash CLI

This repo includes a cross-platform `trash` CLI written in Go that moves files to the system Trash instead of permanently deleting them.

### Supported Platforms

- **macOS**: Uses `~/.Trash` folder
- **Linux**: Uses freedesktop.org trash spec (`~/.local/share/Trash`)

### Installation

#### Option 1: Build from Source (Recommended)

```bash
# Clone the repo
git clone https://github.com/ndraiman/trash-guard
cd trash-guard/cli

# Build
go build -o trash .

# Install to your PATH (example: /usr/local/bin)
sudo mv trash /usr/local/bin/
```

#### Option 2: Go Install

```bash
go install github.com/ndraiman/trash-guard/cli@latest
# Rename the binary
mv $(go env GOPATH)/bin/cli $(go env GOPATH)/bin/trash
```

#### Option 3: Homebrew (macOS only)

Alternatively, on macOS you can use the Homebrew version:

```bash
brew install trash
```

> **Note:** The built-in Go CLI is recommended as it's cross-platform and maintained alongside this plugin.

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

Install the `trash` CLI using one of the methods above (building from source is recommended).

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
