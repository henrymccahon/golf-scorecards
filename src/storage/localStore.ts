import type { Course, Round } from '../domain/types';

export interface ScorecardData {
  customCourses: Course[];
  rounds: Round[];
}

export interface ScorecardStore {
  load(): ScorecardData;
  save(data: ScorecardData): void;
}

function createEmptyData(): ScorecardData {
  return {
    customCourses: [],
    rounds: []
  };
}

function parseStoredData(raw: string): ScorecardData {
  try {
    const parsed = JSON.parse(raw) as Partial<ScorecardData>;
    return {
      customCourses: Array.isArray(parsed.customCourses) ? parsed.customCourses : [],
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds : []
    };
  } catch {
    return createEmptyData();
  }
}

export function createLocalScorecardStore(
  storage: Storage,
  key = 'golf-scorecard-v1'
): ScorecardStore {
  return {
    load() {
      const raw = storage.getItem(key);
      if (!raw) {
        return createEmptyData();
      }

      return parseStoredData(raw);
    },
    save(data) {
      storage.setItem(key, JSON.stringify(data));
    }
  };
}
