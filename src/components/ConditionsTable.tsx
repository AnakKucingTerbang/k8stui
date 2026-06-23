import { t, fg, bold } from "@opentui/core"
import type { NodeCondition } from "../types"

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function lpad(s: string, len: number): string {
  if (s.length >= len) return s
  return " ".repeat(len - s.length) + s
}

function conditionStatusColor(status: string): string {
  if (status === "True") return "#3FB950"
  if (status === "False") return "#F85149"
  return "#D29922"
}

const COL = {
  type: 20,
  status: 8,
  reason: 20,
  age: 10,
}

const SEP = "  "

interface ConditionsTableProps {
  conditions: NodeCondition[]
  selectedIndex: number
  scrollRef: React.RefObject<any>
}

export function ConditionsTable({ conditions, selectedIndex, scrollRef }: ConditionsTableProps) {
  const headerContent = t`${bold(fg("#E6EDF3")(pad("TYPE", COL.type)))}${SEP}${bold(fg("#E6EDF3")(lpad("STATUS", COL.status)))}${SEP}${bold(fg("#E6EDF3")(pad("REASON", COL.reason)))}${SEP}${bold(fg("#E6EDF3")(lpad("AGE", COL.age)))}`

  return (
    <box style={{ flexDirection: "column", width: "100%", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
      <text content={headerContent} style={{ height: 1, flexShrink: 0 }} />
      <scrollbox
        ref={scrollRef}
        scrollY={true}
        viewportCulling={true}
        style={{ width: "100%", flexGrow: 1 }}
        contentOptions={{ minHeight: "100%" }}
      >
        {conditions.map((cond, i) => {
          const isSelected = i === selectedIndex
          const bgColor = isSelected ? "#1A3A5C" : undefined
          const textColor = isSelected ? "#E6EDF3" : "#8B949E"
          const statusColor = isSelected ? "#E6EDF3" : conditionStatusColor(cond.status)
          const content = t`${fg(textColor)(pad(cond.type, COL.type))}${SEP}${fg(statusColor)(lpad(cond.status, COL.status))}${SEP}${fg(textColor)(pad(cond.reason, COL.reason))}${SEP}${fg(textColor)(lpad(cond.lastTransitionTime, COL.age))}`

          return (
            <box key={`${cond.type}-${i}`} id={`cond-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={content} />
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}
