---
name: trash-guard
description: Blocks dangerous `rm -rf` commands and suggests using `trash` for safer file deletion. Prevents accidental permanent data loss by intercepting destructive delete patterns.
---

# trash-guard

A skill that protects against accidental permanent file deletion by blocking dangerous `rm -rf` commands and suggesting safer alternatives.

## When to Use

This skill is automatically active and should be used:
- Before executing any bash command that could delete files
- When you encounter `rm -rf`, `rm -fr`, or similar destructive patterns
- When working with file cleanup or directory removal tasks

## What it Blocks

Detection level defaults to **strict** (catches more patterns).

The following patterns are blocked and should be replaced with `trash`:

- `rm -rf <path>`
- `rm -fr <path>`
- `rm -r -f <path>`
- `rm -f -r <path>`
- `rm --recursive --force <path>`
- `rm --force --recursive <path>`
- Mixed variants like `rm -r --force` or `rm --recursive -f`

## Recommended Alternative

Instead of permanently deleting files, use the `trash` command:

```bash
# Instead of: rm -rf folder/
trash folder/

# Instead of: rm -rf file1.txt file2.txt
trash file1.txt file2.txt
```

## Platform Support

- **macOS 15+**: Built-in `trash` command at `/usr/bin/trash`
- **Linux**: Uses `gio trash` if available (part of GLib)
- **Fallback**: Install the trash-guard CLI for cross-platform support

## Installation

For the full Claude Code plugin with automatic interception:

```bash
/plugin marketplace add ndraiman/trash-guard
/plugin install trash-guard@ndraiman-trash-guard
```

## Why This Matters

- `rm -rf` permanently deletes files with **no recovery option**
- `trash` moves files to system Trash, allowing recovery if needed
- Prevents catastrophic data loss from typos or wrong paths
