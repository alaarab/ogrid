/**
 * TagsEditorComponent  -  Premium multi-value tag/chip cell editor for OGrid (Angular).
 *
 * Usage:
 *   import { TagsEditorComponent } from '@alaarab/ogrid-angular-inputs';
 *
 *   // In your column definitions:
 *   const columns = [{
 *     columnId: 'tags',
 *     cellEditor: TagsEditorComponent,
 *     cellEditorPopup: true,
 *     cellEditorParams: { suggestions: ['Design', 'Engineering', 'QA'], allowCreate: true },
 *   }];
 *
 * Implements ICellEditorProps<T> via @Input() decorators  -  works with cellEditorPopup: true.
 */
import { Component, Input, signal, computed, ElementRef, ViewChild, afterNextRender } from '@angular/core';
import type { IColumnDef, CellEditorParams } from '@alaarab/ogrid-core';
import {
  parseTags,
  formatTags,
  getTagColor,
  filterTagSuggestions,
  DEFAULT_TAG_COLORS,
} from '@alaarab/ogrid-inputs';

// ── Styles (inline objects to avoid CSS file dependency  -  keeps package sideEffects: false) ──

const rootStyleObj: Record<string, string> = {
  'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  'font-size': '13px',
  'background': 'var(--ogrid-bg, #fff)',
  'color': 'var(--ogrid-fg, #242424)',
  'border': '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  'border-radius': '8px',
  'box-shadow': 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
  'padding': '12px',
  'user-select': 'none',
  'min-width': '260px',
  'max-width': '360px',
};

const tagsAreaStyleObj: Record<string, string> = {
  'display': 'flex',
  'flex-wrap': 'wrap',
  'gap': '4px',
  'margin-bottom': '8px',
  'min-height': '28px',
};

const baseChipStyleObj: Record<string, string> = {
  'display': 'inline-flex',
  'align-items': 'center',
  'gap': '4px',
  'padding': '2px 8px 2px 10px',
  'border-radius': '12px',
  'font-size': '12px',
  'font-weight': '500',
  'line-height': '20px',
  'border': '1px solid rgba(0,0,0,0.08)',
  'max-width': '180px',
};

const chipRemoveBtnStyleObj: Record<string, string> = {
  'background': 'none',
  'border': 'none',
  'cursor': 'pointer',
  'padding': '0',
  'font-size': '14px',
  'line-height': '1',
  'color': 'rgba(0,0,0,0.4)',
  'display': 'flex',
  'align-items': 'center',
  'flex-shrink': '0',
};

const inputRowStyleObj: Record<string, string> = {
  'position': 'relative',
};

const inputStyleObj: Record<string, string> = {
  'width': '100%',
  'padding': '6px 10px',
  'border': '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  'border-radius': '4px',
  'font-size': '13px',
  'outline': 'none',
  'background': 'var(--ogrid-bg, #fff)',
  'color': 'inherit',
  'box-sizing': 'border-box',
};

const dropdownStyleObj: Record<string, string> = {
  'position': 'absolute',
  'top': '100%',
  'left': '0',
  'right': '0',
  'background': 'var(--ogrid-bg, #fff)',
  'border': '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  'border-radius': '4px',
  'box-shadow': '0 4px 12px rgba(0,0,0,0.12)',
  'margin-top': '2px',
  'max-height': '160px',
  'overflow-y': 'auto',
  'z-index': '10',
};

const baseSuggestionStyleObj: Record<string, string> = {
  'padding': '6px 12px',
  'cursor': 'pointer',
  'font-size': '13px',
};

const footerStyleObj: Record<string, string> = {
  'display': 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  'margin-top': '8px',
  'padding-top': '8px',
  'border-top': '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
};

const footerBtnStyleObj: Record<string, string> = {
  'background': 'none',
  'border': 'none',
  'cursor': 'pointer',
  'padding': '4px 8px',
  'border-radius': '4px',
  'font-size': '12px',
  'color': 'var(--ogrid-accent, #0078d4)',
  'font-weight': '500',
};

const countLabelStyleObj: Record<string, string> = {
  'font-size': '12px',
  'color': 'var(--ogrid-muted, #888)',
};

