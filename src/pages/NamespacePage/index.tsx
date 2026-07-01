import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard, useRenderer } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { Section } from "../../components/Section"
import { Panel } from "../../components/Panel"
import { CommandsBar, type CommandItem } from "../../components/CommandsBar"
import { PodTable } from "../../components/PodTable"
import { ResourceListTable } from "../../components/ResourceListTable"
import { Toast } from "../../components/Toast"
import { RolloutRestartModal } from "../../components/RolloutRestartModal"
import { AddSecretModal } from "./AddSecretModal"
import { DeleteSecretModal } from "./DeleteSecretModal"
import { RESTARTABLE_KINDS } from "../../utils/kube"
import type { PodDetail, NamespacedResource, MetricMode, CustomGroup } from "../../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type NamespaceView = "workloads" | "pods" | "network" | "config"
type LeftMode = "views" | "custom"
type Focus = "left" | "right"

const LEFT_VIEWS: NamespaceView[] = ["workloads", "pods", "network", "config"]
const VIEW_LABELS: Record<NamespaceView, string> = {
  workloads: "Workloads",
  pods: "Pods",
  network: "Network",
  config: "Config",
}
const VIEW_TITLES: Record<NamespaceView, string> = {
  workloads: "WORKLOADS",
  pods: "PODS",
  network: "NETWORK",
  config: "CONFIG",
}

function getViewportBounds(scrollRef: React.RefObject<any>): { first: number; last: number } | null {
  const scroll = scrollRef.current
  if (!scroll) return null
  const top = Math.floor(scroll.scrollTop ?? 0)
  const h = scroll.viewport?.measuredHeight ?? scroll.viewport?.height ?? scroll.height ?? scroll.measuredHeight ?? 20
  return { first: top, last: Math.max(top, top + h - 1) }
}

interface NamespacePageProps {
  namespace: string
  workloads: NamespacedResource[]
  pods: PodDetail[]
  network: NamespacedResource[]
  config: NamespacedResource[]
  loading: boolean
  metricMode: MetricMode
  contextName: string
  customGroups: CustomGroup[]
  customResourceMap: Record<string, NamespacedResource[]>
  customLoading: boolean
  onOpenWorkload: (kind: string, name: string, namespace: string) => void
  onOpenPod: (pod: PodDetail) => void
  onOpenNetwork: (kind: string, name: string, namespace: string) => void
  onOpenConfig: (kind: string, name: string, namespace: string) => void
  onOpenCustomResource: (kind: string, name: string, namespace: string) => void
  onBack: () => void
  onQuit: () => void
  onRefresh: () => void
}

