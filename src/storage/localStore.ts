import { validateCourse } from '../domain/courses';
import type { Course, Round } from '../domain/types';

export interface ScorecardData {
  savedCourses: Course[];
  rounds: Round[];
}

export interface ScorecardLoadResult {
  data: ScorecardData;
  recoveryRequired: boolean;
}

export interface ScorecardStore {
  load(): ScorecardLoadResult;
  save(data: ScorecardData): void;
  reset(): void;
}

function createEmptyData(): ScorecardData {
  return {
    savedCourses: [],
    rounds: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isProviderRef(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  if (typeof value.providerId !== 'string') return false;
  if (typeof value.externalCourseId !== 'string') return false;
  if (typeof value.providerName !== 'string') return false;
  if (typeof value.lastFetchedAt !== 'string') return false;
  if (!isOptionalString(value.country)) return false;
  if (!isOptionalString(value.region)) return false;
  if (!isOptionalString(value.locality)) return false;
  return isOptionalString(value.attribution);
}

function isHole(value: unknown): boolean {
  if (!isRecord(value) || !isPositiveInteger(value.number) || !isPositiveInteger(value.par)) return false;
  if (value.strokeIndex !== undefined && !isPositiveInteger(value.strokeIndex)) return false;
  if (value.teeDistance !== undefined && (typeof value.teeDistance !== 'number' || !Number.isFinite(value.teeDistance) || value.teeDistance <= 0)) return false;
  return value.teeDistanceUnit === undefined || value.teeDistanceUnit === 'meters' || value.teeDistanceUnit === 'yards';
}

function isCourse(value: unknown, allowedSources: readonly string[]): value is Course {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return false;
  if (!allowedSources.includes(String(value.source))) return false;
  if (value.holeCount !== 9 && value.holeCount !== 18) return false;
  if (!Array.isArray(value.holes) || value.holes.length !== value.holeCount || !value.holes.every(isHole)) return false;
  if (!isOptionalString(value.createdAt) || !isOptionalString(value.updatedAt)) return false;
  if (!isProviderRef(value.providerRef)) return false;
  return value.holes.every((hole, index) => isRecord(hole) && hole.number === index + 1);
}

function isScore(value: unknown): boolean {
  if (!isRecord(value) || !isPositiveInteger(value.holeNumber)) return false;
  if (value.strokes !== undefined && !isPositiveInteger(value.strokes)) return false;
  if (value.putts !== undefined && !isPositiveInteger(value.putts)) return false;
  if (value.penalties !== undefined && (typeof value.penalties !== 'number' || !Number.isInteger(value.penalties) || value.penalties < 0)) return false;
  if (value.fairwayHit !== undefined && typeof value.fairwayHit !== 'boolean') return false;
  return value.greenInRegulation === undefined || typeof value.greenInRegulation === 'boolean';
}

function isRound(value: unknown): value is Round {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.startedAt !== 'string' || typeof value.player !== 'string') return false;
  if (value.status !== 'in_progress' && value.status !== 'completed') return false;
  if (value.courseId !== undefined && typeof value.courseId !== 'string') return false;
  if (!isOptionalString(value.completedAt)) return false;
  if (value.status === 'completed' && value.completedAt === undefined) return false;
  if (!isCourse(value.courseSnapshot, ['seeded', 'custom', 'imported']) || !Array.isArray(value.scores)) return false;
  return value.scores.length === value.courseSnapshot.holeCount && value.scores.every((score, index) => (
    isScore(score) && isRecord(score) && score.holeNumber === index + 1
  ));
}

function parseStoredData(raw: string): ScorecardData | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.rounds)) return undefined;

    const savedCourses = Array.isArray(parsed.savedCourses)
      ? parsed.savedCourses
      : Array.isArray(parsed.customCourses)
        ? parsed.customCourses
        : undefined;

    if (!Array.isArray(savedCourses)) return undefined;
    if (!savedCourses.every((course) => isCourse(course, ['custom', 'imported']))) return undefined;
    if (!parsed.rounds.every(isRound)) return undefined;

    const validatedCourses = savedCourses as Course[];
    const validatedRounds = parsed.rounds as Round[];
    if (!validatedCourses.every((course) => validateCourse(course).length === 0)) return undefined;
    if (!validatedRounds.every((round) => validateCourse(round.courseSnapshot).length === 0)) return undefined;

    return {
      savedCourses: validatedCourses,
      rounds: validatedRounds
    };
  } catch {
    return undefined;
  }
}

export function createLocalScorecardStore(
  storage: Storage,
  key = 'golf-scorecard-v1'
): ScorecardStore {
  let recoveryRequired = false;

  return {
    load() {
      const raw = storage.getItem(key);
      if (!raw) {
        return { data: createEmptyData(), recoveryRequired: false };
      }

      const data = parseStoredData(raw);
      if (data) {
        return { data, recoveryRequired: false };
      }

      recoveryRequired = true;
      if (storage.getItem(`${key}-recovery`) === null) {
        storage.setItem(`${key}-recovery`, raw);
      }
      return { data: createEmptyData(), recoveryRequired: true };
    },
    save(data) {
      if (recoveryRequired) {
        throw new Error('Unable to save until you reset saved data.');
      }
      storage.setItem(key, JSON.stringify(data));
    },
    reset() {
      storage.removeItem(key);
      storage.removeItem(`${key}-recovery`);
      recoveryRequired = false;
    }
  };
}
