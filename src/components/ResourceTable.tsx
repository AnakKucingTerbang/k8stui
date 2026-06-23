import { t, fg, bold } from "@opentui/core"
import type { ClusterResource, ResourceCategory } from "../types"

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function shortResourceKind(kind: string): string {
  switch (kind) {
    case "Deployment": return "Deploy"
    case "StatefulSet": return "Sts"
    case "DaemonSet": return "DS"
    case "CronJob": return "Cron"
    case "ReplicaSet": return "RS"
    case "Job": return "Job"
    case "PersistentVolumeClaim": return "PVC"
    case "PersistentVolume": return "PV"
    case "StorageClass": return "SC"
    case "ConfigMap": return "CM"
    case "Secret": return "Secret"
    case "Service": return "SVC"
    case "Ingress": return "Ingress"
    case "NetworkPolicy": return "NetPol"
    default: return kind
  }
}

const CATEGORY_ORDER: ResourceCategory[] = ["workloads", "network", "storage", "configuration"]

const CATEGORY_LABEL: Record<ResourceCategory, string> = {
  workloads: "Workloads",
  network: "Network",
  storage: "Storage",
  configuration: "Configuration",
}

const COL = {
  kind: 8,
  name: 26,
  namespace: 18,
}

const SEP = "  "

interface ResourceTableProps {
  resources: ClusterResource[]
  selectedIndex: number
  scrollRef: React.RefObject<any>
}

export function ResourceTable({ resources, selectedIndex, scrollRef }: ResourceTableProps) {
  const headerContent = t`${bold(fg("#E6EDF3")(pad("KIND", COL.kind)))}${SEP}${bold(fg("#E6EDF3")(pad("NAME", COL.name)))}${SEP}${bold(fg("#E6EDF3")(pad("NAMESPACE", COL.namespace)))}`

  let itemIndex = 0

  const grouped = new Map<ResourceCategory, ClusterResource[]>()
  for (const r of resources) {
    const list = grouped.get(r.category) || []
    list.push(r)
    grouped.set(r.category, list)
  }

  const rows: Array<{ type: "separator"; category: ResourceCategory } | { type: "item"; resource: ClusterResource; itemIndex: number }> = []
  for (const cat of CATEGORY_ORDER) {
    const items = grouped.get(cat)
    if (!items || items.length === 0) continue
    rows.push({ type: "separator", category: cat })
    for (const r of items) {
      rows.push({ type: "item", resource: r, itemIndex: itemIndex++ })
    }
  }

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
        {rows.map((row, i) => {
          if (row.type === "separator") {
            const label = CATEGORY_LABEL[row.category] || row.category
            const sepContent = t`${fg("#484F58")(`── ${label} ──`)}`
            return (
              <box key={`sep-${row.category}`} style={{ height: 1, width: "100%" }}>
                <text content={sepContent} />
              </box>
            )
          }

          const isSelected = row.itemIndex === selectedIndex
          const bgColor = isSelected ? "#1A3A5C" : undefined
          const textColor = isSelected ? "#E6EDF3" : "#8B949E"
          const kind = shortResourceKind(row.resource.kind)
          const content = t`${fg(textColor)(pad(kind, COL.kind))}${SEP}${fg(textColor)(pad(row.resource.name, COL.name))}${SEP}${fg(textColor)(pad(row.resource.namespace, COL.namespace))}`

          return (
            <box key={`res-${row.itemIndex}`} id={`res-${row.itemIndex}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={content} />
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}
