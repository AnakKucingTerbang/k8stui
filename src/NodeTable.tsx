import { t, fg, bold } from "@opentui/core"
import type { NodeDetail, MetricMode } from "./types"

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function lpad(s: string, len: number): string {
  if (s.length >= len) return s
  return " ".repeat(len - s.length) + s
}

function formatPct(pct: number, ready: boolean, colWidth: number): string {
  if (!ready) return lpad("──", colWidth)
  return lpad(`${pct}%`, colWidth)
}

function formatRaw(value: string, ready: boolean, colWidth: number): string {
  if (!ready) return lpad("──", colWidth)
  return lpad(value, colWidth)
}

const COL = {
  name: 22,
  cpu: 8,
  mem: 8,
  age: 8,
  pods: 11,
}

const SEP = "  "

interface NodeTableProps {
  nodes: NodeDetail[]
  selectedIndex: number
  scrollOffset: number
  metricMode: MetricMode
}

export function NodeTable({ nodes, selectedIndex, scrollOffset, metricMode }: NodeTableProps) {
  const headerContent = t`${bold(fg("#E6EDF3")(pad("NAME", COL.name)))}${SEP}${bold(fg("#E6EDF3")(lpad("CPU", COL.cpu)))}${SEP}${bold(fg("#E6EDF3")(lpad("MEM", COL.mem)))}${SEP}${bold(fg("#E6EDF3")(lpad("AGE", COL.age)))}${SEP}${bold(fg("#E6EDF3")(lpad("PODS", COL.pods)))}`

  return (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0 }}>
      <text content={headerContent} />
      {nodes.map((node, i) => {
        const realIndex = scrollOffset + i
        const isSelected = realIndex === selectedIndex
        const bgColor = isSelected ? "#1A3A5C" : undefined
        const textColor = isSelected ? "#E6EDF3" : "#8B949E"
        const podsStr = node.ready ? `${node.podsUsed}/${node.podsTotal}` : "──"
        const cpuStr = metricMode === "raw"
          ? formatRaw(node.cpu, node.ready, COL.cpu)
          : formatPct(node.cpuPct, node.ready, COL.cpu)
        const memStr = metricMode === "raw"
          ? formatRaw(node.mem, node.ready, COL.mem)
          : formatPct(node.memPct, node.ready, COL.mem)
        const content = t`${fg(textColor)(pad(node.name, COL.name))}${SEP}${fg(textColor)(cpuStr)}${SEP}${fg(textColor)(memStr)}${SEP}${fg(textColor)(lpad(node.age, COL.age))}${SEP}${fg(textColor)(lpad(podsStr, COL.pods))}`

        return (
          <box key={node.name} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
            <text content={content} />
          </box>
        )
      })}
    </box>
  )
}
