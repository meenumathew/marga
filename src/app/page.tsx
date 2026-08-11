"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Search,
  Settings2,
  Trophy,
  X,
} from "lucide-react";
import { LearnHeader } from "@/components/learn-header";
import { dashboardProfileStorageKey, site } from "@/config/site";
import { deriveAchievements } from "@/lib/achievements";
import { localDateStamp } from "@/lib/calendar-date";
import {
  computeStreak,
  useActivityDays,
  useCompletedLessons,
  useEvidence,
  useLastVisitedLesson,
  useReachedMilestones,
  useReviewedPlans,
} from "@/lib/progress";

type LessonSummary = {
  slug: string;
  title: string;
  section: string;
  sectionSlug: string;
  href: string;
  duration: string;
};

type MilestoneItem = {
  id: string;
  title: string;
  date: string;
  type: string;
  sourceTitle: string;
  sourceHref: string;
};

type PlanReviewItem = {
  id: string;
  year: number;
  quarter: number;
  date: string;
};

const sectionThemes = ["python", "network", "analysis"];

function isLessonSummary(value: unknown): value is LessonSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return ["slug", "title", "section", "sectionSlug", "href", "duration"].every(
    (key) => typeof candidate[key] === "string",
  );
}

function isMilestoneItem(value: unknown): value is MilestoneItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return ["id", "title", "date", "type", "sourceTitle", "sourceHref"].every(
    (key) => typeof candidate[key] === "string",
  );
}

