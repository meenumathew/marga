"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";

type MilestoneActionsProps = {
  /** Stable frontmatter id for the milestone. */
  id: string;
  slug: string;
  /** Position within the note's milestones array; identifies which one to edit/delete. */
  index: number;
  title: string;
  date: string;
  type: string;
  note: string;
};

const MILESTONE_TYPES = ["Milestone", "Exam", "Checkpoint", "Review", "Deadline", "Practice"];

export function MilestoneActions({
  id,
  slug,
  index,
  title,
  date,
  type,
  note,
}: MilestoneActionsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDate, setDraftDate] = useState(date);
  const [draftType, setDraftType] = useState(MILESTONE_TYPES.includes(type) ? type : "Milestone");
  const [draftNote, setDraftNote] = useState(note);
  const [error, setError] = useState("");

  async function deleteMilestone() {
    if (!window.confirm(`Delete milestone "${title}"?`)) {
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch("/api/milestones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id, index, title, date }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const result = (await response.json()) as { message?: string };
        window.alert(result.message ?? "Could not delete this milestone.");
      }
    } catch {
      window.alert("Could not reach the milestone API.");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setError("");

    try {
      const response = await fetch("/api/milestones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          id,
          index,
          originalTitle: title,
          originalDate: date,
          title: draftTitle,
          date: draftDate,
          type: draftType,
          note: draftNote,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const result = (await response.json()) as { message?: string };
        setError(result.message ?? "Could not update this milestone.");
      }
    } catch {
      setError("Could not reach the milestone API.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <div className="milestone-actions">
        <button
          className="milestone-action"
          type="button"
          onClick={() => setIsEditing((open) => !open)}
          disabled={isBusy}
          aria-label={`Edit milestone ${title}`}
          title="Edit milestone"
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          className="milestone-action danger"
          type="button"
          onClick={deleteMilestone}
          disabled={isBusy}
          aria-label={`Delete milestone ${title}`}
          title="Delete milestone"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>

      {isEditing ? (
        <form className="milestone-edit-form" onSubmit={saveEdit}>
          <div className="milestone-edit-heading">
            <strong>Edit milestone</strong>
            <button
              className="icon-button"
              type="button"
              onClick={() => setIsEditing(false)}
              aria-label="Close edit form"
            >
              <X size={15} />
            </button>
          </div>
          <label>
            Title
            <input
              required
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
            />
          </label>
          <label>
            Date
            <input
              required
              type="date"
              value={draftDate}
              onChange={(event) => setDraftDate(event.target.value)}
            />
          </label>
          <label>
            Type
            <select value={draftType} onChange={(event) => setDraftType(event.target.value)}>
              {MILESTONE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Note (optional)
            <input
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder="Target score 80%+"
            />
          </label>
          <div className="milestone-edit-actions">
            <button className="save-action" type="submit" disabled={isBusy}>
              {isBusy ? "Saving..." : "Save Changes"}
            </button>
            {error ? <span className="add-milestone-status error">{error}</span> : null}
          </div>
        </form>
      ) : null}
    </>
  );
}
