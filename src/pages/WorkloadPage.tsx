import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard, useRenderer } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { Section } from "../components/Section"
import { Panel } from "../components/Panel"
import { CommandsBar, type CommandItem } from "../components/CommandsBar"
import { PodTable } from "../components/PodTable"
import { RolloutRestartModal } from "../components/RolloutRestartModal"
import { Toast } from "../components/Toast"
import { RESTARTABLE_KINDS } from "../utils/kube"
import type { PodDetail, DetailRow, MetricMode } from "../types"

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

interface WorkloadPageProps {
  kind: string
  name: string
  namespace: string
  summary: DetailRow[]
  pods: PodDetail[]
  loading: boolean
  metricMode: MetricMode
  contextName: string
  onOpenPod: (pod: PodDetail) => void
  onBack: () => void
  onQuit: () => void
  onRefresh: () => void
}

export function WorkloadPage({
  kind,
  name,
  namespace,
  summary,
  pods,
  loading,
  metricMode,
  contextName,
  onOpenPod,
  onBack,
  onQuit,
  onRefresh,
}: WorkloadPageProps) {
  const [podIndex, setPodIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [showRestartModal, setShowRestartModal] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const podScrollRef = useRef<any>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderer = useRenderer()
  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  const canRestart = RESTARTABLE_KINDS.has(kind)

  const toast = useCallback((msg: string) => {
    setToastMessage(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 5000)
  }, [])

  const handleRestarted = useCallback(() => {
    setShowRestartModal(false)
    onRefresh()
  }, [onRefresh])

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
      if (showRestartModal) return

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
      } else if (key.name === "r" && canRestart) {
        setShowRestartModal(true)
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [podIndex, pods, onOpenPod, onBack, onQuit, scrollIntoView, canRestart, showRestartModal],
  )

  useKeyboard(handleKey)

  const commands = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      { key: "[enter]", label: "pod" },
    ]
    if (canRestart) base.push({ key: "[r]", label: "estart" })
    base.push({ key: "[esc]", label: "back" })
    base.push({ key: "[q]", label: "uit" })
    return base
  }, [canRestart])

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
      <Panel title="PODS" focused flexGrow={1}>
        {loading ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading pods...")}`} />
          </box>
        ) : (
          <PodTable pods={pods} selectedIndex={podIndex} scrollRef={podScrollRef} metricMode={metricMode} />
        )}
      </Panel>

      <CommandsBar commands={commands} />

      {showRestartModal && (
        <RolloutRestartModal
          kind={kind}
          name={name}
          namespace={namespace}
          contextName={contextName}
          termWidth={renderer.width ?? 120}
          termHeight={renderer.height ?? 40}
          spinner={spinner}
          onClose={() => setShowRestartModal(false)}
          onRestarted={handleRestarted}
          onToast={toast}
        />
      )}

      <Toast message={toastMessage} />
    </>
  )
}
