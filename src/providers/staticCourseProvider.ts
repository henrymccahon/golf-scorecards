import type { Course } from '../domain/types';
import { mapProviderCourseToCourse, type ProviderCourseRecord } from './providerCourseMapper';
import type { CourseProvider, CourseSearchQuery, CourseSearchResult } from './types';

const providerId = 'static-demo';
const providerName = 'Static Demo Provider';
const attribution = 'Static demonstration scorecard data';

const records: ProviderCourseRecord[] = [
  {
    providerId,
    providerName,
    externalCourseId: 'augusta-national',
    name: 'Augusta National',
    country: 'United States',
    region: 'Georgia',
    locality: 'Augusta',
    attribution,
    holes: [
      { number: 1, par: 4, teeDistance: 445, teeDistanceUnit: 'yards' },
      { number: 2, par: 5, teeDistance: 585, teeDistanceUnit: 'yards' },
      { number: 3, par: 4, teeDistance: 350, teeDistanceUnit: 'yards' },
      { number: 4, par: 3, teeDistance: 240, teeDistanceUnit: 'yards' },
      { number: 5, par: 4, teeDistance: 495, teeDistanceUnit: 'yards' },
      { number: 6, par: 3, teeDistance: 180, teeDistanceUnit: 'yards' },
      { number: 7, par: 4, teeDistance: 450, teeDistanceUnit: 'yards' },
      { number: 8, par: 5, teeDistance: 570, teeDistanceUnit: 'yards' },
      { number: 9, par: 4, teeDistance: 460, teeDistanceUnit: 'yards' },
      { number: 10, par: 4, teeDistance: 495, teeDistanceUnit: 'yards' },
      { number: 11, par: 4, teeDistance: 520, teeDistanceUnit: 'yards' },
      { number: 12, par: 3, teeDistance: 155, teeDistanceUnit: 'yards' },
      { number: 13, par: 5, teeDistance: 545, teeDistanceUnit: 'yards' },
      { number: 14, par: 4, teeDistance: 440, teeDistanceUnit: 'yards' },
      { number: 15, par: 5, teeDistance: 550, teeDistanceUnit: 'yards' },
      { number: 16, par: 3, teeDistance: 170, teeDistanceUnit: 'yards' },
      { number: 17, par: 4, teeDistance: 440, teeDistanceUnit: 'yards' },
      { number: 18, par: 4, teeDistance: 465, teeDistanceUnit: 'yards' }
    ]
  },
  {
    providerId,
    providerName,
    externalCourseId: 'royal-melbourne-demo',
    name: 'Royal Melbourne Demo Composite',
    country: 'Australia',
    region: 'Victoria',
    locality: 'Black Rock',
    attribution,
    holes: Array.from({ length: 18 }, (_, index) => ({
      number: index + 1,
      par: [4, 5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 5, 3, 4][index],
      teeDistance: [360, 500, 340, 150, 380, 350, 490, 160, 355, 370, 340, 510, 145, 380, 350, 500, 160, 365][index],
      teeDistanceUnit: 'meters'
    }))
  }
];

export const staticCourseProvider: CourseProvider = {
  id: providerId,
  name: providerName,
  attribution,
  async searchCourses(query: CourseSearchQuery): Promise<CourseSearchResult[]> {
    const text = query.text.trim().toLowerCase();
    if (text.length < 3) return [];

    return records
      .filter((record) => [
        record.name,
        record.country,
        record.region,
        record.locality
      ].filter(Boolean).join(' ').toLowerCase().includes(text))
      .map((record) => ({
        providerId: record.providerId,
        externalCourseId: record.externalCourseId,
        name: record.name,
        country: record.country,
        region: record.region,
        locality: record.locality,
        holeCount: record.holes.length === 9 || record.holes.length === 18 ? record.holes.length : undefined,
        hasScorecard: record.holes.length === 9 || record.holes.length === 18
      }));
  },
  async loadCourse(result: CourseSearchResult): Promise<Course> {
    const record = records.find((course) =>
      course.providerId === result.providerId && course.externalCourseId === result.externalCourseId
    );
    if (!record) {
      throw new Error('Provider course result could not be loaded.');
    }

    const mapped = mapProviderCourseToCourse(record);
    if (!mapped.course) {
      throw new Error(mapped.errors.join(' '));
    }
    return mapped.course;
  }
};
