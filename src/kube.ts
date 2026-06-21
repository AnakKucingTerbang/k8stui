import { exec, execSync } from "child_process"
import type { Cluster, ClusterStatus, KubeContext, NodeDetail, PodDetail, PodDetailFull, PodContainer } from "./types"

function kubectlAsync(args: string, timeout = 5000): Promise<string> {
  return new Promise((resolve) => {
    exec(`kubectl ${args}`, { encoding: "utf8", timeout }, (err, stdout) => {
      resolve(err ? "" : stdout.trim())
    })
  })
}

function kubectlContextAsync(context: string, args: string, timeout = 5000): Promise<string> {
  return kubectlAsync(`--context=${context} ${args}`, timeout)
}

function kubectlSync(args: string, timeout = 5000): string {
  try {
    return execSync(`kubectl ${args}`, {
      encoding: "utf8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
  } catch {
    return ""
  }
}

export function getCurrentContext(): string {
  return kubectlSync("config current-context") || ""
}

export function switchContext(context: string): boolean {
  const result = kubectlSync(`config use-context ${context}`)
  return result.includes(`Switched to context "${context}"`)
}

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

interface NodeMetrics {
  cpuPct: number
  memPct: number
  cpu: string
  mem: string
}

interface NodeResult {
  total: number
  ready: number
  down: number
}

function parseNodesJson(json: string): NodeResult {
  try {
    const data = JSON.parse(json)
    const items = data.items || []
    let ready = 0
    const total = items.length
    for (const node of items) {
      const conditions = node.status?.conditions || []
      const readyCond = conditions.find((c: any) => c.type === "Ready")
      if (readyCond?.status === "True") ready++
    }
    return { total, ready, down: total - ready }
  } catch {
    return { total: 0, ready: 0, down: 0 }
  }
}

function parseTopNodes(output: string): Map<string, NodeMetrics> {
  const map = new Map<string, NodeMetrics>()
  if (!output) return map

  const lines = output.split("\n")
  for (const line of lines) {
    const parts = line.split(/\s+/).filter(Boolean)
    if (parts.length >= 5) {
      const name = parts[0] ?? ""
      const cpu = parts[1] ?? "0"
      const cpuPct = parseInt(parts[2] ?? "0", 10) || 0
      const mem = parts[3] ?? "0"
      const memPct = parseInt(parts[4] ?? "0", 10) || 0
      map.set(name, { cpuPct, memPct, cpu, mem })
    }
  }
  return map
}

export function parseCpuMillicores(s: string): number {
  if (s.endsWith("m")) return parseInt(s, 10) || 0
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return Math.round(n * 1000)
}

export function parseMemBytes(s: string): number {
  const match = s.match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti)?$/i)
  if (!match) return 0
  const val = parseFloat(match[1] ?? "0") || 0
  const unit = (match[2] || "").toLowerCase()
  if (unit === "ki") return val * 1024
  if (unit === "mi") return val * 1024 * 1024
  if (unit === "gi") return val * 1024 * 1024 * 1024
  if (unit === "ti") return val * 1024 * 1024 * 1024 * 1024
  return val
}

function formatCpuRaw(millicores: number): string {
  if (millicores <= 0) return "0m"
  if (millicores < 1000) return `${millicores}m`
  const cores = millicores / 1000
  if (cores === Math.floor(cores)) return `${cores}c`
  return `${cores.toFixed(1)}c`
}

