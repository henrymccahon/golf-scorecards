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

    expect(store.load()).toEqual({
      data: { customCourses: [course], rounds: [round] },
      recoveryRequired: false
    });
  });

  it('returns empty data when no prior state exists', () => {
    const store = createLocalScorecardStore(new MemoryStorage(), 'test-key');

    expect(store.load()).toEqual({
      data: { customCourses: [], rounds: [] },
      recoveryRequired: false
    });
  });

  it('returns a fresh empty state for each empty load', () => {
    const store = createLocalScorecardStore(new MemoryStorage(), 'test-key');

    const firstLoad = store.load();
    firstLoad.data.rounds.push(round);

    expect(store.load()).toEqual({
      data: { customCourses: [], rounds: [] },
      recoveryRequired: false
    });
  });

  it('requires recovery and preserves corrupt JSON instead of overwriting it', () => {
    const storage = new MemoryStorage();
    storage.setItem('test-key', '{corrupt');
    const store = createLocalScorecardStore(storage, 'test-key');

    expect(store.load()).toEqual({
      data: { customCourses: [], rounds: [] },
      recoveryRequired: true
    });
    expect(storage.getItem('test-key')).toBe('{corrupt');
    expect(storage.getItem('test-key-recovery')).toBe('{corrupt');
    expect(() => store.save({ customCourses: [course], rounds: [round] })).toThrow('reset saved data');
  });

  it('requires recovery for malformed persisted schemas', () => {
    const storage = new MemoryStorage();
    storage.setItem('test-key', JSON.stringify({ customCourses: [{ id: 'course-1' }], rounds: [] }));
    const store = createLocalScorecardStore(storage, 'test-key');

    expect(store.load().recoveryRequired).toBe(true);
    expect(storage.getItem('test-key-recovery')).toBe(storage.getItem('test-key'));
  });

  it('allows saving only after the user resets invalid saved data', () => {
    const storage = new MemoryStorage();
    storage.setItem('test-key', '{corrupt');
    const store = createLocalScorecardStore(storage, 'test-key');

    store.load();
    store.reset();
    store.save({ customCourses: [course], rounds: [round] });

    expect(store.load()).toEqual({
      data: { customCourses: [course], rounds: [round] },
      recoveryRequired: false
    });
  });
});
