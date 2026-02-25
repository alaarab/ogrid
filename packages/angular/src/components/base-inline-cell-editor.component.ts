import { Input, Output, EventEmitter, signal, computed, ElementRef, ViewChild } from '@angular/core';
import type { IColumnDef } from '@alaarab/ogrid-core';

/**
 * Abstract base class for Angular inline cell editors.
 * Contains all shared signals, lifecycle hooks, keyboard handlers,
 * dropdown positioning, and display logic.
 *
 * Subclasses only need a @Component decorator with selector + template.
 */
export abstract class BaseInlineCellEditorComponent<T = unknown> {
  @Input({ required: true }) value!: unknown;
  @Input({ required: true }) item!: T;
  @Input({ required: true }) column!: IColumnDef<T>;
  @Input({ required: true }) rowIndex!: number;
  @Input({ required: true }) editorType!: 'text' | 'select' | 'checkbox' | 'date' | 'richSelect';
  @Output() commit = new EventEmitter<unknown>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement | HTMLSelectElement>;
  @ViewChild('selectWrapper') selectWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('selectDropdown') selectDropdown?: ElementRef<HTMLDivElement>;
  @ViewChild('richSelectWrapper') richSelectWrapper?: ElementRef<HTMLDivElement>;
  @ViewChild('richSelectInput') richSelectInput?: ElementRef<HTMLInputElement>;
  @ViewChild('richSelectDropdown') richSelectDropdown?: ElementRef<HTMLDivElement>;

  readonly localValue = signal<unknown>('');
  readonly highlightedIndex = signal(0);
  readonly selectOptions = signal<unknown[]>([]);
  readonly searchText = signal('');
  readonly filteredOptions = computed(() => {
    const options = this.selectOptions();
    const search = this.searchText().trim().toLowerCase();
    if (!search) return options;
    return options.filter((v) => this.getDisplayText(v).toLowerCase().includes(search));
  });

  private _initialized = false;

  ngOnInit(): void {
    this._initialized = true;
    this.syncFromInputs();
  }

  ngOnChanges(): void {
    if (this._initialized) {
      this.syncFromInputs();
    }
  }

  private syncFromInputs(): void {
    const v = this.value;
    this.localValue.set(v != null ? String(v) : '');

    const col = this.column;
    if (col?.cellEditorParams?.values) {
      const vals = col.cellEditorParams.values as unknown[];
      this.selectOptions.set(vals);
      const initialIdx = vals.findIndex((opt) => String(opt) === String(v));
      this.highlightedIndex.set(Math.max(initialIdx, 0));
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const richSelectInput = this.richSelectInput?.nativeElement;
      if (richSelectInput) {
        richSelectInput.focus();
        richSelectInput.select();
        this.positionFixedDropdown(this.richSelectWrapper, this.richSelectDropdown);
        return;
      }
      const selectWrap = this.selectWrapper?.nativeElement;
      if (selectWrap) {
        selectWrap.focus();
        this.positionFixedDropdown(this.selectWrapper, this.selectDropdown);
        return;
      }
      const el = this.inputEl?.nativeElement;
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement && el.type === 'date') {
          try { el.showPicker(); } catch { /* older browsers */ }
        } else if (el instanceof HTMLInputElement && el.type === 'text') {
          el.select();
        }
      }
    });
  }

  commitValue(value: unknown): void {
    this.commit.emit(value);
  }

  onTextKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitValue(this.localValue());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel.emit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.commitValue(this.localValue());
    }
  }

  getDisplayText(value: unknown): string {
    const formatValue = this.column?.cellEditorParams?.formatValue as ((v: unknown) => string) | undefined;
    if (formatValue) return formatValue(value);
    return value != null ? String(value) : '';
  }

  onCustomSelectKeyDown(e: KeyboardEvent): void {
    const options = this.selectOptions();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.highlightedIndex.set(Math.min(this.highlightedIndex() + 1, options.length - 1));
        this.scrollOptionIntoView(this.selectDropdown);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.highlightedIndex.set(Math.max(this.highlightedIndex() - 1, 0));
        this.scrollOptionIntoView(this.selectDropdown);
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (options.length > 0 && this.highlightedIndex() < options.length) {
          this.commitValue(options[this.highlightedIndex()]);
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (options.length > 0 && this.highlightedIndex() < options.length) {
          this.commitValue(options[this.highlightedIndex()]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.cancel.emit();
        break;
    }
  }

  onRichSelectSearch(text: string): void {
    this.searchText.set(text);
    this.highlightedIndex.set(0);
  }

  onRichSelectKeyDown(e: KeyboardEvent): void {
    const options = this.filteredOptions();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.highlightedIndex.set(Math.min(this.highlightedIndex() + 1, options.length - 1));
        this.scrollOptionIntoView(this.richSelectDropdown);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.highlightedIndex.set(Math.max(this.highlightedIndex() - 1, 0));
        this.scrollOptionIntoView(this.richSelectDropdown);
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (options.length > 0 && this.highlightedIndex() < options.length) {
          this.commitValue(options[this.highlightedIndex()]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.cancel.emit();
        break;
    }
  }

  onCheckboxKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel.emit();
    }
  }

  onTextBlur(): void {
    this.commitValue(this.localValue());
  }

  getInputStyle(): string {
    const baseStyle = 'width:100%;box-sizing:border-box;padding:6px 10px;border:none;outline:none;font:inherit;background:transparent;color:inherit;';
    const col = this.column;
    if (col.type === 'numeric') {
      return baseStyle + 'text-align:right;';
    }
    return baseStyle;
  }

  /** Position a dropdown using fixed positioning to escape overflow clipping. */
  protected positionFixedDropdown(
    wrapperRef: ElementRef<HTMLDivElement> | undefined,
    dropdownRef: ElementRef<HTMLDivElement> | undefined
  ): void {
    const wrapper = wrapperRef?.nativeElement;
    const dropdown = dropdownRef?.nativeElement;
    if (!wrapper || !dropdown) return;
    const rect = wrapper.getBoundingClientRect();
    const maxH = 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < maxH && rect.top > spaceBelow;
    dropdown.style.position = 'fixed';
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.width = `${rect.width}px`;
    dropdown.style.maxHeight = `${maxH}px`;
    dropdown.style.zIndex = '9999';
    dropdown.style.right = 'auto';
    dropdown.style.textAlign = 'left';
    if (flipUp) {
      dropdown.style.top = 'auto';
      dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
    } else {
      dropdown.style.top = `${rect.bottom}px`;
    }
  }

  /** Scroll the highlighted option into view within a dropdown element. */
  protected scrollOptionIntoView(dropdownRef: ElementRef<HTMLDivElement> | undefined): void {
    setTimeout(() => {
      const dropdown = dropdownRef?.nativeElement;
      if (!dropdown) return;
      const highlighted = dropdown.children[this.highlightedIndex()] as HTMLElement | undefined;
      highlighted?.scrollIntoView({ block: 'nearest' });
    });
  }
}
