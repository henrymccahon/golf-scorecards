import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
    renderApp(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Courses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create course' }));
    await userEvent.type(screen.getByLabelText('Course name'), 'Saturday Nine');

    for (let hole = 1; hole <= 9; hole += 1) {
      await userEvent.clear(screen.getByLabelText(`Hole ${hole} par`));
      await userEvent.type(screen.getByLabelText(`Hole ${hole} par`), hole === 3 ? '3' : '4');
    }

    await userEvent.click(screen.getByRole('button', { name: 'Save course' }));

    expect(screen.getByText('Saturday Nine')).toBeInTheDocument();
  });
});
