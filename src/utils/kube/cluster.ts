import type { Cluster, KubeContext, NamespaceInfo, ClusterResource, ResourceCategory, ClusterDetailData } from "../../types"
import { kubectlAsync, kubectlContextAsync } from "./exec"
import { parseNodesJson, parseTopNodes, parseCpuMillicores, parseMemBytes, formatCpuRaw, formatMemRaw, formatAge } from "./parse"
import { fetchNodeDetailsAsync } from "./node"

export async function loadContextsAsync(): Promise<KubeContext[]> {
  const json = await kubectlAsync("config view -o json")
  if (!json) return []

  try {
    const data = JSON.parse(json)
    const clusterArr = data.clusters || []
    const contextArr = data.contexts || []

    const serverMap = new Map<string, string>()
    for (const cl of clusterArr) {
      serverMap.set(cl.name, cl.cluster?.server || "")
    }

    return contextArr.map((ctx: any) => ({
      name: ctx.name || "",
      cluster: ctx.context?.cluster || "",
      user: ctx.context?.user || "",
      server: serverMap.get(ctx.context?.cluster || "") || "",
    }))
  } catch {
    return []
  }
}

export async function fetchClusterStatusAsync(contextName: string): Promise<Cluster> {
  const [clusterName, nodesJson, topOutput, podsTotalRaw, podsRunningRaw] = await Promise.all([
    kubectlContextAsync(
      contextName,
      `config view -o jsonpath="{.contexts[?(@.name=='${contextName}')].context.cluster}"`,
    ),
    kubectlContextAsync(contextName, "get nodes -o json", 5000),
    kubectlContextAsync(contextName, "top nodes --no-headers", 5000),
    kubectlContextAsync(contextName, "get pods -A --no-headers 2>/dev/null | wc -l", 5000),
    kubectlContextAsync(contextName, "get pods -A --field-selector status.phase=Running --no-headers 2>/dev/null | wc -l", 5000),
  ])

  const nodeInfo = parseNodesJson(nodesJson)

  let status: Cluster["status"] = "unreachable"
  let notes = "unreachable"

  if (nodesJson) {
    if (nodeInfo.down > 0) {
      status = "degraded"
      notes = nodeInfo.down === 1 ? "1 node down" : `${nodeInfo.down} nodes down`
    } else if (nodeInfo.total > 0) {
      status = "connected"
      notes = "─"
    }
  }

  const nodeMetrics = parseTopNodes(topOutput)

  let cpuPct = 0
  let memPct = 0
  let cpuMillicores = 0
  let memBytes = 0
  if (nodeMetrics.size > 0) {
    let cpuPctSum = 0
    let memPctSum = 0
    for (const info of nodeMetrics.values()) {
      cpuPctSum += info.cpuPct
      memPctSum += info.memPct
      cpuMillicores += parseCpuMillicores(info.cpu)
      memBytes += parseMemBytes(info.mem)
    }
    cpuPct = Math.round(cpuPctSum / nodeMetrics.size)
    memPct = Math.round(memPctSum / nodeMetrics.size)
  }

  const podsTotal = parseInt(podsTotalRaw.trim(), 10) || 0
  const podsUsed = parseInt(podsRunningRaw.trim(), 10) || 0

  if (status === "degraded") {
    cpuPct = 0
    memPct = 0
  }

  const cpuRaw = formatCpuRaw(cpuMillicores)
  const memRaw = formatMemRaw(memBytes)

  if (status === "unreachable") {
    return {
      contextName,
      name: clusterName || contextName,
      status,
      nodeOnline: 0,
      nodeTotal: 0,
      cpuPct: 0,
      memPct: 0,
      cpuRaw: "──",
      memRaw: "──",
      podsUsed: 0,
      podsTotal: 0,
      notes,
    }
  }

  return {
    contextName,
    name: clusterName || contextName,
    status,
    nodeOnline: nodeInfo.ready,
    nodeTotal: nodeInfo.total,
    cpuPct,
    memPct,
    cpuRaw,
    memRaw,
    podsUsed,
    podsTotal,
    notes,
  }
}

async function fetchCategoryAsync(
  contextName: string,
  kinds: string,
  category: ResourceCategory,
): Promise<ClusterResource[]> {
  try {
    const json = await kubectlContextAsync(contextName, `get ${kinds} -A -o json`, 10000)
    if (!json) return []
    const data = JSON.parse(json)
    const items: any[] = data.items || []
    return items.map((item: any): ClusterResource => ({
      kind: item.kind || "",
      name: item.metadata?.name || "",
      namespace: item.metadata?.namespace || "",
      category,
    }))
  } catch {
    return []
  }
}

export async function fetchClusterResourcesAsync(contextName: string): Promise<ClusterResource[]> {
  const [workloads, network, storage, configmaps, secrets] = await Promise.all([
    fetchCategoryAsync(contextName, "deploy,sts,ds,rs", "workloads"),
    fetchCategoryAsync(contextName, "svc,ingress", "network"),
    fetchCategoryAsync(contextName, "pvc", "storage"),
    fetchCategoryAsync(contextName, "cm", "configuration"),
    fetchCategoryAsync(contextName, "secret", "configuration"),
  ])
  return [...workloads, ...network, ...storage, ...configmaps, ...secrets]
}

export async function fetchNamespacesAsync(contextName: string): Promise<NamespaceInfo[]> {
  const nsJson = await kubectlContextAsync(contextName, "get namespaces -o json", 5000)
  if (!nsJson) return []

  try {
    const data = JSON.parse(nsJson)
    const items: any[] = data.items || []
    return items.map((ns: any): NamespaceInfo => ({
      name: ns.metadata?.name || "",
      age: formatAge(ns.metadata?.creationTimestamp || ""),
      pods: 0,
      workloads: 0,
      network: 0,
      storage: 0,
      config: 0,
    }))
  } catch {
    return []
  }
}

export async function fetchClusterDetailDataAsync(contextName: string): Promise<ClusterDetailData> {
  const [nodesResult, namespacesRaw, resourcesRaw, podsJson] = await Promise.all([
    fetchNodeDetailsAsync(contextName),
    fetchNamespacesAsync(contextName),
    fetchClusterResourcesAsync(contextName),
    kubectlContextAsync(contextName, "get pods -A -o json", 5000),
  ])

  const podCountsByNs = new Map<string, number>()
  if (podsJson) {
    try {
      const data = JSON.parse(podsJson)
      for (const pod of data.items || []) {
        const ns = pod.metadata?.namespace || ""
        podCountsByNs.set(ns, (podCountsByNs.get(ns) || 0) + 1)
      }
    } catch {}
  }

  const resourceCountsByNs = new Map<string, Record<ResourceCategory, number>>()
  for (const r of resourcesRaw) {
    const ns = r.namespace
    const counts = resourceCountsByNs.get(ns) || { workloads: 0, network: 0, storage: 0, configuration: 0 }
    counts[r.category]++
    resourceCountsByNs.set(ns, counts)
  }

  const namespaces = namespacesRaw.map((ns): NamespaceInfo => {
    const counts = resourceCountsByNs.get(ns.name) || { workloads: 0, network: 0, storage: 0, configuration: 0 }
    return {
      ...ns,
      pods: podCountsByNs.get(ns.name) || 0,
      workloads: counts.workloads,
      network: counts.network,
      storage: counts.storage,
      config: counts.configuration,
    }
  })

  return { nodes: nodesResult, namespaces, resources: resourcesRaw }
}
