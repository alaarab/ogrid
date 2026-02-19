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
      style={{ left: dropIndicatorX - wrapperLeft }}
    />
  );
}
