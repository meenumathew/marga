import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, FileText, FolderOpen, PlusCircle } from "lucide-react";
import { LearnHeader } from "@/components/learn-header";
import { LearnSearch } from "@/components/learn-search";
import { NotesManager } from "@/components/notes-manager";
import { getAllLearnContent, getAllSections } from "@/lib/learn-content";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `Learn | ${site.name}`,
  description: `Browse Markdown and MDX learning content in ${site.name}.`,
};

type LearnPageProps = {
  searchParams: Promise<{ q?: string; section?: string }>;
};

export default async function LearnPage({ searchParams }: LearnPageProps) {
  const { q, section } = await searchParams;
  const items = getAllLearnContent();
  const sections = getAllSections();
  const featuredItem = items[0];

  const managerSections = sections.map((section) => ({
    slug: section.slug,
    title: section.title,
    description: section.description,
    icon: section.icon,
    noteCount: section.noteCount,
    editable: section.editable,
  }));
  const managerItems = items.map((item) => ({
    slug: item.slug,
    href: item.href,
    title: item.title,
    description: item.description,
    section: item.section,
    sectionSlug: item.sectionSlug,
    mode: item.mode,
    level: item.level,
    duration: item.duration,
    updated: item.updated,
    sourcePath: item.sourcePath,
  }));

  return (
    <div className="learn-shell">
      <LearnHeader active="learn" />

      <main className="learn-main">
        <section className="learn-hero" aria-labelledby="learn-title">
          <div>
            <p className="section-kicker">{site.learn.kicker}</p>
            <h1 id="learn-title">{site.learn.title}</h1>
            <p>{site.learn.intro}</p>
            <div className="learn-hero-actions">
              <Link className="primary-button" href={featuredItem?.href ?? "/add-content"}>
                <BookOpen size={18} aria-hidden="true" />
                Start Reading
              </Link>
              <Link className="secondary-action" href="/add-content">
                <PlusCircle size={18} aria-hidden="true" />
                Add Content
              </Link>
            </div>
          </div>

          <div className="learn-hero-panel" aria-label="Content library summary">
            <a className="panel-stat" href="#notes-manager-title">
              <FolderOpen size={22} aria-hidden="true" />
              <span>Sections</span>
              <strong>{sections.length}</strong>
            </a>
            <a className="panel-stat" href="#learn-browser-title">
              <FileText size={22} aria-hidden="true" />
              <span>Notes</span>
              <strong>{items.length}</strong>
            </a>
            <Link href="/add-content">
              Add a new note
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <LearnSearch items={items} initialQuery={q} initialSection={section} />
        <NotesManager sections={managerSections} items={managerItems} />
      </main>
    </div>
  );
}
