import { t, fg, StyledText } from "@opentui/core"

export interface CommandItem {
  key: string
  label: string
  keyColor?: string
  labelColor?: string
}

interface CommandsBarProps {
  commands: CommandItem[]
}

const DEFAULT_KEY_COLOR = "#58A6FF"
const DEFAULT_LABEL_COLOR = "#8B949E"

function renderCommands(items: CommandItem[]): StyledText {
  const allChunks: StyledText[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    const kc = item.keyColor ?? DEFAULT_KEY_COLOR
    const lc = item.labelColor ?? DEFAULT_LABEL_COLOR
    if (i > 0) allChunks.push(t`  `)
    allChunks.push(t`${fg(kc)(item.key)} ${fg(lc)(item.label)}`)
  }
  if (allChunks.length === 0) return t``
  const merged = allChunks.reduce((acc, st) => {
    return new (StyledText as any)([...acc.chunks, ...st.chunks]) as StyledText
  })
  return merged
}

export function CommandsBar({ commands }: CommandsBarProps) {
  const content = renderCommands(commands)
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
