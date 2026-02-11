import { renderHook, act } from '@testing-library/react';
import { useSideBarState } from '../useSideBarState';
import type { ISideBarDef } from '../../types';

describe('useSideBarState', () => {
  it('returns isEnabled=false when config is undefined', () => {
    const { result } = renderHook(() => useSideBarState({ config: undefined }));
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.activePanel).toBeNull();
  });

  it('returns isEnabled=false when config is false', () => {
    const { result } = renderHook(() => useSideBarState({ config: false }));
    expect(result.current.isEnabled).toBe(false);
  });

  it('returns isEnabled=true with default panels when config is true', () => {
    const { result } = renderHook(() => useSideBarState({ config: true }));
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.panels).toEqual(['columns', 'filters']);
    expect(result.current.position).toBe('right');
    expect(result.current.activePanel).toBeNull();
    expect(result.current.isOpen).toBe(false);
  });

  it('parses ISideBarDef with custom panels and position', () => {
    const config: ISideBarDef = { panels: ['filters'], position: 'left' };
    const { result } = renderHook(() => useSideBarState({ config }));
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.panels).toEqual(['filters']);
    expect(result.current.position).toBe('left');
  });

  it('opens with defaultPanel when specified', () => {
    const config: ISideBarDef = { defaultPanel: 'columns' };
    const { result } = renderHook(() => useSideBarState({ config }));
    expect(result.current.activePanel).toBe('columns');
    expect(result.current.isOpen).toBe(true);
  });

  it('toggle opens a panel', () => {
    const { result } = renderHook(() => useSideBarState({ config: true }));
    expect(result.current.isOpen).toBe(false);
    act(() => { result.current.toggle('columns'); });
    expect(result.current.activePanel).toBe('columns');
    expect(result.current.isOpen).toBe(true);
  });

  it('toggle closes panel if already active', () => {
    const { result } = renderHook(() => useSideBarState({ config: true }));
    act(() => { result.current.toggle('columns'); });
    expect(result.current.isOpen).toBe(true);
    act(() => { result.current.toggle('columns'); });
    expect(result.current.activePanel).toBeNull();
    expect(result.current.isOpen).toBe(false);
  });

  it('toggle switches panel when different panel is toggled', () => {
    const { result } = renderHook(() => useSideBarState({ config: true }));
    act(() => { result.current.toggle('columns'); });
    expect(result.current.activePanel).toBe('columns');
    act(() => { result.current.toggle('filters'); });
    expect(result.current.activePanel).toBe('filters');
    expect(result.current.isOpen).toBe(true);
  });

  it('close sets activePanel to null', () => {
    const { result } = renderHook(() => useSideBarState({ config: true }));
    act(() => { result.current.toggle('filters'); });
    expect(result.current.isOpen).toBe(true);
    act(() => { result.current.close(); });
    expect(result.current.activePanel).toBeNull();
    expect(result.current.isOpen).toBe(false);
  });

  it('setActivePanel sets panel directly', () => {
    const { result } = renderHook(() => useSideBarState({ config: true }));
    act(() => { result.current.setActivePanel('filters'); });
    expect(result.current.activePanel).toBe('filters');
    expect(result.current.isOpen).toBe(true);
    act(() => { result.current.setActivePanel(null); });
    expect(result.current.isOpen).toBe(false);
  });

  it('uses default position right when not specified in ISideBarDef', () => {
    const config: ISideBarDef = { panels: ['columns'] };
    const { result } = renderHook(() => useSideBarState({ config }));
    expect(result.current.position).toBe('right');
  });

  it('uses default panels when not specified in ISideBarDef', () => {
    const config: ISideBarDef = { position: 'left' };
    const { result } = renderHook(() => useSideBarState({ config }));
    expect(result.current.panels).toEqual(['columns', 'filters']);
  });
});
