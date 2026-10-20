import * as React from 'react';

export interface BaseDropIndicatorProps {
  dropIndicatorX: number;
  wrapperLeft: number;
  className?: string;
}

export function BaseDropIndicator({ dropIndicatorX, wrapperLeft, className }: BaseDropIndicatorProps): React.ReactElement {
  return (
    <div
      className={className}
      data-ogrid-column-drop-indicator=""
      aria-hidden
      style={{ left: dropIndicatorX - wrapperLeft }}
    />
  );
}
