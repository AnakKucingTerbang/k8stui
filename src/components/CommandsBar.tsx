import { t, fg, type StyledText } from "@opentui/core"

type Page = "cluster-list" | "cluster-detail" | "node-detail" | "pod-detail"
type PodDetailMode = "sections" | "details"

interface CommandsBarProps {
  page: Page
  podDetailMode?: PodDetailMode
}

const COMMANDS: Record<Page, StyledText> = {
  "cluster-list": t`${fg("#58A6FF")("[enter]")} open  ${fg("#58A6FF")("[s]")}ort  ${fg("#58A6FF")("[/]")}find  ${fg("#58A6FF")("[f]")}avorite  ${fg("#58A6FF")("[m]")}etric  ${fg("#58A6FF")("[c]")}ontext  ${fg("#58A6FF")("[q]")}uit`,
  "cluster-detail": t`${fg("#58A6FF")("[enter]")} node  ${fg("#58A6FF")("[esc]")} back  ${fg("#58A6FF")("[m]")}etric  ${fg("#58A6FF")("[q]")}uit`,
  "node-detail": t`${fg("#58A6FF")("[enter]")} pod  ${fg("#58A6FF")("[esc]")} back  ${fg("#58A6FF")("[m]")}etric  ${fg("#58A6FF")("[q]")}uit`,
  "pod-detail": t``,
}

const POD_COMMANDS: Record<PodDetailMode, StyledText> = {
  sections: t`${fg("#58A6FF")("[enter]")} open  ${fg("#58A6FF")("[↑↓]")} nav  ${fg("#58A6FF")("[esc]")} back  ${fg("#58A6FF")("[q]")}uit`,
  details: t`${fg("#58A6FF")("[enter]")} copy  ${fg("#58A6FF")("[↑↓]")} scroll  ${fg("#58A6FF")("[esc]")} back  ${fg("#58A6FF")("[q]")}uit`,
}

export function CommandsBar({ page, podDetailMode }: CommandsBarProps) {
  const content = page === "pod-detail" && podDetailMode
    ? POD_COMMANDS[podDetailMode]
    : COMMANDS[page]

  return (
    <box
      title="COMMANDS"
      borderStyle="single"
      borderColor="#30363D"
      style={{
        flexDirection: "row",
        height: 3,
        paddingLeft: 1,
        alignItems: "center",
      }}
    >
      <text fg="#8B949E" content={content} />
    </box>
  )
}
