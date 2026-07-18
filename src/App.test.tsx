import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { seedCourses } from './data/seedCourses';
import { createRoundFromCourse } from './domain/rounds';
import type { Course } from './domain/types';
import { renderApp, renderAppWithExistingStorage } from './test/render';

function deferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

function providerCourse(externalCourseId: string, name: string): Course {
  return {
    id: `provided-test-provider-${externalCourseId}`,
    name,
    source: 'imported',
    holeCount: 9,
    holes: Array.from({ length: 9 }, (_, index) => ({ number: index + 1, par: 4 })),
    providerRef: {
      providerId: 'test-provider',
      externalCourseId,
      providerName: 'Test Provider',
      lastFetchedAt: '2026-07-18T00:00:00.000Z'
    }
  };
}

async function scoreVisibleRound(holeCount: number, strokesPerHole: number): Promise<void> {
  for (let hole = 1; hole <= holeCount; hole += 1) {
    for (let stroke = 0; stroke < strokesPerHole; stroke += 1) {
      await userEvent.click(screen.getByRole('button', { name: `Increase hole ${hole} strokes` }));
    }
    if (hole < holeCount) {
      await userEvent.click(screen.getByRole('button', { name: 'Next hole' }));
    }
  }
  await userEvent.click(screen.getByRole('button', { name: 'Review scorecard' }));
}