// Helper to convert a Record<string,string> into an inline style string
function toStyleString(obj: Record<string, string>): string {
  return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('; ');
}

@Component({
  selector: 'ogrid-tags-editor',
  standalone: true,
  template: `
    <div [style]="rootStyle" (mousedown)="$event.stopPropagation()">
      <!-- Tag chips area -->
      @if (tags().length > 0) {
        <div [style]="tagsAreaStyle">
          @for (tag of tags(); track tag) {
            <span [style]="getChipStyle(tag)">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ tag }}</span>
              <button
                type="button"
                [style]="chipRemoveBtnStyle"
                (click)="removeTag(tag)"
                [attr.aria-label]="'Remove ' + tag"
                tabindex="-1"
              >×</button>
            </span>
          }
        </div>
      }

      <!-- Text input + suggestion dropdown -->
      <div [style]="inputRowStyle">
        <input
          #inputEl
          type="text"
          [value]="inputText()"
          (input)="handleInput($event)"
          (keydown)="handleKeyDown($event)"
          (focus)="showDropdown.set(true)"
          (blur)="handleBlur()"
          placeholder="Add tag..."
          [style]="inputStyle"
        />

        <!-- Suggestion dropdown -->
        @if (showDropdown() && visibleSuggestions().length > 0) {
          <div [style]="dropdownStyle">
            @for (suggestion of visibleSuggestions(); track suggestion) {
              <div
                [style]="getSuggestionStyle(suggestion)"
                (mousedown)="$event.preventDefault()"
                (click)="addTag(suggestion)"
                (mouseenter)="hoveredSuggestion.set(suggestion)"
                (mouseleave)="hoveredSuggestion.set(null)"
              >{{ suggestion }}</div>
            }
            @if (canCreateTag()) {
              <div
                [style]="getSuggestionStyle('__create__')"
                (mousedown)="$event.preventDefault()"
                (click)="createAndAddTag()"
                (mouseenter)="hoveredSuggestion.set('__create__')"
                (mouseleave)="hoveredSuggestion.set(null)"
              >Create "{{ inputText() }}"</div>
            }
          </div>
        }
      </div>

      <!-- Footer -->
      <div [style]="footerStyle">
        <span [style]="countLabelStyle">{{ tags().length }} tag{{ tags().length !== 1 ? 's' : '' }}</span>
        <div style="display: flex; gap: 4px;">
          <button type="button" [style]="footerBtnStyle" (click)="onCancel()">Cancel</button>
          <button type="button" [style]="footerBtnStyle + '; background: var(--ogrid-primary, #0078d4); color: #fff; border-radius: 4px; padding: 4px 12px;'" (click)="handleCommit()">Apply</button>
        </div>
      </div>
    </div>
  `,
})
export class TagsEditorComponent {
  @Input() value: unknown;
  @Input() onValueChange!: (value: unknown) => void;
  @Input() onCommit!: () => void;
  @Input() onCancel!: () => void;
  @Input() item: unknown;
  @Input() column!: IColumnDef;
  @Input() cellEditorParams?: CellEditorParams;

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

  // ── Signals ──

  tags = signal<string[]>([]);
  inputText = signal('');
  showDropdown = signal(false);
  hoveredSuggestion = signal<string | null>(null);

  // ── Computed ──

  suggestions = computed<readonly string[]>(() => {
    const params = this.cellEditorParams as Record<string, unknown> | undefined;
    const s = params?.['suggestions'];
    if (Array.isArray(s)) return s as string[];
    return [];
  });

  allowCreate = computed<boolean>(() => {
    const params = this.cellEditorParams as Record<string, unknown> | undefined;
    return params?.['allowCreate'] !== false;
  });

  visibleSuggestions = computed<string[]>(() =>
    filterTagSuggestions(this.inputText(), this.suggestions(), this.tags())
  );

  canCreateTag = computed<boolean>(() => {
    const text = this.inputText().trim();
    if (!text || !this.allowCreate()) return false;
    // Don't show "create" if exact match already exists in suggestions or current tags
    const alreadyInSuggestions = this.suggestions().some(
      (s) => s.toLowerCase() === text.toLowerCase()
    );
    const alreadyAdded = this.tags().some(
      (t) => t.toLowerCase() === text.toLowerCase()
    );
    return !alreadyInSuggestions && !alreadyAdded;
  });

