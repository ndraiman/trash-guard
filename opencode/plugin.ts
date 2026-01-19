import type { Plugin } from "@opencode-ai/plugin"

import { isDangerousDelete, type Level } from "./lib/matcher"

type Mode = "deny" | "rewrite"

type Config = {
  mode: Mode
  level: Level
  allowlist: string[]
  trashCommand: string
}

function parseMode(value: string | undefined): Mode {
  return value === "deny" ? "deny" : "rewrite"
}

function parseLevel(value: string | undefined): Level {
  return value === "normal" ? "normal" : "strict"
}

function parseAllowlist(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|\\]/g, "\\$&")
  const re = escaped
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")
    .replace(/\[/g, "\\[")
  return new RegExp(`^${re}$`)
}

function isAllowlisted(command: string, allowlist: string[]) {
  if (allowlist.length === 0) return false
  return allowlist.some((pattern) => {
    try {
      return globToRegExp(pattern).test(command)
    } catch {
      return false
    }
  })
}

function tokenizeSimple(command: string) {
  return command
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function rewriteRmToTrash(command: string, trashCommand: string): string | undefined {
  const tokens = tokenizeSimple(command)
  if (tokens.length === 0) return

  let cmdIndex = 0
  if (tokens[0] === "sudo") {
    cmdIndex = 1
    while (cmdIndex < tokens.length && tokens[cmdIndex]!.startsWith("-")) cmdIndex++
  }
  if (tokens[cmdIndex] !== "rm") return

  const targets: string[] = []
  let afterDoubleDash = false
  for (const token of tokens.slice(cmdIndex + 1)) {
    if (afterDoubleDash) {
      targets.push(token)
      continue
    }

    if (token === "--") {
      afterDoubleDash = true
      continue
    }

    if (token.startsWith("-")) {
      continue
    }

    targets.push(token)
  }

  if (targets.length === 0) return

  const prefix = tokens[0] === "sudo" ? ["sudo"] : []
  return [...prefix, trashCommand, ...targets].join(" ")
}

function detectTrashCommand(): string {
  // User override takes priority
  if (process.env.TRASH_GUARD_COMMAND) {
    return process.env.TRASH_GUARD_COMMAND
  }

  // Platform-specific defaults
  if (process.platform === "darwin") {
    return "trash" // macOS 15+ has /usr/bin/trash, older versions need brew install trash
  }

  if (process.platform === "linux") {
    return "gio trash" // Pre-installed on most Linux desktops (GNOME, etc.)
  }

  // Fallback
  return "trash"
}

function getConfig(): Config {
  return {
    mode: parseMode(process.env.TRASH_GUARD_MODE),
    level: parseLevel(process.env.TRASH_GUARD_LEVEL),
    allowlist: parseAllowlist(process.env.TRASH_GUARD_ALLOWLIST),
    trashCommand: detectTrashCommand(),
  }
}

export const TrashGuardPlugin: Plugin = async () => {
  const config = getConfig()

  return {
    async "permission.ask"(input, output) {
      if (config.mode !== "deny") return
      if (input.type !== "bash") return
      const command: string | undefined = input.metadata?.command
      if (!command) return

      if (isAllowlisted(command, config.allowlist)) return

      const result = isDangerousDelete(command, config.level)
      if (!result.blocked) return

      output.status = "deny"
    },

    async "tool.execute.before"(input, output) {
      if (input.tool !== "bash") return

      const args = output.args as { command?: string }
      const command = args.command
      if (!command) return

      if (isAllowlisted(command, config.allowlist)) return

      const result = isDangerousDelete(command, config.level)
      if (!result.blocked) return

      if (config.mode === "deny") {
        throw new Error(
          `[trash-guard] Blocked dangerous command: ${command}\nReason: ${result.reason}\nSuggestion: ${result.suggestion || `Use '${config.trashCommand}' instead of 'rm -rf'`}`,
        )
      }

      const rewritten = rewriteRmToTrash(command, config.trashCommand)
      if (rewritten) {
        const note = `[trash-guard] Rewrote '${command}' to '${rewritten}'. Please use '${config.trashCommand} <path>' instead of 'rm -rf' for safe deletion.`
        args.command = `echo ${JSON.stringify(note)} && ${rewritten}`
      }
    },
  }
}

export default TrashGuardPlugin
