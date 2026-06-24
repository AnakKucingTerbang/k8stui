import type { NamespaceDetailData } from "../../types"
import { kubectlContextAsync } from "./exec"
import { parseNamespacedResources, parsePodsFromJson } from "./parse"

export async function fetchNamespaceDetailAsync(contextName: string, namespace: string): Promise<NamespaceDetailData> {
  const [workloadsJson, podsJson, topPodsOutput, networkJson, configCmJson, configSecretJson] = await Promise.all([
    kubectlContextAsync(contextName, `get deploy,sts,ds,job,cronjob -n ${namespace} -o json`, 10000),
    kubectlContextAsync(contextName, `get pods -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `top pods -n ${namespace} --no-headers`, 5000),
    kubectlContextAsync(contextName, `get svc,ingress -n ${namespace} -o json`, 10000),
    kubectlContextAsync(contextName, `get cm -n ${namespace} -o json`, 5000),
    kubectlContextAsync(contextName, `get secret -n ${namespace} -o json`, 5000),
  ])

  const workloads = parseNamespacedResources(workloadsJson)
  const pods = parsePodsFromJson(podsJson, topPodsOutput)
  const network = parseNamespacedResources(networkJson)
  const configCm = parseNamespacedResources(configCmJson)
  const configSecret = parseNamespacedResources(configSecretJson)
  const config = [...configCm, ...configSecret]

  return { workloads, pods, network, config }
}
