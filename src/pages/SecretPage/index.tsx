import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard, useRenderer } from "@opentui/react"
import { t, fg, type StyledText } from "@opentui/core"
import { Panel } from "../../components/Panel"
import { CommandsBar, type CommandItem } from "../../components/CommandsBar"
import { Toast } from "../../components/Toast"
import { copyToClipboard } from "../../utils/clipboard"
import { SummaryView } from "./SummaryView"
import { KeysView, decodeBase64, isBinary } from "./KeysView"
import { RefsView } from "./RefsView"
import { ManageView, type ManageViewHandle } from "./ManageView"
import { RegisterModal } from "./RegisterModal"
import { EnvEditorModal } from "./EnvEditorModal"
import { LEFT_VIEWS, type LeftView, type Focus } from "./types"
import type { PodDetail, DetailRow, SecretManagement, EnvEntry } from "../../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

interface SecretPageProps {
  name: string
  namespace: string
  summary: DetailRow[]
  dataKeys: string[]
  rawData: Record<string, string>
  pods: PodDetail[]
  loading: boolean
  annotations: Record<string, string>
  contextName: string
  onOpenPod: (pod: PodDetail) => void
  onRefresh: () => void
  onBack: () => void
  onQuit: () => void
}

export function SecretPage({
  name,
  namespace,
  summary,
  dataKeys,
  rawData,
  pods,
  loading,
  annotations,
  contextName,
  onOpenPod,
  onRefresh,
  onBack,
  onQuit,
}: SecretPageProps) {
  const renderer = useRenderer()
  const [leftIndex, setLeftIndex] = useState(0)
  const [focus, setFocus] = useState<Focus>("left")
  const [revealed, setRevealed] = useState(false)
  const [decodedValues, setDecodedValues] = useState<Record<string, string> | null>(null)
  const [keyIndex, setKeyIndex] = useState(0)
  const [podIndex, setPodIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [toastMessage, setToastMessage] = useState("")
  const [manageCommands, setManageCommands] = useState<CommandItem[] | null>(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showEditorModal, setShowEditorModal] = useState(false)
  const [editorEntries, setEditorEntries] = useState<EnvEntry[]>([])
  const [editorManagement, setEditorManagement] = useState<SecretManagement | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rightScrollRef = useRef<any>(null)
  const podScrollRef = useRef<any>(null)
  const manageViewRef = useRef<ManageViewHandle>(null)

  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"
  const termWidth = renderer.width ?? 120
  const termHeight = renderer.height ?? 40
  const modalActive = showRegisterModal || showEditorModal

  const management = useMemo<SecretManagement | null>(
    () => {
      if (!annotations["k8cli.dev/managed-by"]) return null
      return {
        strategy: annotations["k8cli.dev/managed-by"] as any,
        host: annotations["k8cli.dev/env-host"] || "",
        path: annotations["k8cli.dev/env-path"] || "",
      }
    },
    [annotations],
  )

  useEffect(() => {
    const spinning = loading
    if (!spinning) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [loading])

  useEffect(() => {
    setLeftIndex(0)
    setFocus("left")
    setRevealed(false)
    setDecodedValues(null)
    setKeyIndex(0)
    setPodIndex(0)
    setShowRegisterModal(false)
    setShowEditorModal(false)
  }, [name, namespace, management])

  const scrollIntoView = useCallback((scrollRef: React.RefObject<any>, id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const toast = useCallback((msg: string) => {
    setToastMessage(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 5000)
  }, [])

  const handleShowRegisterModal = useCallback(() => {
    setShowRegisterModal(true)
  }, [])

  const handleShowEditorModal = useCallback((entries: EnvEntry[], mgmt: SecretManagement) => {
    setEditorEntries(entries)
    setEditorManagement(mgmt)
    setShowEditorModal(true)
  }, [])

  const activeView = LEFT_VIEWS[leftIndex]!

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "q" && !modalActive) {
        onQuit()
        return
      }

      if (modalActive) return

      if (focus === "left") {
        if (key.name === "up") {
          if (leftIndex > 0) setLeftIndex((i) => i - 1)
        } else if (key.name === "down") {
          if (leftIndex < LEFT_VIEWS.length - 1) setLeftIndex((i) => i + 1)
        } else if (key.name === "right") {
          setFocus("right")
          if (activeView === "keys") setKeyIndex(0)
        } else if (key.name === "escape") {
          onBack()
        }
        return
      }

      if (activeView === "manage") {
        const handled = manageViewRef.current?.handleKey(key) ?? false
        if (handled) return
      }

      if (activeView === "summary") {
        if (key.name === "up") {
          rightScrollRef.current?.scrollBy(-1)
        } else if (key.name === "down") {
          rightScrollRef.current?.scrollBy(1)
        }
      } else if (activeView === "keys") {
        if (key.name === "up") {
          if (keyIndex > 0) {
            const newIdx = keyIndex - 1
            setKeyIndex(newIdx)
            scrollIntoView(rightScrollRef, `key-${newIdx}`)
          }
        } else if (key.name === "down") {
          if (keyIndex < dataKeys.length - 1) {
            const newIdx = keyIndex + 1
            setKeyIndex(newIdx)
            if (revealed) {
              scrollIntoView(rightScrollRef, `keyval-${newIdx}`)
            } else {
              scrollIntoView(rightScrollRef, `key-${newIdx}`)
            }
          }
        } else if (key.name === "return") {
          const selectedKey = dataKeys[keyIndex]
          if (selectedKey) {
            const valueToCopy = decodedValues?.[selectedKey] ?? ""
            copyToClipboard(valueToCopy)
            toast(`copied ${selectedKey}`)
          }
        } else if (key.name === "d") {
          if (!decodedValues) {
            const decoded: Record<string, string> = {}
            for (const k of dataKeys) {
              const raw = rawData[k]
              if (raw) {
                const d = decodeBase64(raw)
                decoded[k] = isBinary(d) ? "<binary>" : d
              } else {
                decoded[k] = ""
              }
            }
            setDecodedValues(decoded)
          }
          setRevealed((v) => !v)
        }
      } else if (activeView === "refs") {
        if (key.name === "up") {
          if (podIndex > 0) {
            const newIdx = podIndex - 1
            setPodIndex(newIdx)
            scrollIntoView(podScrollRef, `pod-${newIdx}`)
          }
        } else if (key.name === "down") {
          if (podIndex < pods.length - 1) {
            const newIdx = podIndex + 1
            setPodIndex(newIdx)
            scrollIntoView(podScrollRef, `pod-${newIdx}`)
          }
        } else if (key.name === "return") {
          const pod = pods[podIndex]
          if (pod) onOpenPod(pod)
        }
      }

      if (key.name === "left") setFocus("left")
      if (key.name === "escape") onBack()
    },
    [focus, leftIndex, activeView, keyIndex, podIndex, pods, dataKeys, rawData, decodedValues,
      revealed, onOpenPod, onBack, onQuit, scrollIntoView, toast, modalActive],
  )

  useKeyboard(handleKey)

  const rightTitle = useMemo(() => {
    if (activeView === "summary") return "SUMMARY"
    if (activeView === "keys") {
      const count = dataKeys.length
      if (revealed) return `KEYS (${count}, revealed)`
      return `KEYS (${count})`
    }
    if (activeView === "refs") return "REFS"
    if (activeView === "manage") return "MANAGE"
    return ""
  }, [activeView, revealed, dataKeys.length])

  const commands = useMemo<CommandItem[]>(() => {
    if (focus === "right" && activeView === "manage" && manageCommands) {
      return manageCommands
    }
    if (focus === "right" && activeView === "keys") {
      return [
        { key: "[d]", label: revealed ? "mask" : "reveal" },
        { key: "[↑↓]", label: "nav" },
        { key: "[enter]", label: "copy" },
        { key: "[←]", label: "focus left" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    if (focus === "right" && activeView === "refs" && pods.length > 0) {
      return [
        { key: "[enter]", label: "pod" },
        { key: "[←→]", label: "focus" },
        { key: "[↑↓]", label: "nav" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    if (focus === "right" && activeView === "refs") {
      return [
        { key: "[←]", label: "focus left" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    if (focus === "right" && activeView === "summary") {
      return [
        { key: "[↑↓]", label: "scroll" },
        { key: "[←]", label: "focus left" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    return [
      { key: "[→]", label: "details" },
      { key: "[↑↓]", label: "nav" },
      { key: "[esc]", label: "back" },
      { key: "[q]", label: "uit" },
    ]
  }, [focus, activeView, revealed, pods.length, manageCommands])

  const renderRightContent = () => {
    if (loading && activeView !== "manage") {
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
        </box>
      )
    }

    if (activeView === "summary") {
      return <SummaryView summary={summary} scrollRef={rightScrollRef} />
    }

    if (activeView === "keys") {
      return (
        <KeysView
          dataKeys={dataKeys}
          rawData={rawData}
          revealed={revealed}
          decodedValues={decodedValues}
          keyIndex={keyIndex}
          focus={focus}
          scrollRef={rightScrollRef}
        />
      )
    }

    if (activeView === "refs") {
      return <RefsView pods={pods} podIndex={podIndex} scrollRef={podScrollRef} />
    }

    if (activeView === "manage") {
      return (
        <ManageView
          ref={manageViewRef}
          name={name}
          namespace={namespace}
          rawData={rawData}
          annotations={annotations}
          contextName={contextName}
          spinner={spinner}
          modalActive={modalActive}
          onRefresh={onRefresh}
          onBack={onBack}
          onFocusLeft={() => setFocus("left")}
          onCommands={setManageCommands}
          onToast={toast}
          onShowRegisterModal={handleShowRegisterModal}
          onShowEditorModal={handleShowEditorModal}
        />
      )
    }

    return null
  }

  return (
    <>
      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%", gap: 0, position: "relative" }}>
        <Panel title="VIEWS" focused={focus === "left"} width={20} gap={0}>
          {LEFT_VIEWS.map((view, i) => {
            const isSelected = i === leftIndex
            const bgColor = isSelected ? "#1A3A5C" : undefined
            const textColor = isSelected ? "#E6EDF3" : "#8B949E"
            const label = view.charAt(0).toUpperCase() + view.slice(1)
            return (
              <box key={view} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                <text content={t`${fg(textColor)(` ${label}`)}`} />
              </box>
            )
          })}
        </Panel>

        <Panel title={rightTitle} focused={focus === "right"} flexGrow={1} gap={0}>
          {renderRightContent()}
        </Panel>

        {showRegisterModal && (
          <RegisterModal
            name={name}
            namespace={namespace}
            rawData={rawData}
            contextName={contextName}
            termWidth={termWidth}
            termHeight={termHeight}
            spinner={spinner}
            onClose={() => setShowRegisterModal(false)}
            onRegistered={() => { setShowRegisterModal(false); onRefresh() }}
            onToast={toast}
          />
        )}

        {showEditorModal && editorManagement && (
          <EnvEditorModal
            entries={editorEntries}
            management={editorManagement}
            namespace={namespace}
            secretName={name}
            contextName={contextName}
            onClose={() => setShowEditorModal(false)}
            onRefresh={onRefresh}
            termWidth={termWidth}
            termHeight={termHeight}
          />
        )}
      </box>

      <CommandsBar commands={commands} />
      <Toast message={toastMessage} />
    </>
  )
}
