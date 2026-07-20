import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CourseDetail } from './CourseDetail';
import type { Course } from '../domain/types';
import { renderApp } from '../test/render';

function makeCourse(): Course {
  return {
    id: 'course-1',
    name: 'Polish Nine',
    source: 'custom',
    holeCount: 9,
    holes: Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      par: index === 0 ? 5 : 4,
      strokeIndex: index + 1,
      teeDistance: 120 + index,
      teeDistanceUnit: 'yards'
    }))
  };
}

describe('CourseDetail', () => {
  it('groups hole metadata so mobile rows can wrap with spacing', () => {
    renderApp(
      <CourseDetail
        course={makeCourse()}
        onBack={() => undefined}
        onStartRound={() => undefined}
        onEditCourse={() => undefined}
      />
    );

    const holeRow = screen.getByTestId('course-detail-hole-1');
    const metadata = screen.getByTestId('course-detail-hole-1-metadata');

    expect(holeRow).toContainElement(metadata);
    expect(metadata).toHaveTextContent('Par 5');
    expect(metadata).toHaveTextContent('SI 1');
    expect(metadata).toHaveTextContent('120 yards');
    expect(screen.queryByLabelText('Hole 1 scorecard row')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Hole 1 metadata')).not.toBeInTheDocument();
  });

  it('starts a new round when no in-progress round blocks the course', async () => {
    const onStartRound = vi.fn();
    const onEditCourse = vi.fn();

    renderApp(
      <CourseDetail
        course={makeCourse()}
        roundAction={{ type: 'start' }}
        onBack={() => undefined}
        onStartRound={onStartRound}
        onResumeRound={() => undefined}
        onEditCourse={onEditCourse}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit course' }));

    expect(onStartRound).toHaveBeenCalledWith('course-1');
    expect(onEditCourse).toHaveBeenCalledWith('course-1');
  });

  it('resumes the same course in-progress round from course detail', async () => {
    const onResumeRound = vi.fn();

    renderApp(
      <CourseDetail
        course={makeCourse()}
        roundAction={{
          type: 'resume',
          roundId: 'round-1',
          courseName: 'Polish Nine',
          progressLabel: '1/9 holes complete'
        }}
        onBack={() => undefined}
        onStartRound={() => undefined}
        onResumeRound={onResumeRound}
        onEditCourse={() => undefined}
      />
    );

    expect(screen.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument();
    expect(screen.getByText('1/9 holes complete')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Resume round' }));

    expect(onResumeRound).toHaveBeenCalledWith('round-1');
  });

  it('blocks starting a different course while another round is in progress', async () => {
    const onResumeRound = vi.fn();
    const onStartRound = vi.fn();

    renderApp(
      <CourseDetail
        course={makeCourse()}
        roundAction={{
          type: 'blocked',
          roundId: 'round-1',
          courseName: 'Lakeview Nine',
          progressLabel: '1/9 holes complete'
        }}
        onBack={() => undefined}
        onStartRound={onStartRound}
        onResumeRound={onResumeRound}
        onEditCourse={() => undefined}
      />
    );

    expect(screen.queryByRole('button', { name: 'Start round' })).not.toBeInTheDocument();
    expect(screen.getByText('Finish or abandon Lakeview Nine before starting another round.')).toBeInTheDocument();
    expect(screen.getByText('1/9 holes complete')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Resume Lakeview Nine' }));

    expect(onResumeRound).toHaveBeenCalledWith('round-1');
    expect(onStartRound).not.toHaveBeenCalled();
  });
});
