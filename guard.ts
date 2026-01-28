#!/usr/bin/env bun

export type RmMatch = {
  segment: string
  segmentIndex: number
  rmIndex: number
  sudoPrefix: string
  envPrefix: string
  paths: string[]
  hasDoubleDash: boolean
  isXargs: boolean
  isFindExec: boolean
}

type Token = {
  value: string
  quoted: "'" | '"' | null
}

function tokenize(command: string): Token[] {
  const tokens: Token[] = []
  let current = ""
  let quote: "'" | '"' | null = null
  let tokenQuote: "'" | '"' | null = null
  let escape = false

  const push = () => {
    if (current.length > 0) {
      tokens.push({ value: current, quoted: tokenQuote })
    }
    current = ""
    tokenQuote = null
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
      current += ch
      continue
    }

    if (quote) {
      current += ch
      if (ch === quote) {
        quote = null
      }
      continue
    }

    if (ch === "'" || ch === '"') {
      quote = ch
      tokenQuote = ch
      current += ch
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

function isShellAssignment(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)
}

const SUDO_FLAGS_WITH_ARG = new Set(["-u", "-g", "-C", "-h", "-p", "-r", "-t", "-U"])
const SUDO_FLAGS_NO_ARG = new Set([
  "-A", "-b", "-E", "-e", "-H", "-i", "-K", "-k", "-l", "-n", "-P", "-S", "-s", "-V", "-v"
])

function parseSudo(tokens: Token[], start: number): { end: number; prefix: string } {
  let i = start
  const parts: string[] = []

  if (tokens[i]?.value !== "sudo") {
    return { end: start, prefix: "" }
  }

  parts.push("sudo")
  i++

  while (i < tokens.length) {
    const tok = tokens[i]!.value
    if (SUDO_FLAGS_WITH_ARG.has(tok)) {
      parts.push(tok)
      i++
      if (i < tokens.length) {
        parts.push(tokens[i]!.value)
        i++
      }
    } else if (SUDO_FLAGS_NO_ARG.has(tok) || tok.startsWith("-")) {
      parts.push(tok)
      i++
    } else {
      break
    }
  }

  return { end: i, prefix: parts.join(" ") }
}

const RM_FLAGS = new Set([
  "-r", "-R", "-f", "-i", "-I", "-d", "-v", "--recursive", "--force",
  "--interactive", "--verbose", "--dir", "--one-file-system",
  "--no-preserve-root", "--preserve-root"
])

function isRmFlag(token: string): boolean {
  if (RM_FLAGS.has(token)) return true
  if (token.startsWith("--")) return false
  if (token.startsWith("-") && token !== "-") {
    // Short flags like -rf, -fr, etc.
    return /^-[rRfivdI]+$/.test(token)
  }
  return false
}

type Segment = {
  raw: string
  tokens: Token[]
  operator: string
}

function splitOnOperators(command: string): Segment[] {
  const segments: Segment[] = []
  let current = ""
  let quote: "'" | '"' | null = null
  let escape = false
  let lastOp = ""

  const push = (op: string) => {
    const trimmed = current.trim()
    if (trimmed) {
      segments.push({
        raw: trimmed,
        tokens: tokenize(trimmed),
        operator: lastOp,
      })
    }
    current = ""
    lastOp = op
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
      current += ch
      continue
    }

    if (quote) {
      current += ch
      if (ch === quote) {
        quote = null
      }
      continue
    }

    if (ch === "'" || ch === '"') {
      quote = ch
      current += ch
      continue
    }

    // Check for operators
    if (ch === "&" && command[i + 1] === "&") {
      push("&&")
      i++ // skip second &
      continue
    }

    if (ch === "|" && command[i + 1] === "|") {
      push("||")
      i++
      continue
    }

    if (ch === "|") {
      push("|")
      continue
    }

    if (ch === ";") {
      push(";")
      continue
    }

    current += ch
  }

  push("")
  return segments
}

