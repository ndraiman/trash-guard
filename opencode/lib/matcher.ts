export type Level = "normal" | "strict"

export type Result = {
  blocked: boolean
  reason?: string
  suggestion?: string
}

function tokenize(command: string): string[] {
  const tokens: string[] = []
  let current = ""
  let quote: "'" | '"' | null = null
  let escape = false

  const push = () => {
    if (current.length > 0) tokens.push(current)
    current = ""
  }

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!

    if (escape) {
      current += ch
      escape = false
      continue
    }

    if (ch === "\\" && quote !== "'") {
      escape = true
      continue
    }

    if (quote) {
      if (ch === quote) {
        quote = null
      } else {
        current += ch
      }
      continue
    }

    if (ch === "'" || ch === '"') {
      quote = ch
      continue
    }

    if (ch === " " || ch === "\t" || ch === "\n") {
      push()
      continue
    }

    current += ch
  }

  push()
  return tokens
}

function isShellAssignment(token: string) {
  // Very small heuristic: KEY=VALUE (with KEY starting with letter/_)
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)
}

function findCommand(tokens: string[]): { cmd?: string; cmdIndex: number } {
  let i = 0
  while (i < tokens.length && isShellAssignment(tokens[i]!)) i++
  if (i >= tokens.length) return { cmdIndex: i }

  if (tokens[i] === "sudo") {
    i++
    while (i < tokens.length && tokens[i]!.startsWith("-")) i++
  }

  return { cmd: tokens[i], cmdIndex: i }
}

function isWildcardArgument(arg: string) {
  // Keep this intentionally conservative: catch common globs.
  return /[\*\?\[]/.test(arg)
}

export function isDangerousDelete(command: string, level: Level): Result {
  const tokens = tokenize(command.trim())
  if (tokens.length === 0) return { blocked: false }

  const { cmd, cmdIndex } = findCommand(tokens)
  if (cmd !== "rm") return { blocked: false }

  const args = tokens.slice(cmdIndex + 1)

  let hasRecursive = false
  let hasForce = false
  let hasWildcard = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!

    if (arg === "--") {
      // Everything after -- is treated as a path/operand.
      for (const rest of args.slice(i + 1)) {
        if (isWildcardArgument(rest)) hasWildcard = true
      }
      break
    }

    if (arg.startsWith("--")) {
      if (arg === "--recursive") hasRecursive = true
      if (arg === "--force") hasForce = true
      continue
    }

    if (arg.startsWith("-") && arg !== "-") {
      // Short flags can be grouped: -rf, -fr, -r -f, etc.
      if (arg.includes("r") || arg.includes("R")) hasRecursive = true
      if (arg.includes("f")) hasForce = true
      continue
    }

    if (isWildcardArgument(arg)) hasWildcard = true
  }

  if (level === "normal") {
    if (hasRecursive && hasForce) {
      return {
        blocked: true,
        reason: "Detected a force+recursive delete (rm -rf)",
        suggestion: "Use a trash command instead of rm -rf",
      }
    }
    return { blocked: false }
  }

  // strict
  if (hasRecursive) {
    return {
      blocked: true,
      reason: "Detected a recursive delete (rm -r)",
      suggestion: "Use a trash command instead of rm -r",
    }
  }

  if (hasWildcard) {
    return {
      blocked: true,
      reason: "Detected a wildcard delete (rm *)",
      suggestion: "Use a trash command or be explicit about files",
    }
  }

  // (The -f + wildcard case is already covered by hasWildcard)
  return { blocked: false }
}
