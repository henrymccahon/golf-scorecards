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

  it('keeps start and edit callbacks unchanged', async () => {
    const onStartRound = vi.fn();
    const onEditCourse = vi.fn();

    renderApp(
      <CourseDetail
        course={makeCourse()}
        onBack={() => undefined}
        onStartRound={onStartRound}
        onEditCourse={onEditCourse}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit course' }));

    expect(onStartRound).toHaveBeenCalledWith('course-1');
    expect(onEditCourse).toHaveBeenCalledWith('course-1');
  });
});
