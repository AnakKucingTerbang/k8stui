import { useCallback, useEffect, useRef, useState } from "react"
import { useRenderer } from "@opentui/react"
import type { CliRenderer } from "@opentui/core"
import { HeaderBar, buildBreadcrumbParts } from "./components/HeaderBar"
import { ClustersPage } from "./pages/ClustersPage"
import { ClusterPage } from "./pages/ClusterPage"
import { NodePage } from "./pages/NodePage"
import { NamespacePage } from "./pages/NamespacePage"
import { WorkloadPage } from "./pages/WorkloadPage"
import { NetworkPage } from "./pages/NetworkPage"
import { StoragePage } from "./pages/StoragePage"
import { ConfigPage } from "./pages/ConfigPage"
import { SecretPage } from "./pages/SecretPage"
import { PodPage } from "./pages/PodPage"
import type {
  Cluster, KubeContext, MetricMode, NodeDetail, NodeCondition,
  NamespaceInfo, ClusterResource, PodDetail, PodDetailFull,
  NamespacedResource, DetailRow, ResourceCategory,   SecretDetailData,
} from "./types"
import {
  loadContextsAsync,
  getCurrentContext,
  switchContext,
  fetchClusterStatusAsync,
  fetchClusterDetailDataAsync,
  fetchPodsForNodeAsync,
  fetchNodeConditionsAsync,
  fetchPodDetailAsync,
  fetchNamespaceDetailAsync,
  fetchWorkloadDetailAsync,
  fetchNetworkDetailAsync,
  fetchStorageDetailAsync,
  fetchConfigDetailAsync,
  fetchSecretDetailAsync,
} from "./utils/kube"

