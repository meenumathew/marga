"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Edit3,
  FilePlus2,
  FileText,
  FolderPen,
  FolderPlus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

export type NotesManagerItem = {
  slug: string;
  href: string;
  title: string;
  description: string;
  section: string;
  sectionSlug: string;
  mode: string;
  level: string;
  duration: string;
  updated: string;
  sourcePath: string;
};

export type NotesManagerSection = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  noteCount: number;
  editable: boolean;
};

type EditorState = {
  slug: string;
  title: string;
  content: string;
  status: string;
  isLoading: boolean;
  isSaving: boolean;
};

type ActionStatus = {
  type: "idle" | "success" | "error";
  message: string;
};

type NotesManagerProps = {
  sections: NotesManagerSection[];
  items: NotesManagerItem[];
};

/** Notes are collapsed to this many rows per section until "Show all" is used. */
const NOTES_PREVIEW_LIMIT = 8;

export function NotesManager({ sections, items }: NotesManagerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState("");
  const [status, setStatus] = useState<ActionStatus>({ type: "idle", message: "" });
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const notesBySection = useMemo(() => {
    const map = new Map<string, NotesManagerItem[]>();
    for (const note of items) {
      const bucket = map.get(note.sectionSlug) ?? [];
      bucket.push(note);
      map.set(note.sectionSlug, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [items]);

  function matchesQuery(note: NotesManagerItem) {
    if (!normalizedQuery) {
      return true;
    }
    return `${note.title} ${note.description} ${note.section} ${note.mode} ${note.level}`
      .toLowerCase()
      .includes(normalizedQuery);
  }

  async function runAction(key: string, request: () => Promise<Response>, fallbackError: string) {
    setBusyKey(key);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await request();
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? fallbackError);
      }

      setStatus({ type: "success", message: result.message ?? "Done." });
      router.refresh();
      return true;
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : fallbackError });
      return false;
    } finally {
      setBusyKey("");
    }
  }

  async function createSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newSectionName.trim();
    if (!title) {
      return;
    }

    const ok = await runAction(
      "section:create",
      () =>
        fetch("/api/sections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        }),
      "Could not create this section.",
    );

    if (ok) {
      setNewSectionName("");
      setNewSectionOpen(false);
    }
  }

  async function renameSection(event: FormEvent<HTMLFormElement>, slug: string) {
    event.preventDefault();
    const title = renameValue.trim();
    if (!title) {
      return;
    }

    const ok = await runAction(
      `section:rename:${slug}`,
      () =>
        fetch("/api/sections", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, title }),
        }),
      "Could not rename this section.",
    );

    if (ok) {
      setRenamingSlug(null);
      setRenameValue("");
    }
  }

  async function deleteSection(section: NotesManagerSection) {
    // Not "the empty section": no notes does not mean no files. The route checks
    // the folder for real and refuses if anything is left in it.
    if (
      !window.confirm(
        `Delete the section "${section.title}"? Its folder is removed only if nothing is left inside.`,
      )
    ) {
      return;
    }

    await runAction(
      `section:delete:${section.slug}`,
      () =>
        fetch("/api/sections", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: section.slug }),
        }),
      "Could not delete this section.",
    );
  }

  async function moveNote(note: NotesManagerItem, targetSlug: string) {
    if (targetSlug === note.sectionSlug) {
      return;
    }

    await runAction(
      `note:move:${note.slug}`,
      () =>
        fetch("/api/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: note.slug, sectionSlug: targetSlug }),
        }),
      "Could not move this note.",
    );
  }

  async function deleteNote(note: NotesManagerItem) {
    if (!window.confirm(`Delete note "${note.title}"? This removes ${note.sourcePath}.`)) {
      return;
    }

    const ok = await runAction(
      `note:delete:${note.slug}`,
      () =>
        fetch("/api/notes", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: note.slug }),
        }),
      "Could not delete this note.",
    );

    if (ok) {
      setEditor((current) => (current?.slug === note.slug ? null : current));
    }
  }

  async function openEditor(note: NotesManagerItem) {
    setEditor({
      slug: note.slug,
      title: note.title,
      content: "",
      status: "Loading source...",
      isLoading: true,
      isSaving: false,
    });
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`/api/notes?slug=${encodeURIComponent(note.slug)}`);
      const result = (await response.json()) as { raw?: string; message?: string };

      if (!response.ok || typeof result.raw !== "string") {
        throw new Error(result.message ?? "Could not load this note.");
      }

      setEditor({
        slug: note.slug,
        title: note.title,
        content: result.raw,
        status: "Editing Markdown source.",
        isLoading: false,
        isSaving: false,
      });
    } catch (error) {
      setEditor({
        slug: note.slug,
        title: note.title,
        content: "",
        status: error instanceof Error ? error.message : "Could not load this note.",
        isLoading: false,
        isSaving: false,
      });
    }
  }

  async function saveEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) {
      return;
    }

    setEditor({ ...editor, isSaving: true, status: "Saving note..." });

    try {
      const response = await fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: editor.slug, content: editor.content }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "Could not save this note.");
      }

      setEditor({ ...editor, isSaving: false, status: result.message ?? "Note saved." });
      router.refresh();
    } catch (error) {
      setEditor({
        ...editor,
        isSaving: false,
        status: error instanceof Error ? error.message : "Could not save this note.",
      });
    }
  }

  function startRename(section: NotesManagerSection) {
    setRenamingSlug(section.slug);
    setRenameValue(section.title);
  }

  return (
    <section className="notes-manager" aria-labelledby="notes-manager-title">
      <div className="notes-manager-heading">
        <div>
          <h2 id="notes-manager-title">Sections and notes</h2>
        </div>
        <div className="notes-manager-heading-actions">
          <button
            className="secondary-action"
            type="button"
            onClick={() => setNewSectionOpen((open) => !open)}
          >
            <FolderPlus size={16} aria-hidden="true" />
            New section
          </button>
          <Link className="secondary-action" href="/add-content">
            Add a new note
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {newSectionOpen ? (
        <form className="new-section-form" onSubmit={createSection}>
          <label>
            <span className="sr-only">New section name</span>
            <input
              value={newSectionName}
              onChange={(event) => setNewSectionName(event.target.value)}
              placeholder="New section name, e.g. Fundamentals"
              autoFocus
            />
          </label>
          <button
            className="save-action"
            type="submit"
            disabled={busyKey === "section:create" || !newSectionName.trim()}
          >
            <FolderPlus size={16} aria-hidden="true" />
            Create
          </button>
          <button
            className="mini-button"
            type="button"
            onClick={() => setNewSectionOpen(false)}
            aria-label="Cancel new section"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </form>
      ) : null}

      <label className="notes-manager-filter">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Filter notes</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter notes by title, section, or mode..."
        />
      </label>

      {status.message ? (
        <p className={`notes-manager-status ${status.type}`}>{status.message}</p>
      ) : null}

      <div className="notes-section-list">
        {sections.map((section) => {
          const allNotes = notesBySection.get(section.slug) ?? [];
          const matching = allNotes.filter(matchesQuery);
          const filtering = normalizedQuery.length > 0;

          // While filtering, only surface sections with matches and keep them open.
          if (filtering && matching.length === 0) {
            return null;
          }

          const isOpen = filtering || !(collapsed[section.slug] ?? false);
          const showEveryNote = filtering || (showAll[section.slug] ?? false);
          const visibleNotes = showEveryNote ? matching : matching.slice(0, NOTES_PREVIEW_LIMIT);
          const hiddenCount = matching.length - visibleNotes.length;
          const isRenaming = renamingSlug === section.slug;

          return (
            <article className="section-block" key={section.slug || "__general"}>
              <div className="section-block-head">
                <button
                  className="section-toggle"
                  type="button"
                  onClick={() =>
                    setCollapsed((current) => ({
                      ...current,
                      [section.slug]: !(current[section.slug] ?? false),
                    }))
                  }
                  aria-expanded={isOpen}
                  disabled={filtering}
                >
                  {isOpen ? (
                    <ChevronDown size={18} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={18} aria-hidden="true" />
                  )}
                  <span className="section-title">{section.title}</span>
                  <span className="section-count">
                    {section.noteCount} {section.noteCount === 1 ? "note" : "notes"}
                  </span>
                </button>

                <div className="section-block-actions">
                  {section.editable ? (
                    <Link
                      className="mini-button"
                      href={`/add-content?section=${encodeURIComponent(section.slug)}`}
                      title={`Add a note to ${section.title}`}
                    >
                      <FilePlus2 size={15} aria-hidden="true" />
                    </Link>
                  ) : null}
                  {section.editable ? (
                    <button
                      className="mini-button"
                      type="button"
                      onClick={() => startRename(section)}
                      title="Rename section"
                    >
                      <FolderPen size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                  {section.editable ? (
                    <button
                      className="mini-button danger"
                      type="button"
                      onClick={() => deleteSection(section)}
                      disabled={
                        section.noteCount > 0 || busyKey === `section:delete:${section.slug}`
                      }
                      title={
                        section.noteCount > 0 ? "Move or delete its notes first" : "Delete section"
                      }
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>

              {isRenaming ? (
                <form
                  className="section-rename-form"
                  onSubmit={(event) => renameSection(event, section.slug)}
                >
                  <label>
                    <span className="sr-only">Rename {section.title}</span>
                    <input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      autoFocus
                    />
                  </label>
                  <button
                    className="save-action"
                    type="submit"
                    disabled={busyKey === `section:rename:${section.slug}`}
                  >
                    <Save size={15} aria-hidden="true" />
                    Save
                  </button>
                  <button
                    className="mini-button"
                    type="button"
                    onClick={() => setRenamingSlug(null)}
                    aria-label="Cancel rename"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </form>
              ) : null}

              {isOpen ? (
                allNotes.length === 0 ? (
                  <p className="section-empty">
                    No notes yet.{" "}
                    {section.editable ? (
                      <Link href={`/add-content?section=${encodeURIComponent(section.slug)}`}>
                        Add the first note
                      </Link>
                    ) : null}
                  </p>
                ) : (
                  <div className="notes-list">
                    {visibleNotes.map((note) => (
                      <div className="note-row" key={note.slug}>
                        <div className="note-row-main">
                          <FileText size={20} aria-hidden="true" />
                          <div>
                            <Link href={note.href}>{note.title}</Link>
                            <p>{note.description}</p>
                            <span>
                              {note.mode} · {note.level} · {note.duration}
                            </span>
                          </div>
                        </div>

                        <div className="note-row-controls">
                          <label className="note-move-select">
                            <span className="sr-only">Move {note.title} to another section</span>
                            <select
                              value={note.sectionSlug}
                              onChange={(event) => moveNote(note, event.target.value)}
                              disabled={busyKey === `note:move:${note.slug}`}
                            >
                              {sections.map((option) => (
                                <option value={option.slug} key={option.slug || "__general"}>
                                  {option.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="mini-button"
                            type="button"
                            onClick={() => openEditor(note)}
                            title="Edit note"
                          >
                            <Edit3 size={15} aria-hidden="true" />
                          </button>
                          <button
                            className="mini-button danger"
                            type="button"
                            onClick={() => deleteNote(note)}
                            disabled={busyKey === `note:delete:${note.slug}`}
                            title="Delete note"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {hiddenCount > 0 ? (
                      <button
                        className="show-more-button"
                        type="button"
                        onClick={() =>
                          setShowAll((current) => ({ ...current, [section.slug]: true }))
                        }
                      >
                        Show {hiddenCount} more
                      </button>
                    ) : null}
                  </div>
                )
              ) : null}
            </article>
          );
        })}
      </div>

      {editor ? (
        <form className="note-editor-panel" onSubmit={saveEditor}>
          <div className="note-editor-heading">
            <div>
              <span className="content-badge">Markdown source</span>
              <h3>{editor.title}</h3>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setEditor(null)}
              aria-label="Close note editor"
            >
              <X size={17} />
            </button>
          </div>
          <textarea
            value={editor.content}
            onChange={(event) => setEditor({ ...editor, content: event.target.value })}
            rows={18}
            disabled={editor.isLoading}
          />
          <div className="note-editor-actions">
            <span>{editor.status}</span>
            <button
              className="save-action"
              type="submit"
              disabled={editor.isLoading || editor.isSaving}
            >
              <Save size={17} aria-hidden="true" />
              {editor.isSaving ? "Saving..." : "Save note"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
