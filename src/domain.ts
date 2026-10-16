export const VERSION = 1 as const;
export const LIMITS = {
  bytes: 1_000_000,
  tasks: 500,
  notes: 200,
  tags: 50,
  title: 160,
  body: 20_000,
  tagsPerItem: 12,
  links: 30,
} as const;
export type Status = "todo" | "doing" | "done";
export type Priority = "low" | "normal" | "high";
export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  archived: boolean;
  updatedAt: string;
}
export interface Task extends Note {
  status: Status;
  priority: Priority;
  due: string | null;
  noteIds: string[];
}
export interface Workspace {
  version: 1;
  tasks: Task[];
  notes: Note[];
}
export const emptyWorkspace = (): Workspace => ({
  version: VERSION,
  tasks: [],
  notes: [],
});

function fail(message: string): never {
  throw new Error(message);
}
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    fail("Expected a plain JSON object.");
  const obj = value as Record<string, unknown>;
  if (
    Object.keys(obj).length !== keys.length ||
    Object.keys(obj).some((k) => !keys.includes(k))
  )
    fail("Unexpected or missing fields.");
  return obj;
}
function string(
  value: unknown,
  max: number,
  name: string,
  required = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim()) ||
    /\u0000/.test(value)
  )
    fail(`Invalid ${name} (maximum ${max} characters).`);
  return value;
}
function id(value: unknown): string {
  const s = string(value, 80, "ID", true);
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(s) ||
    ["__proto__", "constructor", "prototype"].includes(s)
  )
    fail("Invalid ID.");
  return s;
}
function array(value: unknown, max: number, name: string): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    fail(`Invalid ${name}: limit ${max}.`);
  return value;
}
function unique(values: string[], name: string): string[] {
  if (new Set(values).size !== values.length) fail(`Duplicate ${name}.`);
  return values;
}
export function validDate(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01" ||
    value > "2200-12-31"
  )
    return false;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
}
function common(obj: Record<string, unknown>): Note {
  const tags = unique(
    array(obj.tags, LIMITS.tagsPerItem, "item tags").map((t) =>
      string(t, 30, "tag", true),
    ),
    "tag",
  );
  if (tags.some((t) => !/^[a-z0-9][a-z0-9 -]*$/.test(t) || t.trim() !== t))
    fail("Tags use lowercase letters, numbers, spaces and hyphens.");
  if (typeof obj.archived !== "boolean") fail("Invalid archive flag.");
  const updatedAt = string(obj.updatedAt, 24, "timestamp");
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(updatedAt) ||
    !Number.isFinite(Date.parse(updatedAt)) ||
    new Date(updatedAt).toISOString() !== updatedAt
  )
    fail("Invalid timestamp.");
  return {
    id: id(obj.id),
    title: string(obj.title, LIMITS.title, "title", true),
    body: string(obj.body, LIMITS.body, "body"),
    tags,
    archived: obj.archived,
    updatedAt,
  };
}
const noteKeys = ["id", "title", "body", "tags", "archived", "updatedAt"];
export function validateWorkspace(value: unknown): Workspace {
  if (
    value &&
    typeof value === "object" &&
    "version" in value &&
    value.version !== VERSION
  )
    fail("Unsupported workspace version. Expected version 1.");
  const root = record(value, ["version", "tasks", "notes"]);
  if (root.version !== VERSION)
    fail("Unsupported workspace version. Expected version 1.");
  const notes = array(root.notes, LIMITS.notes, "notes").map((n) =>
    common(record(n, noteKeys)),
  );
  const tasks = array(root.tasks, LIMITS.tasks, "tasks").map((t) => {
    const obj = record(t, [
      ...noteKeys,
      "status",
      "priority",
      "due",
      "noteIds",
    ]);
    if (!["todo", "doing", "done"].includes(obj.status as string))
      fail("Invalid task status.");
    if (!["low", "normal", "high"].includes(obj.priority as string))
      fail("Invalid task priority.");
    if (
      obj.due !== null &&
      (typeof obj.due !== "string" || !validDate(obj.due))
    )
      fail("Invalid due date. Use a real date from 1900 to 2200.");
    return {
      ...common(obj),
      status: obj.status as Status,
      priority: obj.priority as Priority,
      due: obj.due as string | null,
      noteIds: unique(
        array(obj.noteIds, LIMITS.links, "note links").map(id),
        "note link",
      ),
    };
  });
  unique(
    [...tasks, ...notes].map((n) => n.id),
    "ID",
  );
  const noteIds = new Set(notes.map((n) => n.id));
  if (tasks.some((t) => t.noteIds.some((n) => !noteIds.has(n))))
    fail("Dangling note link: linked note does not exist.");
  if (allTags({ version: VERSION, tasks, notes }).length > LIMITS.tags)
    fail(`Too many workspace tags: limit ${LIMITS.tags}.`);
  const result = { version: VERSION, tasks, notes };
  if (
    new TextEncoder().encode(JSON.stringify(result)).byteLength > LIMITS.bytes
  )
    fail("Workspace exceeds the 1,000,000 byte limit.");
  return result;
}
export function parseWorkspace(raw: string): Workspace {
  if (new TextEncoder().encode(raw).byteLength > LIMITS.bytes)
    fail("File exceeds the 1,000,000 byte limit.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    fail("Malformed JSON. No workspace changes were made.");
  }
  return validateWorkspace(value);
}
export function serialize(workspace: Workspace): string {
  return JSON.stringify(validateWorkspace(workspace));
}
export function allTags(workspace: Workspace): string[] {
  return [
    ...new Set([...workspace.tasks, ...workspace.notes].flatMap((i) => i.tags)),
  ].sort();
}
export type Action =
  | { type: "replace"; workspace: Workspace }
  | { type: "save-task"; task: Task }
  | { type: "save-note"; note: Note }
  | { type: "status"; id: string; status: Status; at: string }
  | {
      type: "archive";
      kind: "task" | "note";
      id: string;
      archived: boolean;
      at: string;
    }
  | { type: "delete"; kind: "task" | "note"; id: string };
