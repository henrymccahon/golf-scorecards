import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

export function renderApp(ui: ReactElement) {
  localStorage.clear();
  return render(ui);
}

export function renderAppWithExistingStorage(ui: ReactElement) {
  return render(ui);
}
