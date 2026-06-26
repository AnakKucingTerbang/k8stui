import { useCallback, useEffect, useRef, useState } from "react"
import { useRenderer } from "@opentui/react"
import { applyYamlAsync } from "../../utils/kube"
import type { YamlEditMode } from "./types"

interface UseYamlEditArgs {
  contextName: string
  onRefresh: () => void
  onToast: (msg: string) => void
}

export function useYamlEdit({ contextName, onRefresh, onToast }: UseYamlEditArgs) {
  const [yamlEditMode, setYamlEditMode] = useState<YamlEditMode>("view")
  const [editedYaml, setEditedYaml] = useState("")
  const textareaRef = useRef<any>(null)
  const renderer = useRenderer()

  const handleApply = useCallback(async () => {
    const yamlToApply = textareaRef.current?.plainText ?? editedYaml
    if (!yamlToApply || !contextName) return

    onToast("Applying...")
    const result = await applyYamlAsync(contextName, yamlToApply)
    if (result.success) {
      onToast("Applied successfully")
      onRefresh()
    } else {
      onToast(`Apply failed: ${result.message}`)
    }
  }, [editedYaml, contextName, onRefresh, onToast])

  const handleCancelEdit = useCallback(() => {
    setYamlEditMode("view")
    setEditedYaml("")
  }, [])

  useEffect(() => {
    if (yamlEditMode === "edit") {
      const handler = (key: { name: string }) => {
        if (key.name === "escape") handleCancelEdit()
      }
      renderer.keyInput.on("keypress", handler)
      return () => { renderer.keyInput.off("keypress", handler) }
    }
  }, [yamlEditMode, handleCancelEdit, renderer])

  useEffect(() => {
    if (yamlEditMode === "view") setEditedYaml("")
  }, [yamlEditMode])

  return {
    yamlEditMode,
    setYamlEditMode,
    editedYaml,
    setEditedYaml,
    handleApply,
    handleCancelEdit,
    textareaRef,
  }
}