export function transition(workspace: Workspace, action: Action): Workspace {
  let next: Workspace;
  switch (action.type) {
    case "replace":
      return validateWorkspace(action.workspace);
    case "save-task":
      next = {
        ...workspace,
        tasks: workspace.tasks.some((t) => t.id === action.task.id)
          ? workspace.tasks.map((t) =>
              t.id === action.task.id ? action.task : t,
            )
          : [...workspace.tasks, action.task],
      };
      break;
    case "save-note":
      next = {
        ...workspace,
        notes: workspace.notes.some((n) => n.id === action.note.id)
          ? workspace.notes.map((n) =>
              n.id === action.note.id ? action.note : n,
            )
          : [...workspace.notes, action.note],
      };
      break;
    case "status":
      next = {
        ...workspace,
        tasks: workspace.tasks.map((t) =>
          t.id === action.id
            ? { ...t, status: action.status, updatedAt: action.at }
            : t,
        ),
      };
      break;
    case "archive":
      next =
        action.kind === "task"
          ? {
              ...workspace,
              tasks: workspace.tasks.map((t) =>
                t.id === action.id
                  ? { ...t, archived: action.archived, updatedAt: action.at }
                  : t,
              ),
            }
          : {
              ...workspace,
              notes: workspace.notes.map((n) =>
                n.id === action.id
                  ? { ...n, archived: action.archived, updatedAt: action.at }
                  : n,
              ),
            };
      break;
    case "delete":
      next =
        action.kind === "task"
          ? {
              ...workspace,
              tasks: workspace.tasks.filter((t) => t.id !== action.id),
            }
          : {
              ...workspace,
              notes: workspace.notes.filter((n) => n.id !== action.id),
              tasks: workspace.tasks.map((t) => ({
                ...t,
                noteIds: t.noteIds.filter((id) => id !== action.id),
              })),
            };
      break;
  }
  return validateWorkspace(next);
}
export interface Filters {
  query: string;
  status: string;
  priority: string;
  tag: string;
  archive: boolean;
  sort: "updated" | "title" | "due" | "priority";
}
export const defaultFilters = (): Filters => ({
  query: "",
  status: "all",
  priority: "all",
  tag: "all",
  archive: false,
  sort: "updated",
});
export function selectItems<T extends Note>(items: T[], filters: Filters): T[] {
  const terms = filters.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const ranks: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
  return items
    .filter((item) => {
      const task = "status" in item ? (item as unknown as Task) : null;
      const text =
        `${item.title}\n${item.body}\n${item.tags.join(" ")}`.toLowerCase();
      return (
        item.archived === filters.archive &&
        terms.every((term) => text.includes(term)) &&
        (filters.tag === "all" || item.tags.includes(filters.tag)) &&
        (filters.status === "all" || task?.status === filters.status) &&
        (filters.priority === "all" || task?.priority === filters.priority)
      );
    })
    .sort((a, b) => {
      const ta = a as unknown as Task,
        tb = b as unknown as Task;
      const order =
        filters.sort === "title"
          ? a.title.localeCompare(b.title)
          : filters.sort === "due"
            ? (ta.due ?? "9999").localeCompare(tb.due ?? "9999")
            : filters.sort === "priority" && ta.priority && tb.priority
              ? ranks[ta.priority] - ranks[tb.priority]
              : b.updatedAt.localeCompare(a.updatedAt);
      return order || a.id.localeCompare(b.id);
    });
}
export function displayDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1]} ${year}`;
}
