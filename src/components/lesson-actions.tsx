"use client";

import { useEffect } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { recordLessonVisit, toggleLessonComplete, useCompletedLessons } from "@/lib/progress";

type LessonActionsProps = {
  slug: string;
};

export function LessonActions({ slug }: LessonActionsProps) {
  const completed = useCompletedLessons();
  const isDone = completed.has(slug);

  useEffect(() => {
    recordLessonVisit(slug);
  }, [slug]);

  return (
    <button
      className={isDone ? "lesson-complete-button is-done" : "lesson-complete-button"}
      type="button"
      onClick={() => toggleLessonComplete(slug)}
      aria-pressed={isDone}
    >
      {isDone ? (
        <CheckCircle2 size={17} aria-hidden="true" />
      ) : (
        <Circle size={17} aria-hidden="true" />
      )}
      {isDone ? "Read" : "Mark as read"}
    </button>
  );
}
