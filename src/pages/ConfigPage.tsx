import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { Section } from "../components/Section"
import { Panel } from "../components/Panel"
import { CommandsBar, type CommandItem } from "../components/CommandsBar"
import { PodTable } from "../components/PodTable"
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

interface ConfigPageProps {
  kind: string
  name: string
  namespace: string
  summary: DetailRow[]
  pods: PodDetail[]
  loading: boolean
  onOpenPod: (pod: PodDetail) => void
  onBack: () => void
  onQuit: () => void
}

export function ConfigPage({
  kind,
  name,
  namespace,
  summary,
  pods,
  loading,
  onOpenPod,
  onBack,
  onQuit,
}: ConfigPageProps) {
  const [podIndex, setPodIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const podScrollRef = useRef<any>(null)
  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [loading])

  useEffect(() => {
    setPodIndex(0)
  }, [kind, name, namespace])

  const scrollIntoView = useCallback((scrollRef: React.RefObject<any>, id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "up") {
        if (podIndex > 0) {
          const newIdx = podIndex - 1
          setPodIndex(newIdx)
          scrollIntoView(podScrollRef, `pod-${newIdx}`)
        }
      } else if (key.name === "down") {
        if (podIndex < pods.length - 1) {
          const newIdx = podIndex + 1
          setPodIndex(newIdx)
          scrollIntoView(podScrollRef, `pod-${newIdx}`)
        }
      } else if (key.name === "return") {
        const pod = pods[podIndex]
        if (pod) onOpenPod(pod)
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [podIndex, pods, onOpenPod, onBack, onQuit, scrollIntoView],
  )

  useKeyboard(handleKey)

  const commands = useMemo<CommandItem[]>(() => [
    { key: "[enter]", label: "pod" },
    { key: "[esc]", label: "back" },
    { key: "[q]", label: "uit" },
  ], [])

  return (
    <>
      <Section title={`SUMMARY | ${kind}: ${name}`} height={Math.max(5, summary.length + 3)}>
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
      </Section>
      <Panel title="REFS" focused flexGrow={1}>
        {loading ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
          </box>
        ) : pods.length === 0 ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text fg="#8B949E" content={`No pods reference this ${kind === "Secret" ? "secret" : "configmap"}`} />
          </box>
        ) : (
          <PodTable pods={pods} selectedIndex={podIndex} scrollRef={podScrollRef} />
        )}
      </Panel>

      <CommandsBar commands={commands} />
    </>
  )
}
