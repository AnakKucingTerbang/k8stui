import type { EnvEntry } from "../types"

export function parseDotenv(content: string): EnvEntry[] {
  const lines = content.split("\n")
  const entries: EnvEntry[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === "") {
      entries.push({ key: "", value: "", isComment: false, isBlank: true })
      continue
    }

    if (trimmed.startsWith("#")) {
      entries.push({ key: trimmed, value: "", isComment: true, isBlank: false })
      continue
    }

    const exportMatch = trimmed.match(/^export\s+(.+)$/)?.[1]
    const lineToParse = exportMatch ?? trimmed

    const eqIndex = lineToParse.indexOf("=")
    if (eqIndex === -1) {
      entries.push({ key: lineToParse, value: "", isComment: false, isBlank: false })
      continue
    }

    const key = lineToParse.slice(0, eqIndex).trim()
    let rest = lineToParse.slice(eqIndex + 1)

    let value: string
    let inlineComment: string | undefined

    if (rest.startsWith('"')) {
      const closing = rest.indexOf('"', 1)
      if (closing !== -1) {
        value = rest.slice(1, closing)
        const after = rest.slice(closing + 1).trim()
        if (after.startsWith("#")) {
          inlineComment = after
        }
      } else {
        value = rest.slice(1)
      }
    } else if (rest.startsWith("'")) {
      const closing = rest.indexOf("'", 1)
      if (closing !== -1) {
        value = rest.slice(1, closing)
        const after = rest.slice(closing + 1).trim()
        if (after.startsWith("#")) {
          inlineComment = after
        }
      } else {
        value = rest.slice(1)
      }
    } else {
      const commentIdx = rest.indexOf(" #")
      if (commentIdx !== -1) {
        value = rest.slice(0, commentIdx).trim()
        inlineComment = rest.slice(commentIdx).trim()
      } else {
        value = rest.trim()
      }
    }

    entries.push({ key, value, comment: inlineComment, isComment: false, isBlank: false })
  }

  return entries
}

export function stringifyDotenv(entries: EnvEntry[]): string {
  return entries.map((entry) => {
    if (entry.isBlank) return ""
    if (entry.isComment) return entry.key
    if (entry.value.includes(" ") || entry.value.includes("#") || entry.value.includes('"') || entry.value.includes("'")) {
      const escaped = entry.value.replace(/"/g, '\\"')
      const line = `${entry.key}="${escaped}"`
      return entry.comment ? `${line} ${entry.comment}` : line
    }
    const line = `${entry.key}=${entry.value}`
    return entry.comment ? `${line} ${entry.comment}` : line
  }).join("\n")
}
