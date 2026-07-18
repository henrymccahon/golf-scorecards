import type { Course } from '../domain/types';

export interface CourseSearchQuery {
  text: string;
  country?: string;
  region?: string;
}

export interface CourseSearchResult {
  providerId: string;
  externalCourseId: string;
  name: string;
  country?: string;
  region?: string;
  locality?: string;
  holeCount?: 9 | 18;
  hasScorecard: boolean;
}

export interface CourseProvider {
  id: string;
  name: string;
  attribution?: string;
  searchCourses(query: CourseSearchQuery): Promise<CourseSearchResult[]>;
  loadCourse(result: CourseSearchResult): Promise<Course>;
}
