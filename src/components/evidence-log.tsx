"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Award, ClipboardList, MessageSquare, Pencil, PlusCircle, Trash2, X } from "lucide-react";
import {
  addEvidence,
  deleteEvidence,
  updateEvidence,
  useEvidence,
  type EvidenceDraft,
} from "@/lib/progress";
import { EVIDENCE_KINDS, type EvidenceEntry, type EvidenceKind } from "@/lib/evidence";

type SectionOption = { slug: string; title: string };

type EvidenceLogProps = {
  /** Sections a piece of evidence can be attached to. */
  sections: SectionOption[];
};

function sectionOptionValue(section: SectionOption): string {
  return section.slug || `title:${section.title}`;
}

/**
 * Which section select value an existing entry maps to. Prefers a slug match,
 * then a title match (so legacy or renamed entries still resolve), else none.
 */
function initialSectionValue(
  initial: EvidenceEntry | undefined,
  sections: SectionOption[],
): string {
  if (!initial) {
    return "";
  }

  if (initial.sectionSlug) {
    const bySlug = sections.find((section) => section.slug === initial.sectionSlug);
    if (bySlug) {
      return sectionOptionValue(bySlug);
    }
  }

  const byTitle = sections.find((section) => section.title === initial.section);
  return byTitle ? sectionOptionValue(byTitle) : "";
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

type EvidenceFormProps = {
  sections: SectionOption[];
  initial?: EvidenceEntry;
  submitLabel: string;
  /** Returns the saved entry, or null when the input was rejected. */
  onSubmit: (draft: EvidenceDraft) => EvidenceEntry | null;
  onDone: () => void;
};

/** The shared add/edit form. In edit mode it is seeded from `initial`. */
function EvidenceForm({ sections, initial, submitLabel, onSubmit, onDone }: EvidenceFormProps) {
  const [kind, setKind] = useState<EvidenceKind>(initial?.kind ?? "Build");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sectionValue, setSectionValue] = useState(() => initialSectionValue(initial, sections));
  const [source, setSource] = useState(initial?.source ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");

  const isFeedback = kind === "Feedback";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const selected = sections.find((option) => sectionOptionValue(option) === sectionValue);
    const saved = onSubmit({
      kind,
      title,
      sectionSlug: selected?.slug ?? "",
      section: selected?.title ?? "",
      source: isFeedback ? source : "",
      link,
      note,
    });

    if (!saved) {
      setError("Add a short title so this evidence is worth keeping.");
      return;
    }

    onDone();
  }

  return (
    <form className="add-milestone-form" onSubmit={submit}>
      <label>
        Kind
        <select value={kind} onChange={(event) => setKind(event.target.value as EvidenceKind)}>
          {EVIDENCE_KINDS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            isFeedback ? "Reviewer said my error handling leaked" : "Refactored the ingest pipeline"
          }
        />
      </label>
      {isFeedback ? (
        <label>
          From whom
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Mentor, reviewer, teammate"
          />
        </label>
      ) : null}
      <label>
        Section (optional)
        <select value={sectionValue} onChange={(event) => setSectionValue(event.target.value)}>
          <option value="">No section</option>
          {sections.map((option) => (
            <option key={sectionOptionValue(option)} value={sectionOptionValue(option)}>
              {option.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Link (optional)
        <input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="https://... or /learn/..."
        />
      </label>
      <label>
        Detail (optional)
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What changed and why"
        />
      </label>
      <div className="add-milestone-actions">
        <button className="save-action" type="submit">
          {submitLabel}
        </button>
        {error ? <span className="add-milestone-status error">{error}</span> : null}
      </div>
    </form>
  );
}

export function EvidenceLog({ sections }: EvidenceLogProps) {
  const evidence = useEvidence();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const feedbackCount = useMemo(
    () => evidence.filter((entry) => entry.kind === "Feedback").length,
    [evidence],
  );

  return (
    <>
      <div className="add-milestone-toggle">
        <button className="save-action" type="button" onClick={() => setIsAdding((open) => !open)}>
          <PlusCircle size={17} aria-hidden="true" />
          Log Evidence
        </button>
        <span className="evidence-count">
          {evidence.length} logged · {feedbackCount} feedback
        </span>
      </div>

      {isAdding ? (
        <section className="add-milestone-panel" aria-labelledby="log-evidence-title">
          <div className="add-milestone-heading">
            <h2 id="log-evidence-title">Log a piece of evidence</h2>
            <button
              className="icon-button"
              type="button"
              onClick={() => setIsAdding(false)}
              aria-label="Close evidence form"
            >
              <X size={17} />
            </button>
          </div>
          <p>
            Record what you produced or the feedback you received. This is what the scorecard
            rewards, so keep it real.
          </p>
          <EvidenceForm
            sections={sections}
            submitLabel="Save Evidence"
            onSubmit={addEvidence}
            onDone={() => setIsAdding(false)}
          />
        </section>
      ) : null}

      {evidence.length > 0 ? (
        <div className="evidence-list">
          {evidence.map((entry) =>
            editingId === entry.id ? (
              <section
                className="add-milestone-panel"
                key={entry.id}
                aria-label={`Edit evidence ${entry.title}`}
              >
                <div className="add-milestone-heading">
                  <h2>Edit evidence</h2>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel editing"
                  >
                    <X size={17} />
                  </button>
                </div>
                <EvidenceForm
                  sections={sections}
                  initial={entry}
                  submitLabel="Save changes"
                  onSubmit={(draft) => updateEvidence(entry.id, draft)}
                  onDone={() => setEditingId(null)}
                />
              </section>
            ) : (
              <article className="evidence-card" key={entry.id}>
                <div className="evidence-card-icon" aria-hidden="true">
                  {entry.kind === "Feedback" ? <MessageSquare size={18} /> : <Award size={18} />}
                </div>
                <div className="evidence-card-body">
                  <div className="evidence-card-tags">
                    <span
                      className={entry.kind === "Feedback" ? "content-badge auto" : "content-badge"}
                    >
                      {entry.kind}
                    </span>
                    {entry.section ? (
                      <span className="evidence-section">{entry.section}</span>
                    ) : null}
                    <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                  </div>
                  <h3>
                    {entry.link ? (
                      <a
                        href={entry.link}
                        target={entry.link.startsWith("/") ? undefined : "_blank"}
                        rel="noreferrer"
                      >
                        {entry.title}
                      </a>
                    ) : (
                      entry.title
                    )}
                  </h3>
                  {entry.source ? (
                    <p className="evidence-source">Feedback from {entry.source}</p>
                  ) : null}
                  {entry.note ? <p>{entry.note}</p> : null}
                </div>
                <div className="evidence-card-actions">
                  <button
                    className="milestone-action"
                    type="button"
                    onClick={() => {
                      setEditingId(entry.id);
                      setIsAdding(false);
                    }}
                    aria-label={`Edit evidence ${entry.title}`}
                    title="Edit evidence"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    className="milestone-action danger"
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete evidence "${entry.title}"?`)) {
                        deleteEvidence(entry.id);
                      }
                    }}
                    aria-label={`Delete evidence ${entry.title}`}
                    title="Delete evidence"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ),
          )}
        </div>
      ) : (
        <p className="empty-note">
          <ClipboardList size={16} aria-hidden="true" /> No evidence yet. When you build something,
          refactor, write, or get feedback, log it here — that is what turns reading into mastery.
        </p>
      )}
    </>
  );
}
