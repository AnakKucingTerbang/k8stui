import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { Modal } from "./Modal"
import { CommandsBar, type CommandItem } from "./CommandsBar"
import { triggerCronJobAsync } from "../utils/kube"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type ModalStep = "confirm" | "triggering" | "done" | "failed"

interface CronJobTriggerModalProps {
  name: string
  namespace: string
  contextName: string
  termWidth: number
  termHeight: number
  spinner: string
  onClose: () => void
  onToast: (msg: string) => void
}

export function CronJobTriggerModal({
  name,
  namespace,
  contextName,
  termWidth,
  termHeight,
  spinner,
  onClose,
  onToast,
}: CronJobTriggerModalProps) {
  const [step, setStep] = useState<ModalStep>("confirm")
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [triggerError, setTriggerError] = useState("")
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const jobName = useMemo(() => `${name}-manual-${Math.floor(Date.now() / 1000)}`, [name])
  const ownSpinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"
  const activeSpinner = step === "confirm" ? spinner : ownSpinner

  useEffect(() => {
    const spinning = step === "triggering"
    if (!spinning) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [step])

  const doTrigger = useCallback(async () => {
    setStep("triggering")
    const result = await triggerCronJobAsync(contextName, name, namespace, jobName)
    if (result.success) {
      onToast(`Job created: ${jobName}`)
      setStep("done")
    } else {
      setTriggerError(result.output)
      setStep("failed")
    }
  }, [contextName, name, namespace, jobName, onToast])

  const handleKey = useCallback((key: { name: string }) => {
    if (step === "triggering") return

    if (step === "confirm") {
      if (key.name === "escape") { onClose(); return }
      if (key.name === "return") { doTrigger(); return }
      return
    }

    if (step === "done" || step === "failed") {
      if (key.name === "escape" || key.name === "return") { onClose(); return }
      return
    }
  }, [step, doTrigger, onClose])

  useKeyboard(handleKey)

  const commands = useMemo<CommandItem[]>(() => {
    if (step === "confirm") {
      return [
        { key: "[enter]", label: "confirm" },
        { key: "[esc]", label: "cancel" },
      ]
    }
    if (step === "triggering") {
      return [{ key: activeSpinner, label: "Triggering...", keyColor: "#D29922" }]
    }
    if (step === "done") {
      return [{ key: "✓ created", label: "", keyColor: "#3FB950" }, { key: "[esc]", label: "close" }]
    }
    if (step === "failed") {
      return [{ key: "✗ failed", label: "", keyColor: "#F85149" }, { key: "[esc]", label: "close" }]
    }
    return []
  }, [step, activeSpinner])

  const modalWidth = Math.min(88, termWidth - 4)
  const modalHeight = Math.min(termHeight - 6, 14)
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)

  const renderContent = () => {
    if (step === "confirm") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content="" />
          <text content={t`${fg("#8B949E")("CronJob:   ")}${fg("#E6EDF3")(name)}`} />
          <text content={t`${fg("#8B949E")("Namespace: ")}${fg("#E6EDF3")(namespace)}`} />
          <text content={t`${fg("#8B949E")("Job name:  ")}${fg("#E6EDF3")(jobName)}`} />
          <text content="" />
          <text content={t`${fg("#8B949E")("A manual Job will be created from this CronJob.")}`} />
        </box>
      )
    }

    if (step === "triggering") {
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(activeSpinner)} ${fg("#8B949E")("Triggering...")}`} />
        </box>
      )
    }

    if (step === "done") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#3FB950")("✓ Job created")}`} />
          <text content={t`${fg("#8B949E")("Name: ")}${fg("#E6EDF3")(jobName)}`} />
        </box>
      )
    }

    if (step === "failed") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#F85149")("✗ Trigger failed")}`} />
          <text content={t`${fg("#8B949E")(triggerError)}`} />
        </box>
      )
    }

    return null
  }

  const title = (() => {
    if (step === "confirm") return "trigger cronjob"
    if (step === "triggering") return "trigger cronjob — running"
    if (step === "done") return "trigger cronjob — done"
    if (step === "failed") return "trigger cronjob — failed"
    return "trigger cronjob"
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
