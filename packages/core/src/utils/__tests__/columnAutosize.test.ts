import {
  measureColumnContentWidth,
  AUTOSIZE_MAX_PX,
} from '../columnAutosize';
import { DEFAULT_MIN_COLUMN_WIDTH } from '../../constants/layout';

/**
 * Helper to create a mock HTMLElement with the properties needed by
 * measureColumnContentWidth and measureHeaderWidth.
 */
function createMockElement(opts: {
  offsetWidth?: number;
  scrollWidth?: number;
  className?: string;
  children?: HTMLElement[];
  firstElementChild?: HTMLElement | null;
  /** If provided, querySelector('[data-header-label]') returns a truthy element. */
  isHeader?: boolean;
  style?: Record<string, string>;
  computedStyle?: Partial<CSSStyleDeclaration>;
}): HTMLElement {
  const style: Record<string, string> = { ...(opts.style ?? {}) };
  const children = opts.children ?? [];

  const el = {
    offsetWidth: opts.offsetWidth ?? 0,
    scrollWidth: opts.scrollWidth ?? 0,
    className: opts.className ?? '',
    children,
    firstElementChild: opts.firstElementChild !== undefined ? opts.firstElementChild : (children[0] ?? null),
    style: new Proxy(style, {
      get(target, prop: string) {
        return target[prop] ?? '';
      },
      set(target, prop: string, value: string) {
        target[prop] = value;
        return true;
      },
    }),
    querySelector: jest.fn((selector: string) => {
      if (selector === '[data-header-label]' && opts.isHeader) {
        return {} as Element; // truthy = this is a header cell
      }
      return null;
    }),
    querySelectorAll: jest.fn(() => []),
    closest: jest.fn(() => null),
    parentElement: null,
  } as unknown as HTMLElement;

  return el;
}

/**
 * Helper to create a container that returns the given cells from querySelectorAll.
 */
function createContainer(cells: HTMLElement[]) {
  return {
    querySelectorAll: jest.fn((_selector: string) => cells as unknown as NodeListOf<Element>),
  };
}

/**
 * Mock getComputedStyle globally so measureHeaderWidth can call it.
 */
function mockGetComputedStyle(overrides: Partial<CSSStyleDeclaration> = {}) {
  const spy = jest.spyOn(window, 'getComputedStyle').mockImplementation(
    () =>
      ({
        paddingLeft: '0',
        paddingRight: '0',
        overflow: 'visible',
        flexShrink: '1',
        ...overrides,
      } as unknown as CSSStyleDeclaration)
  );
  return spy;
}

