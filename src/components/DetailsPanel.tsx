import { useTerminalDimensions } from "@opentui/react"
import { t, fg, bold } from "@opentui/core"
import type { DetailRow } from "../types"
import { YamlView } from "./YamlView"

const DASH = "──"
const KEY_WIDTH = 18
const SEP = "  "

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

interface DetailsPanelProps {
  rows?: DetailRow[]
  yaml?: string
  yamlMode: "view" | "edit"
  editEnabled: boolean
  scrollOffset: number
  detailRowIndex: number
  scrollRef: React.RefObject<any>
  textareaRef: React.RefObject<any>
  onContentChange?: () => void
  onSubmit?: () => void
  spinner: string
}

export function DetailsPanel({
  rows,
  yaml,
  yamlMode,
  editEnabled,
  scrollOffset,
  detailRowIndex,
  scrollRef,
  textareaRef,
  onContentChange,
  onSubmit,
  spinner,
}: DetailsPanelProps) {
  const { height: termHeight } = useTerminalDimensions()
  const maxVisibleRows = Math.max(1, termHeight - 24)

  if (!rows && yaml === undefined) {
    return (
      <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
        <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
      </box>
    )
  }

  if (yaml !== undefined) {
    return (
      <YamlView
        yaml={yaml}
        mode={yamlMode}
        editEnabled={editEnabled}
        scrollRef={scrollRef}
        textareaRef={textareaRef}
        onContentChange={onContentChange}
        onSubmit={onSubmit}
      />
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0 }}>
        <text fg="#8B949E" content={DASH} />
      </box>
    )
  }

  const visible = rows.slice(scrollOffset, scrollOffset + maxVisibleRows)

  return (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0 }}>
      {visible.map((row, i) => {
        const absIndex = scrollOffset + i
        const isHighlighted = absIndex === detailRowIndex
        const bgColor = isHighlighted ? "#1A3A5C" : undefined

        if (row.isParent) {
          return (
            <box key={`d-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={t`${bold(fg("#58A6FF")(row.key))}`} />
            </box>
          )
        }

        const keyColor = isHighlighted ? "#E6EDF3" : "#8B949E"
        const valColor = isHighlighted ? "#E6EDF3" : "#E6EDF3"

        if (row.indent) {
          return (
            <box key={`d-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={t`${fg(keyColor)(`  ${pad(row.key, KEY_WIDTH - 2)}${SEP}`)}${fg(valColor)(row.value)}`} />
            </box>
          )
        }

        return (
          <box key={`d-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
            <text content={t`${fg(keyColor)(pad(row.key, KEY_WIDTH))}${SEP}${fg(valColor)(row.value)}`} />
          </box>
        )
      })}
    </box>
  )
}

export function getSelectedRowDisplay(rows: DetailRow[], rowIndex: number): string {
  const row = rows[rowIndex]
  if (!row) return DASH
  if (row.isParent) return row.key
  if (row.indent) return `${row.key} = ${row.value}`
  return `${row.key} = ${row.value}`
}