describe('App course flows', () => {
  it('searches seeded courses', async () => {
    renderApp(<App />);
    await userEvent.type(screen.getByLabelText('Search courses'), 'Parklands');
    expect(screen.getByText('Parklands Championship')).toBeInTheDocument();
    expect(screen.queryByText('Lakeview Nine')).not.toBeInTheDocument();
  });

  it('creates a custom 9-hole course and shows it in the course list', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderApp(<App />);

    try {
      await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create a custom course' }));
      await userEvent.type(screen.getByLabelText('Course name'), 'Saturday Nine');

      for (let hole = 1; hole <= 9; hole += 1) {
        await userEvent.clear(screen.getByLabelText(`Hole ${hole} par`));
        await userEvent.type(screen.getByLabelText(`Hole ${hole} par`), hole === 3 ? '3' : '4');
      }

      await userEvent.click(screen.getByRole('button', { name: 'Save course' }));

      expect(screen.getByText('Saturday Nine')).toBeInTheDocument();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('shows validation errors without saving an invalid custom course', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create a custom course' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save course' }));

    expect(screen.getByText('Course name is required.')).toBeInTheDocument();
    expect(screen.queryByText('custom')).not.toBeInTheDocument();
  });

  it('persists custom courses across remounts', async () => {
    const firstRender = renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create a custom course' }));
    await userEvent.type(screen.getByLabelText('Course name'), 'Saturday Nine');
    await userEvent.click(screen.getByRole('button', { name: 'Save course' }));

    firstRender.unmount();
    renderAppWithExistingStorage(<App />);

    expect(screen.getByText('Saturday Nine')).toBeInTheDocument();
  });

  it('edits a custom course without changing seeded courses', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create a custom course' }));
    await userEvent.type(screen.getByLabelText('Course name'), 'Saturday Nine');
    await userEvent.click(screen.getByRole('button', { name: 'Save course' }));

    await userEvent.click(screen.getByText('Saturday Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Edit course' }));
    await userEvent.clear(screen.getByLabelText('Course name'));
    await userEvent.type(screen.getByLabelText('Course name'), 'Sunday Nine');
    await userEvent.click(screen.getByRole('button', { name: 'Save course' }));

    expect(screen.getByText('Sunday Nine')).toBeInTheDocument();
    expect(screen.queryByText('Saturday Nine')).not.toBeInTheDocument();
    expect(screen.getByText('Lakeview Nine')).toBeInTheDocument();
  });

  it('starts a seeded course round, records strokes, finishes it, and shows history', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByText('Lakeview Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));

    await scoreVisibleRound(9, 4);
    await userEvent.click(screen.getByRole('button', { name: 'Finish round' }));
    expect(screen.getByText('Total 36')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByText('Lakeview Nine')).toBeInTheDocument();
    expect(screen.getByText(/Total 36/)).toBeInTheDocument();
  });

  it('resumes an in-progress autosaved round after remount', async () => {
    const firstRender = renderApp(<App />);

    await userEvent.click(screen.getByText('Lakeview Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    for (let stroke = 0; stroke < 5; stroke += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Increase hole 1 strokes' }));
    }

    firstRender.unmount();
    renderAppWithExistingStorage(<App />);

    await userEvent.click(screen.getByRole('button', { name: /Resume Lakeview Nine/ }));
    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('5');
  });

  it('routes a new start request to the existing in-progress round', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByText('Lakeview Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByText('Parklands Championship'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));

    expect(screen.getByRole('heading', { name: 'Lakeview Nine' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hole 18,/ })).not.toBeInTheDocument();
  });

  it('warns before editing a course that is referenced by a round', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create a custom course' }));
    await userEvent.type(screen.getByLabelText('Course name'), 'Saturday Nine');
    await userEvent.click(screen.getByRole('button', { name: 'Save course' }));
    await userEvent.click(screen.getByText('Saturday Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByText('Saturday Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Edit course' }));

    expect(screen.getByText(/Historical scorecards keep their original hole data/)).toBeInTheDocument();
  });

  it('exposes every persisted in-progress round for resuming', async () => {
    const firstRound = createRoundFromCourse(seedCourses[0], { id: 'round-1', startedAt: '2026-07-17T01:00:00.000Z' });
    const secondRound = createRoundFromCourse(seedCourses[1], { id: 'round-2', startedAt: '2026-07-17T02:00:00.000Z' });
    localStorage.setItem('golf-scorecard-v1', JSON.stringify({ savedCourses: [], rounds: [firstRound, secondRound] }));

    renderAppWithExistingStorage(<App />);

    expect(screen.getByRole('button', { name: 'Resume Lakeview Nine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume Parklands Championship' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resume Parklands Championship' }));

    expect(screen.getByRole('heading', { name: 'Parklands Championship' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hole 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hole 18, unplayed/ })).toBeInTheDocument();
  });

  it('does not warn when creating a course after loading a round without courseId', async () => {
    const roundWithoutCourseId = createRoundFromCourse(seedCourses[0], { id: 'round-1', startedAt: '2026-07-17T01:00:00.000Z' });
    delete roundWithoutCourseId.courseId;
    localStorage.setItem('golf-scorecard-v1', JSON.stringify({ savedCourses: [], rounds: [roundWithoutCourseId] }));

    renderAppWithExistingStorage(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create a custom course' }));

    expect(screen.queryByText(/Historical scorecards keep their original hole data/)).not.toBeInTheDocument();
  });

  it('loads legacy custom courses after storage migration', async () => {
    const legacyCourse: Course = {
      id: 'custom-legacy',
      name: 'Legacy Local Nine',
      source: 'custom',
      holeCount: 9,
      holes: Array.from({ length: 9 }, (_, index) => ({ number: index + 1, par: 4 }))
    };
    localStorage.setItem('golf-scorecard-v1', JSON.stringify({ customCourses: [legacyCourse], rounds: [] }));

    renderAppWithExistingStorage(<App />);

    await userEvent.type(screen.getByLabelText('Search courses'), 'Legacy');
    expect(screen.getByText('Legacy Local Nine')).toBeInTheDocument();
  });

  it('searches provided courses, saves one locally, and starts a round from it', async () => {
    renderApp(<App />);

    await userEvent.type(screen.getByLabelText('Search courses'), 'Augusta');
    await screen.findByLabelText('Provided courses');
    await userEvent.click(screen.getByRole('button', { name: /Augusta National/ }));

    expect(await screen.findByRole('heading', { name: 'Augusta National' })).toBeInTheDocument();
    expect(screen.getByText(/Static Demo Provider/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    expect(screen.getByRole('button', { name: /Hole 18, unplayed/ })).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('golf-scorecard-v1') ?? '{}');
    expect(stored.savedCourses[0]).toMatchObject({
      name: 'Augusta National',
      source: 'imported',
      providerRef: {
        providerId: 'static-demo',
        externalCourseId: 'augusta-national'
      }
    });
  });

  it('keeps custom course creation available as the course fallback', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    expect(screen.getByText("Can't find it?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create a custom course' }));

    expect(screen.getByRole('heading', { name: 'Create course' })).toBeInTheDocument();
  });

  it('shows a non-blocking provider error when search fails', async () => {
    const failingProvider = {
      id: 'failing-provider',
      name: 'Failing Provider',
      async searchCourses() {
        throw new Error('network unavailable');
      },
      async loadCourse() {
        throw new Error('network unavailable');
      }
    };

    renderApp(<App courseProvider={failingProvider} />);

    await userEvent.type(screen.getByLabelText('Search courses'), 'Augusta');

    expect(await screen.findByText('Provided course search is unavailable right now.')).toBeInTheDocument();
    expect(screen.getByText("Can't find it?")).toBeInTheDocument();
  });

  it('does not duplicate provider courses that are already saved locally', async () => {
    renderApp(<App />);

    await userEvent.type(screen.getByLabelText('Search courses'), 'Augusta');
    await userEvent.click(await screen.findByRole('button', { name: /Augusta National/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.clear(screen.getByLabelText('Search courses'));
    await userEvent.type(screen.getByLabelText('Search courses'), 'Augusta');

    expect(screen.getByText('Augusta National')).toBeInTheDocument();
    expect(screen.queryByLabelText('Provided courses')).not.toBeInTheDocument();
  });

  it('keeps a provider result visible when its colon-delimited identity differs from a saved course', async () => {
    const savedCourse: Course = {
      id: 'provided-saved',
      name: 'Saved Course',
      source: 'imported',
      holeCount: 9,
      holes: Array.from({ length: 9 }, (_, index) => ({ number: index + 1, par: 4 })),
      providerRef: {
        providerId: 'a:b',
        externalCourseId: 'c',
        providerName: 'Saved Provider',
        lastFetchedAt: '2026-07-18T00:00:00.000Z'
      }
    };
    const provider = {
      id: 'test-provider',
      name: 'Test Provider',
      searchCourses: async () => [{
        providerId: 'a',
        externalCourseId: 'b:c',
        name: 'Distinct Course',
        hasScorecard: true
      }],
      loadCourse: async () => providerCourse('unused', 'Unused Course')
    };
    localStorage.setItem('golf-scorecard-v1', JSON.stringify({ savedCourses: [savedCourse], rounds: [] }));

    renderAppWithExistingStorage(<App courseProvider={provider} />);
    await userEvent.type(screen.getByLabelText('Search courses'), 'Distinct');

    expect(await screen.findByRole('button', { name: /Distinct Course/ })).toBeInTheDocument();
  });

  it('ignores an out-of-order provider load after a newer selection completes', async () => {
    const firstLoad = deferred<Course>();
    const secondLoad = deferred<Course>();
    const firstResult = { providerId: 'test-provider', externalCourseId: 'first', name: 'First Course', hasScorecard: true };
    const secondResult = { providerId: 'test-provider', externalCourseId: 'second', name: 'Second Course', hasScorecard: true };
    const provider = {
      id: 'test-provider',
      name: 'Test Provider',
      searchCourses: async () => [firstResult, secondResult],
      loadCourse: (result: typeof firstResult) => result.externalCourseId === 'first' ? firstLoad.promise : secondLoad.promise
    };

    renderApp(<App courseProvider={provider} />);
    await userEvent.type(screen.getByLabelText('Search courses'), 'Course');
    await screen.findByLabelText('Provided courses');
    await userEvent.click(screen.getByRole('button', { name: /First Course/ }));
    await userEvent.click(screen.getByRole('button', { name: /Second Course/ }));

    await act(async () => {
      secondLoad.resolve(providerCourse('second', 'Second Course'));
    });
    expect(await screen.findByRole('heading', { name: 'Second Course' })).toBeInTheDocument();

    await act(async () => {
      firstLoad.resolve(providerCourse('first', 'First Course'));
    });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'First Course' })).not.toBeInTheDocument());

    const stored = JSON.parse(localStorage.getItem('golf-scorecard-v1') ?? '{}');
    expect(stored.savedCourses).toEqual([expect.objectContaining({ id: 'provided-test-provider-second' })]);
  });

  it('ignores a provider load when the search query changes', async () => {
    const pendingLoad = deferred<Course>();
    const oldResult = { providerId: 'test-provider', externalCourseId: 'old', name: 'Old Course', hasScorecard: true };
    const provider = {
      id: 'test-provider',
      name: 'Test Provider',
      searchCourses: async ({ text }: { text: string }) => text === 'Old' ? [oldResult] : [],
      loadCourse: () => pendingLoad.promise
    };

    renderApp(<App courseProvider={provider} />);
    await userEvent.type(screen.getByLabelText('Search courses'), 'Old');
    await userEvent.click(await screen.findByRole('button', { name: /Old Course/ }));
    await userEvent.clear(screen.getByLabelText('Search courses'));
    await userEvent.type(screen.getByLabelText('Search courses'), 'New');

    await act(async () => {
      pendingLoad.resolve(providerCourse('old', 'Old Course'));
    });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Old Course' })).not.toBeInTheDocument());

    const stored = JSON.parse(localStorage.getItem('golf-scorecard-v1') ?? '{"savedCourses":[]}');
    expect(stored.savedCourses).toEqual([]);
  });

  it('preserves an edited resumed round when a pending provider load resolves', async () => {
    const pendingLoad = deferred<Course>();
    const pendingResult = {
      providerId: 'test-provider',
      externalCourseId: 'pending',
      name: 'Pending Course',
      hasScorecard: true
    };
    const provider = {
      id: 'test-provider',
      name: 'Test Provider',
      searchCourses: async () => [pendingResult],
      loadCourse: () => pendingLoad.promise
    };
    const existingRound = createRoundFromCourse(seedCourses[0], {
      id: 'round-1',
      startedAt: '2026-07-18T01:00:00.000Z'
    });
    localStorage.setItem('golf-scorecard-v1', JSON.stringify({ savedCourses: [], rounds: [existingRound] }));

    renderAppWithExistingStorage(<App courseProvider={provider} />);
    await userEvent.type(screen.getByLabelText('Search courses'), 'Pending');
    await userEvent.click(await screen.findByRole('button', { name: /Pending Course/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Resume Lakeview Nine' }));
    for (let stroke = 0; stroke < 5; stroke += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Increase hole 1 strokes' }));
    }

    await act(async () => {
      pendingLoad.resolve(providerCourse('pending', 'Pending Course'));
    });

    expect(screen.getByRole('heading', { name: 'Lakeview Nine' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hole 1 displayed score')).toHaveTextContent('5');
    expect(screen.queryByRole('heading', { name: 'Pending Course' })).not.toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('golf-scorecard-v1') ?? '{}');
    expect(stored.savedCourses).toEqual([]);
    expect(stored.rounds[0].scores[0].strokes).toBe(5);
  });
});
