import {
  emptyWorkspace,
  parseWorkspace,
  serialize,
  transition,
  type Action,
  type Workspace,
} from "./domain";
import { demoWorkspace } from "./demo";
export const STORAGE_KEY = "margin.workspace.v1";
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface Session {
  workspace: Workspace;
  baseline: string | null;
  recovery: string | null;
  blocked: boolean;
  dirty: boolean;
  message: string;
}
export function loadSession(storage: StoragePort): Session {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      workspace: emptyWorkspace(),
      baseline: null,
      recovery: null,
      blocked: false,
      dirty: true,
      message:
        "Storage unavailable. Work stays in memory; export before closing.",
    };
  }
  if (raw === null)
    return {
      workspace: demoWorkspace(),
      baseline: null,
      recovery: null,
      blocked: false,
      dirty: true,
      message: "Sample notebook · in memory until your first change.",
    };
  try {
    return {
      workspace: parseWorkspace(raw),
      baseline: raw,
      recovery: null,
      blocked: false,
      dirty: false,
      message: "Saved on this device",
    };
  } catch (error) {
    return {
      workspace: emptyWorkspace(),
      baseline: raw,
      recovery: raw,
      blocked: true,
      dirty: false,
      message: `Recovery needed. ${error instanceof Error ? error.message : "Invalid storage."} Original data is untouched. Export the original before replacing it.`,
    };
  }
}
export function applyAction(
  session: Session,
  action: Action,
  storage: StoragePort,
): Session {
  if (session.blocked && action.type !== "replace")
    throw new Error(
      "Recover or explicitly replace the stored workspace before editing.",
    );
  const workspace = transition(session.workspace, action);
  const raw = serialize(workspace);
  try {
    if (storage.getItem(STORAGE_KEY) !== session.baseline)
      throw new Error(
        "Storage changed in another tab. Export this copy, then reload to review the other copy.",
      );
    storage.setItem(STORAGE_KEY, raw);
    return {
      workspace,
      baseline: raw,
      blocked: false,
      recovery: null,
      dirty: false,
      message: "Saved on this device",
    };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.includes("another tab")
        ? error.message
        : "Storage unavailable or full.";
    if (action.type === "replace")
      throw new Error(
        `Replacement not applied. ${detail} Export your work and retry when storage is available.`,
      );
    return {
      ...session,
      workspace,
      dirty: true,
      message: `Not saved. ${detail} Export before closing.`,
    };
  }
}
export function sessionReducer(_state: Session, next: Session): Session {
  return next;
}
