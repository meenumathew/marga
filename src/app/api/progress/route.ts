import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { normalizeEvidenceEntry } from "@/lib/evidence";
import { logRouteError } from "@/lib/log";
import {
  addActivityDay,
  addEvidenceEntry,
  createEmptyProgressState,
  normalizeProgressState,
  type ProgressState,
  readProgressDate,
  readProgressId,
  setMembership,
} from "@/lib/progress-state";
import { rejectCrossOriginWrite } from "@/lib/request-guard";
import { resolveSafeStoragePath } from "@/lib/safe-storage-path";
import { getStoragePaths } from "@/lib/storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statePath = getStoragePaths().statePath;
const progressRoot = path.dirname(path.dirname(statePath));

export async function GET() {
  try {
    const safeStatePath = await resolveSafeStoragePath(progressRoot, statePath);

    if (!safeStatePath) {
      throw new Error("Progress state is outside its storage boundary.");
    }

    const { state, source } = await readProgressState(safeStatePath);
    return NextResponse.json({ ...state, source });
  } catch (error) {
    logRouteError("GET /api/progress", error);
    return NextResponse.json({ message: "Could not read progress state." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const refusal = rejectCrossOriginWrite(request);

  if (refusal) {
    return refusal;
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    // Serialize the whole read-modify-write. The client queues its own actions,
    // but a second tab (or a replayed request) would otherwise interleave and
    // silently drop one side's changes.
    return await withStateLock(() => applyAction(payload));
  } catch (error) {
    logRouteError("POST /api/progress", error);
    return NextResponse.json({ message: "Could not save progress state." }, { status: 500 });
  }
}

/** Serializes state mutations within this process. */
let stateQueue: Promise<unknown> = Promise.resolve();

function withStateLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = stateQueue.then(operation, operation);
  // Keep the chain alive regardless of how this operation settled.
  stateQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function applyAction(payload: Record<string, unknown>): Promise<NextResponse> {
  try {
    const safePaths = await resolveProgressPaths();

    if (!safePaths) {
      return NextResponse.json({ message: "Invalid progress state path." }, { status: 400 });
    }

    const action = readString(payload.action);
    const { state } = await readProgressState(safePaths.state);

    if (action === "setLessonComplete") {
      const slug = readProgressId(payload.slug);
      const completed = typeof payload.completed === "boolean" ? payload.completed : null;
      const activityDay = readProgressDate(payload.date);

      if (!slug || completed === null || !activityDay) {
        return NextResponse.json(
          { message: "Lesson, completion state, and date are required." },
          { status: 400 },
        );
      }

      state.completedLessons = setMembership(state.completedLessons, slug, completed);
      state.activityDays = addActivityDay(state.activityDays, activityDay);
    } else if (action === "recordLessonVisit") {
      const slug = readProgressId(payload.slug);
      const activityDay = readProgressDate(payload.date);

      if (!slug || !activityDay) {
        return NextResponse.json({ message: "Lesson and date are required." }, { status: 400 });
      }

      state.lastVisitedLesson = slug;
      state.activityDays = addActivityDay(state.activityDays, activityDay);
    } else if (action === "addEvidence") {
      const entry = normalizeEvidenceEntry(payload.entry);
      const activityDay = readProgressDate(payload.date);

      if (!entry || !activityDay) {
        return NextResponse.json(
          { message: "Evidence needs a title and a valid date." },
          { status: 400 },
        );
      }

      state.evidence = addEvidenceEntry(state.evidence, entry);
      state.activityDays = addActivityDay(state.activityDays, activityDay);
    } else if (action === "updateEvidence") {
      const entry = normalizeEvidenceEntry(payload.entry);

      if (!entry) {
        return NextResponse.json(
          { message: "Evidence needs a title and a valid date." },
          { status: 400 },
        );
      }

      // Upsert by id: editing keeps the same id, so this replaces in place.
      state.evidence = addEvidenceEntry(state.evidence, entry);
    } else if (action === "deleteEvidence") {
      const id = readProgressId(payload.id);

      if (!id) {
        return NextResponse.json({ message: "An evidence id is required." }, { status: 400 });
      }

      state.evidence = state.evidence.filter((entry) => entry.id !== id);
    } else if (action === "setMilestoneReached") {
      const id = readProgressId(payload.id);
      const reached = typeof payload.reached === "boolean" ? payload.reached : null;
      const activityDay = readProgressDate(payload.date);

      if (!id || reached === null || !activityDay) {
        return NextResponse.json(
          { message: "A milestone id, reached state, and date are required." },
          { status: 400 },
        );
      }

      state.reachedMilestones = setMembership(state.reachedMilestones, id, reached);
      state.activityDays = addActivityDay(state.activityDays, activityDay);
    } else if (action === "setPlanReviewed") {
      const id = readProgressId(payload.id);
      const reviewed = typeof payload.reviewed === "boolean" ? payload.reviewed : null;
      const activityDay = readProgressDate(payload.date);

      if (!id || reviewed === null || !activityDay) {
        return NextResponse.json(
          { message: "A plan-review id, reviewed state, and date are required." },
          { status: 400 },
        );
      }

      state.reviewedPlans = setMembership(state.reviewedPlans, id, reviewed);
      state.activityDays = addActivityDay(state.activityDays, activityDay);
    } else if (action === "replace") {
      const replacement = normalizeProgressState(payload.state);
      await writeProgressState(replacement, safePaths);
      return NextResponse.json(replacement);
    } else {
      return NextResponse.json({ message: "Unsupported progress action." }, { status: 400 });
    }

    await writeProgressState(state, safePaths);
    return NextResponse.json(state);
  } catch (error) {
    logRouteError(`POST /api/progress (${readString(payload.action)})`, error);
    return NextResponse.json({ message: "Could not save progress state." }, { status: 500 });
  }
}

async function resolveProgressPaths(): Promise<{ state: string; temporary: string } | null> {
  const [safeStatePath, safeTemporaryPath] = await Promise.all([
    resolveSafeStoragePath(progressRoot, statePath),
    resolveSafeStoragePath(progressRoot, `${statePath}.tmp`),
  ]);

  return safeStatePath && safeTemporaryPath
    ? { state: safeStatePath, temporary: safeTemporaryPath }
    : null;
}

async function readProgressState(
  safeStatePath: string,
): Promise<{ state: ProgressState; source: "file" | "default" }> {
  try {
    const raw = await fs.readFile(safeStatePath, "utf8");
    return { state: normalizeProgressState(JSON.parse(raw) as unknown), source: "file" };
  } catch (error) {
    if (isFileNotFound(error)) {
      return { state: createEmptyProgressState(), source: "default" };
    }

    throw error;
  }
}

/**
 * Write via a temp file and rename, so an interrupted write cannot leave a
 * half-serialized state.json that the next read would discard as unparseable.
 */
async function writeProgressState(
  state: ProgressState,
  safePaths: { state: string; temporary: string },
): Promise<void> {
  await fs.mkdir(path.dirname(safePaths.state), { recursive: true });
  await fs.writeFile(safePaths.temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.rename(safePaths.temporary, safePaths.state);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
