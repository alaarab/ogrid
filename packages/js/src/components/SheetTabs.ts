import type { ISheetDef } from '@alaarab/ogrid-core';

export interface SheetTabsRenderProps {
  sheets: ISheetDef[];
  activeSheet: string;
  onSheetChange: (sheetId: string) => void;
  onSheetAdd?: () => void;
}

export class SheetTabs {
  private container: HTMLElement;
  private el: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(props: SheetTabsRenderProps): void {
    this.el?.remove();

    if (props.sheets.length === 0 || !props.activeSheet) {
      this.el = null;
      return;
    }

    const bar = document.createElement('div');
    bar.className = 'ogrid-sheet-tabs';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Sheet tabs');

    if (props.onSheetAdd) {
      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = 'ogrid-sheet-tabs__add-btn';
      addButton.textContent = '+';
      addButton.title = 'Add sheet';
      addButton.setAttribute('aria-label', 'Add sheet');
      addButton.addEventListener('click', props.onSheetAdd);
      bar.appendChild(addButton);
    }

    for (const sheet of props.sheets) {
      const isActive = sheet.id === props.activeSheet;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `ogrid-sheet-tabs__tab${isActive ? ' ogrid-sheet-tabs__tab--active' : ''}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.textContent = sheet.name;

      if (isActive && sheet.color) {
        tab.style.borderBottomColor = sheet.color;
      }

      tab.addEventListener('click', () => {
        if (sheet.id !== props.activeSheet) {
          props.onSheetChange(sheet.id);
        }
      });

      bar.appendChild(tab);
    }

    this.container.appendChild(bar);
    this.el = bar;
  }

  destroy(): void {
    this.el?.remove();
    this.el = null;
  }
}
