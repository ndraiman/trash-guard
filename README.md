# trash-guard

[![Release](https://img.shields.io/github/v/release/ndraiman/trash-guard?label=release)](https://github.com/ndraiman/trash-guard/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A coding agent plugin that blocks dangerous `rm -rf` commands and suggests using `trash` for safer file deletion.

## Why?

`rm -rf` permanently deletes files with no recovery. `trash` moves files to the system Trash instead, allowing recovery if needed.

## Installation

### Using add-skill (Recommended)

```bash
npx add-skill ndraiman/trash-guard
```

Works with: [Claude Code](https://docs.anthropic.com/en/docs/claude-code) • [OpenCode](https://opencode.ai) • [Codex](https://openai.com/codex) • [Cursor](https://cursor.com)

### Manual (Claude Code)

```bash
git clone https://github.com/ndraiman/trash-guard.git ~/.claude-plugins/trash-guard
claude --plugin-dir ~/.claude-plugins/trash-guard
```

## What it Blocks

- `rm -rf <path>`
- `rm -fr <path>` 
- `rm -r -f <path>`
- `rm --recursive --force <path>`
- Mixed variants like `rm -r --force`

## Trash Command

The plugin requires a `trash` command. Most systems have one:

| Platform | Command | Notes |
|----------|---------|-------|
| macOS 15+ | `/usr/bin/trash` | Built-in ✓ |
| Linux | `gio trash` | Pre-installed on most desktops |
| macOS <15 / Linux (no gio) | Install wrapper | No built-in trash |

### Wrapper Script (Optional)

For a consistent `trash` command across platforms:

```bash
curl -fsSL https://raw.githubusercontent.com/ndraiman/trash-guard/main/install.sh | bash
```

Delegates to native commands (macOS built-in, `gio trash`) or suggests installing our CLI as fallback.

## License

MIT