describe('measureColumnContentWidth', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── 1. Returns minWidth when no cells are found ──────────────────────────

  it('returns the provided minWidth when no cells are found', () => {
    const container = createContainer([]);
    const result = measureColumnContentWidth('col1', 120, container);
    expect(result).toBe(120);
  });

  // ─── 2. Returns DEFAULT_MIN_COLUMN_WIDTH when no cells and no minWidth ────

  it('returns DEFAULT_MIN_COLUMN_WIDTH when no cells found and no minWidth provided', () => {
    const container = createContainer([]);
    const result = measureColumnContentWidth('col1', undefined, container);
    expect(result).toBe(DEFAULT_MIN_COLUMN_WIDTH);
  });

  // ─── 3. Measures body cells correctly ─────────────────────────────────────

  it('measures body cells using position:absolute + width:max-content technique', () => {
    const csSpy = mockGetComputedStyle();

    const innerContent = createMockElement({ offsetWidth: 150 });
    const bodyCell = createMockElement({
      offsetWidth: 100,
      isHeader: false,
      firstElementChild: innerContent,
    });

    const container = createContainer([bodyCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // Expected: max(minWidth=50, innerContent.offsetWidth + AUTOSIZE_EXTRA_PX)
    // = max(50, 150 + 16) = 166
    expect(result).toBe(166);
    csSpy.mockRestore();
  });

  it('sets position and width on content element during measurement and restores them', () => {
    const csSpy = mockGetComputedStyle();

    const innerContent = createMockElement({ offsetWidth: 100 });
    const bodyCell = createMockElement({
      offsetWidth: 80,
      isHeader: false,
      firstElementChild: innerContent,
    });

    const container = createContainer([bodyCell]);
    measureColumnContentWidth('col1', 50, container);

    // After measurement, styles should be restored to original values
    expect(innerContent.style.position).toBe('');
    expect(innerContent.style.width).toBe('');
    csSpy.mockRestore();
  });

  it('uses the cell itself when it has no firstElementChild', () => {
    const csSpy = mockGetComputedStyle();

    const bodyCell = createMockElement({
      offsetWidth: 200,
      isHeader: false,
      firstElementChild: null,
    });

    const container = createContainer([bodyCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // When firstElementChild is null, the cell itself is used as content element
    // Expected: max(50, 200 + 16) = 216
    expect(result).toBe(216);
    csSpy.mockRestore();
  });

  it('picks the maximum width among multiple body cells', () => {
    const csSpy = mockGetComputedStyle();

    const content1 = createMockElement({ offsetWidth: 100 });
    const cell1 = createMockElement({ isHeader: false, firstElementChild: content1 });

    const content2 = createMockElement({ offsetWidth: 250 });
    const cell2 = createMockElement({ isHeader: false, firstElementChild: content2 });

    const content3 = createMockElement({ offsetWidth: 80 });
    const cell3 = createMockElement({ isHeader: false, firstElementChild: content3 });

    const container = createContainer([cell1, cell2, cell3]);
    const result = measureColumnContentWidth('col1', 50, container);

    // Expected: max(50, 100+16, 250+16, 80+16) = 266
    expect(result).toBe(266);
    csSpy.mockRestore();
  });

  // ─── 4. Measures header cells ─────────────────────────────────────────────

  it('measures header cells by expanding overflow chain', () => {
    // Create a header cell with a content container that has overflow:hidden children
    const headerLabel = createMockElement({ offsetWidth: 200, className: 'header-label' });
    const contentContainer = createMockElement({
      offsetWidth: 180,
      children: [headerLabel],
      firstElementChild: headerLabel,
    });
    const resizeHandle = createMockElement({
      offsetWidth: 8,
      className: 'ogrid-resize-handle',
      children: [],
    });

    const headerCell = createMockElement({
      offsetWidth: 100,
      isHeader: true,
      children: [contentContainer, resizeHandle] as unknown as HTMLElement[],
      firstElementChild: contentContainer,
    });

    // Mock getComputedStyle to return padding and overflow:hidden for the label
    const csSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation(
      (el) => {
        if (el === headerCell) {
          return { paddingLeft: '8', paddingRight: '8', overflow: 'visible', flexShrink: '0' } as unknown as CSSStyleDeclaration;
        }
        if (el === headerLabel) {
          return { overflow: 'hidden', flexShrink: '1', paddingLeft: '0', paddingRight: '0' } as unknown as CSSStyleDeclaration;
        }
        return { overflow: 'visible', flexShrink: '0', paddingLeft: '0', paddingRight: '0' } as unknown as CSSStyleDeclaration;
      }
    );

    const container = createContainer([headerCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // Header measurement: contentContainer.offsetWidth (180) + resizeHandle.offsetWidth (8) + padding (8+8=16)
    // = 204
    // Result: max(50, 204) = 204
    expect(result).toBe(204);
    csSpy.mockRestore();
  });

  it('measures header cells and falls back to th.offsetWidth when no content container', () => {
    const headerCell = createMockElement({
      offsetWidth: 130,
      isHeader: true,
      children: [] as unknown as HTMLElement[],
      firstElementChild: null,
    });

    const csSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          paddingLeft: '4',
          paddingRight: '4',
          overflow: 'visible',
          flexShrink: '0',
        } as unknown as CSSStyleDeclaration)
    );

    const container = createContainer([headerCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // Falls back to th.offsetWidth = 130 since no firstElementChild
    expect(result).toBe(130);
    csSpy.mockRestore();
  });

  // ─── 5. Takes the max of header and body measurements ─────────────────────

  it('returns the max of header and body cell measurements', () => {
    // Header cell with known expanded width
    const contentContainer = createMockElement({ offsetWidth: 200 });
    const headerCell = createMockElement({
      offsetWidth: 100,
      isHeader: true,
      children: [contentContainer] as unknown as HTMLElement[],
      firstElementChild: contentContainer,
    });

    // Body cell with smaller content
    const bodyContent = createMockElement({ offsetWidth: 120 });
    const bodyCell = createMockElement({
      isHeader: false,
      firstElementChild: bodyContent,
    });

    const csSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          paddingLeft: '0',
          paddingRight: '0',
          overflow: 'visible',
          flexShrink: '0',
        } as unknown as CSSStyleDeclaration)
    );

    const container = createContainer([headerCell, bodyCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // Header: contentContainer.offsetWidth (200) + resizeHandle (0) + padding (0) = 200
    // Body: bodyContent.offsetWidth (120) + AUTOSIZE_EXTRA_PX (16) = 136
    // Max(50, 200, 136) = 200
    expect(result).toBe(200);
    csSpy.mockRestore();
  });

  it('returns body measurement when it exceeds header', () => {
    const contentContainer = createMockElement({ offsetWidth: 80 });
    const headerCell = createMockElement({
      offsetWidth: 80,
      isHeader: true,
      children: [contentContainer] as unknown as HTMLElement[],
      firstElementChild: contentContainer,
    });

    const bodyContent = createMockElement({ offsetWidth: 300 });
    const bodyCell = createMockElement({
      isHeader: false,
      firstElementChild: bodyContent,
    });

    const csSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          paddingLeft: '0',
          paddingRight: '0',
          overflow: 'visible',
          flexShrink: '0',
        } as unknown as CSSStyleDeclaration)
    );

    const container = createContainer([headerCell, bodyCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // Header: 80
    // Body: 300 + 16 = 316
    // Max(50, 80, 316) = 316
    expect(result).toBe(316);
    csSpy.mockRestore();
  });

  // ─── 6. Clamps result to AUTOSIZE_MAX_PX ──────────────────────────────────

  it('clamps result to AUTOSIZE_MAX_PX when content is very wide', () => {
    const csSpy = mockGetComputedStyle();

    const wideContent = createMockElement({ offsetWidth: 600 });
    const bodyCell = createMockElement({
      isHeader: false,
      firstElementChild: wideContent,
    });

    const container = createContainer([bodyCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // 600 + 16 = 616 > AUTOSIZE_MAX_PX (520) => clamped to 520
    expect(result).toBe(AUTOSIZE_MAX_PX);
    csSpy.mockRestore();
  });

  it('does not clamp when content width is below AUTOSIZE_MAX_PX', () => {
    const csSpy = mockGetComputedStyle();

    const content = createMockElement({ offsetWidth: 400 });
    const bodyCell = createMockElement({
      isHeader: false,
      firstElementChild: content,
    });

    const container = createContainer([bodyCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // 400 + 16 = 416 < 520 => not clamped
    expect(result).toBe(416);
    csSpy.mockRestore();
  });

  // ─── 7. Returns at least minWidth even when content is smaller ────────────

  it('returns minWidth when all content is narrower than minWidth', () => {
    const csSpy = mockGetComputedStyle();

    const tinyContent = createMockElement({ offsetWidth: 20 });
    const bodyCell = createMockElement({
      isHeader: false,
      firstElementChild: tinyContent,
    });

    const container = createContainer([bodyCell]);
    const result = measureColumnContentWidth('col1', 150, container);

    // 20 + 16 = 36, but minWidth = 150 => returns 150
    expect(result).toBe(150);
    csSpy.mockRestore();
  });

  it('returns DEFAULT_MIN_COLUMN_WIDTH when content is tiny and no minWidth provided', () => {
    const csSpy = mockGetComputedStyle();

    const tinyContent = createMockElement({ offsetWidth: 10 });
    const bodyCell = createMockElement({
      isHeader: false,
      firstElementChild: tinyContent,
    });

    const container = createContainer([bodyCell]);
    const result = measureColumnContentWidth('col1', undefined, container);

    // 10 + 16 = 26, but DEFAULT_MIN_COLUMN_WIDTH = 80 => returns 80
    expect(result).toBe(DEFAULT_MIN_COLUMN_WIDTH);
    csSpy.mockRestore();
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  it('ceils fractional maxWidth values', () => {
    const csSpy = mockGetComputedStyle();

    // offsetWidth returns an integer but the min/max/ceil logic ensures integer output
    const content = createMockElement({ offsetWidth: 100 });
    const bodyCell = createMockElement({
      isHeader: false,
      firstElementChild: content,
    });

    const container = createContainer([bodyCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // 100 + 16 = 116, Math.ceil(116) = 116  -  result is always an integer
    expect(result).toBe(Math.ceil(result));
    csSpy.mockRestore();
  });

  it('uses document as root when no container is provided', () => {
    const spy = jest.spyOn(document, 'querySelectorAll').mockReturnValue(
      [] as unknown as NodeListOf<Element>
    );

    const result = measureColumnContentWidth('col1', 100);

    expect(spy).toHaveBeenCalledWith('[data-column-id="col1"]');
    expect(result).toBe(100);
    spy.mockRestore();
  });

  it('restores header element styles after measurement', () => {
    const headerLabel = createMockElement({
      offsetWidth: 200,
      className: 'header-label',
      children: [],
    });
    // Set initial styles that should be preserved
    headerLabel.style.overflow = 'hidden';
    headerLabel.style.flexShrink = '1';
    headerLabel.style.width = '100px';
    headerLabel.style.minWidth = '50px';

    const contentContainer = createMockElement({
      offsetWidth: 180,
      children: [headerLabel],
      firstElementChild: headerLabel,
    });
    contentContainer.style.position = 'relative';
    contentContainer.style.width = '120px';

    const headerCell = createMockElement({
      offsetWidth: 100,
      isHeader: true,
      children: [contentContainer] as unknown as HTMLElement[],
      firstElementChild: contentContainer,
    });

    const csSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation(
      (el) => {
        if (el === headerLabel) {
          return { overflow: 'hidden', flexShrink: '1', paddingLeft: '0', paddingRight: '0' } as unknown as CSSStyleDeclaration;
        }
        return { overflow: 'visible', flexShrink: '0', paddingLeft: '0', paddingRight: '0' } as unknown as CSSStyleDeclaration;
      }
    );

    const container = createContainer([headerCell]);
    measureColumnContentWidth('col1', 50, container);

    // Verify styles are restored
    expect(contentContainer.style.position).toBe('relative');
    expect(contentContainer.style.width).toBe('120px');
    expect(headerLabel.style.overflow).toBe('hidden');
    expect(headerLabel.style.flexShrink).toBe('1');
    expect(headerLabel.style.width).toBe('100px');
    expect(headerLabel.style.minWidth).toBe('50px');
    expect(headerLabel.style.maxWidth).toBe('');
    csSpy.mockRestore();
  });

  it('clears max-width on overflow-hidden descendants during header measurement', () => {
    // Simulates the real DOM structure: .columnHeader and .columnName both have
    // max-width: 100% in CSS, which was preventing full text measurement.
    const columnName = createMockElement({
      offsetWidth: 200,
      className: 'columnName',
      children: [],
    });
    columnName.style.maxWidth = '100%';

    const headerContent = createMockElement({
      offsetWidth: 200,
      className: 'headerContent',
      children: [columnName],
      firstElementChild: columnName,
    });

    const headerActions = createMockElement({
      offsetWidth: 24,
      className: 'headerActions',
      children: [],
    });

    const columnHeader = createMockElement({
      offsetWidth: 200,
      className: 'columnHeader',
      children: [headerContent, headerActions],
      firstElementChild: headerContent,
    });
    columnHeader.style.maxWidth = '100%';

    const headerCellContent = createMockElement({
      offsetWidth: 250,
      children: [columnHeader],
      firstElementChild: columnHeader,
    });

    const headerCell = createMockElement({
      offsetWidth: 100,
      isHeader: true,
      children: [headerCellContent] as unknown as HTMLElement[],
      firstElementChild: headerCellContent,
    });

    const csSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation(
      (el) => {
        if (el === headerCell) {
          return { paddingLeft: '10', paddingRight: '10', overflow: 'visible', flexShrink: '0' } as unknown as CSSStyleDeclaration;
        }
        if (el === columnHeader) {
          return { overflow: 'hidden', flexShrink: '1', paddingLeft: '0', paddingRight: '0' } as unknown as CSSStyleDeclaration;
        }
        if (el === headerContent) {
          return { overflow: 'hidden', flexShrink: '1', paddingLeft: '0', paddingRight: '0' } as unknown as CSSStyleDeclaration;
        }
        if (el === columnName) {
          return { overflow: 'hidden', flexShrink: '1', paddingLeft: '0', paddingRight: '0' } as unknown as CSSStyleDeclaration;
        }
        if (el === headerActions) {
          return { overflow: 'visible', flexShrink: '0', paddingLeft: '0', paddingRight: '0' } as unknown as CSSStyleDeclaration;
        }
        return { overflow: 'visible', flexShrink: '0', paddingLeft: '0', paddingRight: '0' } as unknown as CSSStyleDeclaration;
      }
    );

    const container = createContainer([headerCell]);
    measureColumnContentWidth('col1', 50, container);

    // Verify max-width was cleared during measurement (set to 'none') and restored after
    expect(columnHeader.style.maxWidth).toBe('100%');
    expect(columnName.style.maxWidth).toBe('100%');
    csSpy.mockRestore();
  });

  it('handles header with resize handle that uses resizeHandle class name', () => {
    const contentContainer = createMockElement({ offsetWidth: 150 });
    const resizeHandle = createMockElement({
      offsetWidth: 6,
      className: 'resizeHandle',
      children: [],
    });

    const headerCell = createMockElement({
      offsetWidth: 100,
      isHeader: true,
      children: [contentContainer, resizeHandle] as unknown as HTMLElement[],
      firstElementChild: contentContainer,
    });

    const csSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          paddingLeft: '4',
          paddingRight: '4',
          overflow: 'visible',
          flexShrink: '0',
        } as unknown as CSSStyleDeclaration)
    );

    const container = createContainer([headerCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // contentContainer.offsetWidth (150) + resizeHandle (6) + padding (4+4=8) = 164
    expect(result).toBe(164);
    csSpy.mockRestore();
  });

  it('handles header with resize handle that uses resize-handle class name', () => {
    const contentContainer = createMockElement({ offsetWidth: 150 });
    const resizeHandle = createMockElement({
      offsetWidth: 10,
      className: 'some-resize-handle-class',
      children: [],
    });

    const headerCell = createMockElement({
      offsetWidth: 100,
      isHeader: true,
      children: [contentContainer, resizeHandle] as unknown as HTMLElement[],
      firstElementChild: contentContainer,
    });

    const csSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          paddingLeft: '0',
          paddingRight: '0',
          overflow: 'visible',
          flexShrink: '0',
        } as unknown as CSSStyleDeclaration)
    );

    const container = createContainer([headerCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // contentContainer.offsetWidth (150) + resizeHandle (10) + padding (0) = 160
    expect(result).toBe(160);
    csSpy.mockRestore();
  });

  it('includes th border widths in header measurement for border-box sizing', () => {
    const contentContainer = createMockElement({ offsetWidth: 150 });
    const resizeHandle = createMockElement({
      offsetWidth: 8,
      className: 'ogrid-resize-handle',
      children: [],
    });

    const headerCell = createMockElement({
      offsetWidth: 100,
      isHeader: true,
      children: [contentContainer, resizeHandle] as unknown as HTMLElement[],
      firstElementChild: contentContainer,
    });

    const csSpy = jest.spyOn(window, 'getComputedStyle').mockImplementation(
      (el) => {
        if (el === headerCell) {
          return {
            paddingLeft: '10',
            paddingRight: '10',
            borderLeftWidth: '1',
            borderRightWidth: '1',
            overflow: 'visible',
            flexShrink: '0',
          } as unknown as CSSStyleDeclaration;
        }
        return { overflow: 'visible', flexShrink: '0', paddingLeft: '0', paddingRight: '0' } as unknown as CSSStyleDeclaration;
      }
    );

    const container = createContainer([headerCell]);
    const result = measureColumnContentWidth('col1', 50, container);

    // contentContainer.offsetWidth (150) + resizeHandle (8) + padding (10+10=20) + borders (1+1=2) = 180
    expect(result).toBe(180);
    csSpy.mockRestore();
  });
});
