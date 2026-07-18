import { describe, expect, it } from 'vitest';
import { staticCourseProvider } from './staticCourseProvider';

describe('static course provider', () => {
  it('returns no results for short queries', async () => {
    await expect(staticCourseProvider.searchCourses({ text: 'au' })).resolves.toEqual([]);
  });

  it('searches deterministic provided courses by name and geography', async () => {
    const byName = await staticCourseProvider.searchCourses({ text: 'Augusta' });
    const byRegion = await staticCourseProvider.searchCourses({ text: 'Georgia' });

    expect(byName[0]).toMatchObject({
      providerId: 'static-demo',
      externalCourseId: 'augusta-national',
      name: 'Augusta National',
      country: 'United States',
      region: 'Georgia',
      locality: 'Augusta',
      holeCount: 18,
      hasScorecard: true
    });
    expect(byRegion.map((result) => result.name)).toContain('Augusta National');
  });

  it('loads a searched course as an imported scorecard', async () => {
    const [result] = await staticCourseProvider.searchCourses({ text: 'Augusta' });
    const course = await staticCourseProvider.loadCourse(result);

    expect(course).toMatchObject({
      id: 'provided-static-demo-augusta-national',
      name: 'Augusta National',
      source: 'imported',
      holeCount: 18,
      providerRef: {
        providerId: 'static-demo',
        externalCourseId: 'augusta-national',
        providerName: 'Static Demo Provider'
      }
    });
    expect(course.holes).toHaveLength(18);
  });
});
