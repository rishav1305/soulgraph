/**
 * Custom render wrapper for React Testing Library.
 *
 * Wraps rendered components with any required providers (theme, context, etc.).
 * Import { render, screen, ... } from this file instead of @testing-library/react.
 */

import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';

/**
 * Provider wrapper for all tests.
 * Add context providers here as the app grows (e.g., SessionProvider, ThemeProvider).
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Custom render that wraps components in AllProviders.
 * Use this instead of raw render() from @testing-library/react.
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library, overriding render
export { customRender as render };
export { screen, fireEvent, waitFor, within, act } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
