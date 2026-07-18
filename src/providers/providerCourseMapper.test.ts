import { describe, expect, it } from 'vitest';
import { createProviderCourseId, mapProviderCourseToCourse } from './providerCourseMapper';
import type { ProviderCourseRecord } from './providerCourseMapper';

const fetchedAt = '2026-07-18T00:00:00.000Z';

const validRecord: ProviderCourseRecord = {
  providerId: 'demo',
  externalCourseId: 'augusta-national',
  providerName: 'Demo Provider',
  name: 'Augusta National',
  country: 'United States',
  region: 'Georgia',
  locality: 'Augusta',
  attribution: 'Demo data',
  holes: [
    { number: 1, par: 4, teeDistance: 445, teeDistanceUnit: 'yards' },
    { number: 2, par: 5, teeDistance: 585, teeDistanceUnit: 'yards' },
    { number: 3, par: 4, teeDistance: 350, teeDistanceUnit: 'yards' },
    { number: 4, par: 3, teeDistance: 240, teeDistanceUnit: 'yards' },
    { number: 5, par: 4, teeDistance: 495, teeDistanceUnit: 'yards' },
    { number: 6, par: 3, teeDistance: 180, teeDistanceUnit: 'yards' },
    { number: 7, par: 4, teeDistance: 450, teeDistanceUnit: 'yards' },
    { number: 8, par: 5, teeDistance: 570, teeDistanceUnit: 'yards' },
    { number: 9, par: 4, teeDistance: 460, teeDistanceUnit: 'yards' }
  ]
};

describe('provider course mapper', () => {
  it('creates stable local ids from provider identity', () => {
    expect(createProviderCourseId('Demo Provider', 'Augusta National #1')).toMatch(
      /^provided-demo-provider-augusta-national-1-[a-z0-9]+$/
    );
  });

  it('creates distinct local ids for raw provider identities that share a slug', () => {
    expect(createProviderCourseId('provider', 'course/a')).not.toBe(
      createProviderCourseId('provider', 'course-a')
    );
  });

  it('maps a valid provider scorecard to an imported course', () => {
    const result = mapProviderCourseToCourse(validRecord, fetchedAt);

    expect(result.errors).toEqual([]);
    expect(result.course).toMatchObject({
      id: createProviderCourseId('demo', 'augusta-national'),
      name: 'Augusta National',
      source: 'imported',
      holeCount: 9,
      providerRef: {
        providerId: 'demo',
        externalCourseId: 'augusta-national',
        providerName: 'Demo Provider',
        country: 'United States',
        region: 'Georgia',
        locality: 'Augusta',
        lastFetchedAt: fetchedAt,
        attribution: 'Demo data'
      }
    });
    expect(result.course?.holes).toHaveLength(9);
    expect(result.course?.holes[0]).toEqual({
      number: 1,
      par: 4,
      teeDistance: 445,
      teeDistanceUnit: 'yards'
    });
  });

  it('rejects unsupported provider hole counts before saving', () => {
    const result = mapProviderCourseToCourse({
      ...validRecord,
      holes: validRecord.holes.slice(0, 3)
    }, fetchedAt);

    expect(result.course).toBeUndefined();
    expect(result.errors).toEqual(['Provider course "Augusta National" must contain 9 or 18 holes.']);
  });

  it('rejects provider scorecards that fail course validation', () => {
    const result = mapProviderCourseToCourse({
      ...validRecord,
      holes: validRecord.holes.map((hole, index) => index === 0 ? { ...hole, par: 0 } : hole)
    }, fetchedAt);

    expect(result.course).toBeUndefined();
    expect(result.errors).toContain('Hole 1 must have a positive par value.');
  });

  it.each([
    ['duplicate', validRecord.holes.map((hole, index) => index === 8 ? { ...hole, number: 8 } : hole)],
    ['skipped', validRecord.holes.map((hole, index) => index === 4 ? { ...hole, number: 6 } : hole)],
    ['out-of-order', [validRecord.holes[1], validRecord.holes[0], ...validRecord.holes.slice(2)]]
  ])('rejects %s provider hole numbers', (_description, holes) => {
    const result = mapProviderCourseToCourse({ ...validRecord, holes }, fetchedAt);

    expect(result.course).toBeUndefined();
    expect(result.errors).toContain('Holes must be numbered sequentially from 1 to 9.');
  });
});
