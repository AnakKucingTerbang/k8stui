import { exec, execSync } from "child_process"
import type { Cluster, ClusterStatus, KubeContext } from "./types"

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

interface NodeInfo {
  ready: boolean
  cpuPct: number
  memPct: number
}

interface NodeResult {
  total: number
  ready: number
  down: number
  podsTotal: number
}

function parseNodesJson(json: string): NodeResult {
  try {
    const data = JSON.parse(json)
    const items = data.items || []
    let ready = 0
    let total = items.length
    let podsTotal = 0
    for (const node of items) {
      const conditions = node.status?.conditions || []
      const readyCond = conditions.find((c: any) => c.type === "Ready")
      if (readyCond?.status === "True") ready++
      const capacity = parseInt(node.status?.capacity?.pods || "0", 10) || 0
      podsTotal += capacity
    }
    return { total, ready, down: total - ready, podsTotal }
  } catch {
    return { total: 0, ready: 0, down: 0, podsTotal: 0 }
  }
}

function parseTopNodes(output: string): Map<string, NodeInfo> {
  const map = new Map<string, NodeInfo>()
  if (!output) return map

  const lines = output.split("\n").slice(1)
  for (const line of lines) {
    const parts = line.split(/\s+/).filter(Boolean)
    if (parts.length >= 5) {
      const name = parts[0] ?? ""
      const cpuPct = parseInt(parts[2] ?? "0", 10) || 0
      const memPct = parseInt(parts[4] ?? "0", 10) || 0
      map.set(name, { ready: true, cpuPct, memPct })
    }
  }
  return map
}

function parsePodCount(output: string): number {
  if (!output) return 0
  return parseInt(output.trim(), 10) || 0
}

export async function fetchClusterStatusAsync(contextName: string): Promise<Cluster> {
  const [clusterName, nodesJson, topOutput, podsRaw] = await Promise.all([
    kubectlContextAsync(
      contextName,
      `config view -o jsonpath="{.contexts[?(@.name=='${contextName}')].context.cluster}"`,
    ),
    kubectlContextAsync(contextName, "get nodes -o json", 5000),
    kubectlContextAsync(contextName, "top nodes --no-headers", 5000),
    kubectlContextAsync(contextName, "get pods -A --no-headers 2>/dev/null | wc -l", 5000),
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
  if (nodeMetrics.size > 0) {
    let cpuSum = 0
    let memSum = 0
    for (const info of nodeMetrics.values()) {
      cpuSum += info.cpuPct
      memSum += info.memPct
    }
    cpuPct = Math.round(cpuSum / nodeMetrics.size)
    memPct = Math.round(memSum / nodeMetrics.size)
  }

  const podsUsed = parsePodCount(podsRaw)

  if (status === "degraded") {
    cpuPct = 0
    memPct = 0
  }

  if (status === "unreachable") {
    return {
      contextName,
      name: clusterName || contextName,
      status,
      nodeOnline: 0,
      nodeTotal: 0,
      cpuPct: 0,
      memPct: 0,
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
    podsUsed,
    podsTotal: nodeInfo.podsTotal,
    notes,
  }
}
