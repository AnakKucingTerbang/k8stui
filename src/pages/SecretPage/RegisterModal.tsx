import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg, type StyledText } from "@opentui/core"
import { sshTestConnection, sshCreateEmptyFile, sshReadFile } from "../../utils/ssh"
import { parseDotenv } from "../../utils/dotenv"
import { compareEnvWithSecret } from "../../utils/compare"
import { registerSecret } from "../../utils/secret-registry"
import { syncSecretFromEnv } from "../../utils/secret-sync"
import { isPrintable } from "../../utils/keys"
import type { ComparisonResult, EnvEntry, SshTestResult } from "../../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

type RegState =
  | "input"
  | "testing"
  | "test-result"
  | "comparing"
  | "diff"
  | "file-not-found"
  | "creating"
  | "registering"
  | "syncing"

interface RegisterModalProps {
  name: string
  namespace: string
  rawData: Record<string, string>
  contextName: string
  termWidth: number
  termHeight: number
  spinner: string
  onClose: () => void
  onRegistered: () => void
  onToast: (msg: string) => void
}

export function RegisterModal({
  name,
  namespace,
  rawData,
  contextName,
  termWidth,
  termHeight,
  spinner,
  onClose,
  onRegistered,
  onToast,
}: RegisterModalProps) {
  const [regState, setRegState] = useState<RegState>("input")
  const [sshHost, setSshHost] = useState("")
  const [filePath, setFilePath] = useState("")
  const [manageField, setManageField] = useState<"host" | "path">("host")
  const [testResult, setTestResult] = useState<SshTestResult | null>(null)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>([])
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const ownSpinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"
  const activeSpinner = regState === "input" || regState === "test-result" || regState === "diff" || regState === "file-not-found"
    ? spinner
    : ownSpinner

  useEffect(() => {
    const spinning = regState === "testing" || regState === "comparing" || regState === "registering" || regState === "syncing" || regState === "creating"
    if (!spinning) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [regState])

  const modalWidth = Math.min(64, termWidth - 4)
  const modalHeight = Math.min(termHeight - 6, 28)
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)

  const runTestConnection = useCallback(async () => {
    if (!sshHost.trim() || !filePath.trim()) {
      onToast("SSH Host and File Path are required")
      return
    }
    setRegState("testing")
    const result = await sshTestConnection(sshHost, filePath)
    setTestResult(result)
    setRegState("test-result")
  }, [sshHost, filePath, onToast])

  const runCompareAndRegister = useCallback(async () => {
    if (!sshHost.trim() || !filePath.trim()) {
      onToast("SSH Host and File Path are required")
      return
    }
    setRegState("comparing")
    try {
      const content = await sshReadFile(sshHost, filePath)
      const entries = parseDotenv(content)
      const result = compareEnvWithSecret(entries, rawData)

      if (result.different.length === 0 && result.onlyInEnv.length === 0 && result.onlyInCluster.length === 0) {
        setRegState("registering")
        const ok = await registerSecret(contextName, namespace, name, sshHost, filePath)
        if (ok) {
          onRegistered()
          onToast("registered (values match)")
        } else {
          setRegState("input")
          onToast("registration failed")
        }
      } else {
        setComparison(result)
        setEnvEntries(entries)
        setRegState("diff")
      }
    } catch {
      setRegState("input")
      onToast("failed to read .env")
    }
  }, [sshHost, filePath, rawData, contextName, namespace, name, onRegistered, onToast])

  const runSyncAndRegister = useCallback(async () => {
    setRegState("syncing")
    const result = await syncSecretFromEnv(envEntries, { strategy: "dotenv", host: sshHost, path: filePath }, contextName, namespace, name)
    if (result.success) {
      const ok = await registerSecret(contextName, namespace, name, sshHost, filePath)
      if (ok) {
        onRegistered()
        onToast("synced & registered")
      } else {
        onToast("synced, but annotation failed")
        onRegistered()
      }
    } else {
      setRegState("diff")
      onToast("sync failed: " + result.output)
    }
  }, [envEntries, sshHost, filePath, contextName, namespace, name, onRegistered, onToast])

  const runRegisterOnly = useCallback(async () => {
    setRegState("registering")
    const ok = await registerSecret(contextName, namespace, name, sshHost, filePath)
    if (ok) {
      onRegistered()
      onToast("registered (no sync)")
    } else {
      setRegState("diff")
      onToast("registration failed")
    }
  }, [contextName, namespace, name, sshHost, filePath, onRegistered, onToast])

  const runCreateAndRegister = useCallback(async () => {
    setRegState("creating")
    try {
      await sshCreateEmptyFile(sshHost, filePath)
    } catch (err: any) {
      onToast(`create failed: ${err.message || err}`)
      setRegState("file-not-found")
      return
    }
    setRegState("registering")
    const ok = await registerSecret(contextName, namespace, name, sshHost, filePath)
    if (ok) {
      onRegistered()
      onToast("created & registered")
    } else {
      setRegState("input")
      onToast("registration failed")
    }
  }, [sshHost, filePath, contextName, namespace, name, onRegistered, onToast])

  const handleKey = useCallback((key: { name: string }) => {
    if (regState === "testing" || regState === "comparing" || regState === "registering" || regState === "syncing" || regState === "creating") {
      return
    }

    if (regState === "input") {
      if (key.name === "up" || key.name === "down" || key.name === "tab") {
        setManageField((prev) => prev === "host" ? "path" : "host")
      } else if (key.name === "return") {
        runTestConnection()
      } else if (key.name === "backspace") {
        if (manageField === "host") setSshHost((v) => v.slice(0, -1))
        else setFilePath((v) => v.slice(0, -1))
      } else if (key.name === "delete") {
        if (manageField === "host") setSshHost("")
        else setFilePath("")
      } else if (isPrintable(key.name)) {
        if (manageField === "host") setSshHost((v) => v + key.name)
        else setFilePath((v) => v + key.name)
      } else if (key.name === "escape") {
        onClose()
      }
      return
    }

    if (regState === "test-result" && testResult) {
      if (key.name === "return" && testResult.connected && testResult.fileExists) {
        runCompareAndRegister()
      } else if (key.name === "return" && testResult.connected && !testResult.fileExists) {
        runCreateAndRegister()
      } else if (key.name === "escape") {
        setRegState("input")
      }
      return
    }

    if (regState === "diff" && comparison) {
      if (key.name === "return") {
        runSyncAndRegister()
      } else if (key.name === "r") {
        runRegisterOnly()
      } else if (key.name === "escape") {
        setRegState("input")
      }
      return
    }

    if (regState === "file-not-found") {
      if (key.name === "c") {
        runCreateAndRegister()
      } else if (key.name === "e") {
        setRegState("input")
        setManageField("path")
      } else if (key.name === "escape") {
        setRegState("input")
      }
      return
    }
  }, [
    regState, manageField, sshHost, filePath, testResult, comparison,
    onClose, runTestConnection, runCompareAndRegister,
    runSyncAndRegister, runRegisterOnly, runCreateAndRegister,
  ])

  useKeyboard(handleKey)

  const commands = useMemo<StyledText>(() => {
    if (regState === "testing" || regState === "comparing" || regState === "registering" || regState === "syncing" || regState === "creating") {
      const label = regState === "testing" ? "Testing..."
        : regState === "comparing" ? "Comparing..."
        : regState === "syncing" ? "Syncing..."
        : regState === "creating" ? "Creating..."
        : "Registering..."
      return t`${fg("#D29922")(activeSpinner)} ${fg("#8B949E")(label)}`
    }
    if (regState === "input") {
      return t`${fg("#58A6FF")("[↑↓/tab]")} ${fg("#8B949E")("fields  ")}${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("test  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("cancel")}`
    }
    if (regState === "test-result" && testResult?.connected && testResult?.fileExists) {
      return t`${fg("#3FB950")("connected, .env found  ")}${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("register  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back")}`
    }
    if (regState === "test-result" && testResult?.connected && !testResult?.fileExists) {
      return t`${fg("#D29922")("connected, .env not found  ")}${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("create & register  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back")}`
    }
    if (regState === "test-result") {
      return t`${fg("#F85149")("connection failed  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back")}`
    }
    if (regState === "diff" && comparison) {
      const hasDiffs = comparison.different.length > 0
      return t`${fg("#58A6FF")("[enter]")} ${fg("#8B949E")(hasDiffs ? "sync & register  " : "register  ")}${fg("#58A6FF")("[r]")} ${fg("#8B949E")("register only  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back")}`
    }
    if (regState === "file-not-found") {
      return t`${fg("#58A6FF")("[c]")} ${fg("#8B949E")("create & register  ")}${fg("#58A6FF")("[e]")} ${fg("#8B949E")("edit path  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("cancel")}`
    }
    return t`${fg("#8B949E")("")}`
  }, [regState, testResult, comparison, activeSpinner])

  const renderContent = () => {
    if (regState === "testing" || regState === "comparing" || regState === "registering" || regState === "syncing" || regState === "creating") {
      const label = regState === "testing" ? "Testing connection..."
        : regState === "comparing" ? "Comparing .env with secret..."
        : regState === "syncing" ? "Syncing to cluster..."
        : regState === "creating" ? "Creating .env..."
        : "Registering..."
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(activeSpinner)} ${fg("#8B949E")(label)}`} />
        </box>
      )
    }

    if (regState === "test-result" && testResult) {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          {testResult.connected && testResult.fileExists && (
            <text content={t`${fg("#3FB950")("✓")} ${fg("#8B949E")("Connected. .env found at " + filePath)}`} />
          )}
          {testResult.connected && !testResult.fileExists && (
            <text content={t`${fg("#D29922")("⚠")} ${fg("#8B949E")("Connected, but " + filePath + " not found")}`} />
          )}
          {!testResult.connected && (
            <text content={t`${fg("#F85149")("✗")} ${fg("#8B949E")("Connection failed: " + (testResult.error || "unknown"))}`} />
          )}
          <text content="" />
          <text content={t`${fg("#8B949E")("Host:    " + sshHost)}`} />
          <text content={t`${fg("#8B949E")("Path:    " + filePath)}`} />
        </box>
      )
    }

    if (regState === "file-not-found") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(filePath + " does not exist on " + sshHost)}`} />
          <text content="" />
          <text content={t`${fg("#58A6FF")("[c]")} ${fg("#8B949E")(" create empty .env & register")}`} />
          <text content={t`${fg("#58A6FF")("[e]")} ${fg("#8B949E")(" edit path and try again")}`} />
          <text content={t`${fg("#58A6FF")("[esc]")} ${fg("#8B949E")(" cancel")}`} />
        </box>
      )
    }

    if (regState === "diff" && comparison) {
      const KEY_W = 18
      return (
        <scrollbox scrollY={true} viewportCulling={true} style={{ width: "100%", flexGrow: 1 }} contentOptions={{ minHeight: "100%" }}>
          <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1 }}>
            <text content={t`${fg("#8B949E")("Comparison: .env vs cluster")}`} />
            <text content="" />

            {comparison.different.length > 0 && (
              <>
                <text content={t`${fg("#D29922")("DIFFERENT VALUES (" + comparison.different.length + ")")}`} />
                {comparison.different.map((d) => (
                  <box key={d.key} style={{ height: 2, width: "100%", flexDirection: "column" }}>
                    <text content={t`${fg("#58A6FF")(pad(d.key, KEY_W))}${fg("#8B949E")("cluster: " + d.clusterValue)}`} />
                    <text content={t`${fg("#58A6FF")(" ".repeat(KEY_W))}${fg("#3FB950")(".env:    " + d.envValue)}`} />
                  </box>
                ))}
                <text content="" />
              </>
            )}

            {comparison.onlyInEnv.length > 0 && (
              <>
                <text content={t`${fg("#3FB950")("NEW IN .ENV (" + comparison.onlyInEnv.length + ")")}`} />
                {comparison.onlyInEnv.map((e) => (
                  <text key={e.key} content={t`${fg("#58A6FF")(pad(e.key, KEY_W))}${fg("#3FB950")(e.envValue)}`} />
                ))}
                <text content="" />
              </>
            )}

            {comparison.onlyInCluster.length > 0 && (
              <>
                <text content={t`${fg("#F85149")("ONLY IN CLUSTER (" + comparison.onlyInCluster.length + ")")}`} />
                {comparison.onlyInCluster.map((c) => (
                  <text key={c.key} content={t`${fg("#58A6FF")(pad(c.key, KEY_W))}${fg("#F85149")("(removed on sync)")}`} />
                ))}
                <text content="" />
              </>
            )}

            {comparison.matching.length > 0 && (() => {
              const matchLabel = `${comparison.matching.length} matching values`
              return <text content={t`${fg("#8B949E")(matchLabel)}`} />
            })()}
          </box>
        </scrollbox>
      )
    }

    return (
      <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
        <text content={t`${fg("#8B949E")("Register this secret with a .env file.")}`} />
        <text content="" />
        <text content={t`${fg("#58A6FF")("Strategy:  ")}${fg("#8B949E")("dotenv")}`} />
        <box style={{ height: 1, width: "100%", backgroundColor: manageField === "host" ? "#1A3A5C" : undefined }}>
          <text content={t`${fg("#58A6FF")("SSH Host:  ")}${fg(manageField === "host" ? "#3FB950" : "#E6EDF3")(sshHost + (manageField === "host" ? "_" : ""))}`} />
        </box>
        <box style={{ height: 1, width: "100%", backgroundColor: manageField === "path" ? "#1A3A5C" : undefined }}>
          <text content={t`${fg("#58A6FF")("File Path:  ")}${fg(manageField === "path" ? "#3FB950" : "#E6EDF3")(filePath + (manageField === "path" ? "_" : ""))}`} />
        </box>
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
        title="register .env"
        borderStyle="single"
        borderColor="#58A6FF"
        style={{ flexDirection: "column", flexGrow: 1, gap: 0 }}
      >
        {renderContent()}
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
