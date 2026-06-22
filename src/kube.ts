import { exec, execSync } from "child_process"
import { dump } from "js-yaml"
import type { Cluster, ClusterStatus, KubeContext, NodeDetail, PodDetail, PodDetailFull, PodContainer, ApplicationResource, DetailRow } from "./types"

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

const DASH = "──"

function val(s: string): string {
  return s || DASH
}

function buildSummaryRows(kind: string, obj: any): DetailRow[] {
  const rows: DetailRow[] = []
  const meta = obj.metadata || {}
  const labels = meta.labels || {}

  rows.push({ key: "Kind", value: kind })
  rows.push({ key: "Name", value: val(meta.name) })
  rows.push({ key: "Namespace", value: val(obj.metadata?.namespace) })

  const labelEntries = Object.entries(labels)
  if (labelEntries.length === 0) {
    rows.push({ key: "Labels", value: DASH })
  } else {
    rows.push({ key: "Labels", value: "", isParent: true })
    for (const [k, v] of labelEntries) {
      rows.push({ key: k, value: v as string, indent: true })
    }
  }

  rows.push({ key: "Created", value: meta.creationTimestamp ? formatAge(meta.creationTimestamp) : DASH })

  switch (kind) {
    case "Deployment":
    case "StatefulSet": {
      const spec = obj.spec || {}
      rows.push({ key: "Replicas", value: `${spec.replicas ?? DASH}` })
      if (kind === "Deployment") rows.push({ key: "Strategy", value: val(spec.strategy?.type) })
      if (kind === "StatefulSet") rows.push({ key: "Service Name", value: val(spec.serviceName) })
      const selector = spec.selector?.matchLabels || {}
      const selEntries = Object.entries(selector)
      if (selEntries.length > 0) {
        rows.push({ key: "Selector", value: "", isParent: true })
        for (const [k, v] of selEntries) {
          rows.push({ key: k, value: v as string, indent: true })
        }
      }
      break
    }
    case "DaemonSet": {
      const selector = obj.spec?.selector?.matchLabels || {}
      const selEntries = Object.entries(selector)
      if (selEntries.length > 0) {
        rows.push({ key: "Selector", value: "", isParent: true })
        for (const [k, v] of selEntries) {
          rows.push({ key: k, value: v as string, indent: true })
        }
      }
      break
    }
    case "PersistentVolumeClaim": {
      const spec = obj.spec || {}
      const status = obj.status || {}
      const accessModes = (spec.accessModes || []).join(", ")
      rows.push({ key: "Access Modes", value: val(accessModes) })
      rows.push({ key: "Storage", value: val(spec.resources?.requests?.storage) })
      rows.push({ key: "Status", value: val(status.phase) })
      rows.push({ key: "Volume Name", value: val(status.accessModes?.length ? status.capacity?.storage : spec.volumeName) })
      break
    }
    case "Secret": {
      rows.push({ key: "Type", value: val(obj.type) })
      const dataKeys = Object.keys(obj.data || {}).join(", ")
      rows.push({ key: "Data Keys", value: val(dataKeys) })
      break
    }
    case "ConfigMap": {
      const dataKeys = Object.keys(obj.data || {}).join(", ")
      rows.push({ key: "Data Keys", value: val(dataKeys) })
      break
    }
    case "Service": {
      const spec = obj.spec || {}
      rows.push({ key: "Type", value: val(spec.type) })
      rows.push({ key: "Cluster IP", value: val(spec.clusterIP) })
      const ports = (spec.ports || []).map((p: any) => `${p.port}/${p.protocol || "TCP"}`).join(", ")
      rows.push({ key: "Ports", value: val(ports) })
      break
    }
    case "Ingress": {
      const spec = obj.spec || {}
      const rules = spec.rules || []
      if (rules.length > 0) {
        const hosts = rules.map((r: any) => r.host || "*").join(", ")
        rows.push({ key: "Hosts", value: val(hosts) })
      }
      break
    }
  }

  return rows
}

