"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clipboard, FileUp, Save } from "lucide-react";
import { slugify, stripFrontmatter } from "@/lib/content-utils";

// Note types: the four Diataxis modes plus a general "Lesson" fallback. Flat
// list — the field is labelled "note type", so Lesson isn't mislabelled as
// Diataxis and needs no separate group. "Plan" is a separate document type.
const NOTE_MODE_OPTIONS = ["Tutorial", "How-to", "Reference", "Explanation", "Lesson"];
const PLAN_MODE = "Plan";
const NEW_SECTION_VALUE = "__new__";

// Diataxis puts each mode to a different job, so each gets its own starting
// structure. Templates begin at H2 — the reader renders the frontmatter title
// as the page's single H1, so a body-level H1 would duplicate it.
const BODY_TEMPLATES: Record<string, string> = {
  Tutorial: `Tell the learner what they will build and why it is worth their time.

## Before you start

- What they should already know or have installed.

## What you will build

A short description of the finished result.

## Steps

1. Do the first small step, and show the result.
2. Build on it with the next step.
3. Check the outcome together.

## What you learned

Recap the skills this tutorial practised.

## Next steps

- Point to a follow-on tutorial or a related how-to.
`,
  "How-to": `State the goal this guide accomplishes in one sentence.

## Before you start

- Prerequisites, access, or tools the reader needs.

## Steps

1. First action to take.
2. Next action.
3. Final action.

## Verify it worked

How the reader confirms the goal is met.

## Troubleshooting

- **Symptom:** likely cause and the fix.
`,
  Reference: `One sentence describing what this reference covers.

## At a glance

| Item | Description |
| --- | --- |
| Example | What it does |

## Details

Describe each item, option, or parameter precisely and completely.

## Example

\`\`\`text
Show a minimal, correct usage example.
\`\`\`
`,
  Explanation: `Introduce the topic and the question this note answers.

## Background

The context a reader needs to follow the discussion.

## Key idea

Explain the core concept clearly.

## Why it matters

Consequences, trade-offs, and how this connects to other ideas.

## See also

- Related notes or references.
`,
  Lesson: `Start with one clear outcome for the learner.

## When to use

Describe the situation where this note helps.

## Fast path

1. Do the first small step.
2. Check the result.
3. Capture the output.

## Example

Add a practical example here.
`,
  Plan: `## Annual Thesis

Write the one-sentence bet for the year.

## Target Outcomes

- [ ] Outcome 1, with the evidence that proves it.
- [ ] Outcome 2, with evidence.
- [ ] Outcome 3, with evidence.

## Quarterly Focus

| Quarter | Primary focus | Secondary focus | Evidence to produce |
| --- | --- | --- | --- |
| Q1 | | | |
| Q2 | | | |
| Q3 | | | |
| Q4 | | | |

## Weekly Operating System

| Day | Work |
| --- | --- |
| Mon | |
| Tue | |
| Wed | |
| Thu | |
| Fri | |
| Sat | |
| Sun | |

## Stop Doing

- Do not add a new major track unless it serves the annual thesis.
- Do not count reading as progress unless it changes code, writing, or decisions.
`,
};

// One-line reminder of what each Diataxis mode is for, shown under the picker.
const MODE_HINTS: Record<string, string> = {
  Tutorial: "Learning-oriented: a guided lesson that builds something end to end.",
  "How-to": "Task-oriented: numbered steps to accomplish one specific goal.",
  Reference: "Information-oriented: precise, lookup-friendly facts and options.",
  Explanation: "Understanding-oriented: the background and reasoning behind a topic.",
  Lesson: "A general-purpose note structure.",
  Plan: "Time-boxed strategy: thesis, outcomes, and quarterly focus. Set a year to show it on /plans.",
};

const DEFAULT_MODE = "How-to";
// The set of pristine templates, used to tell an untouched body from an edited
// one so switching modes never overwrites the learner's own writing.
const TEMPLATE_BODIES = new Set(Object.values(BODY_TEMPLATES));

