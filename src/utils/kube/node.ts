import type { NodeDetail, NodeCondition, PodDetail } from "../../types"
import { kubectlContextAsync } from "./exec"
import { parseTopNodes, parseCpuMillicores, parseMemBytes, formatAge, parsePodStatus, parseTopPods } from "./parse"

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

  const podMetrics = parseTopPods(topPodsOutput)

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

export async function fetchNodeConditionsAsync(contextName: string, nodeName: string): Promise<NodeCondition[]> {
  const json = await kubectlContextAsync(contextName, `get node ${nodeName} -o json`, 5000)
  if (!json) return []
  try {
    const data = JSON.parse(json)
    const conditions = data.status?.conditions || []
    return conditions.map((c: any): NodeCondition => ({
      type: c.type || "",
      status: c.status || "",
      reason: c.reason || "",
      message: c.message || "",
      lastTransitionTime: formatAge(c.lastTransitionTime || ""),
    }))
  } catch {
    return []
  }
}
