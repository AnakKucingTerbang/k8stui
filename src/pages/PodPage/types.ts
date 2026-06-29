export type LeftBox = "containers" | "application" | "manifests" | "logs" | "portforward"
export type FocusTarget = LeftBox | "details"
export type YamlEditMode = "view" | "edit"

export const LEFT_ORDER: LeftBox[] = ["containers", "application", "manifests", "logs", "portforward"]

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function shortKind(kind: string): string {
  switch (kind) {
    case "Deployment": return "Deploy"
    case "StatefulSet": return "Sts"
    case "DaemonSet": return "DS"
    case "PersistentVolumeClaim": return "PVC"
    case "ConfigMap": return "CM"
    case "Secret": return "Secret"
    case "Service": return "SVC"
    case "Ingress": return "Ingress"
    default: return kind
  }
}