function templateFor(mode: string): string {
  return BODY_TEMPLATES[mode] ?? BODY_TEMPLATES.Lesson;
}

type StudioSection = {
  slug: string;
  title: string;
};

type StudioForm = {
  title: string;
  slug: string;
  description: string;
  section: string;
  mode: string;
  level: string;
  duration: string;
  /** Only used for Plan mode; groups the plan on /plans. Empty otherwise. */
  year: string;
  extension: "md" | "mdx";
  body: string;
};

type SaveStatus =
  | { type: "idle"; message: string; href?: string }
  | { type: "success"; message: string; href: string }
  | { type: "error"; message: string; href?: string };

type ContentStudioProps = {
  sections?: StudioSection[];
  initialSection?: string;
  /** When "plan", the studio opens in Plan mode (from the /plans "Write a Plan" link). */
  initialType?: string;
};

export function ContentStudio({ sections = [], initialSection, initialType }: ContentStudioProps) {
  const initialMode = initialType === "plan" ? PLAN_MODE : DEFAULT_MODE;
  const [form, setForm] = useState<StudioForm>({
    title: "",
    slug: "",
    description: "",
    section: resolveInitialSectionTitle(sections, initialSection),
    mode: initialMode,
    level: "Beginner",
    duration: "10 min",
    year: "",
    extension: "md",
    body: templateFor(initialMode),
  });
  const [isNewSection, setIsNewSection] = useState(sections.length === 0);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>({
    type: "idle",
    message: "Ready to add a Markdown note.",
  });

  const fileSlug = slugify(form.slug || form.title || "new-note");
  const sectionSlug = slugify(form.section || "general");
  const filePath = `content/learn/${sectionSlug}/${fileSlug}.${form.extension}`;
  const generatedMarkdown = buildMarkdown(form);

  function updateField(field: keyof StudioForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
      slug: field === "title" && !currentForm.slug ? slugify(value) : currentForm.slug,
    }));
  }

  const isPlan = form.mode === PLAN_MODE;

  // Switching mode swaps the starting structure, but only when the body is an
  // untouched template — so a learner's own writing is never overwritten.
  function handleModeChange(nextMode: string) {
    setForm((currentForm) => {
      const bodyIsPristine =
        TEMPLATE_BODIES.has(currentForm.body) || currentForm.body.trim() === "";
      return {
        ...currentForm,
        mode: nextMode,
        body: bodyIsPristine ? templateFor(nextMode) : currentForm.body,
      };
    });
  }

  // The Note/Plan toggle picks a document type. A Note carries a Diataxis mode;
  // a Plan is its own type with a year. Switching only rewrites a pristine body.
  function handleDocTypeChange(nextType: "note" | "plan") {
    const nextMode = nextType === "plan" ? PLAN_MODE : DEFAULT_MODE;
    if (nextMode === form.mode) {
      return;
    }
    handleModeChange(nextMode);
  }

  const bodyMatchesTemplate = form.body === templateFor(form.mode);

  function resetBodyToTemplate() {
    setForm((currentForm) => ({ ...currentForm, body: templateFor(currentForm.mode) }));
    setStatus({ type: "idle", message: `Reset to the ${form.mode} template.` });
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    const text = await selectedFile.text();
    const inferredTitle = findFirstHeading(text) || titleFromFileName(selectedFile.name);
    const inferredExtension = selectedFile.name.endsWith(".mdx") ? "mdx" : "md";

    setForm((currentForm) => ({
      ...currentForm,
      title: currentForm.title || inferredTitle,
      slug: currentForm.slug || slugify(inferredTitle),
      extension: inferredExtension,
      body: stripFrontmatter(text),
    }));
    setStatus({ type: "idle", message: `Loaded ${selectedFile.name}. Review it, then save.` });
  }

  async function handleCopyTemplate() {
    try {
      await navigator.clipboard.writeText(generatedMarkdown);
      setStatus({
        type: "success",
        message: "Template copied. You can paste it into any .md or .mdx file.",
        href: `/learn/${sectionSlug}/${fileSlug}`,
      });
    } catch {
      setStatus({
        type: "error",
        message: "Copy failed. Select the preview text and copy it manually.",
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus({ type: "idle", message: "Saving content file..." });

    try {
      const response = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { message?: string; href?: string };

      if (!response.ok || !result.href) {
        throw new Error(result.message || "Could not save this content file.");
      }

      setStatus({
        type: "success",
        message: result.message || "Content saved.",
        href: result.href,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not save this content file.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="studio-grid">
      <form className="studio-panel" onSubmit={handleSubmit}>
        <div className="studio-panel-heading">
          <span className="content-badge">Local content studio</span>
          <h2>Add Markdown without touching code</h2>
          <p>
            Paste a note, upload a `.md` or `.mdx` file, then save it into the learning library.
          </p>
        </div>

        <div className="studio-doctype-field">
          <div className="studio-doctype" role="group" aria-label="Document type">
            <button
              type="button"
              className={isPlan ? "studio-doctype-option" : "studio-doctype-option active"}
              aria-pressed={!isPlan}
              onClick={() => handleDocTypeChange("note")}
            >
              Note
            </button>
            <button
              type="button"
              className={isPlan ? "studio-doctype-option active" : "studio-doctype-option"}
              aria-pressed={isPlan}
              onClick={() => handleDocTypeChange("plan")}
            >
              Plan
            </button>
          </div>
          <small className="field-note">
            {isPlan
              ? "Plan — a time-boxed strategy for a year (thesis, outcomes, quarterly focus). Shows on /plans."
              : "Note — a learning document (Tutorial, How-to, Reference, Explanation, or Lesson)."}
          </small>
        </div>

        <label className="studio-upload">
          <FileUp size={20} aria-hidden="true" />
          <span>
            <strong>Upload `.md` or `.mdx`</strong>
            <small>Optional. The editor will fill the note body from the file.</small>
          </span>
          <input type="file" accept=".md,.mdx,text/markdown" onChange={handleFileUpload} />
        </label>

        <div className="studio-two-column">
          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="TDD Notes"
              required
            />
          </label>
          <label>
            Slug
            <input
              value={form.slug}
              onChange={(event) => updateField("slug", event.target.value)}
              placeholder="tdd-notes"
            />
          </label>
        </div>

        <label>
          Description
          <input
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="A short sentence that tells learners when to open this note."
            required
          />
        </label>

        <div className="studio-two-column">
          <label>
            Section
            {isNewSection ? (
              <>
                <input
                  value={form.section}
                  onChange={(event) => updateField("section", event.target.value)}
                  placeholder="New section name"
                  autoFocus
                  required
                />
                {sections.length > 0 ? (
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => {
                      setIsNewSection(false);
                      updateField("section", sections[0]?.title ?? "");
                    }}
                  >
                    Choose an existing section instead
                  </button>
                ) : null}
              </>
            ) : (
              <select
                value={form.section}
                onChange={(event) => {
                  if (event.target.value === NEW_SECTION_VALUE) {
                    setIsNewSection(true);
                    updateField("section", "");
                    return;
                  }
                  updateField("section", event.target.value);
                }}
              >
                {sections.map((section) => (
                  <option value={section.title} key={section.slug || "__general"}>
                    {section.title}
                  </option>
                ))}
                <option value={NEW_SECTION_VALUE}>＋ New section…</option>
              </select>
            )}
          </label>
          {isPlan ? (
            <label>
              Plan Year
              <input
                value={form.year}
                onChange={(event) => updateField("year", event.target.value)}
                placeholder="2026"
                inputMode="numeric"
              />
              <small className="field-note">
                Groups this plan on the /plans page. Leave blank for an undated plan.
              </small>
            </label>
          ) : (
            <label>
              Mode <span className="field-hint">(note type)</span>
              <select value={form.mode} onChange={(event) => handleModeChange(event.target.value)}>
                {NOTE_MODE_OPTIONS.map((mode) => (
                  <option value={mode} key={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <small className="field-note">{MODE_HINTS[form.mode] ?? MODE_HINTS.Lesson}</small>
            </label>
          )}
        </div>

        {isPlan ? (
          <label>
            Format
            <select
              value={form.extension}
              onChange={(event) => updateField("extension", event.target.value)}
            >
              <option value="md">.md</option>
              <option value="mdx">.mdx</option>
            </select>
          </label>
        ) : (
          <div className="studio-three-column">
            <label>
              Level
              <input
                value={form.level}
                onChange={(event) => updateField("level", event.target.value)}
                placeholder="Beginner"
              />
            </label>
            <label>
              Duration
              <input
                value={form.duration}
                onChange={(event) => updateField("duration", event.target.value)}
                placeholder="10 min"
              />
            </label>
            <label>
              Format
              <select
                value={form.extension}
                onChange={(event) => updateField("extension", event.target.value)}
              >
                <option value="md">.md</option>
                <option value="mdx">.mdx</option>
              </select>
            </label>
          </div>
        )}

        <label>
          <span className="studio-label-row">
            Note Body
            {!bodyMatchesTemplate ? (
              <button className="link-button" type="button" onClick={resetBodyToTemplate}>
                Reset to {form.mode} template
              </button>
            ) : null}
          </span>
          <textarea
            value={form.body}
            onChange={(event) => updateField("body", event.target.value)}
            rows={16}
            required
          />
        </label>

        <div
          className={
            status.type === "error"
              ? "studio-status error"
              : status.type === "success"
                ? "studio-status success"
                : "studio-status"
          }
        >
          {status.type === "error" ? (
            <AlertCircle size={18} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} aria-hidden="true" />
          )}
          <span>{status.message}</span>
          {status.href ? <Link href={status.href}>Open note</Link> : null}
        </div>

        <div className="studio-actions">
          <button className="secondary-action" type="button" onClick={handleCopyTemplate}>
            <Clipboard size={17} aria-hidden="true" />
            Copy Template
          </button>
          <button className="save-action" type="submit" disabled={isSaving}>
            <Save size={17} aria-hidden="true" />
            {isSaving ? "Saving..." : "Save Content"}
          </button>
        </div>
      </form>

      <aside className="studio-preview" aria-label="Markdown preview">
        <div>
          <span className="content-badge">Generated file</span>
          <strong>{filePath}</strong>
          <p>
            After saving, this note appears automatically in the Learn library and gets its own
            page.
          </p>
        </div>
        <pre>{generatedMarkdown}</pre>
      </aside>
    </div>
  );
}

function buildMarkdown(form: StudioForm): string {
  const frontmatter = [
    "---",
    `title: ${yamlString(form.title || "New Note")}`,
    `description: ${yamlString(form.description || "Learning note")}`,
    `section: ${yamlString(form.section || "General")}`,
    `mode: ${yamlString(form.mode || "Lesson")}`,
    `level: ${yamlString(form.level || "Any level")}`,
    `duration: ${yamlString(form.duration || "Self-paced")}`,
    ...(form.mode === "Plan" && /^\d{4}$/.test(form.year.trim())
      ? [`year: ${form.year.trim()}`]
      : []),
    `updated: ${yamlString(new Date().toISOString().slice(0, 10))}`,
    "order: 100",
    "---",
    "",
  ].join("\n");

  return `${frontmatter}${stripFrontmatter(form.body).trim()}\n`;
}

function yamlString(value: string): string {
  return JSON.stringify(value.trim());
}

function findFirstHeading(value: string): string {
  const match = stripFrontmatter(value).match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? "";
}

/** Preselect the section from a ?section=slug, else the first existing section. */
function resolveInitialSectionTitle(sections: StudioSection[], initialSection?: string): string {
  if (initialSection) {
    const match = sections.find((section) => section.slug === initialSection);
    if (match) {
      return match.title;
    }
  }

  return sections[0]?.title ?? "";
}

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.(mdx|md)$/i, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