  // ── Style strings (pre-computed once for template binding) ──

  readonly rootStyle = toStyleString(rootStyleObj);
  readonly tagsAreaStyle = toStyleString(tagsAreaStyleObj);
  readonly chipRemoveBtnStyle = toStyleString(chipRemoveBtnStyleObj);
  readonly inputRowStyle = toStyleString(inputRowStyleObj);
  readonly inputStyle = toStyleString(inputStyleObj);
  readonly dropdownStyle = toStyleString(dropdownStyleObj);
  readonly footerStyle = toStyleString(footerStyleObj);
  readonly footerBtnStyle = toStyleString(footerBtnStyleObj);
  readonly countLabelStyle = toStyleString(countLabelStyleObj);

  constructor() {
    afterNextRender(() => {
      // Parse initial value
      const parsed = parseTags(this.value);
      this.tags.set(parsed);
      // Focus input
      this.inputEl?.nativeElement.focus();
    });
  }

  // ── Helpers ──

  getChipStyle(tag: string): string {
    const bg = getTagColor(tag, DEFAULT_TAG_COLORS);
    return toStyleString({
      ...baseChipStyleObj,
      'background': bg,
      'color': 'var(--ogrid-fg, #242424)',
    });
  }

  getSuggestionStyle(key: string): string {
    const isHovered = this.hoveredSuggestion() === key;
    const style: Record<string, string> = { ...baseSuggestionStyleObj };
    if (isHovered) {
      style['background'] = 'var(--ogrid-bg-hover, #f0f0f0)';
    }
    if (key === '__create__') {
      style['color'] = 'var(--ogrid-accent, #0078d4)';
      style['font-style'] = 'italic';
    }
    return toStyleString(style);
  }

  // ── Tag Management ──

  addTag(tag: string): void {
    const trimmed = tag.trim();
    if (!trimmed) return;
    // Prevent duplicates
    if (this.tags().some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    this.tags.update((prev) => [...prev, trimmed]);
    this.inputText.set('');
    this.showDropdown.set(false);
    this.onValueChange(formatTags(this.tags()));
    // Refocus input
    this.inputEl?.nativeElement.focus();
  }

  removeTag(tag: string): void {
    this.tags.update((prev) => prev.filter((t) => t !== tag));
    this.onValueChange(formatTags(this.tags()));
  }

  createAndAddTag(): void {
    const text = this.inputText().trim();
    if (text) this.addTag(text);
  }

  // ── Input Handling ──

  handleInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.inputText.set(text);
    this.showDropdown.set(true);
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const text = this.inputText().trim();
      if (text) {
        // Add if it matches a suggestion or creation is allowed
        const matchedSuggestion = this.visibleSuggestions()[0];
        if (matchedSuggestion) {
          this.addTag(matchedSuggestion);
        } else if (this.allowCreate() && text) {
          this.addTag(text);
        }
      } else {
        // Empty input + Enter = commit
        this.onValueChange(formatTags(this.tags()));
        this.onCommit();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (this.showDropdown()) {
        this.showDropdown.set(false);
      } else {
        this.onCancel();
      }
    } else if (event.key === 'Backspace' && this.inputText() === '') {
      // Remove the last tag on backspace when input is empty
      const current = this.tags();
      if (current.length > 0) {
        this.tags.set(current.slice(0, -1));
        this.onValueChange(formatTags(this.tags()));
      }
    }
  }

  handleBlur(): void {
    // Small delay to allow click on dropdown items to register first
    setTimeout(() => {
      this.showDropdown.set(false);
    }, 150);
  }

  // ── Footer Actions ──

  handleCommit(): void {
    const text = this.inputText().trim();
    if (text && this.allowCreate()) {
      this.addTag(text);
    }
    this.onValueChange(formatTags(this.tags()));
    this.onCommit();
  }

  handleClear(): void {
    this.tags.set([]);
    this.inputText.set('');
    this.onValueChange('');
    this.onCommit();
  }
}
