import { t, fg, bold } from "@opentui/core"
import type { NamespaceInfo } from "../types"

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function lpad(s: string, len: number): string {
  if (s.length >= len) return s
  return " ".repeat(len - s.length) + s
}

const COL = {
  name: 18,
  pods: 6,
  workload: 9,
  network: 8,
  storage: 8,
  configuration: 13,
  age: 8,
}

const SEP = "  "

interface NamespaceTableProps {
  namespaces: NamespaceInfo[]
  selectedIndex: number
  scrollRef: React.RefObject<any>
}

export function NamespaceTable({ namespaces, selectedIndex, scrollRef }: NamespaceTableProps) {
  const headerContent = t`${bold(fg("#E6EDF3")(pad("NAME", COL.name)))}${SEP}${bold(fg("#E6EDF3")(lpad("PODS", COL.pods)))}${SEP}${bold(fg("#E6EDF3")(lpad("WORKLOAD", COL.workload)))}${SEP}${bold(fg("#E6EDF3")(lpad("NETWORK", COL.network)))}${SEP}${bold(fg("#E6EDF3")(lpad("STORAGE", COL.storage)))}${SEP}${bold(fg("#E6EDF3")(lpad("CONFIGURATION", COL.configuration)))}${SEP}${bold(fg("#E6EDF3")(lpad("AGE", COL.age)))}`

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
        {namespaces.map((ns, i) => {
          const isSelected = i === selectedIndex
          const bgColor = isSelected ? "#1A3A5C" : undefined
          const textColor = isSelected ? "#E6EDF3" : "#8B949E"
          const content = t`${fg(textColor)(pad(ns.name, COL.name))}${SEP}${fg(textColor)(lpad(`${ns.pods}`, COL.pods))}${SEP}${fg(textColor)(lpad(`${ns.workloads}`, COL.workload))}${SEP}${fg(textColor)(lpad(`${ns.network}`, COL.network))}${SEP}${fg(textColor)(lpad(`${ns.storage}`, COL.storage))}${SEP}${fg(textColor)(lpad(`${ns.config}`, COL.configuration))}${SEP}${fg(textColor)(lpad(ns.age, COL.age))}`

          return (
            <box key={ns.name} id={`ns-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={content} />
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}
