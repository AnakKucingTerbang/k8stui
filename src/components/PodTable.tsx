import { t, fg, bold } from "@opentui/core"
import { parseCpuMillicores, parseMemBytes } from "../utils/kube"
import type { PodDetail, MetricMode } from "../types"

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function lpad(s: string, len: number): string {
  if (s.length >= len) return s
  return " ".repeat(len - s.length) + s
}

function podStatusColor(status: string): string {
  if (status === "Running") return "#3FB950"
  if (status === "Completed" || status === "Succeeded") return "#8B949E"
  if (status === "Pending" || status === "ContainerCreating") return "#D29922"
  return "#F85149"
}

const COL = {
  name: 28,
  namespace: 14,
  status: 18,
  cpu: 9,
  mem: 9,
  age: 8,
}

const SEP = "  "

interface PodTableProps {
  pods: PodDetail[]
  selectedIndex: number
  scrollRef: React.RefObject<any>
  metricMode?: MetricMode
  cpuAllocatable?: number
  memAllocatable?: number
}

export function PodTable({ pods, selectedIndex, scrollRef, metricMode = "pct", cpuAllocatable, memAllocatable }: PodTableProps) {
  const headerContent = t`${bold(fg("#E6EDF3")(pad("NAME", COL.name)))}${SEP}${bold(fg("#E6EDF3")(pad("NAMESPACE", COL.namespace)))}${SEP}${bold(fg("#E6EDF3")(pad("STATUS", COL.status)))}${SEP}${bold(fg("#E6EDF3")(lpad("CPU", COL.cpu)))}${SEP}${bold(fg("#E6EDF3")(lpad("MEM", COL.mem)))}${SEP}${bold(fg("#E6EDF3")(lpad("AGE", COL.age)))}`

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
        {pods.map((pod, i) => {
          const isSelected = i === selectedIndex
          const bgColor = isSelected ? "#1A3A5C" : undefined
          const textColor = isSelected ? "#E6EDF3" : "#8B949E"
          const statusColor = isSelected ? "#E6EDF3" : podStatusColor(pod.status)
          const cpuStr = metricMode === "pct" && pod.cpu !== "──" && cpuAllocatable && cpuAllocatable > 0
            ? lpad(`${(parseCpuMillicores(pod.cpu) / cpuAllocatable * 100).toFixed(1)}%`, COL.cpu)
            : lpad(pod.cpu, COL.cpu)
          const memStr = metricMode === "pct" && pod.mem !== "──" && memAllocatable && memAllocatable > 0
            ? lpad(`${(parseMemBytes(pod.mem) / memAllocatable * 100).toFixed(1)}%`, COL.mem)
            : lpad(pod.mem, COL.mem)
          const content = t`${fg(textColor)(pad(pod.name, COL.name))}${SEP}${fg(textColor)(pad(pod.namespace, COL.namespace))}${SEP}${fg(statusColor)(pad(pod.status, COL.status))}${SEP}${fg(textColor)(cpuStr)}${SEP}${fg(textColor)(memStr)}${SEP}${fg(textColor)(lpad(pod.age, COL.age))}`

          return (
            <box key={pod.name} id={`pod-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={content} />
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}
