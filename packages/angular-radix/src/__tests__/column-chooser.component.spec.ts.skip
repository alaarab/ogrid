import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ColumnChooserComponent } from '../column-chooser/column-chooser.component';
import type { IColumnDefinition } from '@alaarab/ogrid-angular';

describe('ColumnChooserComponent', () => {
  let component: ColumnChooserComponent;
  let fixture: ComponentFixture<ColumnChooserComponent>;

  const mockColumns: IColumnDefinition[] = [
    { columnId: 'name', name: 'Name' },
    { columnId: 'status', name: 'Status' },
    { columnId: 'priority', name: 'Priority' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColumnChooserComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ColumnChooserComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display column count in trigger button', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('visibleColumns', new Set(['name', 'status']));
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.css('.ogrid-column-chooser__trigger'));
    expect(trigger.nativeElement.textContent).toContain('Columns (2/3)');
  });

  it('should toggle dropdown when trigger clicked', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('visibleColumns', new Set(['name']));
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.css('.ogrid-column-chooser__trigger'));

    // Initially closed
    expect(component.isOpen()).toBe(false);
    let dropdown = fixture.debugElement.query(By.css('.ogrid-column-chooser__dropdown'));
    expect(dropdown).toBeNull();

    // Click to open
    trigger.nativeElement.click();
    fixture.detectChanges();
    expect(component.isOpen()).toBe(true);
    dropdown = fixture.debugElement.query(By.css('.ogrid-column-chooser__dropdown'));
    expect(dropdown).toBeTruthy();

    // Click to close
    trigger.nativeElement.click();
    fixture.detectChanges();
    expect(component.isOpen()).toBe(false);
  });

  it('should show aria-expanded attribute', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('visibleColumns', new Set(['name']));
    fixture.detectChanges();

    const trigger = fixture.debugElement.query(By.css('.ogrid-column-chooser__trigger'));

    expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('false');

    component.toggle();
    fixture.detectChanges();

    expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('true');
  });

  it('should render all columns as checkboxes', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('visibleColumns', new Set(['name', 'status']));
    component.isOpen.set(true);
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('.ogrid-column-chooser__item'));
    expect(items.length).toBe(3);

    const checkboxes = fixture.debugElement.queryAll(By.css('input[type="checkbox"]'));
    expect(checkboxes.length).toBe(3);
  });

  it('should check visible columns', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('visibleColumns', new Set(['name', 'priority']));
    component.isOpen.set(true);
    fixture.detectChanges();

    const checkboxes = fixture.debugElement.queryAll(By.css('input[type="checkbox"]'));
    expect(checkboxes[0].nativeElement.checked).toBe(true); // name
    expect(checkboxes[1].nativeElement.checked).toBe(false); // status
    expect(checkboxes[2].nativeElement.checked).toBe(true); // priority
  });

  it('should emit visibilityChange when checkbox toggled', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('visibleColumns', new Set(['name']));
    component.isOpen.set(true);
    fixture.detectChanges();

    const visibilityChangeSpy = jest.fn();
    component.visibilityChange.subscribe(visibilityChangeSpy);

    const checkboxes = fixture.debugElement.queryAll(By.css('input[type="checkbox"]'));

    // Toggle status checkbox (currently unchecked)
    checkboxes[1].nativeElement.checked = true;
    checkboxes[1].nativeElement.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(visibilityChangeSpy).toHaveBeenCalledWith({
      columnKey: 'status',
      visible: true,
    });
  });

  it('should emit visibilityChange for all columns when selectAll clicked', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('visibleColumns', new Set(['name']));
    component.isOpen.set(true);
    fixture.detectChanges();

    const visibilityChangeSpy = jest.fn();
    component.visibilityChange.subscribe(visibilityChangeSpy);

    const selectAllBtn = fixture.debugElement.queryAll(By.css('.ogrid-column-chooser__btn'))[1];
    selectAllBtn.nativeElement.click();
    fixture.detectChanges();

    // Should emit for status and priority (not already visible)
    expect(visibilityChangeSpy).toHaveBeenCalledTimes(2);
    expect(visibilityChangeSpy).toHaveBeenCalledWith({ columnKey: 'status', visible: true });
    expect(visibilityChangeSpy).toHaveBeenCalledWith({ columnKey: 'priority', visible: true });
  });

  it('should emit visibilityChange for all columns when clearAll clicked', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('visibleColumns', new Set(['name', 'status', 'priority']));
    component.isOpen.set(true);
    fixture.detectChanges();

    const visibilityChangeSpy = jest.fn();
    component.visibilityChange.subscribe(visibilityChangeSpy);

    const clearAllBtn = fixture.debugElement.queryAll(By.css('.ogrid-column-chooser__btn'))[0];
    clearAllBtn.nativeElement.click();
    fixture.detectChanges();

    // Should emit for all 3 columns
    expect(visibilityChangeSpy).toHaveBeenCalledTimes(3);
    expect(visibilityChangeSpy).toHaveBeenCalledWith({ columnKey: 'name', visible: false });
    expect(visibilityChangeSpy).toHaveBeenCalledWith({ columnKey: 'status', visible: false });
    expect(visibilityChangeSpy).toHaveBeenCalledWith({ columnKey: 'priority', visible: false });
  });

  it('should close dropdown when clicking outside', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('visibleColumns', new Set(['name']));
    component.isOpen.set(true);
    fixture.detectChanges();

    // Simulate click outside
    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: outsideElement, enumerable: true });

    component.onDocumentClick(event);
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);

    document.body.removeChild(outsideElement);
  });

  it('should display correct header text', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('visibleColumns', new Set(['name', 'status']));
    component.isOpen.set(true);
    fixture.detectChanges();

    const header = fixture.debugElement.query(By.css('.ogrid-column-chooser__header'));
    expect(header.nativeElement.textContent).toContain('Select Columns (2 of 3)');
  });
});
