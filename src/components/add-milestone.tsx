"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, X } from "lucide-react";

type NoteOption = {
  slug: string;
  title: string;
};

type AddMilestoneProps = {
  notes: NoteOption[];
};

const MILESTONE_TYPES = ["Milestone", "Exam", "Checkpoint", "Review", "Deadline", "Practice"];

export function AddMilestone({ notes }: AddMilestoneProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState(MILESTONE_TYPES[0]);
  const [slug, setSlug] = useState(notes[0]?.slug ?? "");
  const [status, setStatus] = useState<{
    kind: "idle" | "saving" | "done" | "error";
    message: string;
  }>({
    kind: "idle",
    message: "",
  });

  async function submitMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "saving", message: "Saving..." });

    try {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, title, date, type, note }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus({ kind: "error", message: result.message ?? "Could not save this milestone." });
        return;
      }

      setStatus({ kind: "done", message: result.message ?? "Milestone added." });
      setTitle("");
      setDate("");
      setNote("");
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Could not reach the milestone API." });
    }
  }

  if (notes.length === 0) {
    return null;
  }

  if (!isOpen) {
    return (
      <div className="add-milestone-toggle">
        <button className="save-action" type="button" onClick={() => setIsOpen(true)}>
          <CalendarPlus size={17} aria-hidden="true" />
          Add Milestone
        </button>
        {status.kind === "done" ? (
          <span className="add-milestone-status done">{status.message}</span>
        ) : null}
      </div>
    );
  }

  return (
    <section className="add-milestone-panel" aria-labelledby="add-milestone-title">
      <div className="add-milestone-heading">
        <h2 id="add-milestone-title">Add a milestone</h2>
        <button
          className="icon-button"
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close milestone form"
        >
          <X size={17} />
        </button>
      </div>
      <p>Saved into the chosen note&apos;s frontmatter, so your files stay the source of truth.</p>

      <form className="add-milestone-form" onSubmit={submitMilestone}>
        <label>
          Title
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Book the exam"
          />
        </label>
        <label>
          Date
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {MILESTONE_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Attach to note
          <select value={slug} onChange={(event) => setSlug(event.target.value)}>
            {notes.map((noteOption) => (
              <option key={noteOption.slug} value={noteOption.slug}>
                {noteOption.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Note (optional)
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Target score 80%+"
          />
        </label>
        <div className="add-milestone-actions">
          <button className="save-action" type="submit" disabled={status.kind === "saving"}>
            {status.kind === "saving" ? "Saving..." : "Save Milestone"}
          </button>
          {status.kind !== "idle" && status.kind !== "saving" ? (
            <span className={`add-milestone-status ${status.kind}`}>{status.message}</span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
