import { exec } from "child_process"
import { dump } from "js-yaml"
import type { PodDetailFull, PodContainer, ApplicationResource } from "../../types"
import { kubectlContextAsync } from "./exec"
import { formatAge, parsePodStatus, parseProbe, buildSummaryRows, parseTopPods, DASH, val } from "./parse"

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
      appResources: undefined,
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

    if (!existingKeys.has(`${ownerResult.ownerKind}/${ownerResult.ownerName}`) && ownerResult.ownerJson) {
      try {
        const ownerObj = JSON.parse(ownerResult.ownerJson)
        const lastApplied = ownerObj.metadata?.annotations?.["kubectl.kubernetes.io/last-applied-configuration"]
        if (lastApplied) {
          const lastAppliedYaml = dump(JSON.parse(lastApplied), { lineWidth: -1, noRefs: true })
          appResources.push({
            kind: ownerResult.ownerKind,
            name: ownerResult.ownerName,
            namespace,
            lastAppliedYaml,
            summaryRows: buildSummaryRows(ownerResult.ownerKind, ownerObj),
          })
        }
      } catch {}
    }

    return { ...basicResult, appResources }
  } catch {
    return null
  }
}
