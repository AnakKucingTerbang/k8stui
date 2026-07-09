import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useKeyboard } from "@opentui/react"
import { Modal } from "../../components/Modal"
import { CommandsBar, type CommandItem } from "../../components/CommandsBar"
import type { SyncResult } from "../../types"

interface EnvEntryEditorModalProps {
  mode: "add" | "edit"
  initialKey: string
  initialValue: string
  host: string
  termWidth: number
  termHeight: number
  onConfirm: (key: string, value: string) => Promise<SyncResult>
  onCancel: () => void
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const KEY_COL = 24

export function EnvEntryEditorModal({
  mode,
  initialKey,
  initialValue,
  host,
  termWidth,
  termHeight,
  onConfirm,
  onCancel,
}: EnvEntryEditorModalProps) {
  const [field, setField] = useState<"key" | "value">("key")
  const [keyValue, setKeyValue] = useState(initialKey)
  const [valueValue, setValueValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const textareaRef = useRef<any>(null)

  useEffect(() => {
    if (field === "value" && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [field])

  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]

  useEffect(() => {
    if (!saving) {
      return
    }
    const interval = setInterval(() => setSpinnerFrame(f => f + 1), 80)
    return () => clearInterval(interval)
  }, [saving])

const modalWidth = Math.min(70, termWidth - 8)
  const modalHeight = Math.min(termHeight - 12, 24)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)

  const handleConfirm = useCallback(async () => {
    const trimmedKey = keyValue.trim()
    if (!trimmedKey) {
      return
    }
    setSaving(true)
    setSyncResult(null)
    const value = textareaRef.current?.plainText ?? valueValue
    const result = await onConfirm(trimmedKey, value)
    setSyncResult(result)
    setSaving(false)
    if (result.success) {
      setTimeout(() => onCancel(), 700)
    }
  }, [keyValue, valueValue, onConfirm, onCancel])

const handleKey = useCallback(
    (key: { name: string; ctrl?: boolean }) => {
      if (saving) return

      if (key.name === "tab") {
        setField((prev) => (prev === "key" ? "value" : "key"))
      } else if (key.name === "escape") {
        onCancel()
      } else if (key.name === "return" && field === "key" && keyValue.trim()) {
        setField("value")
      } else if (key.ctrl && key.name === "return") {
        handleConfirm()
      }
    },
    [field, onCancel, keyValue, handleConfirm, saving],
  )

  const commands = useMemo<CommandItem[]>(() => {
    if (saving) {
      return [{ key: spinner, label: "Saving...", keyColor: "#D29922" } as CommandItem]
    }
    return [
      { key: "[tab]", label: "next" },
      { key: "[ctrl+enter]", label: "confirm" },
      { key: "[esc]", label: "cancel" },
      { key: "", label: "— key name", keyColor: "#8B949E" },
    ]
  }, [saving, spinner])

const keyDisabled = mode === "edit"

const renderStatusLine = () => {
  if (saving) {
    return (
      <box style={{ height: 1, width: "100%", paddingLeft: 1 }}>
        <text content={`⠋ Saving to ${host}...`} />
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
      title={mode === "add" ? "Add entry" : `Edit entry -- ${keyValue}`}
      top={modalTop}
      left={modalLeft}
      width={modalWidth}
      height={modalHeight}
      footer={<CommandsBar commands={commands} />}
    >
      <box style={{ height: 1, width: "100%", paddingLeft: 1 }}>
        <text fg="#58A6FF" content={`KEY${"".padEnd(KEY_COL - 3)}VALUE`} />
      </box>
      <box flexDirection="column" flexGrow={1} gap={1}>
        <box
          borderStyle="single"
          borderColor={field === "key" ? "#58A6FF" : "#30363D"}
          style={{
            height: 3,
            width: "100%",
            flexDirection: "column",
          }}
        >
          <input
            value={keyValue}
            onInput={setKeyValue}
            focused={field === "key"}
            onSubmit={() => setField("value")}
            placeholder="KEY"
            placeholderColor="#484F58"
            backgroundColor="#0D1117"
            textColor="#E6EDF3"
            cursorColor="#58A6FF"
            width="100%"
          />
        </box>
        <box
          borderStyle="single"
          borderColor={field === "value" ? "#58A6FF" : "#30363D"}
          style={{
            flexGrow: 1,
            width: "100%",
            flexDirection: "column",
          }}
        >
          <textarea
            ref={textareaRef}
            initialValue={valueValue}
            onContentChange={() => setValueValue(textareaRef.current?.plainText ?? "")}
            focused={field === "value"}
            placeholder="VALUE"
            placeholderColor="#484F58"
            backgroundColor="#0D1117"
            textColor="#E6EDF3"
            focusedBackgroundColor="#161B22"
            cursorColor="#58A6FF"
            width="100%"
            height="100%"
          />
        </box>
      </box>
      {renderStatusLine()}
    </Modal>
  )
}