async function resolveOwnerAsync(
  contextName: string,
  podName: string,
  namespace: string,
  podJsonPreloaded?: string,
): Promise<{ ownerKind: string; ownerName: string; ownerJson: string; labelSelector: string }> {
  const empty = { ownerKind: "", ownerName: "", ownerJson: "", labelSelector: "" }

  const podJson = podJsonPreloaded ?? await kubectlContextAsync(
    contextName,
    `get pod ${podName} -n ${namespace} -o json`,
    5000,
  )
  if (!podJson) return empty

  try {
    const pod = JSON.parse(podJson)
    const refs: any[] = pod.metadata?.ownerReferences || []
    if (refs.length === 0) return empty

    let ownerKind = refs[0].kind || ""
    let ownerName = refs[0].name || ""

    if (ownerKind === "ReplicaSet") {
      const rsJson = await kubectlContextAsync(
        contextName,
        `get replicaset ${ownerName} -n ${namespace} -o json`,
        5000,
      )
      if (rsJson) {
        try {
          const rs = JSON.parse(rsJson)
          const rsRefs: any[] = rs.metadata?.ownerReferences || []
          if (rsRefs.length > 0) {
            ownerKind = rsRefs[0].kind || ownerKind
            ownerName = rsRefs[0].name || ownerName
          }
        } catch {}
      }
    }

    const kindLower = ownerKind.toLowerCase()
    const ownerResourceJson = await kubectlContextAsync(
      contextName,
      `get ${kindLower} ${ownerName} -n ${namespace} -o json`,
      5000,
    )
    if (!ownerResourceJson) return { ownerKind, ownerName, ownerJson: "", labelSelector: "" }

    try {
      const ownerObj = JSON.parse(ownerResourceJson)
      const matchLabels = ownerObj.spec?.selector?.matchLabels || {}
      const labelSelector = Object.entries(matchLabels).map(([k, v]) => `${k}=${v}`).join(",")
      return { ownerKind, ownerName, ownerJson: ownerResourceJson, labelSelector }
    } catch {
      return { ownerKind, ownerName, ownerJson: "", labelSelector: "" }
    }
  } catch {
    return empty
  }
}

export async function fetchApplicationResourcesAsync(
  contextName: string,
  namespace: string,
  labelSelector: string,
): Promise<ApplicationResource[]> {
  if (!labelSelector) return []

  const resourcesJson = await kubectlContextAsync(
    contextName,
    `get deploy,statefulset,daemonset,pvc,configmap,secret,service,ingress -l ${labelSelector} -n ${namespace} -o json`,
    8000,
  )
  if (!resourcesJson) return []

  try {
    const data = JSON.parse(resourcesJson)
    const items: any[] = data.items || []
    return items.map((item: any): ApplicationResource => {
      const kind = item.kind || ""
      const name = item.metadata?.name || ""
      const ns = item.metadata?.namespace || namespace
      const lastApplied = item.metadata?.annotations?.["kubectl.kubernetes.io/last-applied-configuration"]
      let lastAppliedYaml = ""
      if (lastApplied) {
        try {
          lastAppliedYaml = dump(JSON.parse(lastApplied), { lineWidth: -1, noRefs: true })
        } catch {}
      }
      return {
        kind,
        name,
        namespace: ns,
        lastAppliedYaml,
        summaryRows: buildSummaryRows(kind, item),
      }
    })
  } catch {
    return []
  }
}

export async function applyYamlAsync(
  contextName: string,
  yamlContent: string,
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const proc = exec(
      `kubectl --context=${contextName} apply -f -`,
      { encoding: "utf8", timeout: 10000 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || "unknown error").trim()
          resolve({ success: false, message: msg })
        } else {
          resolve({ success: true, message: stdout.trim() })
        }
      },
    )
    if (proc.stdin) {
      proc.stdin.write(yamlContent)
      proc.stdin.end()
    }
  })
}

