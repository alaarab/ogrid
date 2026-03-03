import { getResponsiveHiddenColumns, RESPONSIVE_BREAKPOINTS, resolveResponsiveConfig, applyResponsiveHiding } from '../responsiveColumns';

// Helper to create minimal column metas
function col(id, opts = {}) {
  return { columnId: id, name: id, ...opts };
}

describe('getResponsiveHiddenColumns', () => {
  const columns = [
    col('name', { responsivePriority: 0 }),        // always visible
    col('email', { responsivePriority: 1 }),        // hidden < 576px
    col('department', { responsivePriority: 2 }),   // hidden < 768px
    col('phone', { responsivePriority: 3 }),        // hidden < 992px
    col('address', { responsivePriority: 4 }),      // hidden < 1200px
    col('id', {}),                                  // no priority  to  never hidden
  ];

  it('returns empty set when containerWidth is 0', () => {
    expect(getResponsiveHiddenColumns(0, columns).size).toBe(0);
  });

  it('returns empty set when containerWidth is negative', () => {
    expect(getResponsiveHiddenColumns(-100, columns).size).toBe(0);
  });

  it('returns empty set when columns is empty', () => {
    expect(getResponsiveHiddenColumns(500, []).size).toBe(0);
  });

  it('hides priority > 0 columns at very narrow widths (< 576px)', () => {
    const hidden = getResponsiveHiddenColumns(400, columns);
    expect(hidden).toEqual(new Set(['email', 'department', 'phone', 'address']));
  });

  it('shows priority 0-1 columns at 576px+', () => {
    const hidden = getResponsiveHiddenColumns(600, columns);
    expect(hidden).toEqual(new Set(['department', 'phone', 'address']));
  });

  it('shows priority 0-2 columns at 768px+', () => {
    const hidden = getResponsiveHiddenColumns(800, columns);
    expect(hidden).toEqual(new Set(['phone', 'address']));
  });

  it('shows priority 0-3 columns at 992px+', () => {
    const hidden = getResponsiveHiddenColumns(1000, columns);
    expect(hidden).toEqual(new Set(['address']));
  });

  it('shows all columns at 1200px+', () => {
    const hidden = getResponsiveHiddenColumns(1400, columns);
    expect(hidden.size).toBe(0);
  });

  it('never hides columns without responsivePriority', () => {
    const hidden = getResponsiveHiddenColumns(200, columns);
    expect(hidden.has('id')).toBe(false);
  });

  it('never hides required columns regardless of priority', () => {
    const cols = [
      col('name', { responsivePriority: 0 }),
      col('required-col', { responsivePriority: 5, required: true }),
    ];
    const hidden = getResponsiveHiddenColumns(200, cols);
    expect(hidden.has('required-col')).toBe(false);
  });

  it('uses custom breakpoints when provided', () => {
    const config = {
      breakpoints: [
        { minWidth: 0, maxPriority: 0 },
        { minWidth: 500, maxPriority: Infinity },
      ],
    };
    // At 400px  to  only priority 0
    const hidden400 = getResponsiveHiddenColumns(400, columns, config);
    expect(hidden400).toEqual(new Set(['email', 'department', 'phone', 'address']));
    // At 500px  to  all shown
    const hidden500 = getResponsiveHiddenColumns(500, columns, config);
    expect(hidden500.size).toBe(0);
  });

  it('handles columns where all have no responsivePriority', () => {
    const noPriorityCols = [col('a'), col('b'), col('c')];
    const hidden = getResponsiveHiddenColumns(200, noPriorityCols);
    expect(hidden.size).toBe(0);
  });

  it('handles exact breakpoint boundary (576px)', () => {
    const hidden = getResponsiveHiddenColumns(576, columns);
    // At exactly 576px, maxPriority=1  to  email (priority 1) visible, department+ hidden
    expect(hidden.has('name')).toBe(false);
    expect(hidden.has('email')).toBe(false);
    expect(hidden.has('department')).toBe(true);
  });

  it('exports RESPONSIVE_BREAKPOINTS as non-empty array', () => {
    expect(RESPONSIVE_BREAKPOINTS.length).toBeGreaterThan(0);
    // Verify ascending order
    for (let i = 1; i < RESPONSIVE_BREAKPOINTS.length; i++) {
      expect(RESPONSIVE_BREAKPOINTS[i].minWidth).toBeGreaterThan(RESPONSIVE_BREAKPOINTS[i - 1].minWidth);
    }
  });
});

describe('resolveResponsiveConfig', () => {
  it('returns empty object for true', () => {
    expect(resolveResponsiveConfig(true)).toEqual({});
  });

  it('returns undefined for false', () => {
    expect(resolveResponsiveConfig(false)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(resolveResponsiveConfig(undefined)).toBeUndefined();
  });

  it('passes through config object', () => {
    const config = { breakpoints: [{ minWidth: 0, maxPriority: 1 }] };
    expect(resolveResponsiveConfig(config)).toBe(config);
  });
});

describe('applyResponsiveHiding', () => {
  const columns = [
    col('name', { responsivePriority: 0 }),
    col('email', { responsivePriority: 1 }),
    col('phone', { responsivePriority: 3 }),
    col('id'),
  ];

  it('returns input array unchanged when config is undefined', () => {
    const result = applyResponsiveHiding(columns, 400, undefined);
    expect(result).toBe(columns); // same reference
  });

  it('returns input array unchanged when containerWidth is 0', () => {
    const result = applyResponsiveHiding(columns, 0, {});
    expect(result).toBe(columns);
  });

  it('filters columns when hiding is needed', () => {
    const result = applyResponsiveHiding(columns, 400, {});
    expect(result.map(c => c.columnId)).toEqual(['name', 'id']);
  });

  it('returns input array when no columns need hiding', () => {
    const result = applyResponsiveHiding(columns, 1400, {});
    expect(result).toBe(columns);
  });
});
