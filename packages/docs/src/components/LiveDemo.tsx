import React, { useState, useEffect } from 'react';
import type { StackBlitzProject } from '../stackblitz/projects';
import type { FeatureDemoSet } from '../stackblitz/featureDemos';
import { OpenInStackBlitz } from './OpenInStackBlitz';

interface LiveDemoProps {
  children: React.ReactNode;
  height?: number;
  title?: string;
  /**
   * FeatureDemoSet with UI library variants per framework,
   * OR legacy format: Record<string, StackBlitzProject>.
   * The component will detect the current framework tab and show a UI library selector.
   */
  stackblitz?: FeatureDemoSet | Record<string, StackBlitzProject>;
}

type UILibrary = 'radix' | 'fluent' | 'material' | 'primeng' | 'vuetify' | 'primevue';

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 14px',
  borderBottom: '1px solid var(--ogrid-border-glass)',
  background: 'var(--ogrid-bg-subtle, #f5f5f5)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--ifm-color-emphasis-600)',
};

const selectorStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.75rem',
};

const selectStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '2px 6px',
  borderRadius: '4px',
  border: '1px solid var(--ifm-color-emphasis-300)',
  background: 'var(--ifm-background-color)',
  color: 'var(--ifm-font-color-base)',
  cursor: 'pointer',
};

const HEADER_HEIGHT = 34;
const STORAGE_KEY = 'ogrid-demo-ui-library';

// Labels for UI libraries
const UI_LIBRARY_LABELS: Record<UILibrary, string> = {
  radix: 'Radix',
  fluent: 'Fluent',
  material: 'Material',
  primeng: 'PrimeNG',
  vuetify: 'Vuetify',
  primevue: 'PrimeVue',
};

// Detect current framework from Docusaurus tabs
function detectFramework(): 'React' | 'Angular' | 'Vue' | 'JS' | null {
  // Check for framework tab in URL hash or active tab
  const hash = window.location.hash;
  if (hash.includes('react')) return 'React';
  if (hash.includes('angular')) return 'Angular';
  if (hash.includes('vue')) return 'Vue';
  if (hash.includes('js') || hash.includes('vanilla')) return 'JS';

  // Try to detect from active tab
  const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
  if (activeTab) {
    const label = activeTab.textContent?.toLowerCase() || '';
    if (label.includes('react')) return 'React';
    if (label.includes('angular')) return 'Angular';
    if (label.includes('vue')) return 'Vue';
    if (label.includes('js') || label.includes('vanilla')) return 'JS';
  }

  return 'React'; // default
}

export function LiveDemo({ children, height = 420, title, stackblitz }: LiveDemoProps) {
  const [framework, setFramework] = useState<'React' | 'Angular' | 'Vue' | 'JS'>('React');
  const [uiLibrary, setUILibrary] = useState<UILibrary>('radix');

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Object.keys(UI_LIBRARY_LABELS).includes(saved)) {
      setUILibrary(saved as UILibrary);
    }
  }, []);

  // Detect framework on mount and when URL changes
  useEffect(() => {
    const updateFramework = () => setFramework(detectFramework() || 'React');
    updateFramework();

    // Listen for hash changes (Docusaurus tabs)
    window.addEventListener('hashchange', updateFramework);

    // Also listen for clicks on tabs (some don't change hash)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[role="tab"]')) {
        setTimeout(updateFramework, 0);
      }
    };
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('hashchange', updateFramework);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  if (!stackblitz) {
    return (
      <div className="live-demo" style={{ height }}>
        <div style={headerStyle}>
          <span style={titleStyle}>{title ?? ''}</span>
          <div className="live-demo__actions">
            <span className="live-demo__badge">Live</span>
          </div>
        </div>
        <div className="live-demo__content" style={{ height: height - HEADER_HEIGHT }}>
          {children}
        </div>
      </div>
    );
  }

  // Check if it's the legacy format (Record<string, StackBlitzProject>)
  const isLegacyFormat = !('React' in stackblitz || 'Angular' in stackblitz || 'Vue' in stackblitz || 'JS' in stackblitz);

  if (isLegacyFormat) {
    // Legacy format: just render the first project
    const entries = Object.entries(stackblitz);
    const [label, project] = entries[0] || [];

    return (
      <div className="live-demo" style={{ height }}>
        <div style={headerStyle}>
          <span style={titleStyle}>{title ?? ''}</span>
          <div className="live-demo__actions">
            {project && <OpenInStackBlitz project={project as StackBlitzProject} />}
            <span className="live-demo__badge">Live</span>
          </div>
        </div>
        <div className="live-demo__content" style={{ height: height - HEADER_HEIGHT }}>
          {children}
        </div>
      </div>
    );
  }

  // New format: FeatureDemoSet with UI library variants
  const demoSet = stackblitz as FeatureDemoSet;
  const frameworkProjects = demoSet[framework];

  if (!frameworkProjects) {
    return (
      <div className="live-demo" style={{ height }}>
        <div style={headerStyle}>
          <span style={titleStyle}>{title ?? ''}</span>
          <div className="live-demo__actions">
            <span className="live-demo__badge">Live</span>
          </div>
        </div>
        <div className="live-demo__content" style={{ height: height - HEADER_HEIGHT }}>
          {children}
        </div>
      </div>
    );
  }

  const isJS = framework === 'JS';
  const project = isJS ? frameworkProjects as StackBlitzProject : (frameworkProjects as Record<UILibrary, StackBlitzProject>)[uiLibrary];

  // Get available UI libraries for current framework
  const availableLibs = isJS ? [] : Object.keys(frameworkProjects) as UILibrary[];

  const handleLibraryChange = (lib: UILibrary) => {
    setUILibrary(lib);
    localStorage.setItem(STORAGE_KEY, lib);
  };

  return (
    <div className="live-demo" style={{ height }}>
      <div style={headerStyle}>
        <span style={titleStyle}>{title ?? ''}</span>
        <div className="live-demo__actions">
          {!isJS && availableLibs.length > 1 && (
            <div style={selectorStyle}>
              <label htmlFor="ui-library-select" style={{ color: 'var(--ifm-color-emphasis-600)' }}>
                UI Library:
              </label>
              <select
                id="ui-library-select"
                style={selectStyle}
                value={uiLibrary}
                onChange={(e) => handleLibraryChange(e.target.value as UILibrary)}
              >
                {availableLibs.map((lib) => (
                  <option key={lib} value={lib}>
                    {UI_LIBRARY_LABELS[lib]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {project && <OpenInStackBlitz project={project} />}
          <span className="live-demo__badge">Live</span>
        </div>
      </div>
      <div className="live-demo__content" style={{ height: height - HEADER_HEIGHT }}>
        {children}
      </div>
    </div>
  );
}
