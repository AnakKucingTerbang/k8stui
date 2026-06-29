import { useCallback, useEffect, useMemo, useState } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { Modal } from "../../components/Modal"
import { CommandsBar, type CommandItem } from "../../components/CommandsBar"
import { isPrintable } from "../../utils/keys"
import { startPortForward, findFreeLocalPort, type PortForwardHandle } from "../../utils/kube/portforward"
import type { PodDetailFull } from "../../types"

type ModalSection = "list" | "inputContainerPort" | "inputLocalPort" | "starting"

interface PortForwardModalProps {
  podDetailFull: PodDetailFull
  containerIndex: number
  contextName: string
  activeForwards: PortForwardHandle[]
  onAddForward: (handle: PortForwardHandle) => void
  onRemoveForward: (handle: PortForwardHandle) => void
  onClose: () => void
  onToast: (msg: string) => void
}

export function PortForwardModal({
  podDetailFull,
  containerIndex,
  contextName,
  activeForwards,
  onAddForward,
  onRemoveForward,
  onClose,
  onToast,
}: PortForwardModalProps) {
  const { width: termWidth, height: termHeight } = useTerminalDimensions()
  const [section, setSection] = useState<ModalSection>("list")
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [containerPortInput, setContainerPortInput] = useState("")
  const [localPortInput, setLocalPortInput] = useState("")
  const [pendingContainerPort, setPendingContainerPort] = useState<number | null>(null)
  const [pendingProtocol, setPendingProtocol] = useState("TCP")

  const container = podDetailFull.containers[containerIndex]
  const containerName = container?.name ?? ""
  const containerPorts = useMemo(() => {
    if (!container) return []
    return (container.ports || []).map((p) => {
      const parts = p.split("/")
      return { port: parseInt(parts[0] || "0", 10), protocol: parts[1] || "TCP" }
    })
  }, [container])

  const activeForThisContainer = useMemo(() => {
    return activeForwards.filter((f) => f.containerName === containerName)
  }, [activeForwards, containerName])

  const allItems = useMemo(() => {
    const active: { type: "active"; handle: PortForwardHandle; label: string }[] = activeForThisContainer.map((h) => ({
      type: "active" as const,
      handle: h,
      label: `localhost:${h.localPort} → ${h.containerPort}/${h.protocol}`,
    }))
    const available: { type: "available"; port: number; protocol: string; label: string }[] = containerPorts.map((p) => ({
      type: "available" as const,
      port: p.port,
      protocol: p.protocol,
      label: `${p.port}/${p.protocol}`,
    }))
    const custom: { type: "custom"; label: string }[] = [{ type: "custom" as const, label: "custom port..." }]
    return [...active, ...available, ...custom]
  }, [activeForThisContainer, containerPorts])

  const modalWidth = Math.min(72, termWidth - 4)
  const modalHeight = Math.min(termHeight - 6, 20)
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)

  useEffect(() => {
    const max = allItems.length - 1
    if (selectedIdx > max && max >= 0) setSelectedIdx(max)
  }, [allItems.length, selectedIdx])

  const doStartForward = useCallback(async (containerPort: number, protocol: string, localPortStr: string) => {
    setSection("starting")
    const desiredLocal = localPortStr.trim() ? parseInt(localPortStr, 10) : containerPort
    if (isNaN(desiredLocal) || desiredLocal < 1 || desiredLocal > 65535) {
      onToast(`Invalid local port: ${localPortStr}`)
      setSection("list")
      return
    }

    const alreadyForwarded = activeForwards.some(
      (f) => f.containerName === containerName && f.containerPort === containerPort,
    )
    if (alreadyForwarded) {
      onToast(`Port ${containerPort}/${protocol} already forwarded`)
      setSection("list")
      return
    }

    const localPort = await findFreeLocalPort(desiredLocal)

    const handle = startPortForward({
      contextName,
      namespace: podDetailFull.namespace,
      podName: podDetailFull.name,
      localPort,
      containerPort,
      containerName,
      protocol,
    })

    onAddForward(handle)
    onToast(`Forwarding localhost:${localPort} → ${containerPort}/${protocol}`)
    setSection("list")
    setLocalPortInput("")
    setContainerPortInput("")
    setPendingContainerPort(null)
  }, [contextName, podDetailFull, containerName, activeForwards, onAddForward, onToast])

  const handleKey = useCallback((key: { name: string; ctrl: boolean }) => {
    if (section === "starting") return

    if (section === "inputContainerPort") {
      if (key.name === "return") {
        const port = parseInt(containerPortInput, 10)
        if (!containerPortInput.trim() || isNaN(port) || port < 1 || port > 65535) {
          onToast("Enter a valid container port (1-65535)")
          return
        }
        setPendingContainerPort(port)
        setLocalPortInput("")
        setSection("inputLocalPort")
        return
      }
      if (key.name === "escape") {
        setSection("list")
        setContainerPortInput("")
        return
      }
      if (key.name === "backspace") {
        setContainerPortInput((v) => v.slice(0, -1))
        return
      }
      if (key.name === "delete") {
        setContainerPortInput("")
        return
      }
      if (isPrintable(key.name) && /^[0-9]$/.test(key.name)) {
        if (containerPortInput.length < 5) {
          setContainerPortInput((v) => v + key.name)
        }
        return
      }
      return
    }

    if (section === "inputLocalPort") {
      if (key.name === "return") {
        const port = pendingContainerPort ?? 0
        const proto = pendingProtocol
        if (port > 0) doStartForward(port, proto, localPortInput)
        return
      }
      if (key.name === "escape") {
        setSection("list")
        setLocalPortInput("")
        setPendingContainerPort(null)
        return
      }
      if (key.name === "backspace") {
        setLocalPortInput((v) => v.slice(0, -1))
        return
      }
      if (key.name === "delete") {
        setLocalPortInput("")
        return
      }
      if (isPrintable(key.name) && /^[0-9]$/.test(key.name)) {
        if (localPortInput.length < 5) {
          setLocalPortInput((v) => v + key.name)
        }
        return
      }
      return
    }

    if (key.name === "escape") {
      onClose()
      return
    }

    if (key.name === "up") {
      if (selectedIdx > 0) setSelectedIdx((i) => i - 1)
      return
    }
    if (key.name === "down") {
      if (selectedIdx < allItems.length - 1) setSelectedIdx((i) => i + 1)
      return
    }

    if (key.name === "return") {
      const item = allItems[selectedIdx]
      if (!item) return
      if (item.type === "available") {
        setPendingContainerPort(item.port)
        setPendingProtocol(item.protocol)
        setLocalPortInput("")
        setSection("inputLocalPort")
      } else if (item.type === "custom") {
        setContainerPortInput("")
        setSection("inputContainerPort")
      }
      return
    }

    if (key.name === "d") {
      const item = allItems[selectedIdx]
      if (!item) return
      if (item.type === "active") {
        item.handle.abort()
        onRemoveForward(item.handle)
        onToast(`Stopped forwarding port ${item.handle.containerPort}`)
      }
      return
    }

    if (key.name === "c") {
      setContainerPortInput("")
      setSection("inputContainerPort")
      return
    }
  }, [section, selectedIdx, allItems, localPortInput, containerPortInput, pendingContainerPort, pendingProtocol, onClose, onRemoveForward, doStartForward, onToast])

  useKeyboard(handleKey)

  const commands = useMemo<CommandItem[]>(() => {
    if (section === "starting") {
      return [{ key: "...", label: "Starting", keyColor: "#D29922" }]
    }
    if (section === "inputContainerPort") {
      return [
        { key: "[enter]", label: "next" },
        { key: "[esc]", label: "cancel" },
        { key: "", label: "— container port", keyColor: "#8B949E" },
      ]
    }
    if (section === "inputLocalPort") {
      const portLabel = pendingContainerPort ? `${pendingContainerPort}/${pendingProtocol}` : ""
      return [
        { key: "[enter]", label: "start" },
        { key: "[esc]", label: "cancel" },
        { key: "→", label: portLabel, keyColor: "#8B949E", labelColor: "#58A6FF" },
      ]
    }
    return [
      { key: "[↑↓]", label: "nav" },
      { key: "[enter]", label: "forward" },
      { key: "[c]", label: "custom" },
      { key: "[d]", label: "stop" },
      { key: "[esc]", label: "close" },
    ]
  }, [section, pendingContainerPort, pendingProtocol])

  const renderContent = () => {
    if (section === "starting") {
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")("Starting port-forward...")}`} />
        </box>
      )
    }

    if (section === "inputContainerPort") {
      const cursor = "_"
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#8B949E")("Enter container port to forward")}`} />
          <text content="" />
          <box style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
            <text content={t`${fg("#58A6FF")("Port: ")}${fg("#3FB950")(containerPortInput || cursor)}`} />
          </box>
          <text content="" />
          <text content={t`${fg("#8B949E")("e.g. 8080, 3000, 5432")}`} />
        </box>
      )
    }

    if (section === "inputLocalPort") {
      const cursor = "_"
      return (
        <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 1, flexGrow: 1 }}>
          <text content={t`${fg("#8B949E")("Local port for ")}${fg("#58A6FF")(`${pendingContainerPort}/${pendingProtocol}`)}`} />
          <text content="" />
          <box style={{ height: 1, width: "100%", backgroundColor: "#1A3A5C" }}>
            <text content={t`${fg("#58A6FF")("Local: ")}${fg("#3FB950")(localPortInput || cursor)}`} />
          </box>
          <text content="" />
          <text content={t`${fg("#8B949E")("Leave empty to use ")}${fg("#E6EDF3")(`${pendingContainerPort}`)}${fg("#8B949E")(" (auto-increment if taken)")}`} />
        </box>
      )
    }

    const customItemIdx = activeForThisContainer.length + containerPorts.length

    return (
      <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, gap: 0, flexGrow: 1 }}>
        {activeForThisContainer.length > 0 && (
          <>
            <text content={t`${fg("#3FB950")("ACTIVE")}`} />
            {activeForThisContainer.map((h, i) => {
              const isSel = allItems[selectedIdx]?.type === "active" && (allItems[selectedIdx] as any).handle === h
              const bgColor = isSel ? "#1A3A5C" : undefined
              const textColor = isSel ? "#E6EDF3" : "#8B949E"
              return (
                <box key={`active-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                  <text content={t`${fg("#3FB950")("●")} ${fg(textColor)(`localhost:${h.localPort} → ${h.containerPort}/${h.protocol}`)}`} />
                </box>
              )
            })}
            <text content="" />
          </>
        )}
        {containerPorts.length > 0 && (
          <>
            <text content={t`${fg("#58A6FF")("AVAILABLE")}`} />
            {containerPorts.map((p, i) => {
              const itemIdx = activeForThisContainer.length + i
              const isSel = selectedIdx === itemIdx
              const bgColor = isSel ? "#1A3A5C" : undefined
              const textColor = isSel ? "#E6EDF3" : "#8B949E"
              return (
                <box key={`avail-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                  <text content={t`${fg(textColor)(`${p.port}/${p.protocol}`)}`} />
                </box>
              )
            })}
          </>
        )}
        <text content="" />
        <text content={t`${fg("#58A6FF")("CUSTOM")}`} />
        <box style={{ height: 1, width: "100%", backgroundColor: selectedIdx === customItemIdx ? "#1A3A5C" : undefined }}>
          <text content={t`${fg(selectedIdx === customItemIdx ? "#E6EDF3" : "#8B949E")("custom port...")}`} />
        </box>
      </box>
    )
  }

  return (
    <Modal
      title={`port-forward — ${containerName}`}
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