function isPlanReviewItem(value: unknown): value is PlanReviewItem {
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

function sectionInitials(section: string): string {
  const words = section.split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${words[0]?.charAt(0) ?? ""}${words[1]?.charAt(0) ?? ""}`
      : section.slice(0, 2);
  return initials.toUpperCase();
}

function progressPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((completed / total) * 100));
}

function daysUntilLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((target.getTime() - todayMidnight.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return "Passed";
  }

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Tomorrow";
  }

  return `In ${diffDays} days`;
}

function milestoneDateParts(date: string): { month: string; day: string } {
  const parsed = new Date(`${date}T00:00:00Z`);

  return {
    month: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(parsed),
    day: new Intl.DateTimeFormat("en", { day: "2-digit", timeZone: "UTC" }).format(parsed),
  };
}

type DashboardProfile = {
  displayName: string;
  focusArea: string;
  weeklyTarget: string;
  heroMessage: string;
};

const dashboardProfileKey = dashboardProfileStorageKey;

const defaultProfile: DashboardProfile = site.home.defaultProfile;

function readStoredProfile(): DashboardProfile {
  if (typeof window === "undefined") {
    return defaultProfile;
  }

  const storedProfile = window.localStorage.getItem(dashboardProfileKey);

  if (!storedProfile) {
    return defaultProfile;
  }

  try {
    const parsedProfile = JSON.parse(storedProfile) as Partial<DashboardProfile>;
    return { ...defaultProfile, ...parsedProfile };
  } catch {
    window.localStorage.removeItem(dashboardProfileKey);
    return defaultProfile;
  }
}

export default function HomePage() {
  const completedLessons = useCompletedLessons();
  const lastVisitedSlug = useLastVisitedLesson();
  const activityDays = useActivityDays();
  const evidence = useEvidence();
  const reachedMilestones = useReachedMilestones();
  const reviewedPlans = useReviewedPlans();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [planReviews, setPlanReviews] = useState<PlanReviewItem[]>([]);
  const [profile, setProfile] = useState<DashboardProfile>(readStoredProfile);
  const [draftProfile, setDraftProfile] = useState<DashboardProfile>(profile);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  const knownTotalLessons = Math.max(lessons.length, completedLessons.size);
  const overallProgress = progressPercent(completedLessons.size, knownTotalLessons);
  const progressRingStyle = { "--progress-percent": `${overallProgress}%` } as CSSProperties;
  const streak = computeStreak(activityDays);
  const displayName = profile.displayName.trim() || defaultProfile.displayName;
  const avatarInitial = displayName.charAt(0).toUpperCase();

  const sectionStats = (() => {
    const bySection = new Map<string, { sectionSlug: string; total: number; done: number }>();

    for (const lesson of lessons) {
      const entry = bySection.get(lesson.section) ?? {
        sectionSlug: lesson.sectionSlug,
        total: 0,
        done: 0,
      };
      entry.total += 1;

      if (completedLessons.has(lesson.slug)) {
        entry.done += 1;
      }

      bySection.set(lesson.section, entry);
    }

    return [...bySection.entries()]
      .map(([section, counts]) => ({
        section,
        ...counts,
        percent: progressPercent(counts.done, counts.total),
      }))
      .sort((a, b) => b.total - a.total);
  })();

  const featuredLesson =
    lessons.find((lesson) => lesson.slug === lastVisitedSlug) ??
    lessons.find((lesson) => !completedLessons.has(lesson.slug)) ??
    lessons[0];
  const featuredSection = featuredLesson
    ? sectionStats.find((stat) => stat.section === featuredLesson.section)
    : undefined;
  const featuredPercent = featuredSection?.percent ?? 0;

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
  const achievedList = achievements.filter((achievement) => achievement.achieved);
  const recentAchievement = achievedList[achievedList.length - 1];

  const today = localDateStamp(new Date());
  const milestonesAhead = milestones.filter((milestone) => milestone.date >= today);
  const upcomingMilestones = milestonesAhead.slice(0, 3);

  const progressStats = [
    {
      label: `${completedLessons.size}`,
      detail: "Notes Read",
      icon: CheckCircle2,
      href: "/achievements",
    },
    {
      label: `${evidence.length}`,
      detail: "Evidence Logged",
      icon: ClipboardCheck,
      href: "/evidence",
    },
    {
      label: `${achievedList.length}`,
      detail: "Achievements Earned",
      icon: Trophy,
      href: "/achievements",
    },
    {
      label: `${milestonesAhead.length}`,
      detail: "Milestones Ahead",
      icon: CalendarDays,
      href: "/milestones",
    },
  ];

  useEffect(() => {
    const controller = new AbortController();

    async function loadProgressSummary() {
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
        setMilestones(summary.milestones.filter(isMilestoneItem));
      }

      if (Array.isArray(summary.planReviews)) {
        setPlanReviews(summary.planReviews.filter(isPlanReviewItem));
      }
    }

    loadProgressSummary().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        console.error(error);
      }
    });

    return () => controller.abort();
  }, []);

  function updateDraft(field: keyof DashboardProfile, value: string) {
    setDraftProfile((currentProfile) => ({ ...currentProfile, [field]: value }));
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile = {
      displayName: draftProfile.displayName.trim() || defaultProfile.displayName,
      focusArea: draftProfile.focusArea.trim() || defaultProfile.focusArea,
      weeklyTarget: draftProfile.weeklyTarget.trim() || defaultProfile.weeklyTarget,
      heroMessage: draftProfile.heroMessage.trim() || defaultProfile.heroMessage,
    };
    setProfile(nextProfile);
    setDraftProfile(nextProfile);
    localStorage.setItem(dashboardProfileKey, JSON.stringify(nextProfile));
    setIsCustomizerOpen(false);
  }

  function resetProfile() {
    setProfile(defaultProfile);
    setDraftProfile(defaultProfile);
    localStorage.removeItem(dashboardProfileKey);
  }

  return (
    <div className="marga-shell">
      <LearnHeader
        active="home"
        actions={
          <>
            <form className="search-box" action="/learn" role="search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search your lessons and notes</span>
              <input name="q" placeholder={site.home.searchPlaceholder} />
            </form>
            <button
              className="profile-button"
              type="button"
              onClick={() => setIsCustomizerOpen(true)}
              aria-haspopup="dialog"
            >
              <span className="avatar">{avatarInitial}</span>
              <span>{displayName}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => setIsCustomizerOpen(true)}
              aria-label="Customize dashboard"
            >
              <Settings2 size={19} />
            </button>
          </>
        }
      />

      <main className="dashboard-main">
        <section className="hero-card" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <p className="eyebrow">Welcome back,</p>
            <h1 id="welcome-title">{displayName}</h1>
            <p className="hero-text">{profile.heroMessage}</p>
            <p className="hero-focus">
              Focus: {profile.focusArea} · Target: {profile.weeklyTarget}
            </p>
            <Link className="primary-button" href="/learn">
              <BookOpen size={18} aria-hidden="true" />
              Browse Library
            </Link>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-dots" />
            <svg className="mountain-scene" viewBox="0 0 560 300" role="img">
              <path
                d="M0 248 C84 214 128 222 190 186 C246 154 276 157 322 126 C383 84 431 83 560 42 L560 300 L0 300 Z"
                fill="#d9e9f6"
              />
              <path
                d="M112 260 C179 210 226 226 284 170 C340 116 372 120 428 62 C468 110 508 148 560 198 L560 300 L112 300 Z"
                fill="#b7d4ea"
              />
              <path
                d="M257 278 C310 222 356 183 426 61 C463 138 492 181 560 252 L560 300 L257 300 Z"
                fill="#86b2d3"
              />
              <path d="M426 61 L457 141 L405 112 Z" fill="#f7fbff" />
              <path
                d="M398 107 C365 153 335 185 302 215 C357 209 392 189 438 150 C428 132 414 118 398 107 Z"
                fill="#edf6fd"
              />
              <path
                d="M352 222 C388 191 421 158 457 141 C428 188 395 225 346 262 C291 257 252 266 206 282 C260 249 304 235 352 222 Z"
                fill="#fff8ea"
              />
              <path d="M418 45 L418 18" stroke="#d88c13" strokeWidth="4" strokeLinecap="round" />
              <path d="M418 18 C436 16 446 28 463 22 C451 42 435 37 418 45 Z" fill="#f4a72d" />
              <path
                d="M280 82 C287 74 294 74 302 82"
                stroke="#8fb9d6"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M518 70 C525 62 532 62 540 70"
                stroke="#8fb9d6"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </section>

        <div className="content-grid">
          <div className="left-column">
            <section className="panel continue-panel" aria-labelledby="continue-title">
              <div className="panel-heading">
                <h2 id="continue-title">Continue Learning</h2>
                <Link href="/learn">View Library</Link>
              </div>

              {featuredLesson ? (
                <article className="featured-course">
                  <div className="course-cover ai-cover">
                    <span>{sectionInitials(featuredLesson.section)}</span>
                    <small>{featuredLesson.section}</small>
                    <div className="network-orbit" />
                  </div>
                  <div className="featured-details">
                    <p className="label">
                      {featuredLesson.slug === lastVisitedSlug
                        ? "Continue where you left off"
                        : "Up next"}
                    </p>
                    <h3>{featuredLesson.title}</h3>
                    <p>
                      {featuredSection
                        ? `${featuredSection.done} of ${featuredSection.total} notes read in ${featuredLesson.section}.`
                        : "Start your first note."}
                    </p>
                    <div className="progress-row">
                      <div
                        className="progress-track"
                        aria-label={`${featuredPercent} percent of ${featuredLesson.section} complete`}
                      >
                        <span style={{ width: `${featuredPercent}%` }} />
                      </div>
                      <strong>{featuredPercent}%</strong>
                    </div>
                    <div className="course-meta">
                      <span>
                        <Clock3 size={15} aria-hidden="true" />
                        {featuredLesson.duration}
                      </span>
                      <span>{completedLessons.has(featuredLesson.slug) ? "Read" : "Unread"}</span>
                    </div>
                  </div>
                  <Link className="continue-button" href={featuredLesson.href}>
                    Continue
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              ) : (
                <p className="empty-note">
                  Add Markdown notes under content/learn to start tracking progress.
                </p>
              )}
            </section>

            {sectionStats.length > 1 ? (
              <section className="panel recommended-panel" aria-labelledby="recommended-title">
                <div className="panel-heading">
                  <h2 id="recommended-title">Your Paths</h2>
                  <Link href="/learn">View All</Link>
                </div>
                {sectionStats.length > 0 ? (
                  <div className="course-grid">
                    {sectionStats.slice(0, 3).map((sectionStat, index) => (
                      <Link
                        className="course-card"
                        href={
                          sectionStat.sectionSlug
                            ? `/learn?section=${sectionStat.sectionSlug}`
                            : "/learn"
                        }
                        key={sectionStat.section}
                      >
                        <div
                          className={`mini-cover ${sectionThemes[index % sectionThemes.length]}`}
                        >
                          {sectionStat.percent === 100 ? (
                            <span className="course-badge">Done</span>
                          ) : sectionStat.done === 0 ? (
                            <span className="course-badge">New</span>
                          ) : null}
                          <span className="cover-symbol">
                            {sectionInitials(sectionStat.section)}
                          </span>
                        </div>
                        <div className="course-card-body">
                          <h3>{sectionStat.section}</h3>
                          <p>
                            {sectionStat.total} {sectionStat.total === 1 ? "note" : "notes"}
                          </p>
                          <div className="progress-line">
                            <span style={{ width: `${sectionStat.percent}%` }} />
                          </div>
                          <div className="card-meta">
                            <span>
                              <CheckCircle2 size={14} aria-hidden="true" />
                              {sectionStat.done}/{sectionStat.total}
                            </span>
                            <span>{sectionStat.percent}%</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="empty-note">Sections appear here once you add learning content.</p>
                )}
              </section>
            ) : null}

            <section className="streak-banner" aria-label="Learning streak">
              <div className="medal" aria-hidden="true">
                <Trophy size={42} />
              </div>
              <div>
                <h2>Keep it up, {displayName}!</h2>
                <p>
                  {recentAchievement
                    ? `Latest achievement: ${recentAchievement.title}.`
                    : "Read your first note to earn your first achievement."}
                </p>
              </div>
              <div className="streak-detail">
                <span>Learning Streak</span>
                <strong>
                  {streak > 0 ? `${streak} Day${streak === 1 ? "" : "s"}` : "No streak yet"}
                </strong>
                <small>
                  {streak > 0 ? "Keep the momentum going." : "Open a note today to start."}
                </small>
                <div className="streak-days" aria-hidden="true">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <CheckCircle2
                      className={index < streak ? "" : "streak-day-empty"}
                      size={15}
                      key={index}
                    />
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="right-column" aria-label="Progress and milestones">
            <section className="progress-panel" aria-labelledby="progress-title">
              <div className="panel-heading compact">
                <h2 id="progress-title">Your Progress</h2>
                <Link href="/achievements">View All</Link>
              </div>
              <div className="progress-summary">
                <div
                  className="ring"
                  style={progressRingStyle}
                  aria-label={`${overallProgress} percent overall progress`}
                >
                  <span>{overallProgress}%</span>
                </div>
                <div>
                  <strong>Overall Progress</strong>
                  <p>
                    {completedLessons.size > 0
                      ? `${completedLessons.size} of ${knownTotalLessons} lessons done.`
                      : "Mark notes read as you go."}
                  </p>
                </div>
              </div>
              <div className="stat-list">
                {progressStats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <Link className="stat-item" href={stat.href} key={stat.detail}>
                      <Icon size={19} aria-hidden="true" />
                      <strong>{stat.label}</strong>
                      <span>{stat.detail}</span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="panel upcoming-panel" aria-labelledby="upcoming-title">
              <div className="panel-heading compact">
                <h2 id="upcoming-title">Milestones</h2>
                <Link href="/milestones">View Milestones</Link>
              </div>
              {upcomingMilestones.length > 0 ? (
                <div className="event-list">
                  {upcomingMilestones.map((milestone) => {
                    const date = milestoneDateParts(milestone.date);
                    return (
                      <Link
                        className="event-link"
                        href={milestone.sourceHref}
                        key={`${milestone.date}-${milestone.title}`}
                      >
                        <article className="event-item">
                          <div className="event-date">
                            <span>{date.month}</span>
                            <strong>{date.day}</strong>
                          </div>
                          <div>
                            <span>{milestone.type}</span>
                            <strong>{milestone.title}</strong>
                            <p>{daysUntilLabel(milestone.date)}</p>
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-note">
                  Add a milestones list to any note&apos;s frontmatter — exam dates, checkpoints,
                  reviews — and they show up here.
                </p>
              )}
              <Link className="events-link" href="/milestones">
                See all milestones
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>
          </aside>
        </div>
      </main>

      {isCustomizerOpen ? (
        <div className="customizer-backdrop" onClick={() => setIsCustomizerOpen(false)}>
          <section
            className="customizer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customizer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="customizer-heading">
              <div>
                <span className="content-badge">Dashboard setup</span>
                <h2 id="customizer-title">Customize learning dashboard</h2>
                <p>
                  These settings are saved in this browser. Later, the same fields can come from
                  login user data.
                </p>
              </div>
              <button
                className="icon-button customizer-close"
                type="button"
                onClick={() => setIsCustomizerOpen(false)}
                aria-label="Close customizer"
              >
                <X size={19} />
              </button>
            </div>

            <form className="customizer-form" onSubmit={saveProfile}>
              <label>
                Display name
                <input
                  value={draftProfile.displayName}
                  onChange={(event) => updateDraft("displayName", event.target.value)}
                  placeholder="Learner"
                />
              </label>
              <label>
                Learning focus
                <input
                  value={draftProfile.focusArea}
                  onChange={(event) => updateDraft("focusArea", event.target.value)}
                  placeholder="Your craft"
                />
              </label>
              <label>
                Weekly target
                <input
                  value={draftProfile.weeklyTarget}
                  onChange={(event) => updateDraft("weeklyTarget", event.target.value)}
                  placeholder="5h this week"
                />
              </label>
              <label>
                Welcome message
                <textarea
                  value={draftProfile.heroMessage}
                  onChange={(event) => updateDraft("heroMessage", event.target.value)}
                  rows={3}
                />
              </label>
              <div className="customizer-actions">
                <button className="secondary-action" type="button" onClick={resetProfile}>
                  Reset
                </button>
                <button className="save-action" type="submit">
                  Save Dashboard
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
