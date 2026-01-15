# trash-guard

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that blocks dangerous `rm -rf` commands and suggests using the `trash` CLI for safer file deletion.

## Why?

`rm -rf` permanently deletes files with no way to recover them. The `trash` CLI moves files to the system Trash instead, allowing recovery if needed.

This plugin intercepts bash commands before execution and blocks any that contain dangerous recursive+force delete patterns.

## Installation

### Prerequisites

Install the `trash` CLI:

```bash
brew install trash
```

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
