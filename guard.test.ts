import { describe, expect, test } from "bun:test"
import { detectRm, rewriteToTrash, type RmMatch } from "./guard"

describe("detectRm - basic rm detection", () => {
  const cases: Array<[string, boolean]> = [
    ["rm file", true],
    ["rm -rf dir", true],
    ["rm -r dir", true],
    ["rm -f file", true],
    ["rm", false], // no args
    ["ls", false],
    ["echo rm", false],
    ["grep rm file", false],
  ]

  for (const [cmd, shouldMatch] of cases) {
    test(cmd || "(empty)", () => {
      const matches = detectRm(cmd)
      expect(matches.length > 0).toBe(shouldMatch)
    })
  }
})

describe("detectRm - sudo variants", () => {
  const cases: Array<[string, boolean]> = [
    ["sudo rm file", true],
    ["sudo -u root rm file", true],
    ["sudo -n rm -rf dir", true],
    ["sudo -E rm file", true],
  ]

  for (const [cmd, shouldMatch] of cases) {
    test(cmd, () => {
      const matches = detectRm(cmd)
      expect(matches.length > 0).toBe(shouldMatch)
    })
  }
})

describe("detectRm - env var prefix", () => {
  const cases: Array<[string, boolean]> = [
    ["FOO=bar rm file", true],
    ["A=1 B=2 rm -rf dir", true],
    ["PATH=/bin rm file", true],
  ]

  for (const [cmd, shouldMatch] of cases) {
    test(cmd, () => {
      const matches = detectRm(cmd)
      expect(matches.length > 0).toBe(shouldMatch)
    })
  }
})

describe("detectRm - quoted arguments", () => {
  test('rm "my file" preserves quotes', () => {
    const matches = detectRm('rm "my file"')
    expect(matches.length).toBe(1)
    expect(matches[0]!.paths).toContain('"my file"')
  })

  test("rm 'my file' preserves quotes", () => {
    const matches = detectRm("rm 'my file'")
    expect(matches.length).toBe(1)
    expect(matches[0]!.paths).toContain("'my file'")
  })

  test('rm "foo bar" baz preserves structure', () => {
    const matches = detectRm('rm "foo bar" baz')
    expect(matches.length).toBe(1)
    expect(matches[0]!.paths).toContain('"foo bar"')
    expect(matches[0]!.paths).toContain("baz")
  })
})

describe("detectRm - double dash", () => {
  test("rm -- -weird treats -weird as file", () => {
    const matches = detectRm("rm -- -weird")
    expect(matches.length).toBe(1)
    expect(matches[0]!.paths).toContain("-weird")
  })

  test("rm -rf -- -foo treats -foo as file", () => {
    const matches = detectRm("rm -rf -- -foo")
    expect(matches.length).toBe(1)
    expect(matches[0]!.paths).toContain("-foo")
  })
})

describe("detectRm - shell operators", () => {
  test("cd foo && rm file matches rm in segment 2", () => {
    const matches = detectRm("cd foo && rm file")
    expect(matches.length).toBe(1)
  })

  test("cd foo; rm file matches", () => {
    const matches = detectRm("cd foo; rm file")
    expect(matches.length).toBe(1)
  })

  test("cmd || rm file matches", () => {
    const matches = detectRm("cmd || rm file")
    expect(matches.length).toBe(1)
  })

  test("rm a && rm b matches both", () => {
    const matches = detectRm("rm a && rm b")
    expect(matches.length).toBe(2)
  })
})

describe("detectRm - pipes with xargs", () => {
  test("echo x | xargs rm matches", () => {
    const matches = detectRm("echo x | xargs rm")
    expect(matches.length).toBe(1)
  })

  test("ls | xargs rm -rf matches", () => {
    const matches = detectRm("ls | xargs rm -rf")
    expect(matches.length).toBe(1)
  })

  test("find . | xargs rm matches", () => {
    const matches = detectRm("find . | xargs rm")
    expect(matches.length).toBe(1)
  })
})

describe("detectRm - find -exec", () => {
  test("find . -exec rm {} \\; matches", () => {
    const matches = detectRm("find . -exec rm {} \\;")
    expect(matches.length).toBe(1)
  })

  test("find . -exec rm -rf {} + matches", () => {
    const matches = detectRm("find . -exec rm -rf {} +")
    expect(matches.length).toBe(1)
  })
})

describe("rewriteToTrash - basic rewrites", () => {
  test("rm file → trash file", () => {
    expect(rewriteToTrash("rm file", "trash")).toBe("trash file")
  })

  test("rm -rf dir → trash dir", () => {
    expect(rewriteToTrash("rm -rf dir", "trash")).toBe("trash dir")
  })

  test("rm -r -f dir → trash dir", () => {
    expect(rewriteToTrash("rm -r -f dir", "trash")).toBe("trash dir")
  })

  test("rm file1 file2 → trash file1 file2", () => {
    expect(rewriteToTrash("rm file1 file2", "trash")).toBe("trash file1 file2")
  })
})

describe("rewriteToTrash - preserves sudo", () => {
  test("sudo rm file → sudo trash file", () => {
    expect(rewriteToTrash("sudo rm file", "trash")).toBe("sudo trash file")
  })

  test("sudo -u root rm file → sudo -u root trash file", () => {
    expect(rewriteToTrash("sudo -u root rm file", "trash")).toBe(
      "sudo -u root trash file"
    )
  })

  test("sudo -n rm -rf dir → sudo -n trash dir", () => {
    expect(rewriteToTrash("sudo -n rm -rf dir", "trash")).toBe(
      "sudo -n trash dir"
    )
  })
})

