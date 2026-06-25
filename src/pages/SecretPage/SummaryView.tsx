import { t, fg } from "@opentui/core"
import type { DetailRow } from "../../types"

const SEP = "  "
const DASH = "──"

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function val(s: string): string {
  return s || DASH
}

interface SummaryViewProps {
  summary: DetailRow[]
  scrollRef: React.RefObject<any>
}

export function SummaryView({ summary, scrollRef }: SummaryViewProps) {
  return (
    <box style={{ flexDirection: "column", width: "100%", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
      <scrollbox ref={scrollRef} scrollY={true} viewportCulling={true} style={{ width: "100%", flexGrow: 1 }} contentOptions={{ minHeight: "100%" }}>
        {summary.map((row, i) => {
          const keyColor = row.indent ? "#8B949E" : "#58A6FF"
          const displayKey = row.indent ? pad(row.key, 16) : pad(row.key, 18)
          const prefix = row.indent ? "  " : ""
          if (row.isParent) {
            return (
              <box key={i} style={{ height: 1, width: "100%" }}>
                <text content={t`${fg("#E6EDF3")(pad(row.key, 18))}`} />
              </box>
            )
          }
          return (
            <box key={i} style={{ height: 1, width: "100%" }}>
              <text content={t`${prefix}${fg(keyColor)(displayKey)}${SEP}${fg("#8B949E")(val(row.value))}`} />
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}
