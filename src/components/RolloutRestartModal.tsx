import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg, bold } from "@opentui/core"
import { Modal } from "./Modal"
import { CommandsBar, type CommandItem } from "./CommandsBar"
import { rolloutRestartAsync, fetchRolloutPodsAsync } from "../utils/kube"
import type { RolloutPod } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const POLL_INTERVAL = 2000

type ModalStep = "confirm" | "restarting" | "failed" | "tracking"

const STATUS_COLORS: Record<string, string> = {
  Running: "#3FB950",
  Terminating: "#D29922",
  ContainerCreating: "#8B949E",
  Pending: "#8B949E",
  CrashLoopBackOff: "#F85149",
  Error: "#F85149",
  ImagePullBackOff: "#F85149",
  Failed: "#F85149",
}

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#8B949E"
}

const COL = { pod: 34, node: 24, status: 18 }
const SEP = "  "

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

interface RolloutRestartModalProps {
  kind: string
  name: string
  namespace: string
  contextName: string
  termWidth: number
  termHeight: number
  spinner: string
  onClose: () => void
  onRestarted: () => void
  onToast: (msg: string) => void
}

export function RolloutRestartModal({
  kind,
  name,
  namespace,
  contextName,
  termWidth,
  termHeight,
  spinner,
  onClose,
  onRestarted,
  onToast,
}: RolloutRestartModalProps) {
  const [step, setStep] = useState<ModalStep>("confirm")
  const [pods, setPods] = useState<RolloutPod[]>([])
  const [podIndex, setPodIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [restartError, setRestartError] = useState("")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<any>(null)

  const ownSpinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"
  const activeSpinner = step === "confirm" ? spinner : ownSpinner

  useEffect(() => {
    const spinning = step === "restarting"
    if (!spinning) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [step])

  useEffect(() => {
    if (step !== "tracking") {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }

    const doPoll = async () => {
      const fresh = await fetchRolloutPodsAsync(contextName, namespace, kind, name)
      setPods(fresh)
    }

    doPoll()
    pollRef.current = setInterval(doPoll, POLL_INTERVAL)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [step, contextName, namespace, kind, name])

  useEffect(() => { setPodIndex(0) }, [pods.length])

  const doRestart = useCallback(async () => {
    setStep("restarting")
    const result = await rolloutRestartAsync(contextName, kind, name, namespace)
    if (result.success) {
      onToast(`${kind} ${name} restarted`)
      setStep("tracking")
    } else {
      setRestartError(result.output)
      setStep("failed")
    }
  }, [contextName, kind, name, namespace, onToast])

  const doClose = useCallback(() => {
    setPods([])
    if (step === "tracking" || step === "failed") onRestarted()
    onClose()
  }, [step, onRestarted, onClose])

  const handleKey = useCallback((key: { name: string }) => {
    if (step === "restarting") return

    if (step === "confirm") {
      if (key.name === "escape") { onClose(); return }
      if (key.name === "return") { doRestart(); return }
      return
    }

    if (step === "failed") {
      if (key.name === "escape" || key.name === "return") { doClose(); return }
      return
    }

    if (step === "tracking") {
      if (key.name === "escape" || key.name === "return") { doClose(); return }
      if (key.name === "up") {
        if (podIndex > 0) {
          const newIdx = podIndex - 1
          setPodIndex(newIdx)
          scrollRef.current?.scrollChildIntoView?.(`rtrack-${newIdx}`)
        }
      } else if (key.name === "down") {
        if (podIndex < pods.length - 1) {
          const newIdx = podIndex + 1
          setPodIndex(newIdx)
          scrollRef.current?.scrollChildIntoView?.(`rtrack-${newIdx}`)
        }
      }
    }
  }, [step, podIndex, pods.length, doRestart, doClose, onClose])

  useKeyboard(handleKey)

  const commands = useMemo<CommandItem[]>(() => {
    if (step === "confirm") {
      return [
        { key: "[enter]", label: "confirm" },
        { key: "[esc]", label: "cancel" },
      ]
    }
    if (step === "restarting") {
      return [{ key: activeSpinner, label: "Restarting...", keyColor: "#D29922" }]
    }
    if (step === "failed") {
      return [{ key: "✗ failed", label: "", keyColor: "#F85149" }, { key: "[esc]", label: "close" }]
    }
    if (step === "tracking") {
      return [
        { key: "[↑↓]", label: "nav" },
        { key: "[esc]", label: "close" },
      ]
    }
    return []
  }, [step, activeSpinner])

  const modalWidth = Math.min(88, termWidth - 4)
  const modalHeight = Math.min(termHeight - 6, step === "tracking" ? 24 : 14)
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)

  const renderContent = () => {
    if (step === "confirm") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content="" />
          <text content={t`${fg("#8B949E")("Kind:      ")}${fg("#E6EDF3")(kind)}`} />
          <text content={t`${fg("#8B949E")("Name:      ")}${fg("#E6EDF3")(name)}`} />
          <text content={t`${fg("#8B949E")("Namespace: ")}${fg("#E6EDF3")(namespace)}`} />
          <text content="" />
          <text content={t`${fg("#8B949E")("All pods will be recreated.")}`} />
        </box>
      )
    }

    if (step === "restarting") {
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(activeSpinner)} ${fg("#8B949E")("Restarting...")}`} />
        </box>
      )
    }

    if (step === "failed") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#F85149")("✗ Restart failed")}`} />
          <text content={t`${fg("#8B949E")(restartError)}`} />
        </box>
      )
    }

    if (step === "tracking") {
      const header = t`${bold(fg("#E6EDF3")(pad("POD", COL.pod)))}${SEP}${bold(fg("#E6EDF3")(pad("NODE", COL.node)))}${SEP}${bold(fg("#E6EDF3")(pad("STATUS", COL.status)))}`

      return (
        <box style={{ flexDirection: "column", width: "100%", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
          <text content={header} style={{ height: 1, flexShrink: 0 }} />
          <scrollbox
            ref={scrollRef}
            scrollY={true}
            viewportCulling={true}
            style={{ width: "100%", flexGrow: 1 }}
            contentOptions={{ minHeight: "100%" }}
          >
            {pods.length === 0 ? (
              <box style={{ height: 1, width: "100%" }}>
                <text content={t`${fg("#484F58")("  Waiting for pods...")}`} />
              </box>
            ) : (
              pods.map((pod, i) => {
                const isSelected = i === podIndex
                const bgColor = isSelected ? "#1A3A5C" : undefined
                const textColor = isSelected ? "#E6EDF3" : statusColor(pod.status)
                const nodeColor = isSelected ? "#E6EDF3" : "#8B949E"
                const content = t`${fg(textColor)(pad(pod.name, COL.pod))}${SEP}${fg(nodeColor)(pad(pod.node, COL.node))}${SEP}${fg(textColor)(pad(pod.status, COL.status))}`

                return (
                  <box key={`${pod.name}-${i}`} id={`rtrack-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                    <text content={content} />
                  </box>
                )
              })
            )}
          </scrollbox>
        </box>
      )
    }

    return null
  }

  const title = (() => {
    if (step === "confirm") return "rollout restart"
    if (step === "restarting") return "rollout restart — restarting"
    if (step === "failed") return "rollout restart — failed"
    if (step === "tracking") return "rollout restart — tracking"
    return "rollout restart"
  })()

  return (
    <Modal
      title={title}
      top={modalTop}
      left={modalLeft}
      width={modalWidth}
      height={modalHeight}
      footer={<CommandsBar commands={commands} />}
    >
      {renderContent()}
    </Modal>
  )
}
