import * as React from 'react';

export interface BaseLoadingOverlayClassNames {
  loadingOverlay?: string;
  loadingOverlayContent?: string;
  spinner?: string;
  loadingOverlayText?: string;
}

export interface BaseLoadingOverlayProps {
  message: string;
  classNames: BaseLoadingOverlayClassNames;
}

export function BaseLoadingOverlay({ message, classNames }: BaseLoadingOverlayProps): React.ReactElement {
  return (
    <div className={classNames.loadingOverlay} aria-live="polite">
      <div className={classNames.loadingOverlayContent}>
        <div className={classNames.spinner} />
        <span className={classNames.loadingOverlayText}>{message}</span>
      </div>
    </div>
  );
}
