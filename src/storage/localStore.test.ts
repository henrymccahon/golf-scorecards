import { describe, expect, it } from 'vitest';
import { createLocalScorecardStore } from './localStore';
import type { Course, Round } from '../domain/types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const course: Course = {
  id: 'course-1',
  name: 'Local Course',
  source: 'custom',
  holeCount: 9,
  holes: Array.from({ length: 9 }, (_, index) => ({ number: index + 1, par: 4 }))
};

const round: Round = {
  id: 'round-1',
  status: 'in_progress',
  courseId: 'course-1',
  courseSnapshot: { id: 'course-1', name: 'Local Course', source: 'custom', holeCount: 9, holes: course.holes },
  startedAt: '2026-07-17T01:00:00.000Z',
  player: 'Player',
  scores: Array.from({ length: 9 }, (_, index) => ({ holeNumber: index + 1 }))
};

describe('local scorecard store', () => {
  it('saves and loads custom courses and rounds', () => {
    const store = createLocalScorecardStore(new MemoryStorage(), 'test-key');

    store.save({ customCourses: [course], rounds: [round] });

    expect(store.load()).toEqual({ customCourses: [course], rounds: [round] });
  });

  it('returns empty data when no prior state exists', () => {
    const store = createLocalScorecardStore(new MemoryStorage(), 'test-key');

    expect(store.load()).toEqual({ customCourses: [], rounds: [] });
  });
});
