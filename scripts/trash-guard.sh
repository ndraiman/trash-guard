#!/bin/bash
# trash-guard.sh - Block dangerous rm commands in Claude Code
# Suggests using 'trash' CLI for safer file deletion

# Read JSON input from stdin
input=$(cat)

# Extract the command from tool_input
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# If no command found, allow (not a bash command we care about)
if [[ -z "$command" ]]; then
  exit 0
fi

# Patterns to block:
# - rm -rf, rm -fr (combined flags)
# - rm -r -f, rm -f -r (separate flags)
# - rm --recursive --force, rm --force --recursive
# - rm -r --force, rm --recursive -f, etc.

# Check for dangerous rm patterns
if echo "$command" | grep -qE 'rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*)\s'; then
  echo "BLOCKED: 'rm -rf' detected. Use 'trash' instead for safer deletion." >&2
  echo "Install with: brew install trash" >&2
  echo "Usage: trash <file-or-folder>" >&2
  exit 2
fi

if echo "$command" | grep -qE 'rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*)$'; then
  echo "BLOCKED: 'rm -rf' detected. Use 'trash' instead for safer deletion." >&2
  echo "Install with: brew install trash" >&2
  echo "Usage: trash <file-or-folder>" >&2
  exit 2
fi

# Check for separate flags: rm -r -f or rm -f -r
if echo "$command" | grep -qE 'rm\s+.*-r\s+.*-f|rm\s+.*-f\s+.*-r'; then
  echo "BLOCKED: 'rm -r -f' detected. Use 'trash' instead for safer deletion." >&2
  echo "Install with: brew install trash" >&2
  echo "Usage: trash <file-or-folder>" >&2
  exit 2
fi

# Check for long flags: --recursive --force
if echo "$command" | grep -qE 'rm\s+.*--recursive.*--force|rm\s+.*--force.*--recursive'; then
  echo "BLOCKED: 'rm --recursive --force' detected. Use 'trash' instead for safer deletion." >&2
  echo "Install with: brew install trash" >&2
  echo "Usage: trash <file-or-folder>" >&2
  exit 2
fi

# Check for mixed: -r --force, --recursive -f
if echo "$command" | grep -qE 'rm\s+.*-r.*--force|rm\s+.*--force.*-r|rm\s+.*--recursive.*-f|rm\s+.*-f.*--recursive'; then
  echo "BLOCKED: Dangerous rm with recursive and force flags detected. Use 'trash' instead." >&2
  echo "Install with: brew install trash" >&2
  echo "Usage: trash <file-or-folder>" >&2
  exit 2
fi

# Command is safe, allow it
exit 0
