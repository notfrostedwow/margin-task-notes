import { useState, type FormEvent } from "react";
import { Dialog } from "./Dialog";
import {
  LIMITS,
  type Note,
  type Task,
  type Workspace,
  type Action,
  type Priority,
  type Status,
} from "./domain";
export function Editor({
  kind,
  item,
  workspace,
  onSave,
  onClose,
  onArchive,
  onDelete,
}: {
  kind: "task" | "note";
  item?: Task | Note;
  workspace: Workspace;
  onSave: (action: Action) => void;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [error, setError] = useState("");
  const task = kind === "task" ? (item as Task | undefined) : undefined;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const note: Note = {
      id: item?.id ?? crypto.randomUUID(),
      title: String(data.get("title")).trim(),
      body: String(data.get("body")),
      tags: [
        ...new Set(
          String(data.get("tags"))
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
        ),
      ],
      archived: item?.archived ?? false,
      updatedAt: new Date().toISOString(),
    };
    try {
      onSave(
        kind === "note"
          ? { type: "save-note", note }
          : {
              type: "save-task",
              task: {
                ...note,
                status: data.get("status") as Status,
                priority: data.get("priority") as Priority,
                due: String(data.get("due")) || null,
                noteIds: data.getAll("noteIds").map(String),
              },
            },
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save.");
    }
  }
  return (
    <Dialog title={`${item ? "Edit" : "New"} ${kind}`} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Title
          <input
            data-initial
            name="title"
            defaultValue={item?.title ?? ""}
            maxLength={LIMITS.title}
            required
          />
        </label>
        <label>
          {kind === "note" ? "Content" : "Details"}
          <textarea
            name="body"
            defaultValue={item?.body ?? ""}
            maxLength={LIMITS.body}
            rows={kind === "note" ? 10 : 4}
          />
        </label>
        <p className="hint">
          Plain text with # headings, - lists and &gt; quotes. HTML and links
          stay text.
        </p>
        <label>
          Tags, separated by commas
          <input
            name="tags"
            defaultValue={item?.tags.join(", ") ?? ""}
            maxLength={371}
            placeholder="fieldwork, planning"
          />
        </label>
        <p className="hint">
          Up to 12 tags per item; lowercase letters, numbers, spaces and
          hyphens.
        </p>
        {kind === "task" && (
          <>
            <div className="form-grid">
              <label>
                Status
                <select name="status" defaultValue={task?.status ?? "todo"}>
                  <option value="todo">To do</option>
                  <option value="doing">In progress</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  name="priority"
                  defaultValue={task?.priority ?? "normal"}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                Due date
                <input
                  type="date"
                  name="due"
                  min="1900-01-01"
                  max="2200-12-31"
                  defaultValue={task?.due ?? ""}
                />
              </label>
            </div>
            <fieldset>
              <legend>
                Linked notes <span className="hint">(up to 30)</span>
              </legend>
              {workspace.notes.length === 0 && (
                <p className="hint">Create a note first, then link it here.</p>
              )}
              <div className="link-options">
                {workspace.notes.map((note) => (
                  <label className="check-label" key={note.id}>
                    <input
                      type="checkbox"
                      name="noteIds"
                      value={note.id}
                      defaultChecked={task?.noteIds.includes(note.id)}
                    />
                    {note.title}
                    {note.archived ? " (archived)" : ""}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save {kind}
          </button>
        </div>
        {item && (
          <div className="item-actions">
            <button type="button" onClick={onArchive}>
              {item.archived ? "Restore from archive" : "Archive " + kind}
            </button>
            <button type="button" className="danger-text" onClick={onDelete}>
              Delete {kind}
            </button>
          </div>
        )}
      </form>
    </Dialog>
  );
}
