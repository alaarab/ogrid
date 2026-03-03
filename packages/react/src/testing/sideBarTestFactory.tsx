/**
 * Shared OGrid sidebar tests.
 * Each UI package calls createSideBarTests(OGrid) to run these.
 * Tests that the sideBar prop renders sidebar UI with columns and filters panels.
 */
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { fixtureRows, fixtureColumns, getRowId } from './fixtures';
import type { IOGridProps } from '@alaarab/ogrid-core';
import type { FixtureRow } from './fixtures';

export function createSideBarTests(OGrid: React.ComponentType<IOGridProps<FixtureRow>>): void {
  function renderOGrid(overrides: Partial<IOGridProps<FixtureRow>> = {}) {
    const defaultProps = {
      data: fixtureRows,
      columns: fixtureColumns,
      getRowId,
      entityLabelPlural: 'items',
      defaultPageSize: 10,
    };
    return render(<OGrid {...defaultProps} {...overrides} />);
  }

  describe('sideBar', () => {
    it('does not render sidebar when sideBar prop is not set', () => {
      renderOGrid();
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });

    it('renders sidebar with tab strip when sideBar=true', () => {
      renderOGrid({ sideBar: true });
      const sidebar = screen.getByRole('complementary', { name: /side bar/i });
      expect(sidebar).toBeInTheDocument();
      const tablist = screen.getByRole('tablist', { name: /side bar tabs/i });
      expect(tablist).toBeInTheDocument();
    });

    it('renders Columns and Filters tabs by default', () => {
      renderOGrid({ sideBar: true });
      expect(screen.getByRole('tab', { name: /columns/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /filters/i })).toBeInTheDocument();
    });

    it('opens Columns panel when Columns tab is clicked', () => {
      renderOGrid({ sideBar: true });
      const columnsTab = screen.getByRole('tab', { name: /columns/i });
      fireEvent.click(columnsTab);
      const panel = screen.getByRole('tabpanel', { name: /columns/i });
      expect(panel).toBeInTheDocument();
      // Should show column names as checkboxes inside the panel
      const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
    });

    it('opens Filters panel when Filters tab is clicked', () => {
      renderOGrid({ sideBar: true });
      const filtersTab = screen.getByRole('tab', { name: /filters/i });
      fireEvent.click(filtersTab);
      expect(screen.getByRole('tabpanel', { name: /filters/i })).toBeInTheDocument();
    });

    it('toggles panel closed when clicking the same tab again', () => {
      renderOGrid({ sideBar: true });
      const columnsTab = screen.getByRole('tab', { name: /columns/i });
      fireEvent.click(columnsTab);
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
      fireEvent.click(columnsTab);
      expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    });

    it('switches panel when clicking a different tab', () => {
      renderOGrid({ sideBar: true });
      const columnsTab = screen.getByRole('tab', { name: /columns/i });
      const filtersTab = screen.getByRole('tab', { name: /filters/i });
      fireEvent.click(columnsTab);
      expect(screen.getByRole('tabpanel', { name: /columns/i })).toBeInTheDocument();
      fireEvent.click(filtersTab);
      expect(screen.getByRole('tabpanel', { name: /filters/i })).toBeInTheDocument();
    });

    it('close button closes the panel', () => {
      renderOGrid({ sideBar: true });
      fireEvent.click(screen.getByRole('tab', { name: /columns/i }));
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /close panel/i }));
      expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    });

    it('Columns panel toggles column visibility', () => {
      renderOGrid({ sideBar: true });
      fireEvent.click(screen.getByRole('tab', { name: /columns/i }));
      // Status should be visible
      expect(screen.getAllByTestId('cell-status')).toHaveLength(3);
      // Find the Status checkbox in the sidebar panel
      const panel = screen.getByRole('tabpanel');
      // The checkboxes are for Name and Status columns  -  find the Status one
      const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
      // Second checkbox is Status (Name is first)
      fireEvent.click(checkboxes[1]);
      expect(screen.queryByTestId('cell-status')).not.toBeInTheDocument();
    });

    it('respects ISideBarDef with only columns panel', () => {
      renderOGrid({ sideBar: { panels: ['columns'] } });
      expect(screen.getByRole('tab', { name: /columns/i })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /filters/i })).not.toBeInTheDocument();
    });

    it('respects ISideBarDef with defaultPanel', () => {
      renderOGrid({ sideBar: { defaultPanel: 'columns' } });
      // Should auto-open the columns panel
      expect(screen.getByRole('tabpanel', { name: /columns/i })).toBeInTheDocument();
    });

    it('renders sidebar on left when position is left', () => {
      renderOGrid({ sideBar: { position: 'left' } });
      const sidebar = screen.getByRole('complementary', { name: /side bar/i });
      expect(sidebar).toBeInTheDocument();
    });

    it('Select All shows all columns, Clear All hides non-required', () => {
      renderOGrid({ sideBar: { defaultPanel: 'columns' } });
      // Click Clear All
      const clearAllBtn = screen.getByRole('button', { name: /clear all/i });
      fireEvent.click(clearAllBtn);
      // Required columns (name) remain visible; non-required columns (status) are hidden
      expect(screen.getAllByTestId('cell-name')).toHaveLength(3);
      expect(screen.queryByTestId('cell-status')).not.toBeInTheDocument();
      // Click Select All
      const selectAllBtn = screen.getByRole('button', { name: /select all/i });
      fireEvent.click(selectAllBtn);
      expect(screen.getAllByTestId('cell-name')).toHaveLength(3);
      expect(screen.getAllByTestId('cell-status')).toHaveLength(3);
    });
  });
}
