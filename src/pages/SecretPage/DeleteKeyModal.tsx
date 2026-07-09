import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useKeyboard } from "@opentui/react"
import { Modal } from "../../components/Modal"
import { CommandsBar, type CommandItem } from "../../components/CommandsBar"
import type { SyncResult } from "../../types"

interface DeleteKeyModalProps {
  keyName: string
  host: string
  termWidth: number
  termHeight: number
  onConfirm: () => Promise<SyncResult>
  onCancel: () => void
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function DeleteKeyModal({
  keyName,
  host,
  termWidth,
  termHeight,
  onConfirm,
  onCancel,
}: DeleteKeyModalProps) {
  const [saving, setSaving] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]

  useEffect(() => {
    if (!saving) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [saving])

const modalWidth = Math.min(60, termWidth - 8)
  const modalHeight = Math.min(termHeight - 8, 16)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)

  const handleConfirm = useCallback(async () => {
    setSaving(true)
    setSyncResult(null)
    const result = await onConfirm()
    setSyncResult(result)
    setSaving(false)
    if (result.success) {
      setTimeout(() => onCancel(), 700)
    }
  }, [onConfirm, onCancel])

const handleKey = useCallback(
    (key: { name: string; ctrl?: boolean }) => {
      if (saving) return

      if (key.name === "escape") {
        onCancel()
      } else if ((key.name === "return" || key.name === "enter") && !saving) {
        handleConfirm()
      }
    },
    [saving, handleConfirm, onCancel],
  )

  const commands = useMemo<CommandItem[]>(() => {
    if (saving) {
      return [{ key: spinner, label: "Deleting...", keyColor: "#D29922" } as CommandItem]
    }
    return [
      { key: "[enter]", label: "confirm" },
      { key: "[esc]", label: "cancel" },
    ]
  }, [saving, spinner])

const renderStatusLine = () => {
    if (saving) {
      return (
        <box style={{ height: 1, width: "100%", paddingLeft: 1 }}>
          <text content={`⠋ Deleting to ${host}...`} />
        </box>
      )
    }

    if (syncResult && !syncResult.success) {
      return (
        <box style={{ height: 1, width: "100%", paddingLeft: 1 }}>
          <text content={`✗ ${syncResult.output}`} fg="#F85149" />
        </box>
      )
    }

    if (syncResult?.success) {
      return (
        <box style={{ height: 1, width: "100%", paddingLeft: 1 }}>
          <text content={`✓ ${syncResult.output}`} fg="#3FB950" />
        </box>
      )
    }

    return null
  }

  useKeyboard(handleKey)

  return (
    <Modal
      title={`Delete key — ${keyName}`}
      top={modalTop}
      left={modalLeft}
      width={modalWidth}
      height={modalHeight}
      footer={<CommandsBar commands={commands} />}
    >
      <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
        <text content={"Delete key '"} fg="#F85149" />
        <text content={keyName} fg="#E6EDF3" />
        <text content={"' from .env?"} />
        <text content="" />
        <text content={"This removes the key from .env and the K8s secret."} fg="#8B949E" style={{ minHeight: 2 }} />
        <text content="" />
        <text content={"This cannot be undone."} fg="#F85149" style={{ minHeight: 2 }} />
      </box>
      {renderStatusLine()}
    </Modal>
  )
}