function formatMemRaw(bytes: number): string {
  if (bytes <= 0) return "0Mi"
  const gi = bytes / (1024 * 1024 * 1024)
  if (gi >= 1) {
    if (gi === Math.floor(gi)) return `${gi}Gi`
    return `${gi.toFixed(1)}Gi`
  }
  const mi = bytes / (1024 * 1024)
  if (mi >= 1) {
    if (mi === Math.floor(mi)) return `${mi}Mi`
    return `${mi.toFixed(0)}Mi`
  }
  return `${Math.round(bytes / 1024)}Ki`
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

  let status: ClusterStatus = "unreachable"
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

function formatAge(ts: string): string {
  const created = new Date(ts).getTime()
  const now = Date.now()
  const diffMs = now - created
  if (diffMs < 0) return "0s"
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

function parsePodStatus(pod: any): string {
  const phase = pod.status?.phase || "Unknown"
  if (phase !== "Running" && phase !== "Pending") return phase
  const containerStatuses = pod.status?.containerStatuses || []
  for (const cs of containerStatuses) {
    const state = cs.state || {}
    if (state.waiting) {
      const reason = state.waiting.reason || ""
      if (reason === "ContainerCreating") return "ContainerCreating"
      if (reason === "CrashLoopBackOff") return "CrashLoopBackOff"
      if (reason === "ImagePullBackOff") return "ImagePullBackOff"
      if (reason !== "") return reason
    }
    if (state.terminated) {
      const reason = state.terminated.reason || ""
      if (reason === "Completed" || reason === "Error") return reason
      if (reason !== "") return reason
    }
  }
  return phase
}

export async function fetchNodeDetailsAsync(contextName: string): Promise<NodeDetail[]> {
  const [nodesJson, topOutput, podsJson] = await Promise.all([
    kubectlContextAsync(contextName, "get nodes -o json", 5000),
    kubectlContextAsync(contextName, "top nodes --no-headers", 5000),
    kubectlContextAsync(contextName, "get pods -A -o json", 5000),
  ])

  if (!nodesJson) return []

  const nodeMetrics = parseTopNodes(topOutput)

  const podsByNode = new Map<string, { total: number; running: number }>()
  if (podsJson) {
    try {
      const data = JSON.parse(podsJson)
      const items = data.items || []
      for (const pod of items) {
        const nodeName = pod.spec?.nodeName || ""
        if (nodeName) {
          const cur = podsByNode.get(nodeName) || { total: 0, running: 0 }
          cur.total++
          if (pod.status?.phase === "Running") cur.running++
          podsByNode.set(nodeName, cur)
        }
      }
    } catch {}
  }

  try {
    const data = JSON.parse(nodesJson)
    const items = data.items || []
    return items.map((node: any): NodeDetail => {
      const name = node.metadata?.name || ""
      const conditions = node.status?.conditions || []
      const readyCond = conditions.find((c: any) => c.type === "Ready")
      const ready = readyCond?.status === "True"
      const age = formatAge(node.metadata?.creationTimestamp || "")
      const podCounts = podsByNode.get(name) || { total: 0, running: 0 }
      const podsUsed = podCounts.running
      const podsTotal = podCounts.total

      const allocatable = node.status?.allocatable || {}
      const cpuAllocatable = parseCpuMillicores(allocatable.cpu || "0")
      const memAllocatable = parseMemBytes(allocatable.memory || "0")

      const metrics = nodeMetrics.get(name)
      const cpuPct = ready && metrics ? metrics.cpuPct : 0
      const memPct = ready && metrics ? metrics.memPct : 0
      const cpu = ready && metrics ? metrics.cpu : "──"
      const mem = ready && metrics ? metrics.mem : "──"

      return { name, ready, cpuPct, memPct, cpu, mem, age, podsUsed, podsTotal, cpuAllocatable, memAllocatable }
    })
  } catch {
    return []
  }
}

export async function fetchPodsForNodeAsync(contextName: string, nodeName: string): Promise<PodDetail[]> {
  const [podsJson, topPodsOutput] = await Promise.all([
    kubectlContextAsync(
      contextName,
      `get pods -A --field-selector spec.nodeName=${nodeName} -o json`,
      5000,
    ),
    kubectlContextAsync(contextName, "top pods -A --no-headers", 5000),
  ])

  if (!podsJson) return []

  const podMetrics = new Map<string, { cpu: string; mem: string }>()
  if (topPodsOutput) {
    for (const line of topPodsOutput.split("\n")) {
      const parts = line.split(/\s+/).filter(Boolean)
      if (parts.length >= 4) {
        const namespace = parts[0] ?? ""
        const name = parts[1] ?? ""
        const cpu = parts[2] ?? ""
        const mem = parts[3] ?? ""
        podMetrics.set(`${namespace}/${name}`, { cpu, mem })
      }
    }
  }

  try {
    const data = JSON.parse(podsJson)
    const items = data.items || []
    return items.map((pod: any): PodDetail => {
      const name = pod.metadata?.name || ""
      const namespace = pod.metadata?.namespace || ""
      const status = parsePodStatus(pod)
      const age = formatAge(pod.metadata?.creationTimestamp || "")
      const metrics = podMetrics.get(`${namespace}/${name}`)
      return {
        name,
        namespace,
        status,
        cpu: metrics?.cpu || "──",
        mem: metrics?.mem || "──",
        age,
      }
    })
  } catch {
    return []
  }
}

function parseProbe(probe: any): string {
  if (!probe) return "──"
  if (probe.httpGet) {
    const port = probe.httpGet.port || ""
    const path = probe.httpGet.path || "/"
    return `HTTP GET ${port}${path}`
  }
  if (probe.tcpSocket) {
    const port = probe.tcpSocket.port || ""
    return `TCP ${port}`
  }
  if (probe.exec) {
    const cmd = (probe.exec.command || []).join(" ")
    return `Exec [${cmd}]`
  }
  return "──"
}

export async function fetchPodDetailAsync(contextName: string, podName: string, namespace: string): Promise<PodDetailFull | null> {
  const [podJson, podYaml] = await Promise.all([
    kubectlContextAsync(
      contextName,
      `get pod ${podName} -n ${namespace} -o json`,
      5000,
    ),
    kubectlContextAsync(
      contextName,
      `get pod ${podName} -n ${namespace} -o yaml`,
      5000,
    ),
  ])

  if (!podJson) return null

  try {
    const pod = JSON.parse(podJson)

    const labels = pod.metadata?.labels || {}
    const labelsArr = Object.entries(labels).map(([k, v]) => `${k}=${v}`)

    const annotations = pod.metadata?.annotations || {}
    const annotationsArr = Object.entries(annotations).map(([k, v]) => `${k}=${v}`)

    const containers: PodContainer[] = (pod.spec?.containers || []).map((c: any): PodContainer => {
      const resources = c.resources || {}
      const requests = resources.requests || {}
      const limits = resources.limits || {}

      const ports = (c.ports || []).map((p: any) => {
        const port = p.containerPort || ""
        const proto = p.protocol || "TCP"
        return `${port}/${proto}`
      })

      const env: { name: string; value: string }[] = (c.env || []).map((e: any) => ({
        name: e.name || "",
        value: e.value || (e.valueFrom ? `from: ${e.valueFrom.configMapKeyRef?.name || e.valueFrom.secretKeyRef?.name || e.valueFrom.fieldRef?.fieldPath || "ref"}` : "──"),
      }))

      return {
        name: c.name || "",
        image: c.image || "",
        command: c.command || [],
        args: c.args || [],
        ports,
        cpuRequest: requests.cpu || "──",
        cpuLimit: limits.cpu || "──",
        memRequest: requests.memory || "──",
        memLimit: limits.memory || "──",
        livenessProbe: parseProbe(c.livenessProbe),
        readinessProbe: parseProbe(c.readinessProbe),
        env,
      }
    })

    const containerStatuses = pod.status?.containerStatuses || []
    const restarts = containerStatuses.reduce((sum: number, cs: any) => sum + (cs.restartCount || 0), 0)
    const ready = containerStatuses.length > 0 && containerStatuses.every((cs: any) => cs.ready === true)

    return {
      name: pod.metadata?.name || "",
      namespace: pod.metadata?.namespace || "",
      labels: labelsArr.length > 0 ? labelsArr : ["──"],
      annotations: annotationsArr.length > 0 ? annotationsArr : ["──"],
      created: formatAge(pod.metadata?.creationTimestamp || ""),
      containers,
      phase: pod.status?.phase || "Unknown",
      podIP: pod.status?.podIP || "──",
      hostIP: pod.status?.hostIP || "──",
      restarts,
      ready,
      qosClass: pod.status?.qosClass || "──",
      yaml: podYaml || "",
    }
  } catch {
    return null
  }
}
