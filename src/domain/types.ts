export type CourseSource = 'seeded' | 'custom' | 'imported';
export type HoleCount = 9 | 18;
export type TeeDistanceUnit = 'meters' | 'yards';

export interface Hole {
  number: number;
  par: number;
  strokeIndex?: number;
  teeDistance?: number;
  teeDistanceUnit?: TeeDistanceUnit;
}

export interface Course {
  id: string;
  name: string;
  source: CourseSource;
  holeCount: HoleCount;
  holes: Hole[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseSnapshot {
  id: string;
  name: string;
  source: CourseSource;
  holeCount: HoleCount;
  holes: Hole[];
}

export type RoundStatus = 'in_progress' | 'completed';

export interface ScoreEntry {
  holeNumber: number;
  strokes?: number;
  putts?: number;
  penalties?: number;
  fairwayHit?: boolean;
  greenInRegulation?: boolean;
}

export interface Round {
  id: string;
  status: RoundStatus;
  courseId?: string;
  courseSnapshot: CourseSnapshot;
  startedAt: string;
  completedAt?: string;
  player: string;
  scores: ScoreEntry[];
}
