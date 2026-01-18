import { describe, expect, test } from "bun:test"

import { isDangerousDelete } from "./matcher"

describe("isDangerousDelete (normal)", () => {
  const cases: Array<[string, boolean]> = [
    ["", false],
    ["echo rm -rf /", false],

    ["rm -rf foo", true],
    ["rm -fr foo", true],
    ["rm -r -f foo", true],
    ["rm -f -r foo", true],
    ["rm --recursive --force foo", true],
    ["rm --force --recursive foo", true],
    ["rm -rf -- foo", true],

    ["rm -r foo", false],
    ["rm --recursive foo", false],
    ["rm -f foo", false],
    ["rm *", false],
    ["rm foo/*", false],
  ]

  for (const [command, expectedBlocked] of cases) {
    test(command || "(empty)", () => {
      const result = isDangerousDelete(command, "normal")
      expect(result.blocked).toBe(expectedBlocked)
      if (expectedBlocked) {
        expect(result.reason).toBeTruthy()
        expect(result.suggestion).toBeTruthy()
      }
    })
  }
})

describe("isDangerousDelete (strict)", () => {
  const cases: Array<[string, boolean]> = [
    ["rm -rf foo", true],
    ["rm --recursive --force foo", true],

    // recursive (any)
    ["rm -r foo", true],
    ["rm -R foo", true],
    ["rm --recursive foo", true],

    // wildcards
    ["rm *", true],
    ["rm *.log", true],
    ["rm foo/*", true],
    ["rm -- *.log", true],

    // -f with wildcards
    ["rm -f *", true],
    ["rm -f foo/*", true],

    // non-dangerous
    ["rm foo", false],
    ["rm ./foo", false],
    ["rm -f foo", false],
  ]

  for (const [command, expectedBlocked] of cases) {
    test(command, () => {
      const result = isDangerousDelete(command, "strict")
      expect(result.blocked).toBe(expectedBlocked)
    })
  }
})

describe("isDangerousDelete (sudo + quoting)", () => {
  const cases: Array<[string, "normal" | "strict", boolean]> = [
    ["sudo rm -rf 'My Folder'", "normal", true],
    ["sudo -n rm --recursive --force \"My Folder\"", "normal", true],
    ["sudo rm -r foo", "strict", true],
  ]

  for (const [command, level, expectedBlocked] of cases) {
    test(command, () => {
      const result = isDangerousDelete(command, level)
      expect(result.blocked).toBe(expectedBlocked)
    })
  }
})
