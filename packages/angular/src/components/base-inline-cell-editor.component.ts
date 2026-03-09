import { Directive, Input, Output, EventEmitter, signal, computed, ElementRef, ViewChild } from '@angular/core';
import type { IColumnDef } from '@alaarab/ogrid-core';
import { formatDateForDisplay, parseUserInputDate, getDateInputPlaceholder } from '@alaarab/ogrid-core';

/**
 * Abstract base class for Angular inline cell editors.
 * Contains all shared signals, lifecycle hooks, keyboard handlers,
 * dropdown positioning, and display logic.
 *
 * Subclasses only need a @Component decorator with selector + template.
 */
@Directive()
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
  @ViewChild('richSelectOptions') richSelectOptions?: ElementRef<HTMLDivElement>;

  readonly localValue = signal<unknown>('');
  readonly highlightedIndex = signal(0);
  readonly selectOptions = signal<unknown[]>([]);
  readonly searchText = signal('');
  private scrollCleanup: (() => void) | null = null;
  private suppressNextBlur = false;
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
    let strVal = v != null ? String(v) : '';
    if (this.editorType === 'date') {
      const dateFormat = this.getDateFormat();
      const cellEditorType = this.getCellEditorType();
      if (cellEditorType === 'native') {
        // Native <input type="date"> requires YYYY-MM-DD
        strVal = strVal.match(/^\d{4}-\d{2}-\d{2}/) ? strVal.substring(0, 10) : strVal;
      } else {
        // text/calendar: format for display
        strVal = formatDateForDisplay(strVal, dateFormat) ?? strVal;
      }
    }
    this.localValue.set(strVal);

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
        this.attachScrollClose(this.richSelectWrapper?.nativeElement);
        return;
      }
      const selectWrap = this.selectWrapper?.nativeElement;
      if (selectWrap) {
        selectWrap.focus();
        this.positionFixedDropdown(this.selectWrapper, this.selectDropdown);
        this.attachScrollClose(selectWrap);
        return;
      }
      const el = this.inputEl?.nativeElement;
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement && el.type === 'text') {
          el.select();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.scrollCleanup?.();
  }

  /** Attach scroll listeners to close the editor when the grid scrolls.
   *  Delayed via RAF to skip spurious scroll events fired during mount
   *  (e.g. focus-triggered scroll, layout-shift scroll from DOM changes). */
  private attachScrollClose(wrapper: HTMLElement | undefined): void {
    if (!wrapper) return;
    const scrollParent = wrapper.closest('[data-ogrid-scroll-container]') ?? wrapper.closest('[style*="overflow"]');
    const handleScroll = () => this.cancel.emit();
    const raf = requestAnimationFrame(() => {
      if (scrollParent) scrollParent.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true });
    });
    this.scrollCleanup = () => {
      cancelAnimationFrame(raf);
      if (scrollParent) scrollParent.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }

  commitValue(value: unknown): void {
    this.commit.emit(value);
  }

  private commitAndSuppressBlur(value: unknown): void {
    this.suppressNextBlur = true;
    this.commitValue(value);
  }

  private cancelAndSuppressBlur(): void {
    this.suppressNextBlur = true;
    this.cancel.emit();
  }

  private shouldSkipBlur(): boolean {
    if (!this.suppressNextBlur) return false;
    this.suppressNextBlur = false;
    return true;
  }

  onTextKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitDateOrValue(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelAndSuppressBlur();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.commitDateOrValue(true);
    }
  }

  private commitDateOrValue(suppressBlur = false): void {
    if (this.editorType === 'date') {
      const cellEditorType = this.getCellEditorType();
      if (cellEditorType !== 'native') {
        const rawStr = String(this.localValue());
        if (!rawStr.trim()) {
          if (suppressBlur) this.commitAndSuppressBlur(null);
          else this.commitValue(null);
          return;
        }
        const parsed = parseUserInputDate(rawStr, this.getDateFormat());
        // Convert Date to YYYY-MM-DD format; if parsing fails, pass through raw string
        const toCommit = parsed instanceof Date ? parsed.toISOString().substring(0, 10) : rawStr;
        if (suppressBlur) this.commitAndSuppressBlur(toCommit);
        else this.commitValue(toCommit);
        return;
      }
    }
    if (suppressBlur) this.commitAndSuppressBlur(this.localValue());
    else this.commitValue(this.localValue());
  }

  getDateFormat(): string {
    return (this.column?.cellEditorParams?.['dateFormat'] as string | undefined) ?? (this.column?.dateFormat as string | undefined) ?? 'YYYY-MM-DD';
  }

  getCellEditorType(): 'native' | 'text' | 'calendar' {
    return (this.column?.cellEditorParams?.['editorType'] as 'native' | 'text' | 'calendar' | undefined) ?? 'text';
  }

  getDatePlaceholder(): string {
    return getDateInputPlaceholder(this.getDateFormat());
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
        this.scrollOptionIntoView(this.richSelectOptions);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.highlightedIndex.set(Math.max(this.highlightedIndex() - 1, 0));
        this.scrollOptionIntoView(this.richSelectOptions);
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
    if (this.shouldSkipBlur()) return;
    if (this.editorType === 'date') {
      const cellEditorType = this.getCellEditorType();
      if (cellEditorType !== 'native') {
        const rawStr = String(this.localValue());
        if (!rawStr.trim()) {
          this.commitValue(null);
          return;
        }
        const parsed = parseUserInputDate(rawStr, this.getDateFormat());
        const toCommit = parsed instanceof Date ? parsed.toISOString() : rawStr;
        this.commitValue(toCommit);
        return;
      }
    }
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
