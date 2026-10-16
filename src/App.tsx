import { useEffect, useReducer, useRef, useState } from "react";
import {
  allTags,
  defaultFilters,
  displayDate,
  emptyWorkspace,
  LIMITS,
  parseWorkspace,
  selectItems,
  serialize,
  type Action,
  type Filters,
  type Note,
  type Task,
  type Workspace,
} from "./domain";
import {
  applyAction,
  loadSession,
  sessionReducer,
  STORAGE_KEY,
  type StoragePort,
} from "./storage";
import { demoWorkspace } from "./demo";
import { Dialog } from "./Dialog";
import { Editor } from "./Editor";
import { Markdown } from "./Markdown";

type Modal =
  | { type: "edit"; kind: "task" | "note"; item?: Task | Note }
  | {
      type: "confirm";
      title: string;
      description: string;
      accept: string;
      action: Action;
    };
// Resolve storage within calls so denied access is caught by the persistence layer.
const storage: StoragePort = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
const labels = { todo: "To do", doing: "In progress", done: "Done" };
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function App() {
  const [session, dispatch] = useReducer(sessionReducer, storage, loadSession);
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [panel, setPanel] = useState<"tasks" | "notes">("tasks");
  const [selectedId, setSelectedId] = useState("note-walk");
  const [modal, setModal] = useState<Modal | null>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dataDetails = useRef<HTMLDetailsElement>(null);
  const workspace = session.workspace;
  const tasks = selectItems(workspace.tasks, filters);
  const notes = selectItems(workspace.notes, filters);
  const selected = notes.find((n) => n.id === selectedId) ?? notes[0];
  const tags = allTags(workspace);
  const done = workspace.tasks.filter(
    (t) => !t.archived && t.status === "done",
  ).length;
  const active = workspace.tasks.filter((t) => !t.archived).length;

  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null)
        setError(
          "Storage changed in another tab. Export this copy before reloading; your next save will check for conflicts.",
        );
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("storage", changed);
    };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let alive = true;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        if (alive) setOfflineReady(true);
      })
      .catch(() => {
        if (alive) setOfflineReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!session.dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [session.dirty]);

  function commit(action: Action) {
    const next = applyAction(session, action, storage);
    dispatch(next);
    setError("");
    setModal(null);
    if (action.type === "replace") {
      setFilters(defaultFilters());
      setSelectedId(next.workspace.notes[0]?.id ?? "");
    }
  }
  function attempt(action: Action) {
    try {
      commit(action);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    }
  }
  function replace(next: Workspace, title: string) {
    // Validation happens before any confirmation and before touching live state.
    const validated = parseWorkspace(serialize(next));
    if (
      workspace.tasks.length ||
      workspace.notes.length ||
      session.baseline !== null ||
      session.dirty
    )
      setModal({
        type: "confirm",
        title,
        description: `Replace the entire notebook with ${validated.tasks.length} tasks and ${validated.notes.length} notes? All current items, tags and links will be replaced. Export a copy first if you want to keep them.`,
        accept: "Replace notebook",
        action: { type: "replace", workspace: validated },
      });
    else attempt({ type: "replace", workspace: validated });
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    if (dataDetails.current) dataDetails.current.open = false;
    try {
      if (file.size > LIMITS.bytes)
        throw new Error("File exceeds the 1,000,000 byte limit.");
      const candidate = parseWorkspace(await file.text());
      setError("");
      replace(candidate, "Import this notebook?");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not read this file. No changes made.",
      );
    }
  }
  function destructive(
    kind: "task" | "note",
    item: Note,
    type: "archive" | "delete",
  ) {
    setModal({
      type: "confirm",
      title:
        type === "delete"
          ? `Delete this ${kind}?`
          : `${item.archived ? "Restore" : "Archive"} this ${kind}?`,
      description:
        type === "delete"
          ? `“${item.title}” will be permanently deleted.${kind === "note" ? " Its task links will also be removed." : ""} Export first to keep a copy.`
          : `“${item.title}” will ${item.archived ? "return to the active notebook" : "move to the archive"}. Its content and links will be kept.`,
      accept:
        type === "delete"
          ? "Delete permanently"
          : item.archived
            ? "Restore item"
            : "Archive item",
      action:
        type === "delete"
          ? { type: "delete", kind, id: item.id }
          : {
              type: "archive",
              kind,
              id: item.id,
              archived: !item.archived,
              at: new Date().toISOString(),
            },
    });
  }
  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  const filterActive =
    filters.query ||
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.tag !== "all" ||
    filters.archive ||
    filters.sort !== "updated";
  const editor = modal?.type === "edit" ? modal : null;
  return (
    <div className="app-shell">
      <a className="skip" href="#workspace">
        Skip to workspace
      </a>
      <aside className="sidebar" aria-label="Notebook navigation">
        <a className="brand" href="#workspace" aria-label="Margin workspace">
          <span className="brand-mark">m.</span>
          <span>
            margin<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="sidebar-caption">A LITTLE ROOM TO THINK</p>
        <div className="notebook-label">
          <span>01</span> PERSONAL NOTEBOOK
        </div>
        <nav>
          <button
            className={!filters.archive ? "nav-active" : ""}
            onClick={() => setFilters(defaultFilters())}
          >
            <span aria-hidden="true">▤</span> All work <span>{active}</span>
          </button>
          <button
            className={filters.archive ? "nav-active" : ""}
            onClick={() => setFilters({ ...defaultFilters(), archive: true })}
          >
            <span aria-hidden="true">⌑</span> Archive{" "}
            <span>
              {
                [...workspace.tasks, ...workspace.notes].filter(
                  (i) => i.archived,
                ).length
              }
            </span>
          </button>
        </nav>
        <div className="tag-navigation">
          <p className="eyebrow">YOUR THREADS</p>
          {tags.length ? (
            tags.map((tag) => (
              <button
                key={tag}
                className={filters.tag === tag ? "tag-active" : ""}
                onClick={() =>
                  updateFilter("tag", filters.tag === tag ? "all" : tag)
                }
              >
                <span aria-hidden="true">#</span> {tag}
              </button>
            ))
          ) : (
            <p className="sidebar-small">Tags will appear as you write.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="seed-symbol" aria-hidden="true">
            ✳
          </div>
          <p>
            Gather your thoughts.
            <br />
            Make a little progress.
          </p>
          <span className="sidebar-small">
            PRIVATE BY DESIGN
            <br />
            NO ACCOUNT. NO CLOUD.
          </span>
        </div>
      </aside>
      <main id="workspace" tabIndex={-1}>
        <header className="topbar">
          <span className="eyebrow">THE EVERYDAY FIELD NOTEBOOK</span>
          <span className="connection">
            <span aria-hidden="true">●</span>{" "}
            {offline ? "Offline" : "Local workspace"}
            {offlineReady ? " · offline ready" : ""}
          </span>
        </header>
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR SPACE, AT YOUR PACE</p>
            <h1>{filters.archive ? "The archive" : "Room for good work."}</h1>
            <p className="intro">
              Small actions. Connected thoughts. All in one place.
            </p>
          </div>
          <div className="creation-actions">
            <button
              onClick={() => setModal({ type: "edit", kind: "note" })}
              disabled={session.blocked}
            >
              + New note
            </button>
            <button
              id="new-task"
              className="primary"
              onClick={() => setModal({ type: "edit", kind: "task" })}
              disabled={session.blocked}
            >
              + New task
            </button>
          </div>
        </div>
        <div className="workspace-meta">
          <p
            role="status"
            className={
              session.blocked || session.message.startsWith("Not saved")
                ? "error-text"
                : ""
            }
          >
            {session.message}
          </p>
          <details ref={dataDetails} className="data-menu">
            <summary>Notebook & data</summary>
            <div
              className="data-tools"
              onClick={(event) => {
                if (
                  (event.target as HTMLElement).closest("button") &&
                  dataDetails.current
                )
                  dataDetails.current.open = false;
              }}
            >
              <p>
                Your notebook lives in this browser. Keep an export for backup.
              </p>
              <button
                onClick={() =>
                  download(serialize(workspace), "margin-notebook.json")
                }
              >
                Export JSON
              </button>
              {session.recovery !== null && (
                <button
                  onClick={() =>
                    download(session.recovery!, "margin-original-recovery.json")
                  }
                >
                  Export original recovery
                </button>
              )}
              <button onClick={() => input.current?.click()}>
                Import JSON
              </button>
              <input
                ref={input}
                aria-label="Import notebook file"
                hidden
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() =>
                  replace(demoWorkspace(), "Load the sample notebook?")
                }
              >
                Load sample notebook
              </button>
              <button
                className="danger-text"
                onClick={() =>
                  replace(emptyWorkspace(), "Start an empty notebook?")
                }
              >
                Reset to empty
              </button>
              <p className="hint">
                Version 1 JSON · maximum 1 MB. Import and reset replace
                everything.
              </p>
            </div>
          </details>
        </div>
        {session.blocked && (
          <div className="recovery">
            <h2>Your original notebook is protected.</h2>
            <p>
              We could not safely read this browser’s stored data. Export the
              original recovery file from Notebook & data. A validated import,
              sample load or reset can explicitly replace it.
            </p>
          </div>
        )}
        {error && (
          <div role="alert" className="error-banner">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        )}
        <section className="search-tools" aria-label="Search and filters">
          <label className="search-label">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search tasks and notes"
              placeholder="Find a thought, a task, a thread…"
              value={filters.query}
              onChange={(e) => updateFilter("query", e.target.value)}
            />
          </label>
          <button
            className="filter-toggle"
            aria-expanded={showFilters}
            aria-controls="filter-fields"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters & sort{" "}
            <span>
              {[
                filters.status !== "all",
                filters.priority !== "all",
                filters.tag !== "all",
                filters.sort !== "updated",
              ].filter(Boolean).length || "All work"}
            </span>
          </button>
          <div
            id="filter-fields"
            className={`filters ${showFilters ? "filters-open" : ""}`}
          >
            <label>
              Status
              <select
                value={filters.status}
                onChange={(e) => updateFilter("status", e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="todo">To do</option>
                <option value="doing">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label>
              Priority
              <select
                value={filters.priority}
                onChange={(e) => updateFilter("priority", e.target.value)}
              >
                <option value="all">All priorities</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              Tag
              <select
                value={filters.tag}
                onChange={(e) => updateFilter("tag", e.target.value)}
              >
                <option value="all">All tags</option>
                {tags.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select
                value={filters.sort}
                onChange={(e) =>
                  updateFilter("sort", e.target.value as Filters["sort"])
                }
              >
                <option value="updated">Last edited</option>
                <option value="title">Title A–Z</option>
                <option value="due">Due date</option>
                <option value="priority">Priority</option>
              </select>
            </label>
            <button
              className="reset-button"
              disabled={!filterActive}
              onClick={() => setFilters(defaultFilters())}
            >
              Reset filters
            </button>
          </div>
          <p className="match-count" aria-live="polite">
            {tasks.length} of {workspace.tasks.length} tasks · {notes.length} of{" "}
            {workspace.notes.length} notes match
            {filters.status !== "all" || filters.priority !== "all"
              ? " · status and priority apply to tasks; notes have neither"
              : " · searches titles, content and tags"}
          </p>
        </section>
        <div className="mobile-panels" aria-label="Workspace panels">
          <button
            aria-pressed={panel === "tasks"}
            onClick={() => setPanel("tasks")}
          >
            Tasks ({tasks.length})
          </button>
          <button
            aria-pressed={panel === "notes"}
            onClick={() => setPanel("notes")}
          >
            Notes ({notes.length})
          </button>
        </div>
        <div className="work-columns">
          <section
            className={`tasks-panel ${panel === "tasks" ? "mobile-active" : ""}`}
            aria-labelledby="tasks-title"
          >
            <div className="section-heading">
              <h2 id="tasks-title">
                The next small step
                <span className="count">
                  {tasks.length.toString().padStart(2, "0")}
                </span>
              </h2>
              <p>
                {done} of {active} active tasks complete
              </p>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span
                style={{ width: `${active ? (done / active) * 100 : 0}%` }}
              />
            </div>
            {tasks.length === 0 ? (
              <div className="empty">
                <span aria-hidden="true">↗</span>
                <h3>
                  {workspace.tasks.length
                    ? "No tasks match this view."
                    : "A little room to begin."}
                </h3>
                <p>
                  {workspace.tasks.length
                    ? "Try another search or reset your filters."
                    : "Add one small task. You can link it to a note as the idea grows."}
                </p>
                <button
                  onClick={() =>
                    workspace.tasks.length
                      ? setFilters(defaultFilters())
                      : setModal({ type: "edit", kind: "task" })
                  }
                  disabled={session.blocked}
                >
                  {workspace.tasks.length
                    ? "Reset filters"
                    : "Create your first task"}
                </button>
              </div>
            ) : (
              <ul className="task-list">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className={
                      task.status === "done" ? "task-row is-done" : "task-row"
                    }
                  >
                    <button
                      className="complete"
                      aria-label={`${task.status === "done" ? "Reopen" : "Complete"} ${task.title}`}
                      aria-pressed={task.status === "done"}
                      onClick={() =>
                        attempt({
                          type: "status",
                          id: task.id,
                          status: task.status === "done" ? "todo" : "done",
                          at: new Date().toISOString(),
                        })
                      }
                    >
                      {task.status === "done" ? "✓" : ""}
                    </button>
                    <div className="task-content">
                      <button
                        className="task-title"
                        onClick={() =>
                          setModal({ type: "edit", kind: "task", item: task })
                        }
                      >
                        {task.title}
                      </button>
                      <p className="task-excerpt">{task.body}</p>
                      <div className="task-metadata">
                        <span className={`priority priority-${task.priority}`}>
                          {task.priority}
                        </span>
                        <span className={`status status-${task.status}`}>
                          {labels[task.status]}
                        </span>
                        {task.due && (
                          <time dateTime={task.due}>
                            {displayDate(task.due)}
                          </time>
                        )}
                      </div>
                      <div className="task-bottom">
                        <span className="tags">
                          {task.tags.map((t) => (
                            <span key={t}>#{t}</span>
                          ))}
                        </span>
                        {task.noteIds.length > 0 && (
                          <span className="note-links">
                            {task.noteIds.map((id) => {
                              const note = workspace.notes.find(
                                (n) => n.id === id,
                              )!;
                              return (
                                <button
                                  key={id}
                                  title={`Open ${note.title}`}
                                  onClick={() => {
                                    setFilters({
                                      ...defaultFilters(),
                                      archive: note.archived,
                                    });
                                    setSelectedId(id);
                                    setPanel("notes");
                                  }}
                                >
                                  {note.title}
                                </button>
                              );
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="panel-footnote">
              PROGRESS IS A PRACTICE, NOT A RACE.
            </p>
          </section>
          <section
            className={`notes-panel ${panel === "notes" ? "mobile-active" : ""}`}
            aria-labelledby="notes-title"
          >
            <div className="section-heading">
              <h2 id="notes-title">
                Notes in the margins
                <span className="count">
                  {notes.length.toString().padStart(2, "0")}
                </span>
              </h2>
              <p>A place for the thinking behind the doing.</p>
            </div>
            {notes.length === 0 ? (
              <div className="empty note-paper">
                <span aria-hidden="true">¶</span>
                <h3>
                  {workspace.notes.length
                    ? "No notes match this view."
                    : "An open page."}
                </h3>
                <p>
                  {workspace.notes.length
                    ? "Clear the filters to find your notes. Status and priority only match tasks."
                    : "Capture a question, a plan or a good observation."}
                </p>
                <button
                  onClick={() =>
                    workspace.notes.length
                      ? setFilters(defaultFilters())
                      : setModal({ type: "edit", kind: "note" })
                  }
                  disabled={session.blocked}
                >
                  {workspace.notes.length
                    ? "Reset filters"
                    : "Write your first note"}
                </button>
              </div>
            ) : (
              <>
                <div className="note-picker" aria-label="Choose a note">
                  {notes.map((note, i) => (
                    <button
                      key={note.id}
                      aria-pressed={selected?.id === note.id}
                      onClick={() => setSelectedId(note.id)}
                    >
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {note.title}
                    </button>
                  ))}
                </div>
                {selected && (
                  <article className="note-paper">
                    <div className="note-topline">
                      <span className="eyebrow">
                        FIELD NOTES /{" "}
                        {selected.archived ? "ARCHIVED" : "OPEN PAGE"}
                      </span>
                      <button
                        onClick={() =>
                          setModal({
                            type: "edit",
                            kind: "note",
                            item: selected,
                          })
                        }
                      >
                        Edit note <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                    <h2 className="note-title">{selected.title}</h2>
                    <div className="note-date">
                      EDITED {displayDate(selected.updatedAt.slice(0, 10))}{" "}
                      <span>
                        ·{" "}
                        {selected.body.trim()
                          ? selected.body.trim().split(/\s+/).length
                          : 0}{" "}
                        WORDS
                      </span>
                    </div>
                    {selected.body ? (
                      <Markdown text={selected.body} />
                    ) : (
                      <p className="hint">
                        This page is waiting for your words. Choose Edit note to
                        begin.
                      </p>
                    )}
                    <div className="note-footer">
                      <span className="tags">
                        {selected.tags.map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                      </span>
                      <span className="eyebrow">END OF NOTE / ❋</span>
                    </div>
                    <div className="backlinks">
                      <h3>Connected tasks</h3>
                      {workspace.tasks
                        .filter((t) => t.noteIds.includes(selected.id))
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() =>
                              setModal({ type: "edit", kind: "task", item: t })
                            }
                          >
                            {t.title}{" "}
                            <span>
                              {t.archived ? "Archived" : labels[t.status]}
                            </span>
                          </button>
                        ))}
                      {!workspace.tasks.some((t) =>
                        t.noteIds.includes(selected.id),
                      ) && (
                        <p className="hint">
                          No linked tasks yet. Add a link when editing a task.
                        </p>
                      )}
                    </div>
                  </article>
                )}
              </>
            )}
          </section>
        </div>
        <footer className="page-footer">
          <span>MARGIN / A PERSONAL FIELD NOTEBOOK</span>
          <span>Your ideas stay on this device.</span>
        </footer>
      </main>
      {editor && (
        <Editor
          key={`${editor.kind}-${editor.item?.id ?? "new"}`}
          kind={editor.kind}
          item={editor.item}
          workspace={workspace}
          onSave={commit}
          onClose={() => setModal(null)}
          onArchive={() =>
            editor.item && destructive(editor.kind, editor.item, "archive")
          }
          onDelete={() =>
            editor.item && destructive(editor.kind, editor.item, "delete")
          }
        />
      )}
      {modal?.type === "confirm" && (
        <Dialog
          title={modal.title}
          onClose={() => {
            setModal(null);
            setError("");
          }}
        >
          <p className="confirmation-copy">{modal.description}</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              data-initial
              onClick={() => {
                setModal(null);
                setError("");
              }}
            >
              Cancel
            </button>
            <button className="primary" onClick={() => attempt(modal.action)}>
              {modal.accept}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