async function fetchResourcesByNamesAsync(
  contextName: string,
  namespace: string,
  kind: string,
  names: string[],
): Promise<ApplicationResource[]> {
  if (names.length === 0) return []
  const kindFlag = kind === "PersistentVolumeClaim" ? "pvc" : kind.toLowerCase()

  const json = await kubectlContextAsync(
    contextName,
    `get ${kindFlag} ${names.join(",")} -n ${namespace} -o json --ignore-not-found`,
    5000,
  )
  if (json) {
    try {
      const data = JSON.parse(json)
      const items: any[] = data.items || []
      if (items.length > 0) {
        return items.map((item: any): ApplicationResource => {
          const k = item.kind || kind
          const n = item.metadata?.name || ""
          const lastApplied = item.metadata?.annotations?.["kubectl.kubernetes.io/last-applied-configuration"]
          let lastAppliedYaml = ""
          if (lastApplied) {
            try { lastAppliedYaml = dump(JSON.parse(lastApplied), { lineWidth: -1, noRefs: true }) } catch {}
          }
          return { kind: k, name: n, namespace, lastAppliedYaml, summaryRows: buildSummaryRows(k, item) }
        })
      }
    } catch {}
  }

  const results = await Promise.all(
    names.map(async (name): Promise<ApplicationResource | null> => {
      const singleJson = await kubectlContextAsync(
        contextName,
        `get ${kindFlag} ${name} -n ${namespace} -o json --ignore-not-found`,
        5000,
      )
      if (!singleJson) return null
      try {
        const item = JSON.parse(singleJson)
        const k = item.kind || kind
        const n = item.metadata?.name || name
        const lastApplied = item.metadata?.annotations?.["kubectl.kubernetes.io/last-applied-configuration"]
        let lastAppliedYaml = ""
        if (lastApplied) {
          try { lastAppliedYaml = dump(JSON.parse(lastApplied), { lineWidth: -1, noRefs: true }) } catch {}
        }
        return { kind: k, name: n, namespace, lastAppliedYaml, summaryRows: buildSummaryRows(k, item) }
      } catch {
        return null
      }
    }),
  )
  return results.filter((r): r is ApplicationResource => r !== null)
}

