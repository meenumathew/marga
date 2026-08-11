import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { EvidenceLog } from "@/components/evidence-log";
import { LearnHeader } from "@/components/learn-header";
import { site } from "@/config/site";
import { getAllSections } from "@/lib/learn-content";

export const metadata: Metadata = {
  title: `Evidence | ${site.name}`,
  description: `Log the real outputs and feedback that prove learning in ${site.name}.`,
};

// Section options are read from content at request time.
export const dynamic = "force-dynamic";

export default function EvidencePage() {
  const sections = getAllSections()
    .filter((section) => section.noteCount > 0)
    .map((section) => ({ slug: section.slug, title: section.title }));

  return (
    <div className="learn-shell">
      <LearnHeader active="evidence" />

      <main className="learn-main">
        <section className="calendar-hero" aria-labelledby="evidence-title">
          <div>
            <p className="section-kicker">Evidence</p>
            <h1 id="evidence-title">Proof you did the work, not just the reading</h1>
            <p>
              Mastery is what you produce and the feedback you act on. Log builds, refactors,
              write-ups, talks, and feedback here — the scorecard and section mastery are earned
              from this, not from notes marked read.
            </p>
            <div className="learn-hero-actions">
              <Link className="secondary-action" href="/">
                <ArrowLeft size={18} aria-hidden="true" />
                Dashboard
              </Link>
              <Link className="primary-button" href="/achievements">
                See Achievements
              </Link>
            </div>
          </div>

          <div className="calendar-hero-card" aria-label="Evidence intro">
            <ClipboardCheck size={28} aria-hidden="true" />
            <span>Evidence only</span>
            <strong>Produce</strong>
            <p>Outputs and feedback beat time spent reading.</p>
          </div>
        </section>

        <EvidenceLog sections={sections} />
      </main>
    </div>
  );
}