function detectRmInSegment(
  segment: Segment,
  segmentIndex: number
): RmMatch | null {
  const { tokens, raw } = segment

  if (tokens.length === 0) return null

  let i = 0

  // Skip env var assignments
  const envParts: string[] = []
  while (i < tokens.length && isShellAssignment(tokens[i]!.value)) {
    envParts.push(tokens[i]!.value)
    i++
  }
  const envPrefix = envParts.join(" ")

  // Check for sudo
  const { end: sudoEnd, prefix: sudoPrefix } = parseSudo(tokens, i)
  i = sudoEnd

  if (i >= tokens.length) return null

  const cmd = tokens[i]!.value

  // Check for xargs rm pattern
  if (cmd === "xargs") {
    i++
    // Skip xargs flags
    while (i < tokens.length && tokens[i]!.value.startsWith("-")) {
      i++
    }
    if (i < tokens.length && tokens[i]!.value === "rm") {
      // Found xargs rm
      i++
      const paths: string[] = []
      let hasDoubleDash = false
      let afterDoubleDash = false

      while (i < tokens.length) {
        const tok = tokens[i]!
        if (!afterDoubleDash && tok.value === "--") {
          hasDoubleDash = true
          afterDoubleDash = true
          i++
          continue
        }
        if (!afterDoubleDash && isRmFlag(tok.value)) {
          i++
          continue
        }
        paths.push(tok.quoted ? `${tok.quoted}${tok.value.slice(1, -1)}${tok.quoted}` : tok.value)
        i++
      }

      return {
        segment: raw,
        segmentIndex,
        rmIndex: -1,
        sudoPrefix: "",
        envPrefix: "",
        paths,
        hasDoubleDash,
        isXargs: true,
        isFindExec: false,
      }
    }
    return null
  }

  // Check for find -exec rm pattern
  if (cmd === "find") {
    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j]!.value === "-exec" || tokens[j]!.value === "-execdir") {
        if (j + 1 < tokens.length && tokens[j + 1]!.value === "rm") {
          return {
            segment: raw,
            segmentIndex,
            rmIndex: j + 1,
            sudoPrefix: "",
            envPrefix: "",
            paths: [],
            hasDoubleDash: false,
            isXargs: false,
            isFindExec: true,
          }
        }
      }
    }
    return null
  }

  // Check for direct rm command
  if (cmd !== "rm") return null

  const rmIndex = i
  i++

  const paths: string[] = []
  let hasDoubleDash = false
  let afterDoubleDash = false

  while (i < tokens.length) {
    const tok = tokens[i]!
    if (!afterDoubleDash && tok.value === "--") {
      hasDoubleDash = true
      afterDoubleDash = true
      i++
      continue
    }
    if (!afterDoubleDash && isRmFlag(tok.value)) {
      i++
      continue
    }
    // It's a path - preserve original quoting
    if (tok.quoted) {
      paths.push(`${tok.quoted}${tok.value.slice(1, -1)}${tok.quoted}`)
    } else {
      paths.push(tok.value)
    }
    i++
  }

  // rm with no arguments is not dangerous
  if (paths.length === 0) return null

  return {
    segment: raw,
    segmentIndex,
    rmIndex,
    sudoPrefix,
    envPrefix,
    paths,
    hasDoubleDash,
    isXargs: false,
    isFindExec: false,
  }
}

export function detectRm(command: string): RmMatch[] {
  const segments = splitOnOperators(command)
  const matches: RmMatch[] = []

  for (let i = 0; i < segments.length; i++) {
    const match = detectRmInSegment(segments[i]!, i)
    if (match) {
      matches.push(match)
    }
  }

  return matches
}

