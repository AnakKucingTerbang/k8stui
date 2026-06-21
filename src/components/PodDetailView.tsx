import { useEffect, useRef } from "react"
import { useTerminalDimensions } from "@opentui/react"
import { t, fg, bold } from "@opentui/core"
import type { PodDetailFull } from "../types"

type Section =
  | { type: "metadata"; label: string }
  | { type: "container"; label: string; containerIndex: number }
  | { type: "environment"; label: string; containerIndex: number }
  | { type: "status"; label: string }
  | { type: "yaml"; label: string }

export function buildSections(pod: PodDetailFull): Section[] {
  const sections: Section[] = []
  sections.push({ type: "metadata", label: "Metadata" })

  pod.containers.forEach((container, i) => {
    sections.push({ type: "container", label: `Container: ${container.name}`, containerIndex: i })
    if (container.env.length > 0) {
      sections.push({ type: "environment", label: "Environment", containerIndex: i })
    }
  })

  sections.push({ type: "status", label: "Status" })
  sections.push({ type: "yaml", label: "Yaml" })
  return sections
}

interface PodSectionListProps {
  pod: PodDetailFull
  selectedIndex: number
}

export function PodSectionList({ pod, selectedIndex }: PodSectionListProps) {
  const sections = buildSections(pod)

  return (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0 }}>
      {sections.map((section, i) => {
        const isSelected = i === selectedIndex
        const bgColor = isSelected ? "#1A3A5C" : undefined
        const textColor = isSelected ? "#E6EDF3" : "#8B949E"

        return (
          <box key={`s-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
            <text content={t`${fg(textColor)(` ${section.label}`)}`} />
          </box>
        )
      })}
    </box>
  )
}

const KEY_WIDTH = 18
const SEP = "  "
const DASH = "──"

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function val(s: string): string {
  return s || DASH
}

interface Row {
  key: string
  value: string
  isParent?: boolean
  indent?: boolean
}

function buildRows(pod: PodDetailFull, section: Section): Row[] {
  const rows: Row[] = []

  switch (section.type) {
    case "metadata":
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
      break
    case "container": {
      const c = pod.containers[section.containerIndex]
      if (!c) break
      rows.push({ key: "Image", value: val(c.image) })
      if (c.command.length > 0) rows.push({ key: "Command", value: c.command.join(" ") })
      if (c.args.length > 0) rows.push({ key: "Args", value: c.args.join(" ") })
      if (c.ports.length > 0) rows.push({ key: "Ports", value: c.ports.join(", ") })
      rows.push({ key: "CPU Request", value: val(c.cpuRequest) })
      rows.push({ key: "CPU Limit", value: val(c.cpuLimit) })
      rows.push({ key: "Memory Request", value: val(c.memRequest) })
      rows.push({ key: "Memory Limit", value: val(c.memLimit) })
      rows.push({ key: "Liveness", value: val(c.livenessProbe) })
      rows.push({ key: "Readiness", value: val(c.readinessProbe) })
      break
    }
    case "environment": {
      const c = pod.containers[section.containerIndex]
      if (!c) break
      for (const env of c.env) {
        rows.push({ key: env.name, value: val(env.value) })
      }
      break
    }
    case "status":
      rows.push({ key: "Phase", value: val(pod.phase) })
      rows.push({ key: "Pod IP", value: val(pod.podIP) })
      rows.push({ key: "Host IP", value: val(pod.hostIP) })
      rows.push({ key: "Restarts", value: `${pod.restarts}` })
      rows.push({ key: "Ready", value: pod.ready ? "true" : "false" })
      rows.push({ key: "QoS Class", value: val(pod.qosClass) })
      break
    case "yaml":
      break
  }

  return rows
}

export interface SelectedDisplay {
  key: string
  value: string
  isParent: boolean
}

export function getSelectedDisplay(pod: PodDetailFull, sectionIndex: number, rowIndex: number, scrollOffset: number): SelectedDisplay | null {
  const sections = buildSections(pod)
  const section = sections[sectionIndex]
  if (!section) return null

  if (section.type === "yaml") {
    const lines = (pod.yaml || DASH).split("\n")
    const lineIndex = scrollOffset + rowIndex
    const line = lines[lineIndex]
    if (line === undefined) return null
    return { key: "", value: line, isParent: false }
  }

  const rows = buildRows(pod, section)
  const row = rows[rowIndex]
  if (!row) return null
  return { key: row.key, value: row.value, isParent: !!row.isParent }
}

export function getDetailValue(pod: PodDetailFull, sectionIndex: number, rowIndex: number): string {
  const sections = buildSections(pod)
  const section = sections[sectionIndex]
  if (!section) return ""
  const rows = buildRows(pod, section)
  return rows[rowIndex]?.value ?? ""
}

export function getDetailRowCount(pod: PodDetailFull, sectionIndex: number): number {
  const sections = buildSections(pod)
  const section = sections[sectionIndex]
  if (!section) return 0
  return buildRows(pod, section).length
}

interface PodSectionDetailProps {
  pod: PodDetailFull
  sectionIndex: number
  scrollOffset: number
  detailMode: boolean
  detailRowIndex: number
}

export function PodSectionDetail({ pod, sectionIndex, scrollOffset, detailMode, detailRowIndex }: PodSectionDetailProps) {
  const { height: termHeight } = useTerminalDimensions()
  const maxVisibleRows = Math.max(1, termHeight - 24)

  const sections = buildSections(pod)
  const section = sections[sectionIndex]

  if (!section) {
    return (
      <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0 }}>
        <text fg="#8B949E" content={DASH} />
      </box>
    )
  }

  if (section.type === "yaml") {
    const lines = (pod.yaml || DASH).split("\n")
    const visible = lines.slice(scrollOffset, scrollOffset + maxVisibleRows)
    return (
      <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0 }}>
        {visible.map((line, i) => (
          <box key={`yl-${i}`} style={{ height: 1, width: "100%" }}>
            <text fg="#8B949E" content={line} />
          </box>
        ))}
      </box>
    )
  }

  const rows = buildRows(pod, section)
  const visible = rows.slice(scrollOffset, scrollOffset + maxVisibleRows)

  return (
    <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0 }}>
      {visible.map((row, i) => {
        const absIndex = scrollOffset + i
        const isHighlighted = detailMode && absIndex === detailRowIndex
        const bgColor = isHighlighted ? "#1A3A5C" : undefined

        if (row.isParent) {
          return (
            <box key={`kv-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={t`${bold(fg("#58A6FF")(row.key))}`} />
            </box>
          )
        }

        const keyColor = isHighlighted ? "#E6EDF3" : "#8B949E"
        const valColor = isHighlighted ? "#E6EDF3" : "#E6EDF3"

        if (row.indent) {
          return (
            <box key={`kv-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={t`${fg(keyColor)(`  ${pad(row.key, KEY_WIDTH - 2)}${SEP}`)}${fg(valColor)(row.value)}`} />
            </box>
          )
        }

        return (
          <box key={`kv-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
            <text content={t`${fg(keyColor)(pad(row.key, KEY_WIDTH))}${SEP}${fg(valColor)(row.value)}`} />
          </box>
        )
      })}
    </box>
  )
}
