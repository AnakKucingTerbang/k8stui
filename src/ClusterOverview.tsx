import { useTerminalDimensions } from "@opentui/react"
import { t, fg } from "@opentui/core"
import type { Cluster, MetricMode } from "./types"

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

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function lpad(s: string, len: number): string {
  return s.length >= len ? s : " ".repeat(len - s.length) + s
}

interface ClusterOverviewProps {
  cluster: Cluster
  metricMode: MetricMode
}

export function ClusterOverview({ cluster, metricMode }: ClusterOverviewProps) {
  const { width: termWidth } = useTerminalDimensions()

  const barWidth = Math.max(10, termWidth - 17)

  const cpuBar = makeBar(cluster.cpuPct, barWidth)
  const memBar = makeBar(cluster.memPct, barWidth)
  const podPct = cluster.podsTotal > 0 ? Math.round(cluster.podsUsed / cluster.podsTotal * 100) : 0
  const podBar = makeBar(podPct, barWidth)

  const cpuLabel = metricMode === "raw"
    ? pad(cluster.cpuRaw, 9)
    : pad(`${cluster.cpuPct}%`, 9)

  const memLabel = metricMode === "raw"
    ? pad(cluster.memRaw, 9)
    : pad(`${cluster.memPct}%`, 9)

  const cpuContent = t`${fg("#8B949E")("CPU ")}${fg(barColor(cluster.cpuPct))(cpuBar.filled)}${fg("#21262D")(cpuBar.empty)}${fg("#8B949E")(` ${cpuLabel}`)}`
  const memContent = t`${fg("#8B949E")("MEM ")}${fg(barColor(cluster.memPct))(memBar.filled)}${fg("#21262D")(memBar.empty)}${fg("#8B949E")(` ${memLabel}`)}`
  const podContent = t`${fg("#8B949E")("POD ")}${fg("#58A6FF")(podBar.filled)}${fg("#21262D")(podBar.empty)}${fg("#8B949E")(` ${cluster.podsUsed}/${cluster.podsTotal}`)}`

  return (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingTop: 1, gap: 0 }}>
      <text content={cpuContent} />
      <text content={memContent} />
      <text content={podContent} />
    </box>
  )
}