export function NamespacePage({
  namespace,
  workloads,
  pods,
  network,
  config,
  loading,
  metricMode,
  contextName,
  customGroups,
  customResourceMap,
  customLoading,
  onOpenWorkload,
  onOpenPod,
  onOpenNetwork,
  onOpenConfig,
  onOpenCustomResource,
  onBack,
  onQuit,
  onRefresh,
}: NamespacePageProps) {
  const [leftIndex, setLeftIndex] = useState(0)
  const [leftMode, setLeftMode] = useState<LeftMode>("views")
  const [focus, setFocus] = useState<Focus>("left")
  const [wlIndex, setWlIndex] = useState(0)
  const [podIndex, setPodIndex] = useState(0)
  const [netIndex, setNetIndex] = useState(0)
  const [cfgIndex, setCfgIndex] = useState(0)
  const [customGroupIndex, setCustomGroupIndex] = useState(0)
  const [customResIndex, setCustomResIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [showAddSecretModal, setShowAddSecretModal] = useState(false)
  const [showDeleteSecretModal, setShowDeleteSecretModal] = useState(false)
  const [deleteSecretName, setDeleteSecretName] = useState("")
  const [toastMessage, setToastMessage] = useState("")
  const [showRestartModal, setShowRestartModal] = useState(false)
  const [restartTarget, setRestartTarget] = useState<{ kind: string; name: string; namespace: string } | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderer = useRenderer()
  const wlScrollRef = useRef<any>(null)
  const podScrollRef = useRef<any>(null)
  const netScrollRef = useRef<any>(null)
  const cfgScrollRef = useRef<any>(null)
  const customResScrollRef = useRef<any>(null)
  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  const visibleGroups = useMemo(() => {
    const namespacedKindsByGroup = new Map<string, Set<string>>()
    for (const g of customGroups) {
      const namespacedKinds = new Set<string>()
      for (const k of g.kinds) {
        if (k.namespaced) namespacedKinds.add(k.name)
      }
      if (namespacedKinds.size > 0) namespacedKindsByGroup.set(g.apiGroup.groupVersion, namespacedKinds)
    }

    return customGroups.filter((g) => {
      const allResources = customResourceMap[g.apiGroup.groupVersion] || []
      const namespacedKinds = namespacedKindsByGroup.get(g.apiGroup.groupVersion)
      if (!namespacedKinds) return false
      const nsResources = allResources.filter((r) => r.namespace === namespace)
      return nsResources.length > 0
    })
  }, [customGroups, customResourceMap, namespace])

  const activeCustomResources = useMemo(() => {
    if (visibleGroups.length === 0) return []
    const group = visibleGroups[customGroupIndex]
    if (!group) return []
    const allResources = customResourceMap[group.apiGroup.groupVersion] || []
    return allResources.filter((r) => r.namespace === namespace)
  }, [visibleGroups, customGroupIndex, customResourceMap, namespace])

  const toast = useCallback((msg: string) => {
    setToastMessage(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 5000)
  }, [])

  const handleAddSecretCreated = useCallback(() => {
    setShowAddSecretModal(false)
    onRefresh()
  }, [onRefresh])

  const handleDeleteSecretCreated = useCallback(() => {
    setShowDeleteSecretModal(false)
    setDeleteSecretName("")
    onRefresh()
  }, [onRefresh])

  const handleRestarted = useCallback(() => {
    setShowRestartModal(false)
    setRestartTarget(null)
    onRefresh()
  }, [onRefresh])

  const termWidth = renderer.width ?? 120
  const termHeight = renderer.height ?? 40
  const modalActive = showAddSecretModal || showDeleteSecretModal || showRestartModal

  const activeView = LEFT_VIEWS[leftIndex]!

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [loading])

  useEffect(() => {
    setWlIndex(0)
    setPodIndex(0)
    setNetIndex(0)
    setCfgIndex(0)
  }, [namespace, leftIndex])

  useEffect(() => {
    setCustomGroupIndex(0)
  }, [namespace, visibleGroups.length])

  useEffect(() => {
    setCustomResIndex(0)
  }, [activeCustomResources])

  const scrollIntoView = useCallback((scrollRef: React.RefObject<any>, id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const currentList = useMemo((): { items: NamespacedResource[] | PodDetail[]; index: number; scrollRef: React.RefObject<any>; idPrefix: string } => {
    if (leftMode === "custom") return { items: activeCustomResources, index: customResIndex, scrollRef: customResScrollRef, idPrefix: "cres" }
    if (activeView === "workloads") return { items: workloads, index: wlIndex, scrollRef: wlScrollRef, idPrefix: "res" }
    if (activeView === "pods") return { items: pods, index: podIndex, scrollRef: podScrollRef, idPrefix: "pod" }
    if (activeView === "network") return { items: network, index: netIndex, scrollRef: netScrollRef, idPrefix: "res" }
    return { items: config, index: cfgIndex, scrollRef: cfgScrollRef, idPrefix: "res" }
  }, [leftMode, activeView, workloads, pods, network, config, activeCustomResources, wlIndex, podIndex, netIndex, cfgIndex, customResIndex])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (modalActive) return

      if (key.name === "escape") {
        onBack()
      } else if (key.name === "tab") {
        if (focus === "left" && visibleGroups.length > 0) {
          setLeftMode((prev) => prev === "views" ? "custom" : "views")
        }
      } else if (key.name === "up") {
        if (focus === "left") {
          if (leftMode === "views") {
            if (leftIndex > 0) setLeftIndex((i) => i - 1)
          } else {
            if (customGroupIndex > 0) setCustomGroupIndex((i) => i - 1)
          }
        } else {
          const vis = getViewportBounds(currentList.scrollRef)
          let idx = currentList.index
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.min(vis.last, currentList.items.length - 1)
          }
          if (idx > 0) {
            const newIdx = idx - 1
            if (leftMode === "custom") {
              setCustomResIndex(newIdx)
            } else if (activeView === "workloads") setWlIndex(newIdx)
            else if (activeView === "pods") setPodIndex(newIdx)
            else if (activeView === "network") setNetIndex(newIdx)
            else setCfgIndex(newIdx)
            scrollIntoView(currentList.scrollRef, `${currentList.idPrefix}-${newIdx}`)
          }
        }
      } else if (key.name === "down") {
        if (focus === "left") {
          if (leftMode === "views") {
            if (leftIndex < LEFT_VIEWS.length - 1) setLeftIndex((i) => i + 1)
          } else {
            if (customGroupIndex < visibleGroups.length - 1) setCustomGroupIndex((i) => i + 1)
          }
        } else {
          const vis = getViewportBounds(currentList.scrollRef)
          let idx = currentList.index
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.max(vis.first, 0)
          }
          if (idx < currentList.items.length - 1) {
            const newIdx = idx + 1
            if (leftMode === "custom") {
              setCustomResIndex(newIdx)
            } else if (activeView === "workloads") setWlIndex(newIdx)
            else if (activeView === "pods") setPodIndex(newIdx)
            else if (activeView === "network") setNetIndex(newIdx)
            else setCfgIndex(newIdx)
            scrollIntoView(currentList.scrollRef, `${currentList.idPrefix}-${newIdx}`)
          }
        }
      } else if (key.name === "right") {
        if (focus === "left") setFocus("right")
      } else if (key.name === "left") {
        if (focus === "right") setFocus("left")
      } else if (key.name === "return") {
        if (focus === "right") {
          if (leftMode === "custom") {
            const res = activeCustomResources[customResIndex]
            if (res) onOpenCustomResource(res.kind, res.name, res.namespace)
          } else if (activeView === "workloads") {
            const res = workloads[wlIndex]
            if (res) onOpenWorkload(res.kind, res.name, res.namespace)
          } else if (activeView === "pods") {
            const pod = pods[podIndex]
            if (pod) onOpenPod(pod)
          } else if (activeView === "network") {
            const res = network[netIndex]
            if (res) onOpenNetwork(res.kind, res.name, res.namespace)
          } else if (activeView === "config") {
            const res = config[cfgIndex]
            if (res) onOpenConfig(res.kind, res.name, res.namespace)
          }
        }
      } else if (key.name === "a" && focus === "right" && leftMode === "views" && activeView === "config") {
        setShowAddSecretModal(true)
      } else if (key.name === "d" && focus === "right" && leftMode === "views" && activeView === "config") {
        const res = config[cfgIndex]
        if (res && res.kind === "Secret") {
          setDeleteSecretName(res.name)
          setShowDeleteSecretModal(true)
        }
      } else if (key.name === "r" && focus === "right" && leftMode === "views" && activeView === "workloads") {
        const res = workloads[wlIndex]
        if (res && RESTARTABLE_KINDS.has(res.kind)) {
          setRestartTarget({ kind: res.kind, name: res.name, namespace: res.namespace })
          setShowRestartModal(true)
        }
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [focus, leftMode, leftIndex, activeView, wlIndex, podIndex, netIndex, cfgIndex, customGroupIndex, customResIndex, workloads, pods, network, config, visibleGroups, activeCustomResources, currentList, onOpenWorkload, onOpenPod, onOpenNetwork, onOpenConfig, onOpenCustomResource, onBack, onQuit, scrollIntoView, modalActive, namespace],
  )

  useKeyboard(handleKey)

  const rightTitle = useMemo(() => {
    if (leftMode === "custom") {
      if (visibleGroups.length === 0) return "CUSTOM"
      const group = visibleGroups[customGroupIndex]
      if (!group) return "CUSTOM"
      return group.apiGroup.name.toUpperCase()
    }
    return VIEW_TITLES[activeView]
  }, [leftMode, visibleGroups, customGroupIndex, activeView])

  const commands = useMemo<CommandItem[]>(() => {
    if (focus === "right") {
      const baseCommands: CommandItem[] = [
        { key: "[←→]", label: "focus" },
        { key: "[↑↓]", label: "nav" },
        { key: "[enter]", label: "open" },
      ]
      if (leftMode === "views" && activeView === "config") {
        baseCommands.push({ key: "[a]", label: "add secret" })
        const selected = config[cfgIndex]
        if (selected && selected.kind === "Secret") {
          baseCommands.push({ key: "[d]", label: "delete secret" })
        }
      }
      if (leftMode === "views" && activeView === "workloads") {
        const selected = workloads[wlIndex]
        if (selected && RESTARTABLE_KINDS.has(selected.kind)) {
          baseCommands.push({ key: "[r]", label: "estart" })
        }
      }
      baseCommands.push({ key: "[esc]", label: "back" })
      baseCommands.push({ key: "[q]", label: "uit" })
      return baseCommands
    }
    return [
      { key: "[←→]", label: "focus" },
      { key: "[↑↓]", label: "nav" },
      ...(visibleGroups.length > 0 ? [{ key: "[tab]", label: leftMode === "views" ? "custom" : "views" }] : []),
      { key: "[→]", label: "details" },
      { key: "[esc]", label: "back" },
      { key: "[q]", label: "uit" },
    ]
  }, [focus, leftMode, activeView, config, cfgIndex, visibleGroups.length])

  const renderRightContent = () => {
    if (leftMode === "custom") {
      if (customLoading) {
        return (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading custom resources...")}`} />
          </box>
        )
      }
      if (visibleGroups.length === 0) {
        return (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#484F58")("No custom resources in this namespace")}`} />
          </box>
        )
      }
      return <ResourceListTable resources={activeCustomResources} selectedIndex={customResIndex} scrollRef={customResScrollRef} />
    }

    if (loading) {
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading namespace data...")}`} />
          <text fg="#484F58" content={`Fetching from ${namespace}...`} />
        </box>
      )
    }

    if (activeView === "workloads") {
      return <ResourceListTable resources={workloads} selectedIndex={wlIndex} scrollRef={wlScrollRef} />
    }

    if (activeView === "pods") {
      return <PodTable pods={pods} selectedIndex={podIndex} scrollRef={podScrollRef} metricMode={metricMode} />
    }

    if (activeView === "network") {
      return <ResourceListTable resources={network} selectedIndex={netIndex} scrollRef={netScrollRef} />
    }

    return <ResourceListTable resources={config} selectedIndex={cfgIndex} scrollRef={cfgScrollRef} />
  }

  return (
    <>
      <Section title={`NAMESPACE | ${namespace}`} height={5}>
        <box style={{ flexDirection: "row", paddingLeft: 1, paddingTop: 1, gap: 2 }}>
          <text content={t`${fg("#8B949E")("workloads:")} ${fg("#E6EDF3")(`${workloads.length}`)}  ${fg("#8B949E")("pods:")} ${fg("#E6EDF3")(`${pods.length}`)}  ${fg("#8B949E")("network:")} ${fg("#E6EDF3")(`${network.length}`)}  ${fg("#8B949E")("config:")} ${fg("#E6EDF3")(`${config.length}`)}`} />
        </box>
      </Section>

      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%", gap: 0, position: "relative" }}>
        <box style={{ flexDirection: "column", width: 20, gap: 0 }}>
          <Panel title="VIEWS" focused={focus === "left" && leftMode === "views"} width={20} gap={0}>
            {LEFT_VIEWS.map((view, i) => {
              const isSelected = leftMode === "views" && i === leftIndex
              const bgColor = isSelected ? "#1A3A5C" : undefined
              const textColor = isSelected ? "#E6EDF3" : "#8B949E"
              const label = VIEW_LABELS[view]
              return (
                <box key={view} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                  <text content={t`${fg(textColor)(` ${label}`)}`} />
                </box>
              )
            })}
          </Panel>

          <Panel title="CUSTOM" focused={focus === "left" && leftMode === "custom"} width={20} gap={0}>
            {visibleGroups.length === 0 ? (
              <box style={{ height: 1, width: "100%" }}>
                <text content={t`${fg("#484F58")(" No custom resources")}`} />
              </box>
            ) : (
              visibleGroups.map((group, i) => {
                const isSelected = leftMode === "custom" && i === customGroupIndex
                const bgColor = isSelected ? "#1A3A5C" : undefined
                const textColor = isSelected ? "#E6EDF3" : "#8B949E"
                const label = group.apiGroup.name
                const nsCount = (customResourceMap[group.apiGroup.groupVersion] || []).filter((r) => r.namespace === namespace).length
                return (
                  <box key={group.apiGroup.groupVersion} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                    <text content={t`${fg(textColor)(` ${label}`)} ${fg("#484F58")(`(${nsCount})`)}`} />
                  </box>
                )
              })
            )}
          </Panel>
        </box>

        <Panel title={rightTitle} focused={focus === "right"} flexGrow={1} gap={0}>
          {renderRightContent()}
        </Panel>

      </box>

      {showAddSecretModal && (
        <AddSecretModal
          namespace={namespace}
          contextName={contextName}
          termWidth={termWidth}
          termHeight={termHeight}
          spinner={spinner}
          onClose={() => setShowAddSecretModal(false)}
          onCreated={handleAddSecretCreated}
          onToast={toast}
        />
      )}

      {showDeleteSecretModal && (
        <DeleteSecretModal
          namespace={namespace}
          secretName={deleteSecretName}
          contextName={contextName}
          termWidth={termWidth}
          termHeight={termHeight}
          spinner={spinner}
          onClose={() => { setShowDeleteSecretModal(false); setDeleteSecretName("") }}
          onDeleted={handleDeleteSecretCreated}
          onToast={toast}
        />
      )}

      {showRestartModal && restartTarget && (
        <RolloutRestartModal
          kind={restartTarget.kind}
          name={restartTarget.name}
          namespace={restartTarget.namespace}
          contextName={contextName}
          termWidth={termWidth}
          termHeight={termHeight}
          spinner={spinner}
          onClose={() => { setShowRestartModal(false); setRestartTarget(null) }}
          onRestarted={handleRestarted}
          onToast={toast}
        />
      )}

      <CommandsBar commands={commands} />
      <Toast message={toastMessage} />
    </>
  )
}
