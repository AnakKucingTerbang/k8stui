import type { SecretManagement } from "../types"
import { kubectlContextAsync } from "./kube/exec"

const ANNOT_MANAGED_BY = "k8cli.dev/managed-by"
const ANNOT_ENV_HOST = "k8cli.dev/env-host"
const ANNOT_ENV_PATH = "k8cli.dev/env-path"

export function getSecretManagement(annotations: Record<string, string>): SecretManagement | null {
  if (annotations[ANNOT_MANAGED_BY] !== "dotenv") return null
  const host = annotations[ANNOT_ENV_HOST]
  const path = annotations[ANNOT_ENV_PATH]
  if (!host || !path) return null
  return { strategy: "dotenv", host, path }
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

export async function reannotateSecret(
  contextName: string,
  namespace: string,
  name: string,
  host: string,
  path: string,
): Promise<boolean> {
  return registerSecret(contextName, namespace, name, host, path)
}
