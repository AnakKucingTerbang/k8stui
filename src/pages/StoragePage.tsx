import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { CommandsBar, type CommandItem } from "../components/CommandsBar"
import type { PodDetail, DetailRow } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const DASH = "──"
const KEY_WIDTH = 14
const SEP = "  "

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function val(s: string): string {
  return s || DASH
}

function podStatusColor(status: string): string {
  if (status === "Running") return "#3FB950"
  if (status === "Completed" || status === "Succeeded") return "#8B949E"
  if (status === "Pending" || status === "ContainerCreating") return "#D29922"
  return "#F85149"
}

const POD_COL = {
  name: 28,
  namespace: 14,
  status: 18,
  cpu: 9,
  mem: 9,
  age: 8,
}

function lpad(s: string, len: number): string {
  if (s.length >= len) return s
  return " ".repeat(len - s.length) + s
}

interface StoragePageProps {
  name: string
  namespace: string
  summary: DetailRow[]
  mountPod: PodDetail | null
  loading: boolean
  onOpenPod: (pod: PodDetail) => void
  onBack: () => void
  onQuit: () => void
}

export function StoragePage({
  name,
  namespace,
  summary,
  mountPod,
  loading,
  onOpenPod,
  onBack,
  onQuit,
}: StoragePageProps) {
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [loading])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "return") {
        if (mountPod) onOpenPod(mountPod)
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [mountPod, onOpenPod, onBack, onQuit],
  )

  useKeyboard(handleKey)

  const commands = useMemo<CommandItem[]>(() => [
    { key: "[enter]", label: "pod" },
    { key: "[esc]", label: "back" },
    { key: "[q]", label: "uit" },
  ], [])

  return (
    <>
      <box
        title={`SUMMARY | PVC: ${name}`}
        borderStyle="single"
        borderColor="#30363D"
        style={{ flexDirection: "column", height: Math.max(5, summary.length + 3), width: "100%" }}
      >
        {loading ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
          </box>
        ) : (
          <box style={{ flexDirection: "column", paddingLeft: 1, paddingTop: 1, gap: 0 }}>
            {summary.map((row, i) => {
              if (row.isParent) {
                return <text key={i} content={t`${fg("#E6EDF3")(pad(row.key, KEY_WIDTH))}`} />
              }
              const prefix = row.indent ? "  " : ""
              const keyColor = row.indent ? "#8B949E" : "#58A6FF"
              const displayKey = row.indent ? pad(row.key, KEY_WIDTH - 2) : pad(row.key, KEY_WIDTH)
              return <text key={i} content={t`${prefix}${fg(keyColor)(displayKey)}${SEP}${fg("#8B949E")(val(row.value))}`} />
            })}
          </box>
        )}
      </box>
      <box
        title="MOUNT"
        borderStyle="single"
        borderColor="#58A6FF"
        style={{ flexDirection: "column", flexGrow: 1, width: "100%" }}
      >
        {loading ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
          </box>
        ) : mountPod ? (
          <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0 }}>
            <text content={t`${fg("#E6EDF3")(pad("NAME", POD_COL.name))}  ${fg("#E6EDF3")(pad("NAMESPACE", POD_COL.namespace))}  ${fg("#E6EDF3")(pad("STATUS", POD_COL.status))}  ${fg("#E6EDF3")(lpad("CPU", POD_COL.cpu))}  ${fg("#E6EDF3")(lpad("MEM", POD_COL.mem))}  ${fg("#E6EDF3")(lpad("AGE", POD_COL.age))}`} style={{ height: 1, flexShrink: 0 }} />
            <box style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
              <text content={t`${fg("#E6EDF3")(pad(mountPod.name, POD_COL.name))}  ${fg("#E6EDF3")(pad(mountPod.namespace, POD_COL.namespace))}  ${fg(podStatusColor(mountPod.status))(pad(mountPod.status, POD_COL.status))}  ${fg("#E6EDF3")(lpad(mountPod.cpu, POD_COL.cpu))}  ${fg("#E6EDF3")(lpad(mountPod.mem, POD_COL.mem))}  ${fg("#E6EDF3")(lpad(mountPod.age, POD_COL.age))}`} />
            </box>
          </box>
        ) : (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text fg="#8B949E" content="No pod mounting this PVC" />
          </box>
        )}
      </box>

      <CommandsBar commands={commands} />
    </>
  )
}
