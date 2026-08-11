import type { ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Home,
  PlusCircle,
  Target,
  Trophy,
} from "lucide-react";
import { MargaLogo } from "./marga-logo";
import { ThemeToggle } from "./theme-toggle";

type LearnHeaderProps = {
  active?: "home" | "learn" | "add" | "milestones" | "achievements" | "plans" | "evidence";
  /** Optional extra controls (e.g. dashboard search + profile) rendered before the theme toggle. */
  actions?: ReactNode;
};

/** The single app-wide header. Every page renders this so nav stays consistent. */
export function LearnHeader({ active, actions }: LearnHeaderProps) {
  const linkClass = (key: LearnHeaderProps["active"]) =>
    active === key ? "learn-header-link active" : "learn-header-link";

  return (
    <header className="learn-header">
      <MargaLogo className="learn-brand" />

      <div className="learn-header-actions">
        <nav className="learn-header-nav" aria-label="Primary navigation">
          <Link className={linkClass("home")} href="/">
            <Home size={17} aria-hidden="true" />
            Dashboard
          </Link>
          <Link className={linkClass("learn")} href="/learn">
            <BookOpen size={17} aria-hidden="true" />
            Library
          </Link>
          <Link className={linkClass("milestones")} href="/milestones">
            <CalendarDays size={17} aria-hidden="true" />
            Milestones
          </Link>
          <Link className={linkClass("plans")} href="/plans">
            <Target size={17} aria-hidden="true" />
            Plans
          </Link>
          <Link className={linkClass("evidence")} href="/evidence">
            <ClipboardCheck size={17} aria-hidden="true" />
            Evidence
          </Link>
          <Link className={linkClass("achievements")} href="/achievements">
            <Trophy size={17} aria-hidden="true" />
            Achievements
          </Link>
          <Link className={linkClass("add")} href="/add-content">
            <PlusCircle size={17} aria-hidden="true" />
            Add Content
          </Link>
        </nav>
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
