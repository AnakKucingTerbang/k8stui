import { t, fg, bold } from "@opentui/core"
import type { NamespacedResource } from "../types"

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function lpad(s: string, len: number): string {
  if (s.length >= len) return s
  return " ".repeat(len - s.length) + s
}

const COL = {
  kind: 22,
  name: 28,
  age: 8,
}

const SEP = "  "

interface ResourceListTableProps {
  resources: NamespacedResource[]
  selectedIndex: number
  scrollRef: React.RefObject<any>
}

export function ResourceListTable({ resources, selectedIndex, scrollRef }: ResourceListTableProps) {
  const headerContent = t`${bold(fg("#E6EDF3")(pad("KIND", COL.kind)))}${SEP}${bold(fg("#E6EDF3")(pad("NAME", COL.name)))}${SEP}${bold(fg("#E6EDF3")(lpad("AGE", COL.age)))}`

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
        {resources.map((res, i) => {
          const isSelected = i === selectedIndex
          const bgColor = isSelected ? "#1A3A5C" : undefined
          const textColor = isSelected ? "#E6EDF3" : "#8B949E"
          const content = t`${fg(textColor)(pad(res.kind, COL.kind))}${SEP}${fg(textColor)(pad(res.name, COL.name))}${SEP}${fg(textColor)(lpad(res.age, COL.age))}`

          return (
            <box key={`${res.kind}-${res.name}-${i}`} id={`res-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={content} />
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}
