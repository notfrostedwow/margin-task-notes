import { describe, expect, it } from "vitest";
import { demoWorkspace } from "./demo";
import {
  allTags,
  defaultFilters,
  displayDate,
  emptyWorkspace,
  LIMITS,
  parseWorkspace,
  selectItems,
  serialize,
  transition,
  validDate,
  validateWorkspace,
} from "./domain";
import {
  applyAction,
  loadSession,
  STORAGE_KEY,
  type StoragePort,
} from "./storage";

const at = "2026-10-22T12:34:56.000Z";
function memory(initial: string | null = null) {
  let value = initial;
  const writes: string[] = [];
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      writes.push(next);
      value = next;
    },
    writes,
    value: () => value,
  };
}
describe("pure domain transitions", () => {
  it("uses deterministic synthetic fixtures and full fidelity serialization", () => {
    expect(demoWorkspace()).toEqual(demoWorkspace());
    expect(parseWorkspace(serialize(demoWorkspace()))).toEqual(demoWorkspace());
  });
  it("edits content, tags and links without mutating the prior workspace", () => {
    const original = demoWorkspace();
    const before = serialize(original);
    const edited = {
      ...original.tasks[0],
      title: "Observe the bridge",
      body: "Revisit at dusk",
      tags: ["research"],
      noteIds: ["note-studio"],
      due: "2028-02-29",
      updatedAt: at,
    };
    const next = transition(original, { type: "save-task", task: edited });
    expect(next.tasks[0]).toEqual(edited);
    expect(serialize(original)).toBe(before);
    expect(allTags(next)).toContain("research");
  });
  it("completes, reopens, archives, restores and removes note backlinks consistently", () => {
    const start = demoWorkspace();
    let next = transition(start, {
      type: "status",
      id: "task-route",
      status: "done",
      at,
    });
    expect(next.tasks[0].status).toBe("done");
    next = transition(next, {
      type: "status",
      id: "task-route",
      status: "todo",
      at,
    });
    next = transition(next, {
      type: "archive",
      id: "note-walk",
      kind: "note",
      archived: true,
      at,
    });
    expect(next.notes[0].archived).toBe(true);
    expect(next.tasks[0].noteIds).toContain("note-walk");
    next = transition(next, {
      type: "archive",
      id: "note-walk",
      kind: "note",
      archived: false,
      at,
    });
    expect(next.notes[0].archived).toBe(false);
    next = transition(next, { type: "delete", id: "note-walk", kind: "note" });
    expect(
      next.tasks.every((task) => !task.noteIds.includes("note-walk")),
    ).toBe(true);
    expect(next.notes).toHaveLength(2);
    expect(start.notes).toHaveLength(3);
  });
  it("adds notes and tasks, deletes tasks, and replaces all collections atomically", () => {
    const sample = demoWorkspace();
    let next = transition(emptyWorkspace(), {
      type: "save-note",
      note: sample.notes[0],
    });
    next = transition(next, {
      type: "save-task",
      task: { ...sample.tasks[0], noteIds: ["note-walk"] },
    });
    expect(next.tasks).toHaveLength(1);
    next = transition(next, {
      type: "delete",
      id: next.tasks[0].id,
      kind: "task",
    });
    expect(next.tasks).toHaveLength(0);
    expect(
      transition(next, { type: "replace", workspace: emptyWorkspace() }),
    ).toEqual(emptyWorkspace());
  });
});
describe("combined search and filters", () => {
  it("ANDs case-insensitive terms across title, body and tags", () => {
    const workspace = demoWorkspace();
    expect(
      selectItems(workspace.tasks, {
        ...defaultFilters(),
        query: "BENCHES fieldwork",
      }).map((t) => t.id),
    ).toEqual(["task-route"]);
    expect(
      selectItems(workspace.notes, {
        ...defaultFilters(),
        query: "unexpected community",
      }).map((n) => n.id),
    ).toEqual(["note-walk"]);
    expect(
      selectItems(workspace.tasks, {
        ...defaultFilters(),
        query: "absent phrase",
      }),
    ).toEqual([]);
  });
  it("combines status, priority and tag; sorts and excludes archived items", () => {
    const workspace = demoWorkspace();
    expect(
      selectItems(workspace.tasks, {
        ...defaultFilters(),
        status: "doing",
        priority: "high",
        tag: "fieldwork",
      }),
    ).toHaveLength(1);
    expect(
      selectItems(workspace.notes, { ...defaultFilters(), status: "doing" }),
    ).toEqual([]);
    expect(
      selectItems(workspace.tasks, { ...defaultFilters(), sort: "due" }).at(-1)
        ?.due,
    ).toBeNull();
    expect(
      selectItems(workspace.tasks, { ...defaultFilters(), sort: "priority" })[0]
        .priority,
    ).toBe("high");
    expect(
      selectItems(workspace.notes, { ...defaultFilters(), sort: "title" })[0]
        .id,
    ).toBe("note-walk");
    const next = transition(workspace, {
      type: "archive",
      id: "task-route",
      kind: "task",
      archived: true,
      at,
    });
    expect(selectItems(next.tasks, defaultFilters())).toHaveLength(4);
    expect(
      selectItems(next.tasks, { ...defaultFilters(), archive: true }).map(
        (t) => t.id,
      ),
    ).toEqual(["task-route"]);
  });
});
describe("strict import boundary", () => {
  it.each([
    ["malformed", "{broken", /Malformed/],
    ["oversized", " ".repeat(LIMITS.bytes + 1), /byte limit/],
    [
      "unsupported version",
      '{"version":2,"tasks":[],"notes":[]}',
      /Unsupported/,
    ],
    ["missing version", '{"tasks":[],"notes":[]}', /missing fields/],
    [
      "prototype key",
      '{"version":1,"tasks":[],"notes":[],"__proto__":{"polluted":true}}',
      /Unexpected/,
    ],
    [
      "constructor key",
      '{"version":1,"tasks":[],"notes":[],"constructor":{}}',
      /Unexpected/,
    ],
  ])("rejects %s without applying anything", (_label, raw, error) => {
    expect(() => parseWorkspace(raw)).toThrow(error);
    expect(Object.prototype).not.toHaveProperty("polluted");
  });
  it("rejects duplicate IDs across kinds, duplicate tags and duplicate/dangling links", () => {
    const original = demoWorkspace();
    expect(() =>
      validateWorkspace({
        ...original,
        notes: [...original.notes, original.notes[0]],
      }),
    ).toThrow(/Duplicate ID/);
    expect(() =>
      validateWorkspace({
        ...original,
        notes: [{ ...original.notes[0], id: original.tasks[0].id }],
      }),
    ).toThrow(/Duplicate ID/);
    expect(() =>
      validateWorkspace({
        ...original,
        tasks: [{ ...original.tasks[0], noteIds: ["missing"] }],
      }),
    ).toThrow(/Dangling/);
    expect(() =>
      validateWorkspace({
        ...original,
        tasks: [{ ...original.tasks[0], noteIds: ["note-walk", "note-walk"] }],
      }),
    ).toThrow(/Duplicate note link/);
    expect(() =>
      validateWorkspace({
        ...original,
        notes: [{ ...original.notes[0], tags: ["tag", "tag"] }],
      }),
    ).toThrow(/Duplicate tag/);
  });
  it("enforces item counts and string, tag, link, date and timestamp limits", () => {
    const w = demoWorkspace();
    expect(() =>
      validateWorkspace({
        ...w,
        tasks: Array.from({ length: 501 }, (_, i) => ({
          ...w.tasks[0],
          id: `task-${i}`,
        })),
      }),
    ).toThrow(/limit 500/);
    expect(() =>
      validateWorkspace({
        ...w,
        notes: Array.from({ length: 201 }, (_, i) => ({
          ...w.notes[0],
          id: `note-${i}`,
        })),
      }),
    ).toThrow(/limit 200/);
    for (const patch of [
      { title: "x".repeat(161) },
      { title: " " },
      { body: "x".repeat(20001) },
      { tags: ["A"] },
      { tags: ["x".repeat(31)] },
      { tags: Array.from({ length: 13 }, (_, i) => `tag${i}`) },
      { due: "2026-02-30" },
      { status: "wat" },
      { priority: "urgent" },
      { archived: 1 },
      { id: "__proto__" },
      { updatedAt: "2026-02-30T00:00:00.000Z" },
      { noteIds: Array.from({ length: 31 }, (_, i) => `note${i}`) },
    ]) {
      expect(() =>
        validateWorkspace({ ...w, tasks: [{ ...w.tasks[0], ...patch }] }),
      ).toThrow();
    }
    expect(() =>
      validateWorkspace({
        version: 1,
        tasks: [],
        notes: Array.from({ length: 51 }, (_, i) => ({
          ...w.notes[0],
          id: `n${i}`,
          tags: [`tag${i}`],
        })),
      }),
    ).toThrow(/workspace tags/);
    expect(() =>
      validateWorkspace({
        version: 1,
        tasks: [],
        notes: Array.from({ length: 60 }, (_, i) => ({
          ...w.notes[0],
          id: `n${i}`,
          body: "x".repeat(20000),
        })),
      }),
    ).toThrow(/byte limit/);
  });
  it("round-trips executable-looking content literally and rejects nested untrusted properties", () => {
    const w = demoWorkspace();
    w.notes[0].body =
      "<img src=x onerror=alert(1)>\n[run](javascript:alert(1))\n__proto__";
    expect(parseWorkspace(serialize(w))).toEqual(w);
    expect(() =>
      validateWorkspace({
        ...w,
        notes: [{ ...w.notes[0], extra: { __proto__: { polluted: true } } }],
      }),
    ).toThrow();
  });
  it("handles date-only values without timezone conversion", () => {
    expect(validDate("2028-02-29")).toBe(true);
    expect(validDate("2026-02-29")).toBe(false);
    expect(validDate("1899-12-31")).toBe(false);
    expect(displayDate("2026-01-01")).toBe("01 Jan 2026");
  });
});
describe("storage, failure and atomic replacements", () => {
  it("loads fresh demo lazily and reads a complete saved workspace", () => {
    expect(loadSession(memory()).workspace).toEqual(demoWorkspace());
    const raw = serialize(demoWorkspace());
    expect(loadSession(memory(raw))).toMatchObject({
      workspace: demoWorkspace(),
      baseline: raw,
      dirty: false,
      message: "Saved on this device",
    });
  });
  it("preserves corrupt and unsupported original bytes; blocks edits until explicit replacement", () => {
    for (const raw of ["{broken", '{"version":99,"tasks":[],"notes":[]}']) {
      const store = memory(raw);
      const session = loadSession(store);
      expect(session).toMatchObject({ recovery: raw, blocked: true });
      expect(store.value()).toBe(raw);
      expect(() =>
        applyAction(
          session,
          { type: "save-note", note: demoWorkspace().notes[0] },
          store,
        ),
      ).toThrow(/Recover/);
      expect(store.writes).toHaveLength(0);
      const replaced = applyAction(
        session,
        { type: "replace", workspace: emptyWorkspace() },
        store,
      );
      expect(replaced.blocked).toBe(false);
      expect(parseWorkspace(store.value()!)).toEqual(emptyWorkspace());
    }
  });
  it("reports unavailable storage without a false saved message; retains in-memory edits", () => {
    const denied: StoragePort = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    const initial = loadSession(denied);
    expect(initial.message).toMatch(/unavailable/);
    const next = applyAction(
      initial,
      { type: "save-note", note: demoWorkspace().notes[0] },
      denied,
    );
    expect(next.workspace.notes).toHaveLength(1);
    expect(next.message).toMatch(/^Not saved/);
    expect(next.dirty).toBe(true);
  });
  it("quota failure keeps replacement state and persisted bytes unchanged", () => {
    const raw = serialize(demoWorkspace());
    const store = memory(raw);
    const failing: StoragePort = {
      getItem: store.getItem,
      setItem: () => {
        throw new Error("quota");
      },
    };
    const initial = loadSession(store);
    expect(() =>
      applyAction(
        initial,
        { type: "replace", workspace: emptyWorkspace() },
        failing,
      ),
    ).toThrow(/Replacement not applied/);
    expect(initial.workspace).toEqual(demoWorkspace());
    expect(store.value()).toBe(raw);
  });
  it("refuses stale writes from another tab", () => {
    const store = memory(serialize(demoWorkspace()));
    const initial = loadSession(store);
    store.setItem(STORAGE_KEY, serialize(emptyWorkspace()));
    const next = applyAction(
      initial,
      { type: "status", id: "task-route", status: "done", at },
      store,
    );
    expect(next.message).toMatch(/another tab/);
    expect(parseWorkspace(store.value()!)).toEqual(emptyWorkspace());
    expect(next.workspace.tasks[0].status).toBe("done");
  });
  it("does not write while preparing or cancelling and accepts with exactly one complete write", () => {
    const store = memory(serialize(demoWorkspace()));
    const initial = loadSession(store);
    const before = JSON.stringify(initial);
    const candidate = parseWorkspace(serialize(emptyWorkspace()));
    expect(store.writes).toHaveLength(0);
    expect(JSON.stringify(initial)).toBe(before);
    const accepted = applyAction(
      initial,
      { type: "replace", workspace: candidate },
      store,
    );
    expect(store.writes).toEqual([serialize(emptyWorkspace())]);
    expect(loadSession(store)).toEqual(accepted);
  });
});
