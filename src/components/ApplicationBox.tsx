import { t, fg } from "@opentui/core"
import type { ApplicationResource } from "../types"

interface ContainerRefNames {
  pvcs: string[]
  secrets: string[]
  configMaps: string[]
}

interface ApplicationBoxProps {
  resources: ApplicationResource[]
  selectedIndex: number
  focused: boolean
  containerRefNames: ContainerRefNames
  loading?: boolean
  spinner?: string
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

function isReferenced(resource: ApplicationResource, refs: ContainerRefNames): boolean {
  const name = resource.name
  switch (resource.kind) {
    case "PersistentVolumeClaim":
      return refs.pvcs.includes(name)
    case "Secret":
      return refs.secrets.includes(name)
    case "ConfigMap":
      return refs.configMaps.includes(name)
    default:
      return false
  }
}

export function ApplicationBox({ resources, selectedIndex, focused, containerRefNames, loading, spinner }: ApplicationBoxProps) {
  if (loading) {
    return (
      <box
        title="APPLICATION"
        borderStyle="single"
        borderColor={focused ? "#58A6FF" : "#30363D"}
        style={{ flexDirection: "column", width: "100%" }}
      >
        <text content={t`${fg("#D29922")(spinner || "⠋")} ${fg("#8B949E")("Loading...")}`} />
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
        const refd = isReferenced(r, containerRefNames)
        const label = `${shortKind(r.kind)}: ${r.name}`
        const suffix = refd ? " ●" : ""

        return (
          <box key={`a-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
            <text content={t`${fg(textColor)(` ${label}${suffix}`)}`} />
          </box>
        )
      })}
    </box>
  )
}