type NavEntry =
  | { page: "clusters" }
  | { page: "cluster"; cluster: Cluster }
  | { page: "node"; node: NodeDetail }
  | { page: "namespace"; namespace: string }
  | { page: "workload"; kind: string; name: string; namespace: string }
  | { page: "network"; kind: string; name: string; namespace: string }
  | { page: "storage"; name: string; namespace: string }
  | { page: "config"; kind: string; name: string; namespace: string }
  | { page: "pod"; pod: PodDetail }

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
  const [stack, setStack] = useState<NavEntry[]>([{ page: "clusters" }])
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [clock, setClock] = useState(formatTime(new Date()))
  const [contexts, setContexts] = useState<KubeContext[]>([])
  const [currentContext, setCurrentContext] = useState("")
  const [loading, setLoading] = useState(true)
  const [spinnerFrame, setSpinnerFrame] = useState(0)

  const [nodeDetails, setNodeDetails] = useState<NodeDetail[]>([])
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([])
  const [clusterResources, setClusterResources] = useState<ClusterResource[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const [pods, setPods] = useState<PodDetail[]>([])
  const [nodeConditions, setNodeConditions] = useState<NodeCondition[]>([])
  const [nodeLoading, setNodeLoading] = useState(false)

  const [nsWorkloads, setNsWorkloads] = useState<NamespacedResource[]>([])
  const [nsPods, setNsPods] = useState<PodDetail[]>([])
  const [nsNetwork, setNsNetwork] = useState<NamespacedResource[]>([])
  const [nsConfig, setNsConfig] = useState<NamespacedResource[]>([])
  const [nsLoading, setNsLoading] = useState(false)

  const [workloadSummary, setWorkloadSummary] = useState<DetailRow[]>([])
  const [workloadPods, setWorkloadPods] = useState<PodDetail[]>([])
  const [workloadLoading, setWorkloadLoading] = useState(false)

  const [networkSummary, setNetworkSummary] = useState<DetailRow[]>([])
  const [networkPods, setNetworkPods] = useState<PodDetail[]>([])
  const [networkLoading, setNetworkLoading] = useState(false)

  const [storageSummary, setStorageSummary] = useState<DetailRow[]>([])
  const [storageMountPod, setStorageMountPod] = useState<PodDetail | null>(null)
  const [storageLoading, setStorageLoading] = useState(false)

  const [configSummary, setConfigSummary] = useState<DetailRow[]>([])
  const [configPods, setConfigPods] = useState<PodDetail[]>([])
  const [configLoading, setConfigLoading] = useState(false)

  const [secretDetail, setSecretDetail] = useState<SecretDetailData | null>(null)
  const [secretLoading, setSecretLoading] = useState(false)

  const [podDetailFull, setPodDetailFull] = useState<PodDetailFull | null>(null)
  const [metricMode, setMetricMode] = useState<MetricMode>("pct")

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [loading])

  const push = useCallback((entry: NavEntry) => {
    setStack((prev) => [...prev, entry])
  }, [])

  const pop = useCallback(() => {
    setStack((prev) => prev.length > 1 ? prev.slice(0, -1) : prev)
  }, [])

  const current = stack[stack.length - 1]!

  const refreshCluster = useCallback(async () => {
    const data = await fetchClusterStatusAsync(currentContext)
    setClusters([data])
  }, [currentContext])

  const doContextSwitch = useCallback(async (ctxName: string) => {
    setLoading(true)
    setStack([{ page: "clusters" }])
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
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [currentContext, refreshCluster])

  useEffect(() => {
    renderer.requestLive()
    const clockInterval = setInterval(() => setClock(formatTime(new Date())), 2000)
    return () => { clearInterval(clockInterval); renderer.dropLive() }
  }, [renderer])

  const handleOpenCluster = useCallback((cluster: Cluster) => {
    setNodeDetails([])
    setNamespaces([])
    setClusterResources([])
    setDetailLoading(true)
    push({ page: "cluster", cluster })
    fetchClusterDetailDataAsync(currentContext).then((data) => {
      setNodeDetails(data.nodes)
      setNamespaces(data.namespaces)
      setClusterResources(data.resources)
      setDetailLoading(false)
    })
  }, [currentContext, push])

  const handleOpenNode = useCallback((node: NodeDetail) => {
    setPods([])
    setNodeConditions([])
    setNodeLoading(true)
    push({ page: "node", node })
    Promise.all([
      fetchPodsForNodeAsync(currentContext, node.name),
      fetchNodeConditionsAsync(currentContext, node.name),
    ]).then(([podsList, conditions]) => {
      setPods(podsList)
      setNodeConditions(conditions)
      setNodeLoading(false)
    })
  }, [currentContext, push])

  const handleOpenNamespace = useCallback((namespace: string) => {
    setNsWorkloads([])
    setNsPods([])
    setNsNetwork([])
    setNsConfig([])
    setNsLoading(true)
    push({ page: "namespace", namespace })
    fetchNamespaceDetailAsync(currentContext, namespace).then((data) => {
      setNsWorkloads(data.workloads)
      setNsPods(data.pods)
      setNsNetwork(data.network)
      setNsConfig(data.config)
      setNsLoading(false)
    })
  }, [currentContext, push])

  const handleOpenResource = useCallback((resource: ClusterResource) => {
    const entry: NavEntry = (() => {
      switch (resource.category) {
        case "workloads": return { page: "workload" as const, kind: resource.kind, name: resource.name, namespace: resource.namespace }
        case "network": return { page: "network" as const, kind: resource.kind, name: resource.name, namespace: resource.namespace }
        case "storage": return { page: "storage" as const, name: resource.name, namespace: resource.namespace }
        case "configuration": return { page: "config" as const, kind: resource.kind, name: resource.name, namespace: resource.namespace }
      }
    })()

    switch (entry.page) {
      case "workload":
        setWorkloadSummary([])
        setWorkloadPods([])
        setWorkloadLoading(true)
        break
      case "network":
        setNetworkSummary([])
        setNetworkPods([])
        setNetworkLoading(true)
        break
      case "storage":
        setStorageSummary([])
        setStorageMountPod(null)
        setStorageLoading(true)
        break
      case "config":
        if (resource.kind === "Secret") {
          setSecretDetail(null)
          setSecretLoading(true)
        } else {
          setConfigSummary([])
          setConfigPods([])
          setConfigLoading(true)
        }
        break
    }

    push(entry)

    switch (entry.page) {
      case "workload":
        fetchWorkloadDetailAsync(currentContext, entry.namespace, entry.kind, entry.name).then((data) => {
          setWorkloadSummary(data.summary)
          setWorkloadPods(data.pods)
          setWorkloadLoading(false)
        })
        break
      case "network":
        fetchNetworkDetailAsync(currentContext, entry.namespace, entry.kind, entry.name).then((data) => {
          setNetworkSummary(data.summary)
          setNetworkPods(data.pods)
          setNetworkLoading(false)
        })
        break
      case "storage":
        fetchStorageDetailAsync(currentContext, entry.namespace, entry.name).then((data) => {
          setStorageSummary(data.summary)
          setStorageMountPod(data.mountPod)
          setStorageLoading(false)
        })
        break
      case "config":
        if (entry.kind === "Secret") {
          fetchSecretDetailAsync(currentContext, entry.namespace, entry.name).then((data) => {
            setSecretDetail(data)
            setSecretLoading(false)
          })
        } else {
          fetchConfigDetailAsync(currentContext, entry.namespace, entry.kind, entry.name).then((data) => {
            setConfigSummary(data.summary)
            setConfigPods(data.pods)
            setConfigLoading(false)
          })
        }
        break
    }
  }, [currentContext, push])

  const handleOpenWorkload = useCallback((kind: string, name: string, namespace: string) => {
    setWorkloadSummary([])
    setWorkloadPods([])
    setWorkloadLoading(true)
    push({ page: "workload", kind, name, namespace })
    fetchWorkloadDetailAsync(currentContext, namespace, kind, name).then((data) => {
      setWorkloadSummary(data.summary)
      setWorkloadPods(data.pods)
      setWorkloadLoading(false)
    })
  }, [currentContext, push])

  const handleOpenNetwork = useCallback((kind: string, name: string, namespace: string) => {
    setNetworkSummary([])
    setNetworkPods([])
    setNetworkLoading(true)
    push({ page: "network", kind, name, namespace })
    fetchNetworkDetailAsync(currentContext, namespace, kind, name).then((data) => {
      setNetworkSummary(data.summary)
      setNetworkPods(data.pods)
      setNetworkLoading(false)
    })
  }, [currentContext, push])

  const handleOpenConfig = useCallback((kind: string, name: string, namespace: string) => {
    push({ page: "config", kind, name, namespace })
    if (kind === "Secret") {
      setSecretDetail(null)
      setSecretLoading(true)
      fetchSecretDetailAsync(currentContext, namespace, name).then((data) => {
        setSecretDetail(data)
        setSecretLoading(false)
      })
    } else {
      setConfigSummary([])
      setConfigPods([])
      setConfigLoading(true)
      fetchConfigDetailAsync(currentContext, namespace, kind, name).then((data) => {
        setConfigSummary(data.summary)
        setConfigPods(data.pods)
        setConfigLoading(false)
      })
    }
  }, [currentContext, push])

  const handleOpenPod = useCallback((pod: PodDetail) => {
    setPodDetailFull(null)
    push({ page: "pod", pod })
    fetchPodDetailAsync(currentContext, pod.name, pod.namespace, (partial) => {
      setPodDetailFull(partial)
    }).then((detail) => {
      setPodDetailFull(detail)
    })
  }, [currentContext, push])

  const handleRefreshPodDetail = useCallback(() => {
    const podEntry = stack.find((e): e is NavEntry & { page: "pod" } => e.page === "pod")
    if (!podEntry || !currentContext) return
    fetchPodDetailAsync(currentContext, podEntry.pod.name, podEntry.pod.namespace, (partial) => {
      setPodDetailFull(partial)
    }).then((detail) => {
      setPodDetailFull(detail)
    })
  }, [currentContext, stack])

  const handleRefreshSecret = useCallback(() => {
    const secretEntry = stack.find((e): e is NavEntry & { page: "config"; kind: string } => e.page === "config" && e.kind === "Secret")
    if (!secretEntry || !currentContext) return
    setSecretDetail(null)
    setSecretLoading(true)
    fetchSecretDetailAsync(currentContext, secretEntry.namespace, secretEntry.name).then((data) => {
      setSecretDetail(data)
      setSecretLoading(false)
    })
  }, [currentContext, stack])

  const handleToggleMetric = useCallback(() => {
    setMetricMode((prev) => prev === "pct" ? "raw" : "pct")
  }, [])

  const handleQuit = useCallback(() => {
    renderer.destroy()
  }, [renderer])

  const breadcrumb = buildBreadcrumbParts({
    currentContext,
    clusterName: current.page === "cluster" ? (current as { cluster: Cluster }).cluster?.name : undefined,
    nodeName: current.page === "node" ? (current as { node: NodeDetail }).node?.name : undefined,
    namespaceName: current.page === "namespace" ? (current as { namespace: string }).namespace : undefined,
    resourceKind: current.page === "workload" ? (current as { kind: string }).kind :
                   current.page === "network" ? (current as { kind: string }).kind :
                    current.page === "storage" ? "PVC" :
                    current.page === "config" ? (current as { kind: string }).kind : undefined,
    resourceName: current.page === "workload" || current.page === "network" || current.page === "storage" || current.page === "config"
                  ? (current as { name: string }).name : undefined,
    podName: current.page === "pod" ? (current as { pod: PodDetail }).pod?.name : undefined,
    spinner: loading ? spinner : undefined,
  })

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%", gap: 0 }}>
      <HeaderBar content={breadcrumb} clock={clock} />

      {current.page === "clusters" && (
        <ClustersPage
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

      {current.page === "cluster" && (
        <ClusterPage
          cluster={(current as { cluster: Cluster }).cluster}
          nodeDetails={nodeDetails}
          namespaces={namespaces}
          resources={clusterResources}
          loading={detailLoading}
          metricMode={metricMode}
          onOpenNode={handleOpenNode}
          onOpenNamespace={handleOpenNamespace}
          onOpenResource={handleOpenResource}
          onBack={pop}
          onToggleMetric={handleToggleMetric}
          onQuit={handleQuit}
        />
      )}

      {current.page === "node" && (
        <NodePage
          node={(current as { node: NodeDetail }).node}
          pods={pods}
          conditions={nodeConditions}
          loading={nodeLoading}
          metricMode={metricMode}
          onOpenPod={handleOpenPod}
          onBack={pop}
          onToggleMetric={handleToggleMetric}
          onQuit={handleQuit}
        />
      )}

      {current.page === "namespace" && (
        <NamespacePage
          namespace={(current as { namespace: string }).namespace}
          workloads={nsWorkloads}
          pods={nsPods}
          network={nsNetwork}
          config={nsConfig}
          loading={nsLoading}
          metricMode={metricMode}
          onOpenWorkload={handleOpenWorkload}
          onOpenPod={handleOpenPod}
          onOpenNetwork={handleOpenNetwork}
          onOpenConfig={handleOpenConfig}
          onBack={pop}
          onQuit={handleQuit}
        />
      )}

      {current.page === "workload" && (
        <WorkloadPage
          kind={(current as { kind: string }).kind}
          name={(current as { name: string }).name}
          namespace={(current as { namespace: string }).namespace}
          summary={workloadSummary}
          pods={workloadPods}
          loading={workloadLoading}
          metricMode={metricMode}
          onOpenPod={handleOpenPod}
          onBack={pop}
          onQuit={handleQuit}
        />
      )}

      {current.page === "network" && (
        <NetworkPage
          kind={(current as { kind: string }).kind}
          name={(current as { name: string }).name}
          namespace={(current as { namespace: string }).namespace}
          summary={networkSummary}
          pods={networkPods}
          loading={networkLoading}
          metricMode={metricMode}
          onOpenPod={handleOpenPod}
          onBack={pop}
          onQuit={handleQuit}
        />
      )}

      {current.page === "storage" && (
        <StoragePage
          name={(current as { name: string }).name}
          namespace={(current as { namespace: string }).namespace}
          summary={storageSummary}
          mountPod={storageMountPod}
          loading={storageLoading}
          onOpenPod={handleOpenPod}
          onBack={pop}
          onQuit={handleQuit}
        />
      )}

      {current.page === "config" && (current as { kind: string }).kind === "Secret" && (
        <SecretPage
          name={(current as { name: string }).name}
          namespace={(current as { namespace: string }).namespace}
          summary={secretDetail?.summary || []}
          dataKeys={secretDetail?.dataKeys || []}
          rawData={secretDetail?.rawData || {}}
          pods={secretDetail?.pods || []}
          loading={secretLoading}
          annotations={secretDetail?.annotations || {}}
          contextName={currentContext}
          onOpenPod={handleOpenPod}
          onRefresh={handleRefreshSecret}
          onBack={pop}
          onQuit={handleQuit}
        />
      )}

      {current.page === "config" && (current as { kind: string }).kind !== "Secret" && (
        <ConfigPage
          kind={(current as { kind: string }).kind}
          name={(current as { name: string }).name}
          namespace={(current as { namespace: string }).namespace}
          summary={configSummary}
          pods={configPods}
          loading={configLoading}
          onOpenPod={handleOpenPod}
          onBack={pop}
          onQuit={handleQuit}
        />
      )}

      {current.page === "pod" && (
        <PodPage
          pod={(current as { pod: PodDetail }).pod}
          podDetailFull={podDetailFull}
          onBack={pop}
          onQuit={handleQuit}
          onRefresh={handleRefreshPodDetail}
          contextName={currentContext}
        />
      )}
    </box>
  )
}
