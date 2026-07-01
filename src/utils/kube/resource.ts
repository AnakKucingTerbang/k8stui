import type { PodDetail, RolloutPod, WorkloadDetailData, NetworkDetailData, StorageDetailData, ConfigDetailData, SecretDetailData } from "../../types"
import { kubectlContextAsync } from "./exec"
import { formatAge, parsePodStatus, buildSummaryRows, parseTopPods, findRefPods } from "./parse"

export async function fetchRolloutPodsAsync(
  contextName: string,
  namespace: string,
  kind: string,
  name: string,
): Promise<RolloutPod[]> {
  const kindFlag = kind.toLowerCase()
  const resourceJson = await kubectlContextAsync(
    contextName,
    `get ${kindFlag} ${name} -n ${namespace} -o json`,
    5000,
  )
  if (!resourceJson) return []

  let labelSelector = ""
  try {
    const obj = JSON.parse(resourceJson)
    labelSelector = Object.entries(obj.spec?.selector?.matchLabels || {}).map(([k, v]) => `${k}=${v}`).join(",")
  } catch { return [] }

  if (!labelSelector) return []

  const podsJson = await kubectlContextAsync(
    contextName,
    `get pods -n ${namespace} -l ${labelSelector} -o json`,
    5000,
  )
  if (!podsJson) return []

  try {
    const data = JSON.parse(podsJson)
    return (data.items || []).map((pod: any): RolloutPod => ({
      name: pod.metadata?.name || "",
      node: pod.spec?.nodeName || "──",
      status: parsePodStatus(pod),
    }))
  } catch { return [] }
}

export async function fetchWorkloadDetailAsync(contextName: string, namespace: string, kind: string, name: string): Promise<WorkloadDetailData> {
  const kindFlag = kind.toLowerCase()
  const [resourceJson, podsJson, topPodsOutput] = await Promise.all([
    kubectlContextAsync(contextName, `get ${kindFlag} ${name} -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `get pods -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `top pods -n ${namespace} --no-headers`, 5000),
  ])

  let summary: import("../../types").DetailRow[] = []
  let labelSelector = ""
  if (resourceJson) {
    try {
      const obj = JSON.parse(resourceJson)
      summary = buildSummaryRows(kind, obj)
      labelSelector = Object.entries(obj.spec?.selector?.matchLabels || {}).map(([k, v]) => `${k}=${v}`).join(",")
    } catch {}
  }

  let pods: PodDetail[] = []
  if (podsJson) {
    try {
      const data = JSON.parse(podsJson)
      const items: any[] = data.items || []
      const matched = labelSelector
        ? items.filter((pod: any) => {
            const labels = pod.metadata?.labels || {}
            return labelSelector.split(",").every((pair) => {
              const parts = pair.split("=")
              return labels[parts[0] ?? ""] === parts[1]
            })
          })
        : items
      const podMetrics = parseTopPods(topPodsOutput)
      pods = matched.map((pod: any): PodDetail => {
        const pName = pod.metadata?.name || ""
        const pNs = pod.metadata?.namespace || namespace
        const status = parsePodStatus(pod)
        const age = formatAge(pod.metadata?.creationTimestamp || "")
        const metrics = podMetrics.get(`${pNs}/${pName}`)
        return { name: pName, namespace: pNs, status, cpu: metrics?.cpu || "──", mem: metrics?.mem || "──", age }
      })
    } catch {}
  }

  return { summary, pods }
}

