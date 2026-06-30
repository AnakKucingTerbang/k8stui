import { t, fg, bold } from "@opentui/core"
import type { NamespacedResource } from "../types"

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function lpad(s: string, len: number): string {
  if (s.length >= len) return s
  return " ".repeat(len - s.length) + s
}

const COL = {
  kind: 22,
  name: 26,
  namespace: 18,
  age: 8,
}

const SEP = "  "

interface CustomResourceTableProps {
  resources: NamespacedResource[]
  selectedIndex: number
  scrollRef: React.RefObject<any>
}

export function CustomResourceTable({ resources, selectedIndex, scrollRef }: CustomResourceTableProps) {
  const headerContent = t`${bold(fg("#E6EDF3")(pad("KIND", COL.kind)))}${SEP}${bold(fg("#E6EDF3")(pad("NAME", COL.name)))}${SEP}${bold(fg("#E6EDF3")(pad("NAMESPACE", COL.namespace)))}${SEP}${bold(fg("#E6EDF3")(lpad("AGE", COL.age)))}`

  let itemIndex = 0

  const grouped = new Map<string, NamespacedResource[]>()
  for (const r of resources) {
    const list = grouped.get(r.kind) || []
    list.push(r)
    grouped.set(r.kind, list)
  }

  const kindOrder = [...grouped.keys()].sort()

  const rows: Array<{ type: "separator"; kind: string } | { type: "item"; resource: NamespacedResource; itemIndex: number }> = []
  for (const kind of kindOrder) {
    const items = grouped.get(kind)
    if (!items || items.length === 0) continue
    rows.push({ type: "separator", kind })
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
            const sepContent = t`${fg("#484F58")(`── ${row.kind} ──`)}`
            return (
              <box key={`sep-${row.kind}-${i}`} style={{ height: 1, width: "100%" }}>
                <text content={sepContent} />
              </box>
            )
          }

          const isSelected = row.itemIndex === selectedIndex
          const bgColor = isSelected ? "#1A3A5C" : undefined
          const textColor = isSelected ? "#E6EDF3" : "#8B949E"
          const content = t`${fg(textColor)(pad(row.resource.kind, COL.kind))}${SEP}${fg(textColor)(pad(row.resource.name, COL.name))}${SEP}${fg(textColor)(pad(row.resource.namespace, COL.namespace))}${SEP}${fg(textColor)(lpad(row.resource.age, COL.age))}`

          return (
            <box key={`cres-${row.itemIndex}`} id={`cres-${row.itemIndex}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={content} />
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}
