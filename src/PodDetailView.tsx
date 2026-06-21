import { useEffect, useRef } from "react"
import { useTerminalDimensions } from "@opentui/react"
import { t, fg, bold } from "@opentui/core"
import type { PodDetailFull } from "./types"

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

function buildRows(pod: PodDetailFull, section: Section): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = []

  switch (section.type) {
    case "metadata":
      rows.push({ key: "Name", value: val(pod.name) })
      rows.push({ key: "Namespace", value: val(pod.namespace) })
      rows.push({ key: "Labels", value: val(pod.labels) })
      rows.push({ key: "Annotations", value: val(pod.annotations) })
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
        <box style={{ height: 1, width: "100%", paddingBottom: 1 }}>
          <text content={t`${bold(fg("#58A6FF")("Yaml"))}`} />
        </box>
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
      <box style={{ height: 1, width: "100%", paddingBottom: 1 }}>
        <text content={t`${bold(fg("#58A6FF")(section.label))}`} />
      </box>
      {visible.map((row, i) => {
        const absIndex = scrollOffset + i
        const isHighlighted = detailMode && absIndex === detailRowIndex
        const keyColor = isHighlighted ? "#E6EDF3" : "#8B949E"
        const valColor = isHighlighted ? "#E6EDF3" : "#E6EDF3"
        const bgColor = isHighlighted ? "#1A3A5C" : undefined

        return (
          <box key={`kv-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
            <text content={t`${fg(keyColor)(pad(row.key, KEY_WIDTH))}${SEP}${fg(valColor)(row.value)}`} />
          </box>
        )
      })}
    </box>
  )
}
