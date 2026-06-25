import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { t, fg, type StyledText } from "@opentui/core"
import { getSecretManagement, unregisterSecret } from "../../utils/secret-registry"
import { sshTestConnection, sshReadFile } from "../../utils/ssh"
import { parseDotenv } from "../../utils/dotenv"
import type { ManageState, ConnectionStatus } from "./types"
import type { SecretManagement, EnvEntry } from "../../types"

export interface ManageViewHandle {
  handleKey: (key: { name: string }) => boolean
}

interface ManageViewProps {
  name: string
  namespace: string
  rawData: Record<string, string>
  annotations: Record<string, string>
  contextName: string
  spinner: string
  modalActive: boolean
  onRefresh: () => void
  onBack: () => void
  onFocusLeft: () => void
  onCommands: (commands: StyledText) => void
  onToast: (msg: string) => void
  onShowRegisterModal: () => void
  onShowEditorModal: (entries: EnvEntry[], management: SecretManagement) => void
}

export const ManageView = forwardRef<ManageViewHandle, ManageViewProps>(function ManageView({
  name,
  namespace,
  rawData,
  annotations,
  contextName,
  spinner,
  modalActive,
  onRefresh,
  onBack,
  onFocusLeft,
  onCommands,
  onToast,
  onShowRegisterModal,
  onShowEditorModal,
}, ref) {
  const [manageState, setManageState] = useState<ManageState>("unregistered")
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("unknown")

  const management = useMemo(() => getSecretManagement(annotations), [annotations])

  useEffect(() => {
    setManageState(management ? "registered" : "unregistered")
    setConnectionStatus("unknown")
  }, [name, namespace, management])

  useEffect(() => {
    if (manageState === "registered" && management) {
      setConnectionStatus("checking")
      sshTestConnection(management.host, management.path).then((result) => {
        setConnectionStatus(result.connected ? "connected" : "failed")
      })
    }
  }, [manageState, management])

  const runUnregister = useCallback(async () => {
    const ok = await unregisterSecret(contextName, namespace, name)
    if (ok) {
      onRefresh()
      onToast("unregistered")
    } else {
      onToast("unregister failed")
    }
    setManageState(management ? "registered" : "unregistered")
  }, [contextName, namespace, name, management, onRefresh, onToast])

  const openEditor = useCallback(async () => {
    if (!management) return
    try {
      const content = await sshReadFile(management.host, management.path)
      const entries = parseDotenv(content)
      onShowEditorModal(entries, management)
    } catch {
      onToast("failed to read .env")
    }
  }, [management, onToast, onShowEditorModal])

  const commands = useMemo(() => {
    if (modalActive) {
      return t`${fg("#8B949E")("modal active")}`
    }
    if (manageState === "unregistered") {
      return t`${fg("#58A6FF")("[e]")} ${fg("#8B949E")("edit  ")}${fg("#58A6FF")("[←]")} ${fg("#8B949E")("focus left  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back")}`
    }
    if (manageState === "registered" && management) {
      return t`${fg("#58A6FF")("[e]")} ${fg("#8B949E")("edit .env  ")}${fg("#58A6FF")("[u]")} ${fg("#8B949E")("unregister  ")}${fg("#58A6FF")("[←]")} ${fg("#8B949E")("focus left  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back")}`
    }
    if (manageState === "unregister-confirm") {
      return t`${fg("#F85149")("[y]")} ${fg("#8B949E")("confirm  ")}${fg("#58A6FF")("[n]")} ${fg("#8B949E")("cancel")}`
    }
    return t`${fg("#8B949E")("")}`
  }, [manageState, management, modalActive])

  useEffect(() => {
    onCommands(commands)
  }, [commands, onCommands])

  const handleKey = useCallback((key: { name: string }): boolean => {
    if (modalActive) return true

    if (manageState === "unregistered") {
      if (key.name === "e") {
        onShowRegisterModal()
      } else if (key.name === "left") {
        onFocusLeft()
      } else if (key.name === "escape") {
        onBack()
      }
      return true
    }

    if (manageState === "registered" && management) {
      if (key.name === "e") {
        openEditor()
      } else if (key.name === "u") {
        setManageState("unregister-confirm")
      } else if (key.name === "left") {
        onFocusLeft()
      } else if (key.name === "escape") {
        onBack()
      }
      return true
    }

    if (manageState === "unregister-confirm") {
      if (key.name === "y") {
        runUnregister()
      } else if (key.name === "n" || key.name === "escape") {
        setManageState("registered")
      }
      return true
    }

    return true
  }, [
    manageState, management, modalActive,
    onFocusLeft, onBack, openEditor, runUnregister, onShowRegisterModal,
  ])

  useImperativeHandle(ref, () => ({ handleKey }), [handleKey])

  const renderContent = () => {
    if (manageState === "registered" && management) {
      const statusColor = connectionStatus === "connected" ? "#3FB950"
        : connectionStatus === "failed" ? "#F85149"
        : connectionStatus === "checking" ? "#D29922"
        : "#8B949E"
      const statusLabel = connectionStatus === "connected" ? "Connected"
        : connectionStatus === "failed" ? "Failed"
        : connectionStatus === "checking" ? "Checking..."
        : "Unknown"
      const statusIcon = connectionStatus === "checking" ? spinner
        : connectionStatus === "connected" ? "●"
        : connectionStatus === "failed" ? "✗"
        : "○"

      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#58A6FF")("Managed by:")} ${fg("#8B949E")("dotenv")}`} />
          <text content={t`${fg("#58A6FF")("SSH Host:   ")}${fg("#8B949E")(management.host)}`} />
          <text content={t`${fg("#58A6FF")("File Path:   ")}${fg("#8B949E")(management.path)}`} />
          <text content="" />
          <text content={t`${fg(statusColor)("Status: " + statusIcon + " " + statusLabel)}`} />
          {connectionStatus === "failed" && (
            <text content={t`${fg("#8B949E")("Server unreachable or .env missing")}`} />
          )}
        </box>
      )
    }

    if (manageState === "unregister-confirm") {
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#F85149")("Remove .env management for this secret?")}`} />
          <text content={t`${fg("#8B949E")("This does not delete the .env file on the server.")}`} />
          <text content="" />
          <text content={t`${fg("#F85149")("[y]")} ${fg("#8B949E")(" confirm  ")}${fg("#58A6FF")("[n]")} ${fg("#8B949E")(" cancel")}`} />
        </box>
      )
    }

    return (
      <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
        <text content={t`${fg("#58A6FF")("SSH Host:   ")}${fg("#8B949E")("-")}`} />
        <text content={t`${fg("#58A6FF")("File Path:   ")}${fg("#8B949E")("-")}`} />
        <text content="" />
        <text content={t`${fg("#8B949E")("Status:    ○ not connected")}`} />
      </box>
    )
  }

  return renderContent()
})
