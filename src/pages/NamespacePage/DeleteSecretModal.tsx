import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { Modal } from "../../components/Modal"
import { CommandsBar, type CommandItem } from "../../components/CommandsBar"
import { fetchSecretDetailAsync } from "../../utils/kube"
import { getSecretManagement } from "../../utils/secret-registry"
import { deleteSecret } from "../../utils/secret-registry"
import { sshDeleteFile } from "../../utils/ssh"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type ModalStep = "loading" | "confirm" | "dotenv-choice" | "deleting" | "result"

interface DeleteSecretModalProps {
  namespace: string
  secretName: string
  contextName: string
  termWidth: number
  termHeight: number
  spinner: string
  onClose: () => void
  onDeleted: () => void
  onToast: (msg: string) => void
}

export function DeleteSecretModal({
  namespace,
  secretName,
  contextName,
  termWidth,
  termHeight,
  spinner,
  onClose,
  onDeleted,
  onToast,
}: DeleteSecretModalProps) {
  const [step, setStep] = useState<ModalStep>("loading")
  const [dotenvHost, setDotenvHost] = useState("")
  const [dotenvPath, setDotenvPath] = useState("")
  const [deleteEnvToo, setDeleteEnvToo] = useState(false)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [result, setResult] = useState<{ success: boolean; output: string } | null>(null)
  const [loadError, setLoadError] = useState("")
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const ownSpinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"
  const activeSpinner = step === "confirm" ? spinner : ownSpinner

  useEffect(() => {
    let cancelled = false
    fetchSecretDetailAsync(contextName, namespace, secretName).then((data) => {
      if (cancelled) return
      const mgmt = getSecretManagement(data.annotations)
      if (mgmt && mgmt.strategy === "dotenv") {
        setDotenvHost(mgmt.host)
        setDotenvPath(mgmt.path)
        setStep("dotenv-choice")
      } else {
        setStep("confirm")
      }
    }).catch(() => {
      if (cancelled) return
      setLoadError("Failed to load secret annotations")
      setStep("confirm")
    })
    return () => { cancelled = true }
  }, [contextName, namespace, secretName])

  useEffect(() => {
    const spinning = step === "loading" || step === "deleting"
    if (!spinning) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [step])

  const modalWidth = Math.min(56, termWidth - 4)
  const modalHeight = Math.min(termHeight - 6, 18)
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)

  const doDelete = useCallback(async (alsoDeleteEnv: boolean) => {
    setStep("deleting")
    let envDeleteError = ""
    if (alsoDeleteEnv && dotenvHost && dotenvPath) {
      try {
        await sshDeleteFile(dotenvHost, dotenvPath)
      } catch (err: any) {
        envDeleteError = `.env delete failed: ${err.message || err}`
      }
    }
    const k8sResult = await deleteSecret(contextName, namespace, secretName)
    if (k8sResult.success) {
      let msg = `secret ${secretName} deleted`
      if (alsoDeleteEnv && !envDeleteError) msg += " with .env"
      if (envDeleteError) msg += ` (${envDeleteError})`
      onToast(msg)
      setResult({ success: true, output: msg })
    } else {
      setResult({ success: false, output: envDeleteError ? `${envDeleteError}; ${k8sResult.output}` : k8sResult.output })
    }
    setStep("result")
  }, [contextName, namespace, secretName, dotenvHost, dotenvPath, onToast])

  const handleKey = useCallback((key: { name: string }) => {
    if (step === "loading" || step === "deleting") return

    if (step === "result") {
      if (key.name === "escape" || key.name === "return") {
        if (result?.success) onDeleted()
        else onClose()
      }
      return
    }

    if (step === "confirm") {
      if (key.name === "escape") { onClose(); return }
      if (key.name === "return") { doDelete(false); return }
      return
    }

    if (step === "dotenv-choice") {
      if (key.name === "d") { doDelete(true); return }
      if (key.name === "k") { doDelete(false); return }
      if (key.name === "escape") { onClose(); return }
      return
    }
  }, [step, dotenvHost, dotenvPath, result, doDelete, onClose, onDeleted])

  useKeyboard(handleKey)

  const commands = useMemo<CommandItem[]>(() => {
    if (step === "loading") {
      return [{ key: activeSpinner, label: "Loading...", keyColor: "#D29922" }]
    }
    if (step === "deleting") {
      return [{ key: activeSpinner, label: "Deleting...", keyColor: "#D29922" }]
    }
    if (step === "result") {
      if (result?.success) {
        return [{ key: "✓ deleted", label: "", keyColor: "#3FB950" }, { key: "[esc]", label: "close" }]
      }
      return [{ key: "✗ failed", label: "", keyColor: "#F85149" }, { key: "[esc]", label: "back" }]
    }
    if (step === "confirm") {
      return [
        { key: "[enter]", label: "confirm" },
        { key: "[esc]", label: "cancel" },
      ]
    }
    if (step === "dotenv-choice") {
      return [
        { key: "[d]", label: "delete .env" },
        { key: "[k]", label: "keep .env" },
        { key: "[esc]", label: "cancel" },
      ]
    }
    return []
  }, [step, result, activeSpinner])

  const renderContent = () => {
    if (step === "loading" || step === "deleting") {
      const label = step === "loading" ? "Loading secret..."
        : "Deleting..."
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(activeSpinner)} ${fg("#8B949E")(label)}`} />
        </box>
      )
    }

    if (step === "result" && result) {
      if (result.success) {
        return (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, gap: 1 }}>
            <text content={t`${fg("#3FB950")("✓")} ${fg("#8B949E")("Secret " + secretName + " deleted from " + namespace)}`} />
            {dotenvHost && dotenvPath && deleteEnvToo && (
              <text content={t`${fg("#8B949E")(".env removed from " + dotenvHost + ":" + dotenvPath)}`} />
            )}
          </box>
        )
      }
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#F85149")("✗ Deletion failed")}`} />
          <text content={t`${fg("#8B949E")(result.output)}`} />
        </box>
      )
    }

    if (step === "confirm") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#F85149")("Delete secret?")}`} />
          <text content="" />
          <text content={t`${fg("#8B949E")("Name:      ")}${fg("#E6EDF3")(secretName)}`} />
          <text content={t`${fg("#8B949E")("Namespace: ")}${fg("#E6EDF3")(namespace)}`} />
          {loadError && (
            <text content={t`${fg("#D29922")("⚠ " + loadError + " — will delete K8s secret only")}`} />
          )}
          <text content="" />
          <text content={t`${fg("#8B949E")("This cannot be undone.")}`} />
        </box>
      )
    }

    if (step === "dotenv-choice") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#F85149")("Delete secret?")}`} />
          <text content="" />
          <text content={t`${fg("#8B949E")("Name:      ")}${fg("#E6EDF3")(secretName)}`} />
          <text content={t`${fg("#8B949E")("Namespace: ")}${fg("#E6EDF3")(namespace)}`} />
          <text content="" />
          <text content={t`${fg("#D29922")("Has .env source of truth")}`} />
          <text content={t`${fg("#8B949E")("Host: ")}${fg("#E6EDF3")(dotenvHost)}`} />
          <text content={t`${fg("#8B949E")("Path: ")}${fg("#E6EDF3")(dotenvPath)}`} />
          <text content="" />
        </box>
      )
    }

    return null
  }

  const title = (() => {
    if (step === "loading") return "delete secret"
    if (step === "confirm") return "delete secret"
    if (step === "dotenv-choice") return "delete secret — .env"
    if (step === "deleting") return "delete secret — deleting"
    if (step === "result") return `delete secret — ${result?.success ? "done" : "failed"}`
    return "delete secret"
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
