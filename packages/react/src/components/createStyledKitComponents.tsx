/**
 * Factories for the styled shells every UI kit needs. Each kit passes its
 * own SCSS module and gets back a component bound to the kit's class names —
 * mirroring the createDataGridTable(styles, primitives) pattern, so the
 * shells live once here instead of byte-identical copies per kit.
 */
import * as React from 'react';
import {
  GridContextMenu as BaseGridContextMenu,
  type GridContextMenuProps as BaseGridContextMenuProps,
} from './GridContextMenu';
import { StatusBar as BaseStatusBar, type StatusBarProps as BaseStatusBarProps } from './StatusBar';
import { BaseDropIndicator } from './BaseDropIndicator';
import { BaseLoadingOverlay } from './BaseLoadingOverlay';

/** A kit's compiled SCSS module: class name → hashed class string. */
export type KitStylesModule = Record<string, string>;

export type StyledGridContextMenuProps = Omit<BaseGridContextMenuProps, 'classNames'>;

export function createGridContextMenu(
  styles: KitStylesModule,
): React.ComponentType<StyledGridContextMenuProps> {
  const classNames = {
    contextMenu: styles.contextMenu,
    contextMenuItem: styles.contextMenuItem,
    contextMenuItemLabel: styles.contextMenuItemLabel,
    contextMenuItemShortcut: styles.contextMenuItemShortcut,
    contextMenuDivider: styles.contextMenuDivider,
  };
  return function GridContextMenu(props: StyledGridContextMenuProps): React.ReactElement {
    return <BaseGridContextMenu {...props} classNames={classNames} />;
  };
}

export type StyledStatusBarProps = Omit<BaseStatusBarProps, 'classNames'>;

export function createStatusBar(styles: KitStylesModule): React.ComponentType<StyledStatusBarProps> {
  const classNames = {
    statusBar: styles.statusBar,
    statusBarItem: styles.statusBarItem,
    statusBarLabel: styles.statusBarLabel,
    statusBarValue: styles.statusBarValue,
  };
  return function StatusBar(props: StyledStatusBarProps): React.ReactElement {
    return <BaseStatusBar {...props} classNames={classNames} />;
  };
}

export interface StyledDropIndicatorProps {
  dropIndicatorX: number;
  wrapperLeft: number;
}

export function createDropIndicator(
  styles: KitStylesModule,
): React.ComponentType<StyledDropIndicatorProps> {
  return function DropIndicator({ dropIndicatorX, wrapperLeft }: StyledDropIndicatorProps): React.ReactElement {
    return (
      <BaseDropIndicator
        dropIndicatorX={dropIndicatorX}
        wrapperLeft={wrapperLeft}
        className={styles.dropIndicator}
      />
    );
  };
}

export interface StyledLoadingOverlayProps {
  message: string;
}

export function createLoadingOverlay(
  styles: KitStylesModule,
): React.ComponentType<StyledLoadingOverlayProps> {
  const classNames = {
    loadingOverlay: styles.loadingOverlay,
    loadingOverlayContent: styles.loadingOverlayContent,
    spinner: styles.spinner,
    loadingOverlayText: styles.loadingOverlayText,
  };
  return function LoadingOverlay({ message }: StyledLoadingOverlayProps): React.ReactElement {
    return <BaseLoadingOverlay message={message} classNames={classNames} />;
  };
}
