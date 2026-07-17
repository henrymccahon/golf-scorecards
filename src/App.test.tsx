import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { renderApp, renderAppWithExistingStorage } from './test/render';

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
      await userEvent.click(screen.getByRole('button', { name: 'Create course' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Create course' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save course' }));

    expect(screen.getByText('Course name is required.')).toBeInTheDocument();
    expect(screen.queryByText('custom')).not.toBeInTheDocument();
  });

  it('persists custom courses across remounts', async () => {
    const firstRender = renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create course' }));
    await userEvent.type(screen.getByLabelText('Course name'), 'Saturday Nine');
    await userEvent.click(screen.getByRole('button', { name: 'Save course' }));

    firstRender.unmount();
    renderAppWithExistingStorage(<App />);

    expect(screen.getByText('Saturday Nine')).toBeInTheDocument();
  });

  it('edits a custom course without changing seeded courses', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create course' }));
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

    for (let hole = 1; hole <= 9; hole += 1) {
      await userEvent.clear(screen.getByLabelText(`Hole ${hole} strokes`));
      await userEvent.type(screen.getByLabelText(`Hole ${hole} strokes`), '4');
    }

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
    await userEvent.clear(screen.getByLabelText('Hole 1 strokes'));
    await userEvent.type(screen.getByLabelText('Hole 1 strokes'), '5');

    firstRender.unmount();
    renderAppWithExistingStorage(<App />);

    await userEvent.click(screen.getByRole('button', { name: /Resume Lakeview Nine/ }));
    expect(screen.getByLabelText('Hole 1 strokes')).toHaveValue(5);
  });

  it('routes a new start request to the existing in-progress round', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByText('Lakeview Nine'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByText('Parklands Championship'));
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }));

    expect(screen.getByRole('heading', { name: 'Lakeview Nine' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Hole 18 strokes')).not.toBeInTheDocument();
  });

  it('warns before editing a course that is referenced by a round', async () => {
    renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create course' }));
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
});
