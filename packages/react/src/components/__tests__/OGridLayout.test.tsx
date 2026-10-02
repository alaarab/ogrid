import { render, screen } from '@testing-library/react';
import { OGridLayout } from '../OGridLayout';
import { GRID_ROOT_VIRTUAL_SCROLL_STYLE } from '../../constants/domHelpers';
import type { SideBarProps } from '../SideBar';

describe('OGridLayout virtual height', () => {
  const sideBar: SideBarProps = {
    activePanel: null, onPanelChange: jest.fn(), panels: ['columns'], position: 'right',
    columns: [], visibleColumns: new Set(), onVisibilityChange: jest.fn(), onSetVisibleColumns: jest.fn(),
    filterableColumns: [], filters: {}, onFilterChange: jest.fn(), filterOptions: {},
  };

  for (const sidebar of [undefined, sideBar]) {
    it(`allows virtual grids in short containers to shrink ${sidebar ? 'with' : 'without'} a sidebar`, () => {
      render(
        <OGridLayout sideBar={sidebar} pagination={<div>Footer</div>}>
          <div data-testid="virtual-root" style={GRID_ROOT_VIRTUAL_SCROLL_STYLE} />
        </OGridLayout>
      );
      const grid = screen.getByTestId('virtual-root');
      expect(grid.parentElement!.style.getPropertyValue('--ogrid-virtual-scroll-min-height')).toBe('0px');
      expect(screen.getByText('Footer')).toBeInTheDocument();
    });
  }

  it('preserves the standalone virtual grid height floor', () => {
    render(<div data-testid="standalone" style={GRID_ROOT_VIRTUAL_SCROLL_STYLE} />);
    expect(screen.getByTestId('standalone').style.minHeight).toBe('var(--ogrid-virtual-scroll-min-height, 480px)');
  });
});
