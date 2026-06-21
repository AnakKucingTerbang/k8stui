import { t, fg } from "@opentui/core"

export function LegendsBar() {
  return (
    <box
      title="LEGENDS"
      borderStyle="single"
      borderColor="#30363D"
      style={{
        flexDirection: "row",
        gap: 2,
        height: 3,
        paddingLeft: 1,
        alignItems: "center",
      }}
    >
      <text content={t`${fg("#3FB950")("●")} connected`} fg="#8B949E" />
      <text content={t`${fg("#D29922")("▲")} degraded`} fg="#8B949E" />
      <text content={t`${fg("#F85149")("○")} unreachable`} fg="#8B949E" />
    </box>
  )
}
