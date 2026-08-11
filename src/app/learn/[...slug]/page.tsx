import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Clock3, FileText, PencilLine } from "lucide-react";
import { LearnHeader } from "@/components/learn-header";
import { LessonActions } from "@/components/lesson-actions";
import { ScrollToTop } from "@/components/scroll-to-top";
import {
  getAllLearnContent,
  getLearnContentBySlug,
  getSectionNeighbors,
} from "@/lib/learn-content";
import { site } from "@/config/site";

type LearnContentPageProps = {
  params: Promise<{ slug: string[] }>;
};

export function generateStaticParams() {
  return getAllLearnContent().map((item) => ({ slug: item.slugSegments }));
}

export async function generateMetadata({ params }: LearnContentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLearnContentBySlug(slug);

  return {
    title: page ? `${page.title} | ${site.name}` : `Learn | ${site.name}`,
    description: page?.description ?? `Learning content in ${site.name}.`,
  };
}

export default async function LearnContentPage({ params }: LearnContentPageProps) {
  const { slug } = await params;
  const page = await getLearnContentBySlug(slug);

  if (!page) {
    notFound();
  }

  const relatedItems = getAllLearnContent()
    .filter((item) => item.section === page.section && item.href !== page.href)
    .slice(0, 5);
  const { previous, next } = getSectionNeighbors(page.slug);

  return (
    <div className="learn-shell">
      <LearnHeader active="learn" />

      <main className="reader-layout">
        <aside className="reader-sidebar" aria-label="Note details">
          <Link className="back-link" href="/learn">
            <ArrowLeft size={16} aria-hidden="true" />
            All notes
          </Link>

          <div className="reader-info-card">
            <span className="content-badge">{page.mode}</span>
            <h2>{page.section}</h2>
            <p>{page.description}</p>
            <div className="reader-meta-list">
              <span>
                <BookOpen size={15} aria-hidden="true" />
                {page.level}
              </span>
              <span>
                <Clock3 size={15} aria-hidden="true" />
                {page.duration}
              </span>
              <span>
                <FileText size={15} aria-hidden="true" />
                {page.sourcePath}
              </span>
            </div>
            <LessonActions slug={page.slug} />
          </div>

          {page.headings.length > 0 ? (
            <nav className="toc-card" aria-label="On this page">
              <strong>On this page</strong>
              {page.headings.map((heading) => (
                <a
                  className={heading.level === 3 ? "toc-link nested" : "toc-link"}
                  href={`#${heading.anchor}`}
                  key={heading.anchor}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          ) : null}
        </aside>

        <article className="reader-article">
          <div className="reader-title-block">
            <span>
              {page.section} · {page.updated}
            </span>
            <h1>{page.title}</h1>
            <p>{page.description}</p>
          </div>
          <div className="markdown-body" dangerouslySetInnerHTML={{ __html: page.html }} />

          {previous || next ? (
            <nav className="reader-pager" aria-label="Previous and next notes">
              {previous ? (
                <Link className="reader-pager-link prev" href={previous.href}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  <span>
                    <small>Previous</small>
                    <strong>{previous.title}</strong>
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link className="reader-pager-link next" href={next.href}>
                  <span>
                    <small>Next</small>
                    <strong>{next.title}</strong>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </article>

        <aside className="related-sidebar" aria-label="Related notes">
          <Link className="add-note-card" href="/add-content">
            <PencilLine size={19} aria-hidden="true" />
            <strong>Add Content</strong>
            <span>Paste or upload Markdown.</span>
          </Link>

          {relatedItems.length > 0 ? (
            <div className="related-card">
              <strong>More in {page.section}</strong>
              {relatedItems.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.title}
                </Link>
              ))}
            </div>
          ) : null}
        </aside>
      </main>

      <ScrollToTop />
    </div>
  );
}
