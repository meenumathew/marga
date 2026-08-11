import { NextResponse } from "next/server";
import { getAllLearnContent, getAllMilestones } from "@/lib/learn-content";
import { getPlanReviews } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const lessons = getAllLearnContent().map((item) => ({
    slug: item.slug,
    title: item.title,
    section: item.section,
    sectionSlug: item.sectionSlug,
    href: item.href,
    duration: item.duration,
  }));

  // A stable id (source slug + milestone id) lets a "reached" badge map to exactly one
  // milestone, matching the confirmId used by the milestones page toggle.
  const milestones = getAllMilestones().map((milestone) => ({
    ...milestone,
    id: `${milestone.sourceSlug}#${milestone.id}`,
  }));

  return NextResponse.json({
    totalLessons: lessons.length,
    lessons,
    milestones,
    planReviews: getPlanReviews(),
  });
}
