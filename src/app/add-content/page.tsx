import type { Metadata } from "next";
import { ContentStudio } from "@/components/content-studio";
import { LearnHeader } from "@/components/learn-header";
import { getAllSections } from "@/lib/learn-content";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `Add Content | ${site.name}`,
  description: `Add Markdown and MDX learning content to ${site.name}.`,
};

type AddContentPageProps = {
  searchParams: Promise<{ section?: string; type?: string }>;
};

export default async function AddContentPage({ searchParams }: AddContentPageProps) {
  const { section, type } = await searchParams;
  // Only real (folder-backed) sections can receive new notes; the virtual General section is excluded.
  const sections = getAllSections()
    .filter((entry) => entry.editable)
    .map((entry) => ({ slug: entry.slug, title: entry.title }));

  return (
    <div className="learn-shell">
      <LearnHeader active="add" />
      <main className="learn-main">
        <section className="page-hero" aria-labelledby="studio-title">
          <p className="section-kicker">{site.addContent.kicker}</p>
          <h1 id="studio-title">{site.addContent.title}</h1>
          <p>{site.addContent.intro}</p>
        </section>
        <ContentStudio sections={sections} initialSection={section} initialType={type} />
      </main>
    </div>
  );
}
