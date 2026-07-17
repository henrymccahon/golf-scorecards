import type { Course, Round } from '../domain/types';

export interface ScorecardData {
  customCourses: Course[];
  rounds: Round[];
}

export interface ScorecardStore {
  load(): ScorecardData;
  save(data: ScorecardData): void;
}

const emptyData: ScorecardData = {
  customCourses: [],
  rounds: []
};

export function createLocalScorecardStore(
  storage: Storage,
  key = 'golf-scorecard-v1'
): ScorecardStore {
  return {
    load() {
      const raw = storage.getItem(key);
      if (!raw) {
        return emptyData;
      }

      const parsed = JSON.parse(raw) as Partial<ScorecardData>;
      return {
        customCourses: Array.isArray(parsed.customCourses) ? parsed.customCourses : [],
        rounds: Array.isArray(parsed.rounds) ? parsed.rounds : []
      };
    },
    save(data) {
      storage.setItem(key, JSON.stringify(data));
    }
  };
}
