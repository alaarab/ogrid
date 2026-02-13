import { useContextMenu } from '../composables/useContextMenu';

describe('useContextMenu', () => {
  it('initializes contextMenuPosition as null', () => {
    const { contextMenuPosition } = useContextMenu();
    expect(contextMenuPosition.value).toBeNull();
  });

  it('setContextMenuPosition updates position', () => {
    const { contextMenuPosition, setContextMenuPosition } = useContextMenu();
    setContextMenuPosition({ x: 100, y: 200 });
    expect(contextMenuPosition.value).toEqual({ x: 100, y: 200 });
  });

  it('setContextMenuPosition to null clears position', () => {
    const { contextMenuPosition, setContextMenuPosition } = useContextMenu();
    setContextMenuPosition({ x: 100, y: 200 });
    setContextMenuPosition(null);
    expect(contextMenuPosition.value).toBeNull();
  });

  it('handleCellContextMenu sets position from event', () => {
    const { contextMenuPosition, handleCellContextMenu } = useContextMenu();
    const preventDefault = jest.fn();
    handleCellContextMenu({ clientX: 150, clientY: 250, preventDefault });
    expect(contextMenuPosition.value).toEqual({ x: 150, y: 250 });
    expect(preventDefault).toHaveBeenCalled();
  });

  it('handleCellContextMenu works without preventDefault', () => {
    const { contextMenuPosition, handleCellContextMenu } = useContextMenu();
    handleCellContextMenu({ clientX: 50, clientY: 75 });
    expect(contextMenuPosition.value).toEqual({ x: 50, y: 75 });
  });

  it('closeContextMenu sets position to null', () => {
    const { contextMenuPosition, setContextMenuPosition, closeContextMenu } = useContextMenu();
    setContextMenuPosition({ x: 100, y: 200 });
    closeContextMenu();
    expect(contextMenuPosition.value).toBeNull();
  });
});
