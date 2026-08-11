"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { BookOpen, Clock3, FileText, Search, Sparkles } from "lucide-react";

export type LearnSearchItem = {
  href: string;
  title: string;
  description: string;
  section: string;
  sectionSlug: string;
  mode: string;
  level: string;
  duration: string;
  updated: string;
};

type LearnSearchProps = {
  items: LearnSearchItem[];
  initialQuery?: string;
  /** Section slug to pre-select the filter (from a `?section=` deep link). */
  initialSection?: string;
};

/** Canonical Diataxis ordering (plus Lesson) so the mode filter reads left-to-right sensibly. */
const DIATAXIS_ORDER = ["Tutorial", "How-to", "Reference", "Explanation", "Lesson"];

export function LearnSearch({ items, initialQuery, initialSection }: LearnSearchProps) {
  const [query, setQuery] = useState(initialQuery ?? "");
  // Filter by section slug (stable, URL-friendly). Honour a valid `?section=` deep link.
  const hasInitialSection =
    Boolean(initialSection) && items.some((item) => item.sectionSlug === initialSection);
  const [sectionFilter, setSectionFilter] = useState<string | null>(
    hasInitialSection ? (initialSection ?? null) : null,
  );
  const [modeFilter, setModeFilter] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const sections = [
    ...new Map(items.map((item) => [item.sectionSlug, item.section])).entries(),
  ].sort(([, a], [, b]) => a.localeCompare(b));
  const modes = [...new Set(items.map((item) => item.mode))].sort(
    (a, b) => DIATAXIS_ORDER.indexOf(a) - DIATAXIS_ORDER.indexOf(b) || a.localeCompare(b),
  );
  const filteredItems = items.filter((item) => {
    if (sectionFilter && item.sectionSlug !== sectionFilter) {
      return false;
    }

    if (modeFilter && item.mode !== modeFilter) {
      return false;
    }

    const searchableText =
      `${item.title} ${item.description} ${item.section} ${item.mode} ${item.level}`.toLowerCase();
    return !deferredQuery || searchableText.includes(deferredQuery);
  });

  return (
    <section className="learn-browser" aria-labelledby="learn-browser-title">
      <div className="learn-browser-heading">
        <div>
          <h2 id="learn-browser-title">Browse notes</h2>
        </div>
        <label className="learn-search-box">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search learning content</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, section, or mode..."
          />
        </label>
      </div>

      {sections.length > 1 ? (
        <div className="filter-row">
          <span className="filter-label">Section</span>
          <div className="section-chips" role="group" aria-label="Filter by section">
            <button
              className={sectionFilter === null ? "section-chip active" : "section-chip"}
              type="button"
              onClick={() => setSectionFilter(null)}
            >
              All ({items.length})
            </button>
            {sections.map(([slug, title]) => (
              <button
                className={sectionFilter === slug ? "section-chip active" : "section-chip"}
                type="button"
                onClick={() => setSectionFilter(sectionFilter === slug ? null : slug)}
                key={slug}
              >
                {title} ({items.filter((item) => item.sectionSlug === slug).length})
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {modes.length > 1 ? (
        <div className="filter-row">
          <span className="filter-label">Diataxis</span>
          <div className="section-chips" role="group" aria-label="Filter by Diataxis mode">
            <button
              className={modeFilter === null ? "section-chip active" : "section-chip"}
              type="button"
              onClick={() => setModeFilter(null)}
            >
              All
            </button>
            {modes.map((mode) => (
              <button
                className={modeFilter === mode ? "section-chip active" : "section-chip"}
                type="button"
                onClick={() => setModeFilter(modeFilter === mode ? null : mode)}
                key={mode}
              >
                {mode} ({items.filter((item) => item.mode === mode).length})
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {filteredItems.length > 0 ? (
        <div className="learn-card-grid">
          {filteredItems.map((item) => (
            <Link className="learn-card" href={item.href} key={item.href}>
              <span className="learn-card-icon" aria-hidden="true">
                <FileText size={22} />
              </span>
              <span className="learn-card-meta">
                {item.section} · {item.mode}
              </span>
              <strong>{item.title}</strong>
              <span>{item.description}</span>
              <span className="learn-card-footer">
                <span>
                  <BookOpen size={14} aria-hidden="true" />
                  {item.level}
                </span>
                <span>
                  <Clock3 size={14} aria-hidden="true" />
                  {item.duration}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-learn-state">
          <Sparkles size={28} aria-hidden="true" />
          <strong>No matching content yet</strong>
          <p>Try another search, or add a new Markdown note from the content studio.</p>
          <Link href="/add-content">Add Content</Link>
        </div>
      )}
    </section>
  );
}
