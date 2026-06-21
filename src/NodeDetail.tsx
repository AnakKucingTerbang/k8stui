import { useTerminalDimensions } from "@opentui/react"
import { t, fg, bold } from "@opentui/core"
import type { NodeDetail, PodDetail, MetricMode } from "./types"

function barColor(pct: number): string {
  if (pct >= 90) return "#F85149"
  if (pct >= 70) return "#D29922"
  return "#3FB950"
}

function makeBar(pct: number, width: number): { filled: string; empty: string } {
  const clamped = Math.min(100, Math.max(0, pct))
  const filledCount = Math.round(width * clamped / 100)
  return {
    filled: "█".repeat(filledCount),
    empty: "░".repeat(width - filledCount),
  }
}

function lpad(s: string, len: number): string {
  return s.length >= len ? s : " ".repeat(len - s.length) + s
}

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function podStatusColor(status: string): string {
  if (status === "Running") return "#3FB950"
  if (status === "Completed" || status === "Succeeded") return "#8B949E"
  if (status === "Pending" || status === "ContainerCreating") return "#D29922"
  return "#F85149"
}

interface NodeBarsProps {
  node: NodeDetail
  metricMode: MetricMode
}

export function NodeBars({ node, metricMode }: NodeBarsProps) {
  const { width: termWidth } = useTerminalDimensions()

  const barWidth = Math.max(10, termWidth - 17)

  const cpuBar = makeBar(node.cpuPct, barWidth)
  const memBar = makeBar(node.memPct, barWidth)
  const podPct = node.podsTotal > 0 ? Math.round(node.podsUsed / node.podsTotal * 100) : 0
  const podBar = makeBar(podPct, barWidth)

  const cpuLabel = metricMode === "raw"
    ? pad(node.cpu, 9)
    : pad(`${node.cpuPct}%`, 9)

  const memLabel = metricMode === "raw"
    ? pad(node.mem, 9)
    : pad(`${node.memPct}%`, 9)

  const cpuContent = t`${fg("#8B949E")("CPU ")}${fg(barColor(node.cpuPct))(cpuBar.filled)}${fg("#21262D")(cpuBar.empty)}${fg("#8B949E")(` ${cpuLabel}`)}`
  const memContent = t`${fg("#8B949E")("MEM ")}${fg(barColor(node.memPct))(memBar.filled)}${fg("#21262D")(memBar.empty)}${fg("#8B949E")(` ${memLabel}`)}`
  const podContent = t`${fg("#8B949E")("POD ")}${fg("#58A6FF")(podBar.filled)}${fg("#21262D")(podBar.empty)}${fg("#8B949E")(` ${node.podsUsed}/${node.podsTotal}`)}`

  return (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingTop: 1, gap: 0 }}>
      <text content={cpuContent} />
      <text content={memContent} />
      <text content={podContent} />
    </box>
  )
}

const COL = {
  name: 28,
  namespace: 14,
  status: 18,
  cpu: 8,
  mem: 8,
  age: 8,
}

const SEP = "  "

interface PodTableProps {
  pods: PodDetail[]
  scrollOffset: number
  loading: boolean
}

export function PodTable({ pods, scrollOffset, loading }: PodTableProps) {
  const headerContent = t`${bold(fg("#E6EDF3")(pad("NAME", COL.name)))}${SEP}${bold(fg("#E6EDF3")(pad("NAMESPACE", COL.namespace)))}${SEP}${bold(fg("#E6EDF3")(pad("STATUS", COL.status)))}${SEP}${bold(fg("#E6EDF3")(lpad("CPU", COL.cpu)))}${SEP}${bold(fg("#E6EDF3")(lpad("MEM", COL.mem)))}${SEP}${bold(fg("#E6EDF3")(lpad("AGE", COL.age)))}`

  const visiblePods = pods.slice(scrollOffset)

  return (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0 }}>
      <text content={headerContent} />
      {loading ? (
        <text content={t`${fg("#8B949E")("Loading pod data...")}`} />
      ) : visiblePods.map((pod) => {
        const content = t`${fg("#E6EDF3")(pad(pod.name, COL.name))}${SEP}${fg("#8B949E")(pad(pod.namespace, COL.namespace))}${SEP}${fg(podStatusColor(pod.status))(pad(pod.status, COL.status))}${SEP}${fg("#8B949E")(lpad(pod.cpu, COL.cpu))}${SEP}${fg("#8B949E")(lpad(pod.mem, COL.mem))}${SEP}${fg("#8B949E")(lpad(pod.age, COL.age))}`

        return (
          <box key={pod.name} style={{ height: 1, width: "100%" }}>
            <text content={content} />
          </box>
        )
      })}
      {!loading && pods.length === 0 && (
        <text fg="#484F58" content="No pods on this node" />
      )}
    </box>
  )
}