function rewriteSegment(segment: Segment, match: RmMatch, trashCmd: string): string {
  const { tokens, raw } = segment

  if (match.isFindExec) {
    // For find -exec rm, replace rm and strip its flags
    let result = ""
    let i = 0
    let inExec = false
    let foundRm = false

    while (i < tokens.length) {
      const tok = tokens[i]!

      if (tok.value === "-exec" || tok.value === "-execdir") {
        inExec = true
        result += (result ? " " : "") + tok.value
        i++
        continue
      }

      if (inExec && !foundRm && tok.value === "rm") {
        result += " " + trashCmd
        foundRm = true
        i++
        // Skip rm flags
        while (i < tokens.length && isRmFlag(tokens[i]!.value)) {
          i++
        }
        continue
      }

      if (inExec && foundRm && (tok.value === "\\;" || tok.value === "+" || tok.value === ";")) {
        inExec = false
      }

      result += (result ? " " : "") + tok.value
      i++
    }

    return result
  }

  if (match.isXargs) {
    // For xargs rm, replace rm and strip its flags
    let result = ""
    let foundXargs = false
    let foundRm = false

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!

      if (tok.value === "xargs") {
        foundXargs = true
        result += (result ? " " : "") + tok.value
        continue
      }

      if (foundXargs && !foundRm && tok.value === "rm") {
        result += " " + trashCmd
        foundRm = true
        // Skip rm flags
        while (i + 1 < tokens.length && isRmFlag(tokens[i + 1]!.value)) {
          i++
        }
        continue
      }

      result += (result ? " " : "") + tok.value
    }

    return result
  }

  // Regular rm command
  const parts: string[] = []

  // Add env prefix
  if (match.envPrefix) {
    parts.push(match.envPrefix)
  }

  // Add sudo prefix
  if (match.sudoPrefix) {
    parts.push(match.sudoPrefix)
  }

  // Add trash command
  parts.push(trashCmd)

  // Add -- if there was one
  if (match.hasDoubleDash) {
    parts.push("--")
  }

  // Add paths
  parts.push(...match.paths)

  return parts.join(" ")
}

export function rewriteToTrash(command: string, trashCmd: string): string {
  const segments = splitOnOperators(command)
  const matches = detectRm(command)

  if (matches.length === 0) return command

  // Create a map of segmentIndex to match
  const matchMap = new Map<number, RmMatch>()
  for (const m of matches) {
    matchMap.set(m.segmentIndex, m)
  }

  const rewritten: string[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const match = matchMap.get(i)

    let part: string
    if (match) {
      part = rewriteSegment(seg, match, trashCmd)
    } else {
      part = seg.raw
    }

    if (i === 0) {
      rewritten.push(part)
    } else {
      // Format operator appropriately
      const op = seg.operator
      if (op === ";") {
        rewritten.push("; " + part)
      } else {
        rewritten.push(" " + op + " " + part)
      }
    }
  }

  return rewritten.join("")
}

// Hook integration - main entry point
async function main() {
  // Determine trash command based on platform
  const trashCmd = process.platform === "darwin" ? "trash" : "gio trash"

  // Read JSON input from stdin
  let input = ""
  for await (const chunk of Bun.stdin.stream()) {
    input += new TextDecoder().decode(chunk)
  }

  if (!input.trim()) {
    process.exit(0)
  }

  let data: { tool_input?: { command?: string } }
  try {
    data = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  const command = data.tool_input?.command
  if (!command) {
    process.exit(0)
  }

  const matches = detectRm(command)
  if (matches.length === 0) {
    process.exit(0)
  }

  // Rewrite and output
  const rewritten = rewriteToTrash(command, trashCmd)

  console.error(`REWRITE: Detected rm command. Rewriting to use '${trashCmd}' for safer deletion.`)
  console.error(`Original: ${command}`)
  console.error(`Rewritten: ${rewritten}`)

  // Output modified tool_input
  const output = {
    ...data,
    tool_input: {
      ...data.tool_input,
      command: rewritten,
    },
  }

  console.log(JSON.stringify(output))
  process.exit(0)
}

