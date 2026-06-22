import { t, fg, bold } from "@opentui/core"
import type { PodDetailFull, PodDetail } from "../types"

const STATUS_COLORS: Record<string, string> = {
  Running: "#3FB950",
  Succeeded: "#8B949E",
  Completed: "#8B949E",
  Pending: "#D29922",
  ContainerCreating: "#D29922",
  CrashLoopBackOff: "#F85149",
  Error: "#F85149",
  Failed: "#F85149",
}

interface PodHeaderProps {
  pod: PodDetail
  podDetailFull?: PodDetailFull | null
  spinner?: string
}

export function PodHeader({ pod, podDetailFull, spinner }: PodHeaderProps) {
  const phase = podDetailFull?.phase || pod.status || ""
  const color = STATUS_COLORS[phase] || "#8B949E"
  const ns = podDetailFull?.namespace || pod.namespace || ""
  const name = podDetailFull?.name || pod.name || ""

  if (!podDetailFull) {
    return (
      <box borderStyle="single" borderColor="#30363D" style={{ flexDirection: "column", width: "100%" }}>
        <text content={t`${bold(fg("#E6EDF3")(name))}`} />
        <text content={t`${fg("#D29922")(spinner || "⠋")} ${fg("#8B949E")("Loading...")}`} />
      </box>
    )
  }

  return (
    <box borderStyle="single" borderColor="#30363D" style={{ flexDirection: "column", width: "100%" }}>
      <text content={t`${fg("#8B949E")("ns:")} ${fg("#E6EDF3")(ns)}`} />
      <text content={t`${fg("#8B949E")("status:")} ${fg(color)("●")} ${fg(color)(phase)}`} />
    </box>
  )
}
