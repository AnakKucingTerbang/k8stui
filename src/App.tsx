import { useCallback, useEffect, useRef, useState } from "react"
import { useRenderer } from "@opentui/react"
import type { CliRenderer } from "@opentui/core"
import { HeaderBar, buildBreadcrumbParts } from "./components/HeaderBar"
import { ClusterListPage } from "./pages/ClusterListPage"
import { ClusterDetailPage } from "./pages/ClusterDetailPage"
import { NodeDetailPage } from "./pages/NodeDetailPage"
import { PodDetailPage } from "./pages/PodDetailPage"
import type { Cluster, KubeContext, MetricMode, NodeDetail, PodDetail, PodDetailFull } from "./types"
import {
  loadContextsAsync,
  getCurrentContext,
  switchContext,
  fetchClusterStatusAsync,
  fetchNodeDetailsAsync,
  fetchPodsForNodeAsync,
  fetchPodDetailAsync,
} from "./kube"

type Page = "cluster-list" | "cluster-detail" | "node-detail" | "pod-detail"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function formatTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const s = date.getSeconds()
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`
}

interface AppProps {
  renderer: CliRenderer
}

export function App({ renderer }: AppProps) {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [clock, setClock] = useState(formatTime(new Date()))

  const [contexts, setContexts] = useState<KubeContext[]>([])
  const [currentContext, setCurrentContext] = useState("")

  const [loading, setLoading] = useState(true)
  const [spinnerFrame, setSpinnerFrame] = useState(0)

  const [page, setPage] = useState<Page>("cluster-list")
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [nodeDetails, setNodeDetails] = useState<NodeDetail[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null)
  const [pods, setPods] = useState<PodDetail[]>([])
  const [nodeLoading, setNodeLoading] = useState(false)
  const [metricMode, setMetricMode] = useState<MetricMode>("pct")

  const [selectedPod, setSelectedPod] = useState<PodDetail | null>(null)
  const [podDetailFull, setPodDetailFull] = useState<PodDetailFull | null>(null)
  const [podDetailLoading, setPodDetailLoading] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) {
        clearInterval(spinnerRef.current)
        spinnerRef.current = null
      }
      return
    }
    spinnerRef.current = setInterval(() => {
      setSpinnerFrame((f: number) => f + 1)
    }, 80)
    return () => {
      if (spinnerRef.current) {
        clearInterval(spinnerRef.current)
        spinnerRef.current = null
      }
    }
  }, [loading])

  const refreshCluster = useCallback(async () => {
    const data = await fetchClusterStatusAsync(currentContext)
    setClusters([data])
  }, [currentContext])

  const doContextSwitch = useCallback(async (ctxName: string) => {
    setLoading(true)
    setPage("cluster-list")
    setSelectedCluster(null)
    setNodeDetails([])
    setSelectedNode(null)
    setPods([])
    setSelectedPod(null)
    setPodDetailFull(null)
    switchContext(ctxName)
    setCurrentContext(ctxName)
    const data = await fetchClusterStatusAsync(ctxName)
    setClusters([data])
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      const ctxs = await loadContextsAsync()
      const cur = getCurrentContext()
      setContexts(ctxs)
      setCurrentContext(cur)

      if (cur) {
        const data = await fetchClusterStatusAsync(cur)
        setClusters([data])
      }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!currentContext) return

    refreshCluster()

    pollRef.current = setInterval(refreshCluster, 5000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [currentContext, refreshCluster])

  useEffect(() => {
    renderer.requestLive()

    const clockInterval = setInterval(() => {
      setClock(formatTime(new Date()))
    }, 2000)

    return () => {
      clearInterval(clockInterval)
      renderer.dropLive()
    }
  }, [renderer])

  const handleOpenCluster = useCallback((cluster: Cluster) => {
    setSelectedCluster(cluster)
    setNodeDetails([])
    setDetailLoading(true)
    setPage("cluster-detail")
    fetchNodeDetailsAsync(currentContext).then((nodes) => {
      setNodeDetails(nodes)
      setDetailLoading(false)
    })
  }, [currentContext])

  const handleOpenNode = useCallback((node: NodeDetail) => {
    setSelectedNode(node)
    setPods([])
    setNodeLoading(true)
    setPage("node-detail")
    fetchPodsForNodeAsync(currentContext, node.name).then((podsList) => {
      setPods(podsList)
      setNodeLoading(false)
    })
  }, [currentContext])

  const handleOpenPod = useCallback((pod: PodDetail) => {
    setSelectedPod(pod)
    setPodDetailFull(null)
    setPodDetailLoading(true)
    setPage("pod-detail")
    fetchPodDetailAsync(currentContext, pod.name, pod.namespace).then((detail) => {
      setPodDetailFull(detail)
      setPodDetailLoading(false)
    })
  }, [currentContext])

  const handleBack = useCallback(() => {
    if (page === "pod-detail") {
      setSelectedPod(null)
      setPodDetailFull(null)
      setPage("node-detail")
    } else if (page === "node-detail") {
      setSelectedNode(null)
      setPods([])
      setPage("cluster-detail")
    } else if (page === "cluster-detail") {
      setSelectedCluster(null)
      setNodeDetails([])
      setPage("cluster-list")
    }
  }, [page])

  const handleToggleMetric = useCallback(() => {
    setMetricMode((prev) => prev === "pct" ? "raw" : "pct")
  }, [])

  const handleQuit = useCallback(() => {
    renderer.destroy()
  }, [renderer])

  const breadcrumb = buildBreadcrumbParts({
    currentContext,
    clusterName: selectedCluster?.name,
    nodeName: selectedNode?.name,
    podName: selectedPod?.name,
    spinner: loading ? spinner : undefined,
  })

  const showLegends = page === "cluster-list"

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%", gap: 0 }}>
      <HeaderBar content={breadcrumb} clock={clock} />

      {page === "cluster-list" && (
        <ClusterListPage
          clusters={clusters}
          contexts={contexts}
          currentContext={currentContext}
          metricMode={metricMode}
          loading={loading}
          spinner={spinner}
          onOpenCluster={handleOpenCluster}
          onSwitchContext={doContextSwitch}
          onToggleMetric={handleToggleMetric}
          onQuit={handleQuit}
        />
      )}

      {page === "cluster-detail" && selectedCluster && (
        <ClusterDetailPage
          cluster={selectedCluster}
          nodeDetails={nodeDetails}
          loading={detailLoading}
          spinner={spinner}
          metricMode={metricMode}
          onOpenNode={handleOpenNode}
          onBack={handleBack}
          onToggleMetric={handleToggleMetric}
          onQuit={handleQuit}
        />
      )}

      {page === "node-detail" && selectedNode && (
        <NodeDetailPage
          node={selectedNode}
          pods={pods}
          loading={nodeLoading}
          spinner={spinner}
          metricMode={metricMode}
          onOpenPod={handleOpenPod}
          onBack={handleBack}
          onToggleMetric={handleToggleMetric}
          onQuit={handleQuit}
        />
      )}

      {page === "pod-detail" && selectedPod && (
        <PodDetailPage
          pod={selectedPod}
          podDetailFull={podDetailFull}
          loading={podDetailLoading}
          spinner={spinner}
          onBack={handleBack}
          onQuit={handleQuit}
        />
      )}
    </box>
  )
}
