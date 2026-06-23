import { t, fg, type StyledText } from "@opentui/core"

interface HeaderBarProps {
  content: StyledText
  clock: string
}

export function HeaderBar({ content, clock }: HeaderBarProps) {
  return (
    <box
      title="K8STUI"
      borderStyle="single"
      borderColor="#30363D"
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        height: 3,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg="#8B949E" content={content} />
      <text fg="#8B949E" content={clock} />
    </box>
  )
}

interface BreadcrumbOpts {
  currentContext: string
  clusterName?: string
  nodeName?: string
  namespaceName?: string
  resourceKind?: string
  resourceName?: string
  podName?: string
  spinner?: string
}

export function buildBreadcrumbParts(opts: BreadcrumbOpts): StyledText {
  const { currentContext, clusterName, nodeName, namespaceName, resourceKind, resourceName, podName, spinner } = opts
  const S = fg("#484F58")(" | ")
  const E = ""

  return t`${fg("#8B949E")("k8s manager")}${S}${fg("#58A6FF")("context:")}${fg("#8B949E")(` ${currentContext}`)}${clusterName ? S : E}${clusterName ? fg("#58A6FF")("cluster:") : E}${clusterName ? fg("#8B949E")(` ${clusterName}`) : E}${nodeName ? S : E}${nodeName ? fg("#58A6FF")("node:") : E}${nodeName ? fg("#8B949E")(` ${nodeName}`) : E}${namespaceName ? S : E}${namespaceName ? fg("#58A6FF")("ns:") : E}${namespaceName ? fg("#8B949E")(` ${namespaceName}`) : E}${resourceKind && resourceName ? S : E}${resourceKind && resourceName ? fg("#58A6FF")(`${resourceKind.toLowerCase()}:`) : E}${resourceKind && resourceName ? fg("#8B949E")(` ${resourceName}`) : E}${podName ? S : E}${podName ? fg("#58A6FF")("pod:") : E}${podName ? fg("#8B949E")(` ${podName}`) : E}${spinner ? fg("#D29922")(spinner) : E}`
}