export async function fetchNetworkDetailAsync(contextName: string, namespace: string, kind: string, name: string): Promise<NetworkDetailData> {
  const kindFlag = kind === "Ingress" ? "ingress" : "service"
  const [resourceJson, endpointsJson, podsJson, topPodsOutput] = await Promise.all([
    kubectlContextAsync(contextName, `get ${kindFlag} ${name} -n ${namespace} -o json`, 5000),
    kind === "Service" ? kubectlContextAsync(contextName, `get endpoints ${name} -n ${namespace} -o json`, 5000) : Promise.resolve(""),
    kubectlContextAsync(contextName, `get pods -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `top pods -n ${namespace} --no-headers`, 5000),
  ])

  let summary: import("../../types").DetailRow[] = []
  let targetPodNames = new Set<string>()
  if (resourceJson) {
    try {
      const obj = JSON.parse(resourceJson)
      summary = buildSummaryRows(kind, obj)
      if (kind === "Service") {
        const selector = obj.spec?.selector || {}
        const labelSelector = Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(",")
        if (labelSelector && podsJson) {
          try {
            const data = JSON.parse(podsJson)
            for (const pod of data.items || []) {
              const labels = pod.metadata?.labels || {}
              if (labelSelector.split(",").every((pair) => { const parts = pair.split("="); return labels[parts[0] ?? ""] === parts[1] })) {
                targetPodNames.add(pod.metadata?.name || "")
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  const podMetrics = parseTopPods(topPodsOutput)

  let pods: PodDetail[] = []
  if (podsJson && targetPodNames.size > 0) {
    try {
      const data = JSON.parse(podsJson)
      for (const pod of data.items || []) {
        const pName = pod.metadata?.name || ""
        if (!targetPodNames.has(pName)) continue
        const pNs = pod.metadata?.namespace || namespace
        const status = parsePodStatus(pod)
        const age = formatAge(pod.metadata?.creationTimestamp || "")
        const metrics = podMetrics.get(`${pNs}/${pName}`)
        pods.push({ name: pName, namespace: pNs, status, cpu: metrics?.cpu || "──", mem: metrics?.mem || "──", age })
      }
    } catch {}
  }

  return { summary, pods }
}

export async function fetchStorageDetailAsync(contextName: string, namespace: string, name: string): Promise<StorageDetailData> {
  const [pvcJson, podsJson, topPodsOutput] = await Promise.all([
    kubectlContextAsync(contextName, `get pvc ${name} -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `get pods -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `top pods -n ${namespace} --no-headers`, 5000),
  ])

  let summary: import("../../types").DetailRow[] = []
  let mountPod: PodDetail | null = null

  if (pvcJson) {
    try {
      const obj = JSON.parse(pvcJson)
      summary = buildSummaryRows("PersistentVolumeClaim", obj)
    } catch {}
  }

  if (podsJson) {
    try {
      const data = JSON.parse(podsJson)
      const podMetrics = parseTopPods(topPodsOutput)
      for (const pod of data.items || []) {
        const volumes: any[] = pod.spec?.volumes || []
        const mounts = volumes.filter((v: any) => v.persistentVolumeClaim?.claimName === name)
        if (mounts.length > 0) {
          const pName = pod.metadata?.name || ""
          const pNs = pod.metadata?.namespace || namespace
          const status = parsePodStatus(pod)
          const age = formatAge(pod.metadata?.creationTimestamp || "")
          const metrics = podMetrics.get(`${pNs}/${pName}`)
          mountPod = { name: pName, namespace: pNs, status, cpu: metrics?.cpu || "──", mem: metrics?.mem || "──", age }
          break
        }
      }
    } catch {}
  }

  return { summary, mountPod }
}

export async function fetchConfigDetailAsync(contextName: string, namespace: string, kind: string, name: string): Promise<ConfigDetailData> {
  const kindFlag = kind === "Secret" ? "secret" : "configmap"
  const [resourceJson, podsJson, topPodsOutput] = await Promise.all([
    kubectlContextAsync(contextName, `get ${kindFlag} ${name} -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `get pods -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `top pods -n ${namespace} --no-headers`, 5000),
  ])

  let summary: import("../../types").DetailRow[] = []
  if (resourceJson) {
    try {
      const obj = JSON.parse(resourceJson)
      summary = buildSummaryRows(kind, obj)
    } catch {}
  }

  const pods = findRefPods(podsJson, topPodsOutput, kind, name, namespace)

  return { summary, pods }
}

export async function fetchSecretDetailAsync(contextName: string, namespace: string, name: string): Promise<SecretDetailData> {
  const [resourceJson, podsJson, topPodsOutput] = await Promise.all([
    kubectlContextAsync(contextName, `get secret ${name} -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `get pods -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `top pods -n ${namespace} --no-headers`, 5000),
  ])

  let summary: import("../../types").DetailRow[] = []
  let dataKeys: string[] = []
  let rawData: Record<string, string> = {}
  let annotations: Record<string, string> = {}

  if (resourceJson) {
    try {
      const obj = JSON.parse(resourceJson)
      summary = buildSummaryRows("Secret", obj)
      dataKeys = Object.keys(obj.data || {})
      rawData = obj.data || {}
      annotations = obj.metadata?.annotations || {}
    } catch {}
  }

  const pods = findRefPods(podsJson, topPodsOutput, "Secret", name, namespace)

  return { summary, dataKeys, rawData, pods, annotations }
}
