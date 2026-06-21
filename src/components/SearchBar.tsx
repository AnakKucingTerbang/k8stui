import { t, fg } from "@opentui/core"

interface SearchBarProps {
  query: string
  onInput: (value: string) => void
}

export function SearchBar({ query, onInput }: SearchBarProps) {
  return (
    <box
      title="SEARCH"
      borderStyle="single"
      borderColor="#30363D"
      style={{
        flexDirection: "row",
        height: 3,
        paddingLeft: 1,
        alignItems: "center",
        backgroundColor: "#0D1117",
      }}
    >
      <text content={t`${fg("#58A6FF")("search:")} `} />
      <input
        value={query}
        onInput={onInput}
        focused={true}
        width={50}
        backgroundColor="#0D1117"
        textColor="#E6EDF3"
        cursorColor="#58A6FF"
      />
    </box>
  )
}
