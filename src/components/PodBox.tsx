import { t, fg, bold } from "@opentui/core"
import { Panel } from "./Panel"
import type { PodDetailFull, DetailRow } from "../types"

const DASH = "──"
const KEY_WIDTH = 12
const SEP = "  "

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function val(s: string): string {
  return s || DASH
}

export function buildPodRows(pod: PodDetailFull): DetailRow[] {
  const rows: DetailRow[] = []
  rows.push({ key: "Name", value: val(pod.name) })
  rows.push({ key: "Namespace", value: val(pod.namespace) })

  if (pod.labels.length === 1 && pod.labels[0] === DASH) {
    rows.push({ key: "Labels", value: DASH })
  } else {
    rows.push({ key: "Labels", value: "", isParent: true })
    for (const l of pod.labels) {
      const eq = l.indexOf("=")
      const lk = eq >= 0 ? l.slice(0, eq) : l
      const lv = eq >= 0 ? l.slice(eq + 1) : ""
      rows.push({ key: lk, value: lv, indent: true })
    }
  }

  if (pod.annotations.length === 1 && pod.annotations[0] === DASH) {
    rows.push({ key: "Annotations", value: DASH })
  } else {
    rows.push({ key: "Annotations", value: "", isParent: true })
    for (const a of pod.annotations) {
      const eq = a.indexOf("=")
      const ak = eq >= 0 ? a.slice(0, eq) : a
      const av = eq >= 0 ? a.slice(eq + 1) : ""
      rows.push({ key: ak, value: av, indent: true })
    }
  }

  rows.push({ key: "Created", value: pod.created ? `${pod.created} ago` : DASH })
  rows.push({ key: "Phase", value: val(pod.phase) })
  rows.push({ key: "Pod IP", value: val(pod.podIP) })
  rows.push({ key: "Host IP", value: val(pod.hostIP) })
  rows.push({ key: "Restarts", value: `${pod.restarts}` })
  rows.push({ key: "Ready", value: pod.ready ? "true" : "false" })
  rows.push({ key: "QoS", value: val(pod.qosClass) })

  return rows
}

interface PodBoxProps {
  pod: PodDetailFull
  focused: boolean
  scrollOffset: number
  maxVisible: number
}

export function PodBox({ pod, focused, scrollOffset, maxVisible }: PodBoxProps) {
  const rows = buildPodRows(pod)
  const visible = rows.slice(scrollOffset, scrollOffset + maxVisible)

  return (
    <Panel title="POD" focused={focused} height={10}>
      {visible.map((row, i) => {
        if (row.isParent) {
          return (
            <box key={`p-${i}`} style={{ height: 1, width: "100%" }}>
              <text content={t`${bold(fg("#58A6FF")(row.key))}`} />
            </box>
          )
        }

        const keyColor = "#8B949E"
        const valColor = "#E6EDF3"

        if (row.indent) {
          return (
            <box key={`p-${i}`} style={{ height: 1, width: "100%" }}>
              <text content={t`${fg(keyColor)(`  ${pad(row.key, KEY_WIDTH - 2)}${SEP}`)}${fg(valColor)(row.value)}`} />
            </box>
          )
        }

        return (
          <box key={`p-${i}`} style={{ height: 1, width: "100%" }}>
            <text content={t`${fg(keyColor)(pad(row.key, KEY_WIDTH))}${SEP}${fg(valColor)(row.value)}`} />
          </box>
        )
      })}
    </Panel>
  )
}
