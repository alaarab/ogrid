import React, { useCallback } from 'react';
import type { StackBlitzProject } from '../stackblitz/projects';

interface OpenInStackBlitzProps {
  project: StackBlitzProject;
  label?: string;
}

export function OpenInStackBlitz({ project, label }: OpenInStackBlitzProps) {
  const open = useCallback(() => {
    import('@stackblitz/sdk').then((sdk) => {
      sdk.default.openProject(project, { openFile: Object.keys(project.files).pop() });
    });
  }, [project]);

  return (
    <button
      className="stackblitz-btn"
      onClick={open}
      title={`Open ${project.title} in StackBlitz`}
    >
      <svg width="14" height="14" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M12.747 16.273h-7.46L18.925 1.5l-3.671 10.227h7.46L9.075 26.5l3.672-10.227z" fill="currentColor" />
      </svg>
      {label ?? 'StackBlitz'}
    </button>
  );
}
