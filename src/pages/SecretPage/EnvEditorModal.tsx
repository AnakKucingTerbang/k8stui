import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { syncSecretFromEnv } from "../../utils/secret-sync"
import { isPrintable } from "../../utils/keys"
import type { EnvEntry, SecretManagement, SyncResult } from "../../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const MASK = "******"
const KEY_COL = 24

type EditMode = "idle" | "editValue" | "addKey" | "addValue" | "confirmDiscard" | "saving"

function looksSensitive(key: string): boolean {
  const lower = key.toLowerCase()
  return lower.includes("password") || lower.includes("secret") || lower.includes("token") || lower.includes("key") || lower.includes("credential")
}

interface EnvEditorModalProps {
  entries: EnvEntry[]
  management: SecretManagement
  namespace: string
  secretName: string
  contextName: string
  onClose: () => void
  onRefresh: () => void
  termWidth: number
  termHeight: number
}

export function EnvEditorModal({
  entries: initialEntries,
  management,
  namespace,
  secretName,
  contextName,
  onClose,
  onRefresh,
  termWidth,
  termHeight,
}: EnvEditorModalProps) {
  const [entries, setEntries] = useState<EnvEntry[]>(() =>
    initialEntries.map((e) => ({ ...e }))
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [editMode, setEditMode] = useState<EditMode>("idle")
  const [editValue, setEditValue] = useState("")
  const [addKey, setAddKey] = useState("")
  const [addValue, setAddValue] = useState("")
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<any>(null)

  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  const modalWidth = Math.min(80, termWidth - 4)
  const modalHeight = Math.min(termHeight - 6, 36)
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)

  useEffect(() => {
    if (editMode !== "saving") {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [editMode])

  const scrollIntoView = useCallback((id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const handleSave = useCallback(async () => {
    setEditMode("saving")
    setSyncResult(null)

    const result = await syncSecretFromEnv(entries, management, contextName, namespace, secretName)

    setSyncResult(result)
    setEditMode("idle")

    if (result.success) {
      setDirty(false)
      onRefresh()
    }
  }, [entries, management, contextName, namespace, secretName, onRefresh])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (editMode === "saving") return

      if (editMode === "confirmDiscard") {
        if (key.name === "y") {
          setEditMode("idle")
          onClose()
        } else if (key.name === "n" || key.name === "escape") {
          setEditMode("idle")
        }
        return
      }

      if (editMode === "editValue") {
        if (key.name === "return") {
          setEntries((prev) =>
            prev.map((e, i) =>
              i === selectedIndex && !e.isComment && !e.isBlank
                ? { ...e, value: editValue }
                : e,
            ),
          )
          setDirty(true)
          setEditMode("idle")
        } else if (key.name === "escape") {
          setEditMode("idle")
        } else if (key.name === "backspace") {
          setEditValue((v) => v.slice(0, -1))
        } else if (key.name === "delete") {
          setEditValue("")
        } else if (isPrintable(key.name)) {
          setEditValue((v) => v + key.name)
        }
        return
      }

      if (editMode === "addKey") {
        if (key.name === "return") {
          if (addKey.trim()) {
            setEditMode("addValue")
            setAddValue("")
          }
        } else if (key.name === "escape") {
          setEditMode("idle")
        } else if (key.name === "backspace") {
          setAddKey((v) => v.slice(0, -1))
        } else if (isPrintable(key.name)) {
          setAddKey((v) => v + key.name)
        }
        return
      }

      if (editMode === "addValue") {
        if (key.name === "return") {
          const newEntry: EnvEntry = {
            key: addKey.trim(),
            value: addValue,
            isComment: false,
            isBlank: false,
          }
          setEntries((prev) => [...prev, newEntry])
          setDirty(true)
          setSelectedIndex(entries.length)
          setEditMode("idle")
          setTimeout(() => scrollIntoView(`entry-${entries.length}`), 50)
        } else if (key.name === "escape") {
          setEditMode("idle")
        } else if (key.name === "backspace") {
          setAddValue((v) => v.slice(0, -1))
        } else if (isPrintable(key.name)) {
          setAddValue((v) => v + key.name)
        }
        return
      }

      if (key.name === "escape") {
        if (dirty) {
          setEditMode("confirmDiscard")
        } else {
          onClose()
        }
      } else if (key.name === "up") {
        if (selectedIndex > 0) {
          const newIdx = selectedIndex - 1
          setSelectedIndex(newIdx)
          scrollIntoView(`entry-${newIdx}`)
        }
      } else if (key.name === "down") {
        if (selectedIndex < entries.length - 1) {
          const newIdx = selectedIndex + 1
          setSelectedIndex(newIdx)
          scrollIntoView(`entry-${newIdx}`)
        }
      } else if (key.name === "return") {
        const entry = entries[selectedIndex]
        if (entry && !entry.isComment && !entry.isBlank) {
          setEditValue(entry.value)
          setEditMode("editValue")
        }
      } else if (key.name === "a") {
        setAddKey("")
        setAddValue("")
        setEditMode("addKey")
      } else if (key.name === "d") {
        const entry = entries[selectedIndex]
        if (entry && !entry.isComment && !entry.isBlank) {
          setEntries((prev) => prev.filter((_, i) => i !== selectedIndex))
          setDirty(true)
          if (selectedIndex >= entries.length - 1) {
            setSelectedIndex(Math.max(0, selectedIndex - 1))
          }
        }
      } else if (key.name === "v") {
        setRevealed((prev) => !prev)
      } else if (key.name === "s") {
        handleSave()
      }
    },
    [editMode, selectedIndex, entries, dirty, editValue, addKey, addValue, onClose, handleSave, scrollIntoView],
  )

  useKeyboard(handleKey)

  const commands = useMemo(() => {
    if (editMode === "saving") {
      return t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Saving...")}`
    }
    if (editMode === "confirmDiscard") {
      return t`${fg("#F85149")("[y]")} ${fg("#8B949E")("discard  ")}${fg("#58A6FF")("[n]")} ${fg("#8B949E")("cancel")}`
    }
    if (editMode === "editValue") {
      return t`${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("confirm  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("cancel  ")}${fg("#58A6FF")("[backspace]")} ${fg("#8B949E")("delete char")}`
    }
    if (editMode === "addKey") {
      return t`${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("next  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("cancel")} ${fg("#8B949E")("— key name")}`
    }
    if (editMode === "addValue") {
      return t`${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("confirm  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("cancel")} ${fg("#8B949E")("— value")}`
    }
    const revealLabel = revealed ? "mask" : "reveal"
    return t`${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("nav  ")}${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("edit  ")}${fg("#58A6FF")("[a]")} ${fg("#8B949E")("add  ")}${fg("#58A6FF")("[d]")} ${fg("#8B949E")("delete  ")}${fg("#58A6FF")("[v]")} ${fg("#8B949E")(revealLabel + "  ")}${fg("#58A6FF")("[s]")} ${fg("#8B949E")("save  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("close")}`
  }, [editMode, revealed, spinner])

  const header = `${management.host}:${management.path}`

  const renderEntry = (entry: EnvEntry, i: number) => {
    const isSelected = i === selectedIndex && editMode === "idle"
    const bgColor = isSelected ? "#1A3A5C" : undefined

    if (entry.isBlank) {
      return (
        <box key={`blank-${i}`} id={`entry-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
          <text content="" />
        </box>
      )
    }

    if (entry.isComment) {
      return (
        <box key={`comment-${i}`} id={`entry-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
          <text content={t`${fg("#8B949E")("  " + entry.key)}`} />
        </box>
      )
    }

    const isEditing = editMode === "editValue" && i === selectedIndex

    let displayValue: string
    if (isEditing) {
      displayValue = editValue + "_"
    } else if (!revealed && looksSensitive(entry.key)) {
      displayValue = MASK
    } else {
      displayValue = entry.value
    }

    const valColor = isEditing ? "#3FB950" : isSelected ? "#E6EDF3" : "#8B949E"
    const keyColor = isSelected ? "#E6EDF3" : "#58A6FF"

    return (
      <box key={`entry-${i}`} id={`entry-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
        <text content={t`${fg(keyColor)(entry.key.padEnd(KEY_COL))}${fg(valColor)(displayValue)}`} />
      </box>
    )
  }

  const renderAddRow = () => {
    if (editMode === "addKey") {
      return (
        <box style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
          <text content={t`${fg("#3FB950")((addKey + "_").padEnd(KEY_COL))}${fg("#8B949E")("NEW_VALUE")}`} />
        </box>
      )
    }
    if (editMode === "addValue") {
      return (
        <box style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
          <text content={t`${fg("#3FB950")(addKey.padEnd(KEY_COL))}${fg("#3FB950")(addValue + "_")}`} />
        </box>
      )
    }
    return null
  }

  const renderStatusLine = () => {
    if (editMode === "saving") {
      return (
        <box style={{ height: 1, width: "100%", paddingLeft: 1 }}>
          <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Saving to " + management.host + "...")}`} />
        </box>
      )
    }

    if (syncResult && !syncResult.success) {
      return (
        <box style={{ height: 1, width: "100%", paddingLeft: 1 }}>
          <text content={t`${fg("#F85149")("✗ " + syncResult.output)}`} />
        </box>
      )
    }

    if (syncResult?.success) {
      return (
        <box style={{ height: 1, width: "100%", paddingLeft: 1 }}>
          <text content={t`${fg("#3FB950")("✓")} ${fg("#8B949E")("saved & synced")}`} />
        </box>
      )
    }

    if (dirty) {
      return (
        <box style={{ height: 1, width: "100%", paddingLeft: 1 }}>
          <text content={t`${fg("#D29922")("* unsaved changes")}`} />
        </box>
      )
    }

    return null
  }

  const renderConfirmDiscard = () => {
    if (editMode !== "confirmDiscard") return null
    return (
      <box style={{ height: 2, width: "100%", paddingLeft: 1 }}>
        <text content={t`${fg("#F85149")("Unsaved changes. Discard?")}`} />
        <text content={t`${fg("#58A6FF")("[y]")} ${fg("#8B949E")("discard  ")}${fg("#58A6FF")("[n]")} ${fg("#8B949E")("cancel")}`} />
      </box>
    )
  }

  return (
    <box
      style={{
        position: "absolute",
        top: modalTop,
        left: modalLeft,
        width: modalWidth,
        height: modalHeight,
        flexDirection: "column",
        zIndex: 100,
        backgroundColor: "#0D1117",
      }}
    >
      <box
        title={`.env editor -- ${header}`}
        borderStyle="single"
        borderColor="#58A6FF"
        style={{ flexDirection: "column", flexGrow: 1, gap: 0 }}
      >
        <box style={{ height: 1, width: "100%", paddingLeft: 1 }}>
          <text content={t`${fg("#58A6FF")("KEY".padEnd(KEY_COL))}${fg("#8B949E")("VALUE")}`} />
        </box>
        <scrollbox ref={scrollRef} scrollY={true} viewportCulling={true} style={{ width: "100%", flexGrow: 1 }} contentOptions={{ minHeight: "100%" }}>
          {entries.map((entry, i) => renderEntry(entry, i))}
          {renderAddRow()}
        </scrollbox>
        {renderStatusLine()}
        {renderConfirmDiscard()}
      </box>

      <box
        borderStyle="single"
        borderColor="#30363D"
        style={{ flexDirection: "row", height: 3, paddingLeft: 1, alignItems: "center" }}
      >
        <text fg="#8B949E" content={commands} />
      </box>
    </box>
  )
}
