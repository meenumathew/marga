---
title: "Add Your Content"
description: "How to add notes, plans, sections, and milestones to this site."
section: "Guides"
mode: "How-to"
level: "Beginner"
duration: "5 min"
updated: "2026-07-03"
order: 2
---

# Add Your Content

Everything on this site comes from Markdown files in `content/learn/`. No code changes are needed to add notes, plans, sections, or milestones.

## Add A Note

Two ways:

1. Open **Add Content** in the top navigation, paste or upload a `.md` file, and save.
2. Drop a Markdown file into `content/learn/` by hand.

Folders become **sections**. For example:

```text
content/learn/foundations/first-principles.md  →  section "Foundations"
content/learn/plans/current-plan.md            →  section "Plans"
```

A `README.md` inside a folder becomes that section's index page.

## Describe A Note With Frontmatter

Frontmatter is optional, but it makes the library cards much better:

```md
---
title: "First Principles"
description: "Break problems down to what is provably true."
section: "Foundations"
mode: "Explanation" # Tutorial | How-to | Reference | Explanation | Lesson
level: "Beginner"
duration: "10 min"
updated: "2026-07-03"
order: 10 # lower numbers appear first
---
```

## Add A Plan

A plan is just a note in a `plans/` folder: yearly strategy, weekly operating system, or a study schedule. Give it `mode: "How-to"` and link it from other notes. Keep one stable entry note (for example `plans/current-plan.md`) so year rollover only changes one file.

## Add Milestones

Any note can declare dates that matter: exam days, plan checkpoints, review sessions. They appear on the dashboard and the Milestones calendar automatically:

```md
---
title: "Certification Quarter Plan"
milestones:
  - id: "book-the-exam"
    title: "Book the exam"
    date: "2026-09-15"
    type: "Exam"
  - id: "mock-exam-80-plus"
    title: "Mock exam at 80%+"
    date: "2026-08-30"
    type: "Checkpoint"
---
```

## Track Your Progress

Open any note and press **Mark as complete**. The dashboard ring, section bars, streak, and achievements all follow from what you actually complete; nothing is decorative.

## Log Your Evidence

Reading is a start, not the goal. When you build something, refactor, write, give a talk, or get feedback, record it on the **Evidence** page. Section mastery and the scorecard are earned from evidence, not from notes marked read, so this is where consumption turns into competence. See [Why Evidence Beats Reading](../practice/why-evidence-beats-reading.md).
