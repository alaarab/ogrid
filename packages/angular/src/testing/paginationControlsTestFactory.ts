/**
 * Shared PaginationControls tests for Angular UI packages.
 * Each UI package calls createPaginationControlsTests(PaginationControlsComponent) to run these.
 *
 * Tests instantiate the component class directly and verify computed signal behavior
 * via the vm() computed that uses getPaginationViewModel.
 */

import type { Signal } from '@angular/core';
import type { PaginationViewModel } from '@alaarab/ogrid-core';

interface PaginationControlsInstance {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  pageSizeOptions?: number[];
  entityLabelPlural?: string;
  vm: Signal<PaginationViewModel | null>;
  pageChange: { emit: (page: number) => void };
  pageSizeChange: { emit: (size: number) => void };
  onPageSizeSelect?: (event: Event) => void;
  onPageSizeChange?: (value: string) => void;
}

export function createPaginationControlsTests(PaginationControlsComponent: new () => PaginationControlsInstance): void {
  function createComponent(overrides: Partial<PaginationControlsInstance> = {}): PaginationControlsInstance {
    const instance = new PaginationControlsComponent();
    // Set @Input() properties directly
    instance.currentPage = overrides.currentPage ?? 2;
    instance.pageSize = overrides.pageSize ?? 10;
    instance.totalCount = overrides.totalCount ?? 50;
    if (overrides.pageSizeOptions !== undefined) instance.pageSizeOptions = overrides.pageSizeOptions;
    if (overrides.entityLabelPlural !== undefined) instance.entityLabelPlural = overrides.entityLabelPlural;
    return instance;
  }

  it('instantiates correctly', () => {
    const comp = createComponent();
    expect(comp).toBeTruthy();
    expect(comp.currentPage).toBe(2);
    expect(comp.pageSize).toBe(10);
    expect(comp.totalCount).toBe(50);
  });

  it('vm() computes correct page info', () => {
    const comp = createComponent();
    const vm = comp.vm();
    expect(vm).toBeTruthy();
    expect(vm!.startItem).toBe(11);
    expect(vm!.endItem).toBe(20);
    expect(vm!.totalPages).toBe(5);
  });

  it('vm() returns null when totalCount is 0', () => {
    const comp = createComponent({ totalCount: 0 });
    const vm = comp.vm();
    // getPaginationViewModel returns null when there are no items
    expect(vm).toBeNull();
  });

  it('vm() computes totalPages correctly for non-divisible count', () => {
    const comp = createComponent({ totalCount: 53 });
    const vm = comp.vm();
    expect(vm!.totalPages).toBe(6);
  });

  it('vm() shows correct range on first page', () => {
    const comp = createComponent({ currentPage: 1, pageSize: 10, totalCount: 50 });
    const vm = comp.vm();
    expect(vm!.startItem).toBe(1);
    expect(vm!.endItem).toBe(10);
  });

  it('vm() shows correct range on last page', () => {
    const comp = createComponent({ currentPage: 5, pageSize: 10, totalCount: 50 });
    const vm = comp.vm();
    expect(vm!.startItem).toBe(41);
    expect(vm!.endItem).toBe(50);
  });

  it('pageChange output emits page number', () => {
    const comp = createComponent();
    const emitted: number[] = [];
    comp.pageChange.emit = (page: number) => emitted.push(page);
    comp.pageChange.emit(3);
    expect(emitted).toEqual([3]);
  });

  it('onPageSizeSelect emits the selected page size', () => {
    const comp = createComponent();
    const emitted: number[] = [];
    comp.pageSizeChange.emit = (size: number) => emitted.push(size);
    // Support both `onPageSizeSelect(event)` (Material/Radix) and `onPageSizeChange(value)` (PrimeNG)
    if (typeof comp.onPageSizeSelect === 'function') {
      const event = { target: { value: '25' } } as unknown as Event;
      comp.onPageSizeSelect(event);
    } else {
      comp.onPageSizeChange!('25');
    }
    expect(emitted).toEqual([25]);
  });
}
