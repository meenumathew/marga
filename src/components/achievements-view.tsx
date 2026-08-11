"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  CalendarCheck,
  CheckCircle2,
  Flame,
  FolderOpen,
  Hammer,
  Lock,
  MessageSquare,
  Target,
  Trophy,
} from "lucide-react";
import { LearnHeader } from "@/components/learn-header";
import { deriveAchievements, type Achievement } from "@/lib/achievements";
import {
  computeStreak,
  useActivityDays,
  useCompletedLessons,
  useEvidence,
  useReachedMilestones,
  useReviewedPlans,
} from "@/lib/progress";

type LessonSummary = {
  slug: string;
  section: string;
  sectionSlug: string;
};

type MilestoneSummary = {
  id: string;
  title: string;
  date: string;
  type: string;
};

type PlanReviewSummary = {
  id: string;
  year: number;
  quarter: number;
  date: string;
};

function isLessonSummary(value: unknown): value is LessonSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.slug === "string" &&
    typeof candidate.section === "string" &&
    typeof candidate.sectionSlug === "string"
  );
}

function isMilestoneSummary(value: unknown): value is MilestoneSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return ["id", "title", "date", "type"].every((key) => typeof candidate[key] === "string");
}

function isPlanReviewSummary(value: unknown): value is PlanReviewSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.year === "number" &&
    typeof candidate.quarter === "number" &&
    typeof candidate.date === "string"
  );
}

const kindIcons = {
  lesson: CheckCircle2,
  section: FolderOpen,
  mastery: Award,
  evidence: Hammer,
  feedback: MessageSquare,
  streak: Flame,
  milestone: CalendarCheck,
  plan: Target,
} as const;

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const Icon = achievement.achieved ? kindIcons[achievement.kind] : Lock;
  // Show a progress bar on locked, countable badges so the learner sees how close
  // they are (e.g. 7/10). Skip it once earned, or when there's nothing to count.
  const progress = achievement.progress;
  const showProgress = !achievement.achieved && progress !== undefined && progress.target > 0;
  const percent = showProgress ? Math.round((progress.current / progress.target) * 100) : 0;

  return (
    <article
      className={achievement.achieved ? "achievement-card" : "achievement-card locked"}
      aria-label={`${achievement.title} — ${achievement.achieved ? "earned" : "locked"}`}
    >
      <Icon size={26} aria-hidden="true" />
      <strong>{achievement.title}</strong>
      <span>{achievement.detail}</span>
      {showProgress ? (
        <div className="achievement-progress">
          <div
            className="achievement-progress-bar"
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={0}
            aria-valuemax={progress.target}
            aria-label={`${progress.current} of ${progress.target}`}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <small>
            {progress.current} / {progress.target}
          </small>
        </div>
      ) : (
        <small>{achievement.achieved ? "Earned" : "Locked"}</small>
      )}
    </article>
  );
}

export function AchievementsView() {
  const completedLessons = useCompletedLessons();
  const activityDays = useActivityDays();
  const evidence = useEvidence();
  const reachedMilestones = useReachedMilestones();
  const reviewedPlans = useReviewedPlans();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [milestones, setMilestones] = useState<MilestoneSummary[]>([]);
  const [planReviews, setPlanReviews] = useState<PlanReviewSummary[]>([]);
  const [showAllLocked, setShowAllLocked] = useState(false);

  const streak = computeStreak(activityDays);
  const achievements = deriveAchievements({
    lessons,
    completed: completedLessons,
    streak,
    evidence,
    milestones,
    reachedMilestones,
    planReviews,
    reviewedPlans,
  });
  const earned = achievements.filter((achievement) => achievement.achieved);
  const locked = achievements.filter((achievement) => !achievement.achieved);
  // Locked badges grow without bound (every future milestone, section, and plan
  // quarter), so preview a handful and let the learner expand the rest on demand.
  const LOCKED_PREVIEW = 12;
  const visibleLocked = showAllLocked ? locked : locked.slice(0, LOCKED_PREVIEW);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLessons() {
      const response = await fetch("/api/progress-summary", { signal: controller.signal });

      if (!response.ok) {
        return;
      }

      const summary = (await response.json()) as {
        lessons?: unknown;
        milestones?: unknown;
        planReviews?: unknown;
      };

      if (Array.isArray(summary.lessons)) {
        setLessons(summary.lessons.filter(isLessonSummary));
      }

      if (Array.isArray(summary.milestones)) {
        setMilestones(summary.milestones.filter(isMilestoneSummary));
      }

      if (Array.isArray(summary.planReviews)) {
        setPlanReviews(summary.planReviews.filter(isPlanReviewSummary));
      }
    }

    loadLessons().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        console.error(error);
      }
    });

    return () => controller.abort();
  }, []);

  return (
    <div className="learn-shell">
      <LearnHeader active="achievements" />

      <main className="learn-main">
        <section className="calendar-hero" aria-labelledby="achievements-title">
          <div>
            <p className="section-kicker">Achievements</p>
            <h1 id="achievements-title">Milestones you have earned on the path</h1>
            <p>
              Achievements come from real activity: notes you read, sections you master, and the
              streaks you keep. No points for showing up — evidence only.
            </p>
            <div className="learn-hero-actions">
              <Link className="secondary-action" href="/">
                <ArrowLeft size={18} aria-hidden="true" />
                Dashboard
              </Link>
              <Link className="primary-button" href="/learn">
                Browse notes
              </Link>
            </div>
          </div>

          <div className="calendar-hero-card" aria-label="Achievements summary">
            <Trophy size={28} aria-hidden="true" />
            <span>Earned</span>
            <strong>{earned.length}</strong>
            <p>
              {earned.length > 0
                ? `${earned.length} of ${achievements.length} unlocked`
                : "Read a note to earn your first."}
            </p>
          </div>
        </section>

        <section className="achievements-panel" aria-labelledby="earned-title">
          <div className="achievements-heading">
            <h2 id="earned-title">
              <Trophy size={20} aria-hidden="true" /> Earned
            </h2>
            <span>
              {earned.length} of {achievements.length}
            </span>
          </div>
          {earned.length > 0 ? (
            <div className="achievements-grid">
              {earned.map((achievement) => (
                <AchievementCard achievement={achievement} key={achievement.id} />
              ))}
            </div>
          ) : (
            <p className="empty-note">
              Nothing earned yet. Open a note and mark it read to get your first one.
            </p>
          )}
        </section>

        {locked.length > 0 ? (
          <section className="achievements-panel" aria-labelledby="locked-title">
            <div className="achievements-heading">
              <h2 id="locked-title">
                <Lock size={18} aria-hidden="true" /> Still ahead
              </h2>
              <span>{locked.length}</span>
            </div>
            <div className="achievements-grid">
              {visibleLocked.map((achievement) => (
                <AchievementCard achievement={achievement} key={achievement.id} />
              ))}
            </div>
            {locked.length > LOCKED_PREVIEW ? (
              <button
                className="show-more-button"
                type="button"
                onClick={() => setShowAllLocked((open) => !open)}
                aria-expanded={showAllLocked}
              >
                {showAllLocked ? "Show fewer" : `Show all ${locked.length}`}
              </button>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
