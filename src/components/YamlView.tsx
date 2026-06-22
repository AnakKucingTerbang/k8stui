import { useEffect } from "react"
import { SyntaxStyle, RGBA } from "@opentui/core"

const yamlSyntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#FF7B72"), bold: true },
  string: { fg: RGBA.fromHex("#A5D6FF") },
  comment: { fg: RGBA.fromHex("#8B949E"), italic: true },
  number: { fg: RGBA.fromHex("#79C0FF") },
  boolean: { fg: RGBA.fromHex("#79C0FF") },
  constant: { fg: RGBA.fromHex("#79C0FF") },
  type: { fg: RGBA.fromHex("#FFA657") },
  variable: { fg: RGBA.fromHex("#E6EDF3") },
  property: { fg: RGBA.fromHex("#79C0FF") },
  "variable.member": { fg: RGBA.fromHex("#79C0FF") },
  operator: { fg: RGBA.fromHex("#FF7B72") },
  punctuation: { fg: RGBA.fromHex("#E6EDF3") },
  default: { fg: RGBA.fromHex("#E6EDF3") },
})

interface YamlViewProps {
  yaml: string
  mode: "view" | "edit"
  editEnabled: boolean
  scrollRef: React.RefObject<any>
  textareaRef: React.RefObject<any>
  onContentChange?: () => void
  onSubmit?: () => void
}

export function YamlView({ yaml, mode, editEnabled, scrollRef, textareaRef, onContentChange, onSubmit }: YamlViewProps) {
  useEffect(() => {
    if (mode === "edit" && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.onSubmit = onSubmit
      textareaRef.current.keyBindings = [
        { name: "return", ctrl: true, action: "submit" },
      ]
    }
  }, [mode, textareaRef, onSubmit])

  if (mode === "edit" && editEnabled) {
    return (
      <textarea
        ref={textareaRef}
        initialValue={yaml}
        width="100%"
        height="100%"
        backgroundColor="#0D1117"
        focusedBackgroundColor="#161B22"
        textColor="#E6EDF3"
        focusedTextColor="#E6EDF3"
        cursorColor="#58A6FF"
        selectionBg="#264F78"
        selectionFg="#FFFFFF"
        wrapMode="none"
        placeholder="No YAML to edit"
        placeholderColor="#484F58"
        onContentChange={onContentChange}
        style={{ width: "100%", height: "100%" }}
      />
    )
  }

  return (
    <scrollbox
      ref={scrollRef}
      scrollX={true}
      scrollY={true}
      viewportCulling={true}
      style={{ width: "100%", height: "100%" }}
    >
      <code
        content={yaml || "──"}
        filetype="yaml"
        syntaxStyle={yamlSyntaxStyle}
        wrapMode="none"
        selectable={true}
      />
    </scrollbox>
  )
}
