/**
 * Single layout structure for OGrid: toolbar row (title, toolbar, column chooser),
 * grid area, pagination. UI packages supply Container and gap (Fluent/Radix: div + 16, Material: Box + 2 or 16).
 */

import * as React from 'react';

export interface OGridLayoutProps {
  /** Root container element (default: 'div'). Material can pass Box. */
  containerComponent?: React.ElementType;
  /** Extra props for the root container (e.g. sx for MUI Box). */
  containerProps?: Record<string, unknown>;
  /** Gap between layout sections in px (default: 16). Material may pass theme spacing via containerProps. */
  gap?: number | string;
  className?: string;
  title?: React.ReactNode;
  toolbar?: React.ReactNode;
  columnChooser?: React.ReactNode;
  /** Grid content (DataGridTable). */
  children: React.ReactNode;
  pagination?: React.ReactNode;
}

const defaultGap = 16;

/**
 * Renders OGrid layout: [toolbar row | title, toolbar, columnChooser] [grid] [pagination].
 * Inner structure uses divs; only the root uses Container so UIs can use Box/div and pass gap.
 */
export function OGridLayout(props: OGridLayoutProps): React.ReactElement {
  const {
    containerComponent: Container = 'div',
    containerProps = {},
    gap = defaultGap,
    className,
    title,
    toolbar,
    columnChooser,
    children,
    pagination,
  } = props;

  // Always apply flex layout; merge with any containerProps styles
  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: typeof gap === 'number' ? `${gap}px` : gap,
  };

  return (
    <Container
      className={className}
      style={rootStyle}
      {...containerProps}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 40 }}>
        {title != null ? <div style={{ margin: 0 }}>{title}</div> : null}
        {toolbar}
        {columnChooser}
      </div>
      <div style={{ width: '100%', minWidth: 0, flex: 1 }}>{children}</div>
      {pagination}
    </Container>
  );
}
