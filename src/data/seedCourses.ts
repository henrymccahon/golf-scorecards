import type { Course } from '../domain/types';

export const seedCourses: Course[] = [
  {
    id: 'seed-lakeview-nine',
    name: 'Lakeview Nine',
    source: 'seeded',
    holeCount: 9,
    holes: [
      { number: 1, par: 4, strokeIndex: 5, teeDistance: 322, teeDistanceUnit: 'meters' },
      { number: 2, par: 5, strokeIndex: 1, teeDistance: 475, teeDistanceUnit: 'meters' },
      { number: 3, par: 4, strokeIndex: 7, teeDistance: 331, teeDistanceUnit: 'meters' },
      { number: 4, par: 4, strokeIndex: 3, teeDistance: 360, teeDistanceUnit: 'meters' },
      { number: 5, par: 3, strokeIndex: 9, teeDistance: 145, teeDistanceUnit: 'meters' },
      { number: 6, par: 4, strokeIndex: 4, teeDistance: 342, teeDistanceUnit: 'meters' },
      { number: 7, par: 3, strokeIndex: 8, teeDistance: 158, teeDistanceUnit: 'meters' },
      { number: 8, par: 5, strokeIndex: 2, teeDistance: 492, teeDistanceUnit: 'meters' },
      { number: 9, par: 4, strokeIndex: 6, teeDistance: 350, teeDistanceUnit: 'meters' }
    ]
  },
  {
    id: 'seed-parklands-championship',
    name: 'Parklands Championship',
    source: 'seeded',
    holeCount: 18,
    holes: Array.from({ length: 18 }, (_, index) => ({
      number: index + 1,
      par: [4, 5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 5, 3, 4][index],
      strokeIndex: [7, 1, 9, 17, 5, 11, 3, 15, 13, 8, 10, 2, 18, 6, 12, 4, 16, 14][index],
      teeDistance: [356, 501, 338, 154, 372, 344, 486, 162, 351, 360, 333, 510, 142, 378, 347, 498, 155, 364][index],
      teeDistanceUnit: 'meters'
    }))
  }
];