export async function fetchPodDetailAsync(
  contextName: string,
  podName: string,
  namespace: string,
  onBasicData?: (partial: PodDetailFull) => void,
): Promise<PodDetailFull | null> {
  const podJson = await kubectlContextAsync(contextName, `get pod ${podName} -n ${namespace} -o json`, 5000)
  if (!podJson) return null

  const [podYaml, ownerResult] = await Promise.all([
    kubectlContextAsync(contextName, `get pod ${podName} -n ${namespace} -o yaml`, 5000),
    resolveOwnerAsync(contextName, podName, namespace, podJson),
  ])

  let appResources: ApplicationResource[] = []
  let combinedOriginalYaml = ""

  try {
    const pod = JSON.parse(podJson)
    const podSpec = pod.spec || {}
    const podVolumes: any[] = podSpec.volumes || []

    const volumePvcMap: Record<string, string> = {}
    const volumeSecretMap: Record<string, string> = {}
    const volumeCmMap: Record<string, string> = {}
    const allPvcNames: string[] = []
    const allSecretNames: string[] = []
    const allCmNames: string[] = []

    for (const vol of podVolumes) {
      const vName = vol.name || ""
      if (vol.persistentVolumeClaim?.claimName) {
        volumePvcMap[vName] = vol.persistentVolumeClaim.claimName
        if (!allPvcNames.includes(vol.persistentVolumeClaim.claimName)) allPvcNames.push(vol.persistentVolumeClaim.claimName)
      }
      if (vol.secret?.secretName) {
        volumeSecretMap[vName] = vol.secret.secretName
        if (!allSecretNames.includes(vol.secret.secretName)) allSecretNames.push(vol.secret.secretName)
      }
      if (vol.configMap?.name) {
        volumeCmMap[vName] = vol.configMap.name
        if (!allCmNames.includes(vol.configMap.name)) allCmNames.push(vol.configMap.name)
      }
    }

    const containers: PodContainer[] = (podSpec.containers || []).map((c: any): PodContainer => {
      const resources = c.resources || {}
      const requests = resources.requests || {}
      const limits = resources.limits || {}

      const ports = (c.ports || []).map((p: any) => `${p.containerPort || ""}/${p.protocol || "TCP"}`)

      const env: { name: string; value: string }[] = (c.env || []).map((e: any) => ({
        name: e.name || "",
        value: e.value || (e.valueFrom ? `from: ${e.valueFrom.configMapKeyRef?.name || e.valueFrom.secretKeyRef?.name || e.valueFrom.fieldRef?.fieldPath || "ref"}` : "──"),
      }))

      const volumeMountNames: string[] = (c.volumeMounts || []).map((vm: any) => vm.name || "")

      const pvcRefNames: string[] = []
      const secretRefNames: string[] = []
      const configMapRefNames: string[] = []

      for (const vmName of volumeMountNames) {
        if (volumePvcMap[vmName] && !pvcRefNames.includes(volumePvcMap[vmName])) pvcRefNames.push(volumePvcMap[vmName])
        if (volumeSecretMap[vmName] && !secretRefNames.includes(volumeSecretMap[vmName])) secretRefNames.push(volumeSecretMap[vmName])
        if (volumeCmMap[vmName] && !configMapRefNames.includes(volumeCmMap[vmName])) configMapRefNames.push(volumeCmMap[vmName])
      }

      for (const e of (c.env || [])) {
        if (e.valueFrom?.secretKeyRef?.name && !secretRefNames.includes(e.valueFrom.secretKeyRef.name)) secretRefNames.push(e.valueFrom.secretKeyRef.name)
        if (e.valueFrom?.configMapKeyRef?.name && !configMapRefNames.includes(e.valueFrom.configMapKeyRef.name)) configMapRefNames.push(e.valueFrom.configMapKeyRef.name)
      }
      for (const ef of (c.envFrom || [])) {
        if (ef.secretRef?.name && !secretRefNames.includes(ef.secretRef.name)) secretRefNames.push(ef.secretRef.name)
        if (ef.configMapRef?.name && !configMapRefNames.includes(ef.configMapRef.name)) configMapRefNames.push(ef.configMapRef.name)
      }

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
        volumeMountNames,
        pvcRefNames,
        secretRefNames,
        configMapRefNames,
      }
    })

    const labels = pod.metadata?.labels || {}
    const labelsArr = Object.entries(labels).map(([k, v]) => `${k}=${v}`)
    const annotations = pod.metadata?.annotations || {}
    const annotationsArr = Object.entries(annotations).map(([k, v]) => `${k}=${v}`)

    const containerStatuses = pod.status?.containerStatuses || []
    const restarts = containerStatuses.reduce((sum: number, cs: any) => sum + (cs.restartCount || 0), 0)
    const ready = containerStatuses.length > 0 && containerStatuses.every((cs: any) => cs.ready === true)

    const basicResult: PodDetailFull = {
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
      appResources: [],
      combinedOriginalYaml: "",
      ownerKind: ownerResult.ownerKind,
      ownerName: ownerResult.ownerName,
    }

    onBasicData?.(basicResult)

    if (ownerResult.labelSelector) {
      appResources = await fetchApplicationResourcesAsync(contextName, namespace, ownerResult.labelSelector)
    }

    const existingKeys = new Set(appResources.map((r) => `${r.kind}/${r.name}`))
    const missingPvcs = allPvcNames.filter((n) => !existingKeys.has(`PersistentVolumeClaim/${n}`))
    const missingSecrets = allSecretNames.filter((n) => !existingKeys.has(`Secret/${n}`))
    const missingCms = allCmNames.filter((n) => !existingKeys.has(`ConfigMap/${n}`))

    const [pvcResources, secretResources, cmResources] = await Promise.all([
      fetchResourcesByNamesAsync(contextName, namespace, "PersistentVolumeClaim", missingPvcs),
      fetchResourcesByNamesAsync(contextName, namespace, "Secret", missingSecrets),
      fetchResourcesByNamesAsync(contextName, namespace, "ConfigMap", missingCms),
    ])
    appResources = [...appResources, ...pvcResources, ...secretResources, ...cmResources]

    const yamls = appResources.filter((r) => r.lastAppliedYaml).map((r) => r.lastAppliedYaml)
    if (yamls.length > 0) {
      combinedOriginalYaml = yamls.join("\n---\n")
    }

    if (!combinedOriginalYaml && ownerResult.ownerJson) {
      try {
        const ownerObj = JSON.parse(ownerResult.ownerJson)
        const lastApplied = ownerObj.metadata?.annotations?.["kubectl.kubernetes.io/last-applied-configuration"]
        if (lastApplied) {
          combinedOriginalYaml = dump(JSON.parse(lastApplied), { lineWidth: -1, noRefs: true })
        }
      } catch {}
    }

    return { ...basicResult, appResources, combinedOriginalYaml }
  } catch {
    return null
  }
}
