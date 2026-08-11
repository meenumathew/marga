import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";
import { AddMilestone } from "@/components/add-milestone";
import { MilestoneActions } from "@/components/milestone-actions";
import { ReachedToggle } from "@/components/reached-toggle";
import { LearnHeader } from "@/components/learn-header";
import { site } from "@/config/site";
import {
  getEventDateParts,
  getEventMonthLabel,
  getPastEvents,
  getUpcomingEvents,
  groupEventsByMonth,
  type LearningEvent,
} from "@/lib/events";
import { getAllLearnContent } from "@/lib/learn-content";

export const metadata: Metadata = {
  title: `Milestones | ${site.name}`,
  description: `View upcoming and past learning milestones in ${site.name}.`,
};

// Milestones come from note frontmatter and countdowns depend on today's date.
export const dynamic = "force-dynamic";

function EventCard({ event, past }: { event: LearningEvent; past?: boolean }) {
  const date = getEventDateParts(event.date);
  const isPlanReview = event.kind === "plan-review";

  return (
    <article className={past ? "calendar-event past" : "calendar-event"}>
      <div className="event-date">
        <span>{date.month}</span>
        <strong>{date.day}</strong>
      </div>
      <div>
        <span className={isPlanReview ? "content-badge auto" : "content-badge"}>{event.type}</span>
        <h3>
          <Link href={event.href}>{event.title}</Link>
        </h3>
        <p>{event.description}</p>
        <div className="calendar-event-meta">
          <time dateTime={event.date}>{getEventMonthLabel(event.date)}</time>
          <span>
            <Clock3 size={15} aria-hidden="true" />
            {event.time}
          </span>
          <ReachedToggle id={event.confirmId} kind={isPlanReview ? "plan" : "milestone"} />
        </div>
      </div>
      {/* Plan reviews are auto-generated, so they have no edit/delete actions. */}
      {isPlanReview ? null : (
        <MilestoneActions
          id={event.id.split("#").at(-1) ?? ""}
          slug={event.slug}
          index={event.sourceIndex}
          title={event.title}
          date={event.date}
          type={event.type}
          note={event.note}
        />
      )}
    </article>
  );
}

export default function MilestonesPage() {
  const upcoming = getUpcomingEvents();
  const past = getPastEvents();
  const nextEvent = upcoming[0];
  const upcomingByMonth = groupEventsByMonth(upcoming);
  const pastByMonth = groupEventsByMonth(past);
  const notes = getAllLearnContent().map((item) => ({ slug: item.slug, title: item.title }));

  return (
    <div className="learn-shell">
      <LearnHeader active="milestones" />

      <main className="learn-main">
        <section className="calendar-hero" aria-labelledby="milestones-title">
          <div>
            <p className="section-kicker">Milestones</p>
            <h1 id="milestones-title">Dates that matter on your path</h1>
            <p>
              Declare milestones in any note&apos;s frontmatter — exam dates, checkpoints, review
              days — and they appear here automatically, alongside each plan&apos;s quarter-end
              reviews.
            </p>
            <div className="learn-hero-actions">
              <Link className="secondary-action" href="/">
                <ArrowLeft size={18} aria-hidden="true" />
                Dashboard
              </Link>
              <Link className="primary-button" href="/learn/guides/add-your-content">
                How To Add Milestones
              </Link>
            </div>
          </div>

          <div className="calendar-hero-card" aria-label="Milestones summary">
            <CalendarDays size={28} aria-hidden="true" />
            <span>Upcoming Milestones</span>
            <strong>{upcoming.length}</strong>
            <p>
              {nextEvent
                ? `Next: ${nextEvent.title}`
                : "Add milestones in note frontmatter to see them here."}
            </p>
          </div>
        </section>

        <AddMilestone notes={notes} />

        <section className="calendar-panel" aria-labelledby="upcoming-title">
          <div className="calendar-panel-heading">
            <div>
              <p className="section-kicker">Schedule</p>
              <h2 id="upcoming-title">Upcoming</h2>
            </div>
            <span>{upcoming.length} planned</span>
          </div>

          {upcomingByMonth.length > 0 ? (
            upcomingByMonth.map((group) => (
              <div className="calendar-month-group" key={`upcoming-${group.label}`}>
                <h3 className="calendar-month-label">{group.label}</h3>
                <div className="calendar-list">
                  {group.events.map((event) => (
                    <EventCard event={event} key={event.id} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="empty-note">
              No upcoming milestones. Add a milestones list to any note&apos;s frontmatter and they
              show up here.
            </p>
          )}
        </section>

        {pastByMonth.length > 0 ? (
          <section className="calendar-panel" aria-labelledby="past-title">
            <div className="calendar-panel-heading">
              <div>
                <p className="section-kicker">History</p>
                <h2 id="past-title">Past</h2>
              </div>
              <span>{past.length} reached</span>
            </div>

            {pastByMonth.map((group) => (
              <div className="calendar-month-group" key={`past-${group.label}`}>
                <h3 className="calendar-month-label">{group.label}</h3>
                <div className="calendar-list">
                  {group.events.map((event) => (
                    <EventCard event={event} past key={event.id} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
