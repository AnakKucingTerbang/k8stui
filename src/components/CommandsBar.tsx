import type { StyledText } from "@opentui/core"

interface CommandsBarProps {
  content: StyledText
}

export function CommandsBar({ content }: CommandsBarProps) {
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
