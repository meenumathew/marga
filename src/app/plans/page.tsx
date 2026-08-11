import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Target } from "lucide-react";
import { LearnHeader } from "@/components/learn-header";
import { PlanReviewRow } from "@/components/plan-review-row";
import { site } from "@/config/site";
import { getEventDateParts } from "@/lib/events";
import { getPlanYears } from "@/lib/plans";

export const metadata: Metadata = {
  title: `Plans | ${site.name}`,
  description: `Annual plans grouped by year and quarter in ${site.name}.`,
};

// Plans and their quarterly milestones are read from note frontmatter.
export const dynamic = "force-dynamic";

export default function PlansPage() {
  const planYears = getPlanYears();
  const currentYear = new Date().getFullYear();

  return (
    <div className="learn-shell">
      <LearnHeader active="plans" />

      <main className="learn-main">
        <section className="calendar-hero" aria-labelledby="plans-title">
          <div>
            <p className="section-kicker">Plans</p>
            <h1 id="plans-title">Your year, one quarter at a time</h1>
            <p>
              Plans are notes written in Plan mode with a year. Each year shows its strategy and the
              milestones that fall in each quarter, so intent and dated checkpoints live together.
            </p>
            <div className="learn-hero-actions">
              <Link className="secondary-action" href="/">
                <ArrowLeft size={18} aria-hidden="true" />
                Dashboard
              </Link>
              <Link className="primary-button" href="/add-content?type=plan">
                Write a Plan
              </Link>
            </div>
          </div>

          <div className="calendar-hero-card" aria-label="Plans summary">
            <Target size={28} aria-hidden="true" />
            <span>Plan Years</span>
            <strong>{planYears.length}</strong>
            <p>
              {planYears.length > 0
                ? `Latest: ${planYears[0]?.year}`
                : "Add a Plan-mode note with a year to see it here."}
            </p>
          </div>
        </section>

        {planYears.length === 0 ? (
          <section className="calendar-panel">
            <p className="empty-note">
              No plans yet. Go to <Link href="/add-content">Add Content</Link>, pick{" "}
              <strong>Plan</strong> mode, set a year, and save. It will appear here grouped by
              quarter.
            </p>
          </section>
        ) : (
          planYears.map((planYear) => (
            <details className="plan-year" key={planYear.year} open={planYear.year >= currentYear}>
              <summary className="plan-year-summary">
                <span className="plan-year-number">{planYear.year}</span>
                <span className="plan-year-meta">
                  {planYear.plans.length} {planYear.plans.length === 1 ? "plan" : "plans"} ·{" "}
                  {planYear.milestoneCount}{" "}
                  {planYear.milestoneCount === 1 ? "milestone" : "milestones"}
                </span>
              </summary>

              <div className="plan-year-body">
                <div className="plan-note-list">
                  {planYear.plans.map((plan) => (
                    <Link className="plan-note-link" href={plan.href} key={plan.slug}>
                      <strong>{plan.title}</strong>
                      <span>{plan.description}</span>
                    </Link>
                  ))}
                </div>

                <div className="plan-quarter-grid">
                  {planYear.quarters.map((quarter) => {
                    const reviewDate = getEventDateParts(quarter.review.date);
                    return (
                      <section
                        className="plan-quarter"
                        key={quarter.label}
                        aria-label={`${planYear.year} ${quarter.label}`}
                      >
                        <div className="plan-quarter-heading">
                          <h3>{quarter.label}</h3>
                          <span>{quarter.milestones.length}</span>
                        </div>

                        <ul className="plan-quarter-list">
                          <PlanReviewRow
                            reviewId={quarter.review.id}
                            label={quarter.review.label}
                            date={quarter.review.date}
                            month={reviewDate.month}
                            day={reviewDate.day}
                          />
                          {quarter.milestones.map((milestone) => {
                            const date = getEventDateParts(milestone.date);
                            return (
                              <li key={`${milestone.sourceSlug}-${milestone.sourceIndex}`}>
                                <Link href={milestone.link || milestone.sourceHref}>
                                  <CalendarClock size={14} aria-hidden="true" />
                                  <time dateTime={milestone.date}>
                                    {date.month} {date.day}
                                  </time>
                                  <span>{milestone.title}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              </div>
            </details>
          ))
        )}
      </main>
    </div>
  );
}
