export type LeftView = "summary" | "keys" | "refs" | "manage"
export type Focus = "left" | "right"
export type ConnectionStatus = "unknown" | "checking" | "connected" | "failed"
export type ManageState =
  | "unregistered"
  | "input"
  | "testing"
  | "test-result"
  | "comparing"
  | "diff"
  | "registering"
  | "syncing"
  | "registered"
  | "unregister-confirm"
  | "file-not-found"
  | "creating"
  | "editor"

export const LEFT_VIEWS: LeftView[] = ["summary", "keys", "refs", "manage"]
