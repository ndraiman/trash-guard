# trash-guard

[![Release](https://img.shields.io/github/v/release/ndraiman/trash-guard?label=release)](https://github.com/ndraiman/trash-guard/releases)
[![npm](https://img.shields.io/npm/v/opencode-trash-guard?label=opencode)](https://www.npmjs.com/package/opencode-trash-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A coding agent plugin that blocks dangerous `rm -rf` commands and suggests using `trash` for safer file deletion.

## Why?

`rm -rf` permanently deletes files with no recovery. `trash` moves files to the system Trash instead, allowing recovery if needed.

## Installation

### Plugin Marketplace (Recommended)

```bash
/plugin marketplace add ndraiman/trash-guard
/plugin install trash-guard@ndraiman-trash-guard
```

### Manual (Claude Code)

```bash
git clone https://github.com/ndraiman/trash-guard.git ~/.claude-plugins/trash-guard
claude --plugin-dir ~/.claude-plugins/trash-guard
```

### Using add-skill (Skill Only - No Hooks)

```bash
npx add-skill ndraiman/trash-guard
```

Works with: [Claude Code](https://docs.anthropic.com/en/docs/claude-code) • [OpenCode](https://opencode.ai) • [Codex](https://openai.com/codex) • [Cursor](https://cursor.com)

**Note**: This installs the skill documentation only and does not include the protective hooks.

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

## OpenCode Plugin

trash-guard can be used as an [OpenCode](https://opencode.ai) plugin to protect against destructive `rm` commands.

### Installation

**Option 1: npm package** (recommended)

Add to your OpenCode config (`~/.config/opencode/opencode.json` or `.opencode/opencode.json`):

```json
{
  "plugin": ["opencode-trash-guard"]
}
```

**Option 2: Local plugin**

Copy `opencode/plugin.ts` and `opencode/lib/` to `.opencode/plugin/` in your project.

### How it works

By default (rewrite mode), when you or the AI tries to run `rm -rf`, the plugin:
1. Rewrites the command to use `trash` instead
2. Shows feedback so the model learns to use `trash` directly

### Configuration

Set environment variables to customize:

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `TRASH_GUARD_MODE` | `rewrite`, `deny` | `rewrite` | Rewrite to trash or block entirely |
| `TRASH_GUARD_LEVEL` | `normal`, `strict` | `strict` | What patterns to catch |
| `TRASH_GUARD_ALLOWLIST` | comma-separated | - | Patterns to skip |
| `TRASH_GUARD_COMMAND` | path | `trash` | Custom trash binary |

### Detection levels

- **strict** (default): `rm -rf`, `rm -fr`, `rm --recursive --force`, plus `rm -r`, `rm *`, wildcards
- **normal**: Only `rm -rf`, `rm -fr`, `rm --recursive --force`
