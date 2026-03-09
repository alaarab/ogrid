import { ColumnChooserComponent } from '../column-chooser/column-chooser.component';

describe('ColumnChooserComponent', () => {
  it('closes the chooser on Escape', () => {
    const comp = new ColumnChooserComponent();
    comp.columns = [];
    comp.visibleColumns = new Set();
    comp.isOpen.set(true);

    let prevented = false;
    let stopped = false;
    const event = {
      preventDefault: () => {
        prevented = true;
      },
      stopPropagation: () => {
        stopped = true;
      },
    } as unknown as KeyboardEvent;

    comp.onEscape(event);

    expect(comp.isOpen()).toBe(false);
    expect(prevented).toBe(true);
    expect(stopped).toBe(true);
  });
});
