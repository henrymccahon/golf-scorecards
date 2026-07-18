import { validateCourse } from '../domain/courses';
import type { Course, Hole, HoleCount, TeeDistanceUnit } from '../domain/types';

export interface ProviderHoleRecord {
  number: number;
  par: number;
  strokeIndex?: number;
  teeDistance?: number;
  teeDistanceUnit?: TeeDistanceUnit;
}

export interface ProviderCourseRecord {
  providerId: string;
  externalCourseId: string;
  providerName: string;
  name: string;
  country?: string;
  region?: string;
  locality?: string;
  attribution?: string;
  holes: ProviderHoleRecord[];
}

export interface ProviderCourseMappingResult {
  course?: Course;
  errors: string[];
}

export function createProviderCourseId(providerId: string, externalCourseId: string): string {
  return `provided-${slugPart(providerId)}-${slugPart(externalCourseId)}-raw-${createProviderIdentityKey(providerId, externalCourseId)}`;
}

export function createProviderIdentityKey(providerId: string, externalCourseId: string): string {
  return `${encodeIdentityPart(providerId)}-${encodeIdentityPart(externalCourseId)}`;
}

export function mapProviderCourseToCourse(
  record: ProviderCourseRecord,
  fetchedAt = new Date().toISOString()
): ProviderCourseMappingResult {
  if (record.holes.length !== 9 && record.holes.length !== 18) {
    return {
      errors: [`Provider course "${record.name}" must contain 9 or 18 holes.`]
    };
  }

  const holes: Hole[] = record.holes.map((hole) => ({
    number: hole.number,
    par: hole.par,
    strokeIndex: hole.strokeIndex,
    teeDistance: hole.teeDistance,
    teeDistanceUnit: hole.teeDistanceUnit
  }));

  const course: Course = {
    id: createProviderCourseId(record.providerId, record.externalCourseId),
    name: record.name,
    source: 'imported',
    holeCount: record.holes.length as HoleCount,
    holes,
    providerRef: {
      providerId: record.providerId,
      externalCourseId: record.externalCourseId,
      providerName: record.providerName,
      country: record.country,
      region: record.region,
      locality: record.locality,
      lastFetchedAt: fetchedAt,
      attribution: record.attribution
    }
  };

  const errors = validateCourse(course);
  return errors.length > 0 ? { errors } : { course, errors: [] };
}

function slugPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function encodeIdentityPart(value: string): string {
  const codePoints = Array.from(value, (character) => character.codePointAt(0)!.toString(36));
  return `${codePoints.length}:${codePoints.join('.')}`;
}
