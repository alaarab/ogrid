/**
 * Base class for OGrid top-level components (Material, Radix).
 * Contains all shared TypeScript logic. Subclasses provide a @Component
 * decorator with their own selector, template, and imports.
 */
import { Directive, Input, signal, effect, inject } from '@angular/core';
import { OGridService } from '../services/ogrid.service';
import type { IOGridProps } from '../types';

@Directive()
export abstract class BaseOGridComponent<T> {
  private readonly propsSignal = signal<IOGridProps<T> | undefined>(undefined);
  readonly ogridService = inject<OGridService<T>>(OGridService);

  @Input({ required: true })
  set props(value: IOGridProps<T>) {
    this.propsSignal.set(value);
  }

  constructor() {
    effect(() => {
      const p = this.propsSignal();
      if (p) this.ogridService.configure(p);
    });
  }

  get showToolbar(): boolean {
    return this.ogridService.columnChooserPlacement() === 'toolbar' || this.ogridService.toolbar() != null || this.ogridService.fullScreen();
  }

  onPageSizeChange(size: number): void {
    this.ogridService.pagination().setPageSize(size);
  }
}
