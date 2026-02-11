import { GRID_CONTEXT_MENU_ITEMS, formatShortcut, getContextMenuHandlers } from '../gridContextMenuHelpers';
import type { GridContextMenuHandlerProps } from '../gridContextMenuHelpers';

describe('gridContextMenuHelpers', () => {
  describe('GRID_CONTEXT_MENU_ITEMS', () => {
    it('exports menu items array', () => {
      expect(Array.isArray(GRID_CONTEXT_MENU_ITEMS)).toBe(true);
      expect(GRID_CONTEXT_MENU_ITEMS.length).toBe(6);
    });

    it('includes undo item with correct properties', () => {
      const undo = GRID_CONTEXT_MENU_ITEMS.find((item) => item.id === 'undo');
      expect(undo).toEqual({
        id: 'undo',
        label: 'Undo',
        shortcut: 'Ctrl+Z',
      });
    });

    it('includes redo item with correct properties', () => {
      const redo = GRID_CONTEXT_MENU_ITEMS.find((item) => item.id === 'redo');
      expect(redo).toEqual({
        id: 'redo',
        label: 'Redo',
        shortcut: 'Ctrl+Y',
      });
    });

    it('includes copy item with divider and disabledWhenNoSelection', () => {
      const copy = GRID_CONTEXT_MENU_ITEMS.find((item) => item.id === 'copy');
      expect(copy).toEqual({
        id: 'copy',
        label: 'Copy',
        shortcut: 'Ctrl+C',
        disabledWhenNoSelection: true,
        dividerBefore: true,
      });
    });

    it('includes cut item with disabledWhenNoSelection', () => {
      const cut = GRID_CONTEXT_MENU_ITEMS.find((item) => item.id === 'cut');
      expect(cut).toEqual({
        id: 'cut',
        label: 'Cut',
        shortcut: 'Ctrl+X',
        disabledWhenNoSelection: true,
      });
    });

    it('includes paste item', () => {
      const paste = GRID_CONTEXT_MENU_ITEMS.find((item) => item.id === 'paste');
      expect(paste).toEqual({
        id: 'paste',
        label: 'Paste',
        shortcut: 'Ctrl+V',
      });
    });

    it('includes selectAll item with divider', () => {
      const selectAll = GRID_CONTEXT_MENU_ITEMS.find((item) => item.id === 'selectAll');
      expect(selectAll).toEqual({
        id: 'selectAll',
        label: 'Select all',
        shortcut: 'Ctrl+A',
        dividerBefore: true,
      });
    });
  });

  describe('formatShortcut', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('returns Ctrl as-is on non-Mac platforms', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Windows' },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('Ctrl+Z')).toBe('Ctrl+Z');
    });

    it('replaces Ctrl with ⌘ on Mac', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mac' },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('Ctrl+Z')).toBe('⌘+Z');
    });

    it('replaces Ctrl with ⌘ on iPhone', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'iPhone' },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('Ctrl+Y')).toBe('⌘+Y');
    });

    it('replaces Ctrl with ⌘ on iPad', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'iPad' },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('Ctrl+C')).toBe('⌘+C');
    });

    it('replaces Ctrl with ⌘ on iPod', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'iPod' },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('Ctrl+V')).toBe('⌘+V');
    });

    it('handles shortcuts without Ctrl', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mac' },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('Shift+A')).toBe('Shift+A');
    });

    it('handles undefined navigator', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('Ctrl+Z')).toBe('Ctrl+Z');
    });

    it('replaces only Ctrl word (not substring)', () => {
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mac' },
        writable: true,
        configurable: true,
      });
      expect(formatShortcut('Ctrl+Control')).toBe('⌘+Control');
    });
  });

  describe('getContextMenuHandlers', () => {
    it('returns handler map with all menu item ids', () => {
      const props: GridContextMenuHandlerProps = {
        onCopy: jest.fn(),
        onCut: jest.fn(),
        onPaste: jest.fn(),
        onSelectAll: jest.fn(),
        onUndo: jest.fn(),
        onRedo: jest.fn(),
        onClose: jest.fn(),
      };
      const handlers = getContextMenuHandlers(props);
      expect(Object.keys(handlers)).toEqual(['undo', 'redo', 'copy', 'cut', 'paste', 'selectAll']);
    });

    it('undo handler calls onUndo then onClose', () => {
      const onUndo = jest.fn();
      const onClose = jest.fn();
      const props: GridContextMenuHandlerProps = {
        onCopy: jest.fn(),
        onCut: jest.fn(),
        onPaste: jest.fn(),
        onSelectAll: jest.fn(),
        onUndo,
        onRedo: jest.fn(),
        onClose,
      };
      const handlers = getContextMenuHandlers(props);
      handlers.undo();
      expect(onUndo).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('redo handler calls onRedo then onClose', () => {
      const onRedo = jest.fn();
      const onClose = jest.fn();
      const props: GridContextMenuHandlerProps = {
        onCopy: jest.fn(),
        onCut: jest.fn(),
        onPaste: jest.fn(),
        onSelectAll: jest.fn(),
        onUndo: jest.fn(),
        onRedo,
        onClose,
      };
      const handlers = getContextMenuHandlers(props);
      handlers.redo();
      expect(onRedo).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('copy handler calls onCopy then onClose', () => {
      const onCopy = jest.fn();
      const onClose = jest.fn();
      const props: GridContextMenuHandlerProps = {
        onCopy,
        onCut: jest.fn(),
        onPaste: jest.fn(),
        onSelectAll: jest.fn(),
        onUndo: jest.fn(),
        onRedo: jest.fn(),
        onClose,
      };
      const handlers = getContextMenuHandlers(props);
      handlers.copy();
      expect(onCopy).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('cut handler calls onCut then onClose', () => {
      const onCut = jest.fn();
      const onClose = jest.fn();
      const props: GridContextMenuHandlerProps = {
        onCopy: jest.fn(),
        onCut,
        onPaste: jest.fn(),
        onSelectAll: jest.fn(),
        onUndo: jest.fn(),
        onRedo: jest.fn(),
        onClose,
      };
      const handlers = getContextMenuHandlers(props);
      handlers.cut();
      expect(onCut).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('paste handler calls onPaste then onClose', () => {
      const onPaste = jest.fn();
      const onClose = jest.fn();
      const props: GridContextMenuHandlerProps = {
        onCopy: jest.fn(),
        onCut: jest.fn(),
        onPaste,
        onSelectAll: jest.fn(),
        onUndo: jest.fn(),
        onRedo: jest.fn(),
        onClose,
      };
      const handlers = getContextMenuHandlers(props);
      handlers.paste();
      expect(onPaste).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('selectAll handler calls onSelectAll then onClose', () => {
      const onSelectAll = jest.fn();
      const onClose = jest.fn();
      const props: GridContextMenuHandlerProps = {
        onCopy: jest.fn(),
        onCut: jest.fn(),
        onPaste: jest.fn(),
        onSelectAll,
        onUndo: jest.fn(),
        onRedo: jest.fn(),
        onClose,
      };
      const handlers = getContextMenuHandlers(props);
      handlers.selectAll();
      expect(onSelectAll).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('each handler is an independent function', () => {
      const props: GridContextMenuHandlerProps = {
        onCopy: jest.fn(),
        onCut: jest.fn(),
        onPaste: jest.fn(),
        onSelectAll: jest.fn(),
        onUndo: jest.fn(),
        onRedo: jest.fn(),
        onClose: jest.fn(),
      };
      const handlers = getContextMenuHandlers(props);
      handlers.copy();
      expect(props.onCopy).toHaveBeenCalledTimes(1);
      expect(props.onCut).not.toHaveBeenCalled();
      expect(props.onPaste).not.toHaveBeenCalled();
      expect(props.onUndo).not.toHaveBeenCalled();
      expect(props.onRedo).not.toHaveBeenCalled();
      expect(props.onSelectAll).not.toHaveBeenCalled();
    });

    it('onClose is called for every handler', () => {
      const onClose = jest.fn();
      const props: GridContextMenuHandlerProps = {
        onCopy: jest.fn(),
        onCut: jest.fn(),
        onPaste: jest.fn(),
        onSelectAll: jest.fn(),
        onUndo: jest.fn(),
        onRedo: jest.fn(),
        onClose,
      };
      const handlers = getContextMenuHandlers(props);
      handlers.copy();
      handlers.cut();
      handlers.paste();
      handlers.selectAll();
      handlers.undo();
      handlers.redo();
      expect(onClose).toHaveBeenCalledTimes(6);
    });
  });
});
