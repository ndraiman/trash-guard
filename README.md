# trash-guard

[![Release](https://img.shields.io/github/v/release/ndraiman/trash-guard?label=release)](https://github.com/ndraiman/trash-guard/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that blocks dangerous `rm -rf` commands and suggests using `trash` for safer file deletion.

## Why?

`rm -rf` permanently deletes files with no way to recover them. The `trash` command moves files to the system Trash instead, allowing recovery if needed.

This plugin intercepts bash commands before execution and blocks any that contain dangerous recursive+force delete patterns.

## Platform Support

### macOS 15+ (Sequoia)

macOS 15 introduced a **built-in `trash` command** at `/usr/bin/trash`. No installation needed!

```bash
# Built-in - works out of the box
trash file.txt
trash folder/
trash file1.txt file2.txt folder/
```

For older macOS versions, install our CLI:
```bash
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/install.sh | bash
```

### Linux

Most desktop Linux distributions include **`gio trash`** (part of GLib). If available, our wrapper uses it automatically.

If `gio` is not available, install our CLI:
```bash
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/install.sh | bash
```

Our CLI provides:
- Cross-platform support (macOS and Linux)
- Freedesktop.org trash spec compliance on Linux
- Handles name conflicts (appends counter if file exists in trash)
- Cross-device moves (copy + delete fallback)

## Wrapper Script

For a consistent `trash` command that delegates to the right tool:

```bash
# Download wrapper
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/bin/trash -o ~/.local/bin/trash
chmod +x ~/.local/bin/trash

# Make sure ~/.local/bin is in your PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

The wrapper automatically delegates to:
- **macOS 15+**: `/usr/bin/trash` (built-in)
- **Linux**: `gio trash` (if available)
- **Fallback**: Suggests installing our CLI

## Claude Code Plugin

### Prerequisites

Ensure you have a working `trash` command:
- **macOS 15+**: Built-in ✓
- **macOS <15**: Install our CLI (see above)
- **Linux**: `gio trash` or install our CLI

### Install the Plugin

**Marketplace (recommended):**
```
/plugin marketplace add ndraiman/trash-guard
/plugin install trash-guard@ndraiman-trash-guard
```

**Development/testing:**
```bash
git clone https://github.com/ndraiman/trash-guard.git ~/.claude-plugins/trash-guard
claude --plugin-dir ~/.claude-plugins/trash-guard
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
            "command": "/path/to/trash-guard/hooks/pre-tool-use.sh"
          }
        ]
      }
    ]
  }
}
```

## License

MIT
