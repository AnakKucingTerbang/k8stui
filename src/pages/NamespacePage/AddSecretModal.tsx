import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { Modal } from "../../components/Modal"
import { CommandsBar, type CommandItem } from "../../components/CommandsBar"
import { sshTestConnection, sshMkdirP, sshWriteFile, sshReadFile } from "../../utils/ssh"
import { parseDotenv, stringifyDotenv } from "../../utils/dotenv"
import { createSecret } from "../../utils/secret-registry"
import { isPrintable } from "../../utils/keys"
import type { EnvEntry, SshTestResult } from "../../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const KEY_COL = 22

type Strategy = "kubectl" | "dotenv"

type ModalStep =
  | "name-strategy"
  | "ssh-host"
  | "env-path"
  | "keys"
  | "testing-host"
  | "env-exists"
  | "creating"
  | "result"

type KeyEditMode = "idle" | "addKey" | "addValue" | "editKey" | "editValue"

interface KvpEntry {
  key: string
  value: string
}

interface AddSecretModalProps {
  namespace: string
  contextName: string
  termWidth: number
  termHeight: number
  spinner: string
  onClose: () => void
  onCreated: () => void
  onToast: (msg: string) => void
}

export function AddSecretModal({
  namespace,
  contextName,
  termWidth,
  termHeight,
  spinner,
  onClose,
  onCreated,
  onToast,
}: AddSecretModalProps) {
  const [step, setStep] = useState<ModalStep>("name-strategy")
  const [secretName, setSecretName] = useState("")
  const [strategy, setStrategy] = useState<Strategy>("kubectl")
  const [strategyIndex, setStrategyIndex] = useState(0)
  const [nameFocused, setNameFocused] = useState(true)
  const [sshHost, setSshHost] = useState("")
  const [envPath, setEnvPath] = useState("")
  const [entries, setEntries] = useState<KvpEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState(0)
  const [editMode, setEditMode] = useState<KeyEditMode>("idle")
  const [addKey, setAddKey] = useState("")
  const [addValue, setAddValue] = useState("")
  const [testResult, setTestResult] = useState<SshTestResult | null>(null)
  const [existingEnvContent, setExistingEnvContent] = useState<EnvEntry[] | null>(null)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [createResult, setCreateResult] = useState<{ success: boolean; output: string } | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const keysScrollRef = useRef<any>(null)

  const ownSpinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"
  const activeSpinner = step === "name-strategy" || step === "keys" || step === "ssh-host" || step === "env-path" || step === "env-exists" || step === "result"
    ? spinner
    : ownSpinner

  useEffect(() => {
    const spinning = step === "testing-host" || step === "creating"
    if (!spinning) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [step])

  const modalWidth = Math.min(64, termWidth - 4)
  const modalHeight = Math.min(termHeight - 6, 28)
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)

  const STRATEGIES: Strategy[] = ["kubectl", "dotenv"]
  const STRATEGY_LABELS: Record<Strategy, string> = {
    kubectl: "kubectl (no source of truth)",
    dotenv: ".env (remote source of truth)",
  }

  const scrollEntryIntoView = useCallback((id: string) => {
    keysScrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const doTestHost = useCallback(async () => {
    if (!sshHost.trim()) {
      onToast("SSH Host is required")
      return
    }
    setStep("testing-host")
    const result = await sshTestConnection(sshHost, "/dev/null")
    setTestResult(result)
    if (!result.connected) {
      setStep("ssh-host")
      onToast("Connection failed: " + (result.error || "unknown"))
      return
    }
    setStep("env-path")
  }, [sshHost, onToast])

  const doTestHostAfterPath = useCallback(async () => {
    setStep("testing-host")
    const result = await sshTestConnection(sshHost, envPath)
    setTestResult(result)
    if (!result.connected) {
      setStep("env-path")
      onToast("Connection failed: " + (result.error || "unknown"))
      return
    }
    if (result.fileExists) {
      try {
        const content = await sshReadFile(sshHost, envPath)
        const parsed = parseDotenv(content)
        setExistingEnvContent(parsed)
        setStep("env-exists")
      } catch {
        setStep("keys")
        setEditMode("idle")
        setEntries([])
        setSelectedEntry(0)
      }
      return
    }
    setStep("keys")
    setEditMode("idle")
    setEntries([])
    setSelectedEntry(0)
  }, [sshHost, envPath, onToast])

  const doCreateKubectl = useCallback(async () => {
    if (entries.length === 0) {
      onToast("Add at least one key-value pair")
      return
    }
    setStep("creating")
    const annotations: Record<string, string> = { "k8cli.dev/managed-by": "kubectl" }
    const result = await createSecret(contextName, namespace, secretName, entries, annotations)
    setCreateResult(result)
    if (result.success) {
      onToast(`secret ${secretName} created`)
      setTimeout(() => { onCreated() }, 1200)
    }
  }, [secretName, entries, contextName, namespace, onCreated, onToast])

  const doCreateDotenv = useCallback(async (envEntries: EnvEntry[]) => {
    if (entries.length === 0) {
      onToast("Add at least one key-value pair")
      return
    }
    setStep("creating")
    try {
      const dirPath = envPath.includes("/") ? envPath.substring(0, envPath.lastIndexOf("/")) : "."
      await sshMkdirP(sshHost, dirPath)
    } catch (err: any) {
      setCreateResult({ success: false, output: `mkdir failed: ${err.message || err}` })
      return
    }
    const envContent = stringifyDotenv(envEntries)
    try {
      await sshWriteFile(sshHost, envPath, envContent)
    } catch (err: any) {
      setCreateResult({ success: false, output: `write .env failed: ${err.message || err}` })
      return
    }
    const annotations: Record<string, string> = {
      "k8cli.dev/managed-by": "dotenv",
      "k8cli.dev/env-host": sshHost,
      "k8cli.dev/env-path": envPath,
    }
    const result = await createSecret(contextName, namespace, secretName, entries, annotations)
    setCreateResult(result)
    if (result.success) {
      onToast(`secret ${secretName} created with .env`)
      setTimeout(() => { onCreated() }, 1200)
    }
  }, [secretName, entries, sshHost, envPath, contextName, namespace, onCreated, onToast])

  const doOverwrite = useCallback(() => {
    const envEntries: EnvEntry[] = entries.map((e) => ({
      key: e.key,
      value: e.value,
      isComment: false,
      isBlank: false,
    }))
    doCreateDotenv(envEntries)
  }, [entries, doCreateDotenv])

  const doAppend = useCallback(() => {
    const existing = existingEnvContent || []
    const existingMap = new Map<string, EnvEntry>()
    for (const e of existing) {
      if (!e.isComment && !e.isBlank) existingMap.set(e.key, e)
    }
    for (const entry of entries) {
      existingMap.set(entry.key, {
        key: entry.key,
        value: entry.value,
        isComment: false,
        isBlank: false,
      })
    }
    const merged = [...existing]
    const existingKeys = new Set(existing.filter((e) => !e.isComment && !e.isBlank).map((e) => e.key))
    for (const entry of entries) {
      if (!existingKeys.has(entry.key)) {
        merged.push({
          key: entry.key,
          value: entry.value,
          isComment: false,
          isBlank: false,
        })
      }
    }
    for (let i = 0; i < merged.length; i++) {
      const e = merged[i]!
      if (!e.isComment && !e.isBlank && entries.some((en) => en.key === e.key)) {
        merged[i] = { ...e, value: entries.find((en) => en.key === e.key)!.value }
      }
    }
    doCreateDotenv(merged)
  }, [existingEnvContent, entries, doCreateDotenv])

  const handleKey = useCallback((key: { name: string }) => {
    if (step === "testing-host" || step === "creating") return

    if (step === "result") {
      if (key.name === "escape" || key.name === "return") {
        if (createResult?.success) onCreated()
        else onClose()
      }
      return
    }

    if (step === "name-strategy") {
      if (nameFocused) {
        if (key.name === "tab") {
          setNameFocused(false)
          return
        }
        if (key.name === "backspace") { setSecretName((v) => v.slice(0, -1)); return }
        if (key.name === "delete") { setSecretName(""); return }
        if (isPrintable(key.name)) { setSecretName((v) => v + key.name); return }
        if (key.name === "return") {
          if (!secretName.trim()) { onToast("Secret name is required"); return }
          if (strategy === "kubectl") { setStep("keys"); setEditMode("idle") }
          else { setStep("ssh-host") }
          return
        }
        if (key.name === "escape") { onClose(); return }
      } else {
        if (key.name === "tab") { setNameFocused(true); return }
        if (key.name === "up" || key.name === "down") {
          const newIdx = key.name === "up" ? Math.max(0, strategyIndex - 1) : Math.min(STRATEGIES.length - 1, strategyIndex + 1)
          setStrategyIndex(newIdx)
          setStrategy(STRATEGIES[newIdx]!)
          return
        }
        if (key.name === "return") {
          if (!secretName.trim()) { onToast("Secret name is required"); return }
          if (strategy === "kubectl") { setStep("keys"); setEditMode("idle") }
          else { setStep("ssh-host") }
          return
        }
        if (key.name === "escape") { onClose(); return }
      }
      return
    }

    if (step === "ssh-host") {
      if (key.name === "return") { doTestHost(); return }
      if (key.name === "backspace") { setSshHost((v) => v.slice(0, -1)); return }
      if (key.name === "delete") { setSshHost(""); return }
      if (isPrintable(key.name)) { setSshHost((v) => v + key.name); return }
      if (key.name === "escape") { setStep("name-strategy"); return }
      return
    }

    if (step === "env-path") {
      if (key.name === "return") {
        if (!envPath.trim()) { onToast("File path is required"); return }
        doTestHostAfterPath()
        return
      }
      if (key.name === "backspace") { setEnvPath((v) => v.slice(0, -1)); return }
      if (key.name === "delete") { setEnvPath(""); return }
      if (isPrintable(key.name)) { setEnvPath((v) => v + key.name); return }
      if (key.name === "escape") { setStep("ssh-host"); return }
      return
    }

    if (step === "env-exists") {
      if (key.name === "o") { doOverwrite(); return }
      if (key.name === "a") { doAppend(); return }
      if (key.name === "escape") { setStep("env-path"); return }
      return
    }

    if (step === "keys") {
      if (editMode === "addKey" || editMode === "editKey") {
        if (key.name === "return") {
          if (addKey.trim()) { setEditMode(editMode === "addKey" ? "addValue" : "editValue"); setAddValue(editMode === "editKey" ? entries[selectedEntry]?.value ?? "" : ""); }
          return
        }
        if (key.name === "escape") { setEditMode("idle"); return }
        if (key.name === "backspace") { setAddKey((v) => v.slice(0, -1)); return }
        if (isPrintable(key.name)) { setAddKey((v) => v + key.name); return }
        return
      }

      if (editMode === "addValue" || editMode === "editValue") {
        if (key.name === "return") {
          if (editMode === "addValue") {
            const newEntry: KvpEntry = { key: addKey.trim(), value: addValue }
            setEntries((prev) => [...prev, newEntry])
            setSelectedEntry(entries.length)
            setTimeout(() => scrollEntryIntoView(`kvp-${entries.length}`), 50)
          } else {
            setEntries((prev) => prev.map((e, i) => i === selectedEntry ? { key: addKey.trim(), value: addValue } : e))
          }
          setEditMode("idle")
          return
        }
        if (key.name === "escape") { setEditMode("idle"); return }
        if (key.name === "backspace") { setAddValue((v) => v.slice(0, -1)); return }
        if (isPrintable(key.name)) { setAddValue((v) => v + key.name); return }
        return
      }

      if (key.name === "a") {
        setAddKey("")
        setAddValue("")
        setEditMode("addKey")
        return
      }
      if (key.name === "d" && entries.length > 0) {
        setEntries((prev) => prev.filter((_, i) => i !== selectedEntry))
        if (selectedEntry >= entries.length - 1) setSelectedEntry(Math.max(0, selectedEntry - 1))
        return
      }
      if (key.name === "e" && entries.length > 0) {
        const entry = entries[selectedEntry]!
        setAddKey(entry.key)
        setAddValue(entry.value)
        setEditMode("editKey")
        return
      }
      if (key.name === "up") {
        if (selectedEntry > 0) {
          const newIdx = selectedEntry - 1
          setSelectedEntry(newIdx)
          scrollEntryIntoView(`kvp-${newIdx}`)
        }
        return
      }
      if (key.name === "down") {
        if (selectedEntry < entries.length - 1) {
          const newIdx = selectedEntry + 1
          setSelectedEntry(newIdx)
          scrollEntryIntoView(`kvp-${newIdx}`)
        }
        return
      }
      if (key.name === "s") {
        if (strategy === "kubectl") { doCreateKubectl() }
        else { doCreateDotenv(entries.map((e) => ({ key: e.key, value: e.value, isComment: false, isBlank: false }))) }
        return
      }
      if (key.name === "escape") {
        if (strategy === "kubectl") setStep("name-strategy")
        else setStep("env-path")
        return
      }
      return
    }
  }, [
    step, nameFocused, secretName, strategy, strategyIndex, sshHost, envPath,
    entries, selectedEntry, editMode, addKey, addValue, testResult,
    existingEnvContent, createResult,
    onClose, onCreated, onToast, doTestHost, doTestHostAfterPath, doCreateKubectl, doCreateDotenv,
    doOverwrite, doAppend, scrollEntryIntoView,
  ])

  useKeyboard(handleKey)

  const commands = useMemo<CommandItem[]>(() => {
    if (step === "testing-host") {
      return [{ key: activeSpinner, label: "Testing...", keyColor: "#D29922" }]
    }
    if (step === "creating") {
      return [{ key: activeSpinner, label: "Creating...", keyColor: "#D29922" }]
    }
    if (step === "result") {
      if (createResult?.success) {
        return [{ key: "✓ created", label: "", keyColor: "#3FB950" }, { key: "[esc]", label: "close" }]
      }
      return [{ key: "✗ failed", label: "", keyColor: "#F85149" }, { key: "[esc]", label: "back" }]
    }
    if (step === "name-strategy") {
      return [
        { key: "[tab]", label: "fields" },
        { key: "[enter]", label: "next" },
        { key: "[esc]", label: "cancel" },
      ]
    }
    if (step === "ssh-host") {
      return [
        { key: "[enter]", label: "test" },
        { key: "[esc]", label: "back" },
      ]
    }
    if (step === "env-path") {
      return [
        { key: "[enter]", label: "next" },
        { key: "[esc]", label: "back" },
      ]
    }
    if (step === "env-exists") {
      return [
        { key: ".env exists", label: "", keyColor: "#D29922" },
        { key: "[o]", label: "overwrite" },
        { key: "[a]", label: "append" },
        { key: "[esc]", label: "back" },
      ]
    }
    if (step === "keys") {
      if (editMode === "addKey" || editMode === "editKey") {
        return [
          { key: "[enter]", label: "next" },
          { key: "[esc]", label: "cancel" },
          { key: "", label: "— key name", keyColor: "#8B949E" },
        ]
      }
      if (editMode === "addValue" || editMode === "editValue") {
        return [
          { key: "[enter]", label: "confirm" },
          { key: "[esc]", label: "cancel" },
          { key: "", label: "— value", keyColor: "#8B949E" },
        ]
      }
      return [
        { key: "[a]", label: "add" },
        { key: "[e]", label: "edit" },
        { key: "[d]", label: "delete" },
        { key: "[↑↓]", label: "nav" },
        { key: "[s]", label: "submit" },
        { key: "[esc]", label: "back" },
      ]
    }
    return []
  }, [step, editMode, nameFocused, createResult, activeSpinner])

  const renderContent = () => {
    if (step === "testing-host" || step === "creating") {
      const label = step === "testing-host" ? "Testing connection..."
        : "Creating secret..."
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(activeSpinner)} ${fg("#8B949E")(label)}`} />
        </box>
      )
    }

    if (step === "result" && createResult) {
      if (createResult.success) {
        return (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, gap: 1 }}>
            <text content={t`${fg("#3FB950")("✓")} ${fg("#8B949E")("Secret " + secretName + " created in " + namespace)}`} />
            {strategy === "dotenv" && (
              <text content={t`${fg("#8B949E")(".env → " + sshHost + ":" + envPath)}`} />
            )}
          </box>
        )
      }
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#F85149")("✗ Creation failed")}`} />
          <text content={t`${fg("#8B949E")(createResult.output)}`} />
        </box>
      )
    }

    if (step === "name-strategy") {
      const cursor = nameFocused ? "_" : ""
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#8B949E")("Create a new secret in namespace ")}${fg("#E6EDF3")(namespace)}`} />
          <text content="" />
          <box style={{ height: 1, width: "100%", backgroundColor: nameFocused ? "#1A3A5C" : undefined }}>
            <text content={t`${fg("#58A6FF")("Name:      ")}${fg(nameFocused ? "#3FB950" : "#E6EDF3")(secretName + cursor)}`} />
          </box>
          <text content="" />
          <text content={t`${fg("#58A6FF")("Strategy:")}`} />
          {STRATEGIES.map((s, i) => {
            const isSelected = i === strategyIndex && !nameFocused
            const bgColor = isSelected ? "#1A3A5C" : undefined
            const textColor = isSelected ? "#3FB950" : "#8B949E"
            return (
              <box key={s} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                <text content={t`${fg(textColor)("  " + STRATEGY_LABELS[s]!)}`} />
              </box>
            )
          })}
        </box>
      )
    }

    if (step === "ssh-host") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#8B949E")("SSH host for .env source of truth")}`} />
          <text content="" />
          <box style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
            <text content={t`${fg("#58A6FF")("Host: ")}${fg("#3FB950")(sshHost + "_" )}`} />
          </box>
          <text content="" />
          <text content={t`${fg("#8B949E")("e.g. user@ip:port or SSH alias like ovhmanager")}`} />
        </box>
      )
    }

    if (step === "env-path") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#8B949E")("File path for .env on " + sshHost)}`} />
          <text content="" />
          <box style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
            <text content={t`${fg("#58A6FF")("Path: ")}${fg("#3FB950")(envPath + "_" )}`} />
          </box>
          <text content="" />
          <text content={t`${fg("#8B949E")("e.g. apps/app/.env (must include the filename)")}`} />
        </box>
      )
    }

    if (step === "env-exists") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(".env already exists at " + envPath)}`} />
          <text content="" />
          <text content={t`${fg("#8B949E")("on " + sshHost)}`} />
          <text content="" />
          <text content={t`${fg("#58A6FF")("[o]")} ${fg("#8B949E")(" overwrite — replace .env with new values only")}`} />
          <text content={t`${fg("#58A6FF")("[a]")} ${fg("#8B949E")(" append — merge new keys, keep existing ones")}`} />
          <text content={t`${fg("#58A6FF")("[esc]")} ${fg("#8B949E")(" back — change path")}`} />
        </box>
      )
    }

    if (step === "keys") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0, flexGrow: 1 }}>
          <text content={t`${fg("#58A6FF")("KEY".padEnd(KEY_COL))}${fg("#8B949E")("VALUE")}`} />
          <scrollbox ref={keysScrollRef} scrollY={true} viewportCulling={true} style={{ width: "100%", flexGrow: 1 }} contentOptions={{ minHeight: "100%" }}>
            {entries.length === 0 && editMode === "idle" && (
              <text content={t`${fg("#8B949E")("  Press [a] to add a key-value pair")}`} />
            )}
            {entries.map((entry, i) => {
              const isEditingKey = i === selectedEntry && editMode === "editKey"
              const isEditingValue = i === selectedEntry && editMode === "editValue"
              const isSelected = i === selectedEntry && editMode === "idle"
              if (isEditingKey) {
                return (
                  <box key={`kvp-${i}`} id={`kvp-${i}`} style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
                    <text content={t`${fg("#3FB950")((addKey + "_").padEnd(KEY_COL))}${fg("#8B949E")(addValue)}`} />
                  </box>
                )
              }
              if (isEditingValue) {
                return (
                  <box key={`kvp-${i}`} id={`kvp-${i}`} style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
                    <text content={t`${fg("#3FB950")(addKey.padEnd(KEY_COL))}${fg("#3FB950")(addValue + "_")}`} />
                  </box>
                )
              }
              const bgColor = isSelected ? "#1A3A5C" : undefined
              const keyColor = isSelected ? "#E6EDF3" : "#58A6FF"
              const valColor = isSelected ? "#E6EDF3" : "#8B949E"
              return (
                <box key={`kvp-${i}`} id={`kvp-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                  <text content={t`${fg(keyColor)(entry.key.padEnd(KEY_COL))}${fg(valColor)(entry.value)}`} />
                </box>
              )
            })}
            {editMode === "addKey" && (
              <box style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
                <text content={t`${fg("#3FB950")((addKey + "_").padEnd(KEY_COL))}${fg("#484F58")("_")}`} />
              </box>
            )}
            {editMode === "addValue" && (
              <box style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
                <text content={t`${fg("#3FB950")(addKey.padEnd(KEY_COL))}${fg("#3FB950")(addValue + "_")}`} />
              </box>
            )}
          </scrollbox>
        </box>
      )
    }

    return null
  }

  const title = (() => {
    if (step === "name-strategy") return "add secret"
    if (step === "ssh-host") return "add secret — ssh host"
    if (step === "env-path") return "add secret — .env path"
    if (step === "keys") return `add secret — ${secretName}`
    if (step === "env-exists") return "add secret — .env exists"
    if (step === "creating") return "add secret — creating"
    if (step === "result") return `add secret — ${createResult?.success ? "done" : "failed"}`
    return "add secret"
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
