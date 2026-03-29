/**
 * Layout.test.tsx — Unit tests for the app shell layout component.
 *
 * Tests:
 * - Structure: root container, sidebar, main content, right panel
 * - Skip-to-content: link present with correct href
 * - Sidebar toggle: open/close, aria-expanded, aria-label changes
 * - Backdrop: appears when sidebar open, click closes sidebar
 * - Escape key: closes sidebar when open
 * - Focus management: focus returns to toggle after close
 * - Right panel: conditional rendering
 * - Accessibility: role="navigation", aria-labels, sr-only h1
 *
 * Owner: Happy (QA) | Coverage expansion
 */

import { describe, it, expect, vi } from 'vitest';
import Layout from '@/components/Layout';
import { render, screen, fireEvent } from '../helpers/render';

// ─── Helpers ────────────────��─────────────────────────────────

function renderLayout(rightPanel?: React.ReactNode) {
  return render(
    <Layout
      sidebar={<div data-testid="test-sidebar">Sidebar Content</div>}
      rightPanel={rightPanel}
    >
      <div data-testid="test-children">Main Content</div>
    </Layout>,
  );
}

// ─── Structure ────────��───────────────────────────────────────

describe('Layout', () => {
  describe('structure', () => {
    it('renders layout root container', () => {
      renderLayout();
      expect(screen.getByTestId('layout-root')).toBeInTheDocument();
    });

    it('renders sidebar with navigation role', () => {
      renderLayout();
      const sidebar = screen.getByTestId('layout-sidebar');
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveAttribute('role', 'navigation');
      expect(sidebar).toHaveAttribute('aria-label', 'Session navigation');
    });

    it('renders sidebar content passed as prop', () => {
      renderLayout();
      expect(screen.getByTestId('test-sidebar')).toBeInTheDocument();
      expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
    });

    it('renders children in main content area', () => {
      renderLayout();
      expect(screen.getByTestId('test-children')).toBeInTheDocument();
      expect(screen.getByText('Main Content')).toBeInTheDocument();
    });

    it('renders main landmark with id for skip link target', () => {
      renderLayout();
      const main = screen.getByTestId('layout-main');
      expect(main.tagName).toBe('MAIN');
      expect(main).toHaveAttribute('id', 'main-content');
    });

    it('renders sidebar header with SoulGraph branding', () => {
      renderLayout();
      const header = screen.getByTestId('layout-sidebar-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('SoulGraph');
    });

    it('renders sidebar footer with version', () => {
      renderLayout();
      const footer = screen.getByTestId('layout-sidebar-footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveTextContent('SoulGraph v0.2.0');
    });

    it('renders mobile header with sidebar toggle', () => {
      renderLayout();
      expect(screen.getByTestId('layout-header')).toBeInTheDocument();
      expect(screen.getByTestId('layout-sidebar-toggle')).toBeInTheDocument();
    });
  });

  // ─��─ Skip-to-content ─────────────────────────────────────────

  describe('skip-to-content', () => {
    it('renders skip link with correct href', () => {
      renderLayout();
      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink.tagName).toBe('A');
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('skip link has sr-only class for visual hiding', () => {
      renderLayout();
      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink.className).toContain('sr-only');
    });
  });

  // ──�� Accessibility h1 ────────────────────────────────────────

  describe('heading hierarchy', () => {
    it('renders sr-only h1 for accessibility', () => {
      renderLayout();
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
      expect(h1).toHaveTextContent('SoulGraph — Multi-Agent RAG System');
      expect(h1.className).toContain('sr-only');
    });
  });

  // ���── Sidebar toggle ───────────��──────────────────────────────

  describe('sidebar toggle', () => {
    it('starts with sidebar closed', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAttribute('aria-label', 'Open sidebar');
    });

    it('opens sidebar on toggle click', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle).toHaveAttribute('aria-label', 'Close sidebar');
    });

    it('closes sidebar on second toggle click', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      fireEvent.click(toggle); // open
      fireEvent.click(toggle); // close
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAttribute('aria-label', 'Open sidebar');
    });

    it('toggle has aria-controls pointing to sidebar nav', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      expect(toggle).toHaveAttribute('aria-controls', 'layout-sidebar-nav');
    });

    it('sidebar nav has matching id', () => {
      renderLayout();
      const sidebar = screen.getByTestId('layout-sidebar');
      expect(sidebar).toHaveAttribute('id', 'layout-sidebar-nav');
    });
  });

  // ─��─ Backdrop ──────────────────────────────────���──────────────

  describe('backdrop', () => {
    it('does not render backdrop when sidebar is closed', () => {
      renderLayout();
      expect(
        screen.queryByTestId('layout-sidebar-backdrop'),
      ).not.toBeInTheDocument();
    });

    it('renders backdrop when sidebar is open', () => {
      renderLayout();
      fireEvent.click(screen.getByTestId('layout-sidebar-toggle'));
      expect(
        screen.getByTestId('layout-sidebar-backdrop'),
      ).toBeInTheDocument();
    });

    it('backdrop has aria-hidden=true', () => {
      renderLayout();
      fireEvent.click(screen.getByTestId('layout-sidebar-toggle'));
      expect(screen.getByTestId('layout-sidebar-backdrop')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    it('clicking backdrop closes sidebar', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      fireEvent.click(toggle); // open
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(screen.getByTestId('layout-sidebar-backdrop'));
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(
        screen.queryByTestId('layout-sidebar-backdrop'),
      ).not.toBeInTheDocument();
    });
  });

  // ─── Escape key ──────��────────────────────────────────────────

  describe('escape key', () => {
    it('closes sidebar when Escape is pressed', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      fireEvent.click(toggle); // open
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not react to Escape when sidebar is already closed', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      // Sidebar starts closed — Escape should be a no-op
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not react to other keys when sidebar is open', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      fireEvent.click(toggle); // open

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(toggle).toHaveAttribute('aria-expanded', 'true'); // still open
    });
  });

  // ─── Focus management ────────────────────────────────────────

  describe('focus management', () => {
    it('returns focus to toggle button after closing via backdrop', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      const focusSpy = vi.spyOn(toggle, 'focus');

      fireEvent.click(toggle); // open
      fireEvent.click(screen.getByTestId('layout-sidebar-backdrop')); // close

      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('returns focus to toggle button after closing via Escape', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      const focusSpy = vi.spyOn(toggle, 'focus');

      fireEvent.click(toggle); // open
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });
  });

  // ���── Right panel ────────────────────────────────────��─────────

  describe('right panel', () => {
    it('does not render right panel when prop is undefined', () => {
      renderLayout();
      expect(
        screen.queryByTestId('layout-right-panel'),
      ).not.toBeInTheDocument();
    });

    it('renders right panel when prop is provided', () => {
      renderLayout(
        <div data-testid="test-right-panel">Right Panel Content</div>,
      );
      expect(screen.getByTestId('layout-right-panel')).toBeInTheDocument();
      expect(screen.getByText('Right Panel Content')).toBeInTheDocument();
    });

    it('right panel is an aside with aria-label', () => {
      renderLayout(
        <div>Right Panel</div>,
      );
      const aside = screen.getByTestId('layout-right-panel');
      expect(aside.tagName).toBe('ASIDE');
      expect(aside).toHaveAttribute('aria-label', 'Agent visualization');
    });
  });

  // ─── SVG icon switching ───────────────────────────────────────

  describe('toggle icon', () => {
    it('shows hamburger icon when sidebar is closed', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      const svg = toggle.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // Hamburger has 3 horizontal lines: M3 5h12, M3 9h12, M3 13h12
      const path = toggle.querySelector('path');
      expect(path?.getAttribute('d')).toContain('M3 5h12');
    });

    it('shows close (X) icon when sidebar is open', () => {
      renderLayout();
      const toggle = screen.getByTestId('layout-sidebar-toggle');
      fireEvent.click(toggle);
      const path = toggle.querySelector('path');
      // Close icon: diagonal lines M4 4l10 10M14 4L4 14
      expect(path?.getAttribute('d')).toContain('M4 4l10 10');
    });
  });
});