describe("rewriteToTrash - preserves env vars", () => {
  test("FOO=bar rm file → FOO=bar trash file", () => {
    expect(rewriteToTrash("FOO=bar rm file", "trash")).toBe("FOO=bar trash file")
  })

  test("A=1 B=2 rm dir → A=1 B=2 trash dir", () => {
    expect(rewriteToTrash("A=1 B=2 rm dir", "trash")).toBe("A=1 B=2 trash dir")
  })
})

describe("rewriteToTrash - preserves quotes", () => {
  test('rm "my file" → trash "my file"', () => {
    expect(rewriteToTrash('rm "my file"', "trash")).toBe('trash "my file"')
  })

  test("rm 'my file' → trash 'my file'", () => {
    expect(rewriteToTrash("rm 'my file'", "trash")).toBe("trash 'my file'")
  })
})

describe("rewriteToTrash - shell operators", () => {
  test("cd foo && rm file → cd foo && trash file", () => {
    expect(rewriteToTrash("cd foo && rm file", "trash")).toBe(
      "cd foo && trash file"
    )
  })

  test("rm a && rm b → trash a && trash b", () => {
    expect(rewriteToTrash("rm a && rm b", "trash")).toBe("trash a && trash b")
  })

  test("cd foo; rm file → cd foo; trash file", () => {
    expect(rewriteToTrash("cd foo; rm file", "trash")).toBe(
      "cd foo; trash file"
    )
  })
})

describe("rewriteToTrash - xargs", () => {
  test("echo x | xargs rm → echo x | xargs trash", () => {
    expect(rewriteToTrash("echo x | xargs rm", "trash")).toBe(
      "echo x | xargs trash"
    )
  })

  test("ls | xargs rm -rf → ls | xargs trash", () => {
    expect(rewriteToTrash("ls | xargs rm -rf", "trash")).toBe(
      "ls | xargs trash"
    )
  })
})

describe("rewriteToTrash - find -exec", () => {
  test("find . -exec rm {} \\; → find . -exec trash {} \\;", () => {
    expect(rewriteToTrash("find . -exec rm {} \\;", "trash")).toBe(
      "find . -exec trash {} \\;"
    )
  })

  test("find . -exec rm -rf {} + → find . -exec trash {} +", () => {
    expect(rewriteToTrash("find . -exec rm -rf {} +", "trash")).toBe(
      "find . -exec trash {} +"
    )
  })
})

describe("rewriteToTrash - double dash", () => {
  test("rm -- -weird → trash -- -weird", () => {
    expect(rewriteToTrash("rm -- -weird", "trash")).toBe("trash -- -weird")
  })

  test("rm -rf -- -foo → trash -- -foo", () => {
    expect(rewriteToTrash("rm -rf -- -foo", "trash")).toBe("trash -- -foo")
  })
})

describe("e2e - hook flow", () => {
  test("rewrites rm command in tool_input", () => {
    const input = { tool_input: { command: "rm -rf foo" } }
    const command = input.tool_input.command
    const matches = detectRm(command)
    expect(matches.length).toBeGreaterThan(0)
    const rewritten = rewriteToTrash(command, "trash")
    const output = { ...input, tool_input: { ...input.tool_input, command: rewritten } }
    expect(output.tool_input.command).toBe("trash foo")
  })

  test("preserves other tool_input fields", () => {
    const input = { tool_input: { command: "rm file", description: "test" } }
    const command = input.tool_input.command
    const matches = detectRm(command)
    expect(matches.length).toBeGreaterThan(0)
    const rewritten = rewriteToTrash(command, "trash")
    const output = { ...input, tool_input: { ...input.tool_input, command: rewritten } }
    expect(output.tool_input.description).toBe("test")
  })

  test("no match for non-rm commands", () => {
    const input = { tool_input: { command: "ls -la" } }
    const matches = detectRm(input.tool_input.command)
    expect(matches.length).toBe(0)
  })

  test("no match for empty command", () => {
    const matches = detectRm("")
    expect(matches.length).toBe(0)
  })

  test("no match for whitespace-only command", () => {
    const matches = detectRm("   ")
    expect(matches.length).toBe(0)
  })

  test("rewriteToTrash returns original when no rm", () => {
    const command = "ls -la"
    const rewritten = rewriteToTrash(command, "trash")
    expect(rewritten).toBe(command)
  })

  test("handles sudo rm", () => {
    const input = { tool_input: { command: "sudo rm -rf bar" } }
    const command = input.tool_input.command
    const matches = detectRm(command)
    expect(matches.length).toBeGreaterThan(0)
    const rewritten = rewriteToTrash(command, "trash")
    const output = { ...input, tool_input: { ...input.tool_input, command: rewritten } }
    expect(output.tool_input.command).toBe("sudo trash bar")
  })

  test("handles chained commands", () => {
    const input = { tool_input: { command: "cd dir && rm -rf stuff" } }
    const command = input.tool_input.command
    const matches = detectRm(command)
    expect(matches.length).toBeGreaterThan(0)
    const rewritten = rewriteToTrash(command, "trash")
    const output = { ...input, tool_input: { ...input.tool_input, command: rewritten } }
    expect(output.tool_input.command).toBe("cd dir && trash stuff")
  })
})
