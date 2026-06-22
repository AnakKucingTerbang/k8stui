import { t, fg } from "@opentui/core"
import type { ApplicationResource } from "../types"

interface ApplicationBoxProps {
  resources: ApplicationResource[] | undefined
  selectedIndex: number
  focused: boolean
  spinner: string
}

function shortKind(kind: string): string {
  switch (kind) {
    case "Deployment": return "Deploy"
    case "StatefulSet": return "Sts"
    case "DaemonSet": return "DS"
    case "PersistentVolumeClaim": return "PVC"
    case "ConfigMap": return "CM"
    case "Secret": return "Secret"
    case "Service": return "SVC"
    case "Ingress": return "Ingress"
    default: return kind
  }
}

export function ApplicationBox({ resources, selectedIndex, focused, spinner }: ApplicationBoxProps) {
  if (resources === undefined) {
    return (
      <box
        title="APPLICATION"
        borderStyle="single"
        borderColor={focused ? "#58A6FF" : "#30363D"}
        style={{ flexDirection: "column", width: "100%" }}
      >
        <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
      </box>
    )
  }

  if (resources.length === 0) {
    return (
      <box
        title="APPLICATION"
        borderStyle="single"
        borderColor={focused ? "#58A6FF" : "#30363D"}
        style={{ flexDirection: "column", width: "100%" }}
      >
        <text fg="#8B949E" content="──" />
      </box>
    )
  }

  return (
    <box
      title="APPLICATION"
      borderStyle="single"
      borderColor={focused ? "#58A6FF" : "#30363D"}
      style={{ flexDirection: "column", width: "100%" }}
    >
      {resources.map((r, i) => {
        const isSelected = i === selectedIndex
        const bgColor = isSelected ? "#1A3A5C" : undefined
        const textColor = isSelected ? "#E6EDF3" : "#8B949E"
        const label = `${shortKind(r.kind)}: ${r.name}`
        const padded = label.length >= 24 ? label.slice(0, Math.max(0, 21)) + "... ●" : label + " ".repeat(24 - label.length) + "●"

        return (
          <box key={`a-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
            <text content={t`${fg(textColor)(` ${padded}`)}`} />
          </box>
        )
      })}
    </box>
  )
}
