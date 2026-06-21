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
  podName?: string
  spinner?: string
}

export function buildBreadcrumbParts(opts: BreadcrumbOpts): StyledText {
  const { currentContext, clusterName, nodeName, podName, spinner } = opts

  if (podName && nodeName && clusterName) {
    return t`${fg("#8B949E")("k8s manager")}${fg("#484F58")(" | ")}${fg("#58A6FF")("context:")}${fg("#8B949E")(` ${currentContext}`)}${fg("#484F58")(" | ")}${fg("#58A6FF")("cluster:")}${fg("#8B949E")(` ${clusterName}`)}${fg("#484F58")(" | ")}${fg("#58A6FF")("node:")}${fg("#8B949E")(` ${nodeName}`)}${fg("#484F58")(" | ")}${fg("#58A6FF")("pod:")}${fg("#8B949E")(` ${podName}`)}${spinner ? fg("#D29922")(spinner) : ""}`
  }
  if (nodeName && clusterName) {
    return t`${fg("#8B949E")("k8s manager")}${fg("#484F58")(" | ")}${fg("#58A6FF")("context:")}${fg("#8B949E")(` ${currentContext}`)}${fg("#484F58")(" | ")}${fg("#58A6FF")("cluster:")}${fg("#8B949E")(` ${clusterName}`)}${fg("#484F58")(" | ")}${fg("#58A6FF")("node:")}${fg("#8B949E")(` ${nodeName}`)}${spinner ? fg("#D29922")(spinner) : ""}`
  }
  if (clusterName) {
    return t`${fg("#8B949E")("k8s manager")}${fg("#484F58")(" | ")}${fg("#58A6FF")("context:")}${fg("#8B949E")(` ${currentContext}`)}${fg("#484F58")(" | ")}${fg("#58A6FF")("cluster:")}${fg("#8B949E")(` ${clusterName}`)}${spinner ? fg("#D29922")(spinner) : ""}`
  }
  return t`${fg("#8B949E")("k8s manager")}${fg("#484F58")(" | ")}${fg("#58A6FF")("context:")}${fg("#8B949E")(` ${currentContext}`)}${spinner ? fg("#D29922")(spinner) : ""}`
}
