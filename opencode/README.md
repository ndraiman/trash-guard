# opencode-trash-guard

[![npm](https://img.shields.io/npm/v/opencode-trash-guard)](https://www.npmjs.com/package/opencode-trash-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An [OpenCode](https://opencode.ai) plugin that intercepts dangerous `rm -rf` commands and rewrites them to use `trash` for safer file deletion.

## Why?

`rm -rf` permanently deletes files with no recovery. `trash` moves files to the system Trash instead, allowing recovery if needed. This plugin protects you from accidental data loss when using AI coding agents.

## Installation

Add to your OpenCode config (`~/.config/opencode/opencode.json` or `.opencode/opencode.json`):

```json
{
  "plugin": ["opencode-trash-guard"]
}
```

## How it works

By default (rewrite mode), when the AI tries to run `rm -rf`, the plugin:

1. **Intercepts** the command before execution
2. **Rewrites** it to use `trash` instead
3. **Shows feedback** so the model learns to use `trash` directly

Works regardless of OpenCode's permission settings (even in auto-approve mode).

## Configuration

Set environment variables to customize behavior:

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `TRASH_GUARD_MODE` | `rewrite`, `deny` | `rewrite` | Rewrite to trash or block entirely |
| `TRASH_GUARD_LEVEL` | `normal`, `strict` | `normal` | What patterns to catch |
| `TRASH_GUARD_ALLOWLIST` | comma-separated | - | Patterns to skip (e.g., `node_modules,dist`) |
| `TRASH_GUARD_COMMAND` | path | `trash` | Custom trash binary |

### Detection levels

**normal** (default):
- `rm -rf <path>`
- `rm -fr <path>`
- `rm -r -f <path>`
- `rm --recursive --force <path>`

**strict** (catches more):
- All of the above
- `rm -r <path>` (recursive without force)
- `rm *`, `rm *.js` (wildcards)

## Trash Command

The plugin requires a `trash` command. Most systems have one:

| Platform | Command | Notes |
|----------|---------|-------|
| macOS 15+ | `/usr/bin/trash` | Built-in ✓ |
| Linux | `gio trash` | Pre-installed on most desktops |
| macOS <15 | `brew install trash` | Via Homebrew |

## Example

When the AI runs:
```bash
rm -rf ./old-build
```

The plugin rewrites it to:
```bash
trash ./old-build
```

And shows feedback:
```
⚠️ trash-guard: Rewrote destructive rm command to use trash
💡 Tip: Use 'trash <path>' directly for safer deletion
```

## License

MIT

## Links

- [GitHub](https://github.com/ndraiman/trash-guard)
- [OpenCode](https://opencode.ai)
