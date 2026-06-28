import type { SecretManagement } from "../types"
import { kubectlContextAsync, kubectlApplyYamlAsync } from "./kube/exec"

const ANNOT_MANAGED_BY = "k8cli.dev/managed-by"
const ANNOT_ENV_HOST = "k8cli.dev/env-host"
const ANNOT_ENV_PATH = "k8cli.dev/env-path"

function buildSecretYaml(
  name: string,
  namespace: string,
  entries: { key: string; value: string }[],
  annotations?: Record<string, string>,
): string {
  const data: Record<string, string> = {}
  for (const entry of entries) {
    data[entry.key] = Buffer.from(entry.value).toString("base64")
  }

  const dataLines = Object.entries(data)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n")

  const annotationEntries = annotations
    ? Object.entries(annotations)
        .map(([k, v]) => `    ${k}: "${v}"`)
        .join("\n")
    : ""

  const annotationsBlock = annotationEntries
    ? `\n  annotations:\n${annotationEntries}`
    : ""

  return [
    "apiVersion: v1",
    "kind: Secret",
    "metadata:",
    `  name: ${name}`,
    `  namespace: ${namespace}${annotationsBlock}`,
    "type: Opaque",
    "data:",
    dataLines,
  ].join("\n")
}

export async function createSecret(
  context: string,
  namespace: string,
  name: string,
  entries: { key: string; value: string }[],
  annotations?: Record<string, string>,
): Promise<{ success: boolean; output: string }> {
  const yaml = buildSecretYaml(name, namespace, entries, annotations)
  return kubectlApplyYamlAsync(context, yaml)
}

export function getSecretManagement(annotations: Record<string, string>): SecretManagement | null {
  const managedBy = annotations[ANNOT_MANAGED_BY]
  if (managedBy === "kubectl") {
    return { strategy: "kubectl", host: "", path: "" }
  }
  if (managedBy === "dotenv") {
    const host = annotations[ANNOT_ENV_HOST]
    const path = annotations[ANNOT_ENV_PATH]
    if (!host || !path) return null
    return { strategy: "dotenv", host, path }
  }
  return null
}

export async function registerSecret(
  contextName: string,
  namespace: string,
  name: string,
  host: string,
  path: string,
): Promise<boolean> {
  const result = await kubectlContextAsync(
    contextName,
    `annotate secret ${name} -n ${namespace} ${ANNOT_MANAGED_BY}=dotenv ${ANNOT_ENV_HOST}=${host} ${ANNOT_ENV_PATH}=${path} --overwrite`,
    10000,
  )
  return result.includes("annotated")
}

export async function unregisterSecret(
  contextName: string,
  namespace: string,
  name: string,
): Promise<boolean> {
  const result = await kubectlContextAsync(
    contextName,
    `annotate secret ${name} -n ${namespace} ${ANNOT_MANAGED_BY}- ${ANNOT_ENV_HOST}- ${ANNOT_ENV_PATH}-`,
    10000,
  )
  return result.includes("annotated") || result.includes("unannotation")
}

export async function deleteSecret(
  context: string,
  namespace: string,
  name: string,
): Promise<{ success: boolean; output: string }> {
  const result = await kubectlContextAsync(
    context,
    `delete secret ${name} -n ${namespace} --ignore-not-found`,
    15000,
  )
  if (result.includes("deleted") || result.includes("not found")) {
    return { success: true, output: result }
  }
  return { success: false, output: result || "delete failed" }
}

export async function reannotateSecret(
  contextName: string,
  namespace: string,
  name: string,
  host: string,
  path: string,
): Promise<boolean> {
  return registerSecret(contextName, namespace, name, host, path)
}
