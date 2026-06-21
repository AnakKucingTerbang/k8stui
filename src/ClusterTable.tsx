import type { Cluster, ClusterStatus, MetricMode } from "./types"
import { t, fg, bold } from "@opentui/core"

type SortOrder = "none" | "asc" | "desc"

const STATUS_SYMBOL: Record<ClusterStatus, string> = {
  connected: "●",
  degraded: "▲",
  unreachable: "○",
}

const STATUS_FG: Record<ClusterStatus, string> = {
  connected: "#3FB950",
  degraded: "#D29922",
  unreachable: "#F85149",
}

const SORT_LABEL: Record<SortOrder, string> = {
  none: "NAME",
  asc: "NAME ↑",
  desc: "NAME ↓",
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen - 3) + "..."
}

function pad(s: string, len: number): string {
  return s.length >= len ? s : s + " ".repeat(len - s.length)
}

function lpad(s: string, len: number): string {
  return s.length >= len ? s : " ".repeat(len - s.length) + s
}

const COL = {
  name: 22,
  status: 8,
  nodes: 8,
  cpu: 8,
  mem: 8,
  pods: 13,
  notes: 20,
}

const SEP = "  "

interface HeaderRowProps {
  sortOrder: SortOrder
}

function HeaderRow({ sortOrder }: HeaderRowProps) {
  const nameLabel = SORT_LABEL[sortOrder]
  const content = t`${bold(fg("#E6EDF3")(pad(nameLabel, COL.name)))}${SEP}${bold(fg("#E6EDF3")(pad("STATUS", COL.status)))}${SEP}${bold(fg("#E6EDF3")(lpad("NODES", COL.nodes)))}${SEP}${bold(fg("#E6EDF3")(lpad("CPU", COL.cpu)))}${SEP}${bold(fg("#E6EDF3")(lpad("MEM", COL.mem)))}${SEP}${bold(fg("#E6EDF3")(lpad("PODS", COL.pods)))}${SEP}${bold(fg("#E6EDF3")(pad("NOTES", COL.notes)))}`

  return (
    <text style={{ height: 1, width: "100%" }} content={content} />
  )
}

function formatNodes(c: Cluster): string {
  if (c.status === "unreachable") return lpad("──", COL.nodes)
  return `${c.nodeOnline}/${c.nodeTotal}`
}

function formatCpu(c: Cluster, metricMode: MetricMode): string {
  if (c.status === "unreachable" || c.status === "degraded") return lpad("──", COL.cpu)
  if (metricMode === "raw") return lpad(c.cpuRaw, COL.cpu)
  return lpad(`${c.cpuPct}%`, COL.cpu)
}

function formatMem(c: Cluster, metricMode: MetricMode): string {
  if (c.status === "unreachable" || c.status === "degraded") return lpad("──", COL.mem)
  if (metricMode === "raw") return lpad(c.memRaw, COL.mem)
  return lpad(`${c.memPct}%`, COL.mem)
}

function formatPods(c: Cluster): string {
  if (c.status === "unreachable" || c.status === "degraded") return lpad("──", COL.pods)
  return `${c.podsUsed}/${c.podsTotal}`
}

interface ClusterRowProps {
  cluster: Cluster
  selected: boolean
  isFavorite: boolean
  metricMode: MetricMode
}

function ClusterRow({ cluster, selected, isFavorite, metricMode }: ClusterRowProps) {
  const statusSym = STATUS_SYMBOL[cluster.status]
  const statusFg = STATUS_FG[cluster.status]
  const bgColor = selected ? "#1A3A5C" : undefined
  const textColor = selected ? "#E6EDF3" : "#8B949E"
  const nameLen = isFavorite ? 20 : 22
  const content = t`${isFavorite ? fg("#E3B341")("★ ") : ""}${pad(truncate(cluster.name, nameLen), nameLen)}${SEP}${fg(statusFg)(pad(statusSym, COL.status))}${SEP}${lpad(formatNodes(cluster), COL.nodes)}${SEP}${lpad(formatCpu(cluster, metricMode), COL.cpu)}${SEP}${lpad(formatMem(cluster, metricMode), COL.mem)}${SEP}${lpad(formatPods(cluster), COL.pods)}${SEP}${pad(cluster.notes, COL.notes)}`

  return (
    <box style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
      <text fg={textColor} content={content} />
    </box>
  )
}

interface ClusterTableProps {
  clusters: Cluster[]
  selectedIndex: number
  sortOrder: SortOrder
  favorites: Set<string>
  metricMode: MetricMode
}

export function ClusterTable({ clusters, selectedIndex, sortOrder, favorites, metricMode }: ClusterTableProps) {
  return (
    <box style={{ flexDirection: "column", gap: 0, flexGrow: 1, width: "100%", paddingLeft: 1, paddingRight: 1 }}>
      <HeaderRow sortOrder={sortOrder} />
      {clusters.map((c, i) => (
        <ClusterRow cluster={c} selected={i === selectedIndex} isFavorite={favorites.has(c.name)} metricMode={metricMode} />
      ))}
    </box>
  )
}
