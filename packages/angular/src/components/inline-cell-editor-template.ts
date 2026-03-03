/**
 * Shared inline cell editor template used by all Angular UI packages.
 * The template is identical across Material, PrimeNG, and Radix implementations.
 */
export const INLINE_CELL_EDITOR_TEMPLATE = `
    @switch (editorType) {
      @case ('text') {
        <input
          #inputEl
          type="text"
          [value]="localValue()"
          (input)="localValue.set($any($event.target).value)"
          (keydown)="onTextKeyDown($event)"
          (blur)="onTextBlur()"
          [style]="getInputStyle()"
        />
      }
      @case ('richSelect') {
        <div #richSelectWrapper
             style="width:100%;height:100%;display:flex;align-items:center;padding:6px 10px;box-sizing:border-box;min-width:0;position:relative">
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer;font-size:13px;color:inherit">
            <span>{{ getDisplayText(value) }}</span>
            <span style="margin-left:4px;font-size:10px;opacity:0.5">&#9662;</span>
          </div>
          <div #richSelectDropdown role="listbox"
               style="position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:var(--ogrid-bg, #fff);border:1px solid var(--ogrid-border, rgba(0,0,0,0.12));z-index:10;box-shadow:0 4px 16px rgba(0,0,0,0.2);text-align:left;font-size:13px;font-family:inherit">
            <input
              #richSelectInput
              type="text"
              [value]="searchText()"
              (input)="onRichSelectSearch($any($event.target).value)"
              (keydown)="onRichSelectKeyDown($event)"
              placeholder="Search..."
              style="width:100%;padding:6px 8px;border:none;border-bottom:1px solid var(--ogrid-border, rgba(0,0,0,0.12));background:var(--ogrid-bg, #fff);color:inherit;font:inherit;font-size:13px;outline:none;box-sizing:border-box;position:sticky;top:0;z-index:1"
            />
            <div #richSelectOptions>
              @for (opt of filteredOptions(); track opt; let i = $index) {
                <div role="option"
                     [attr.aria-selected]="i === highlightedIndex()"
                     (click)="commitValue(opt)"
                     [style]="i === highlightedIndex() ? 'padding:6px 8px;cursor:pointer;color:var(--ogrid-fg, #242424);font-size:13px;background:var(--ogrid-bg-hover, #e8f0fe)' : 'padding:6px 8px;cursor:pointer;color:var(--ogrid-fg, #242424);font-size:13px'">
                  {{ getDisplayText(opt) }}
                </div>
              }
              @if (filteredOptions().length === 0) {
                <div style="padding:6px 8px;color:var(--ogrid-muted, #999);font-size:13px">No matches</div>
              }
            </div>
          </div>
        </div>
      }
      @case ('select') {
        <div #selectWrapper tabindex="0"
             style="width:100%;height:100%;display:flex;align-items:center;padding:6px 10px;box-sizing:border-box;min-width:0;position:relative"
             (keydown)="onCustomSelectKeyDown($event)">
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer;font-size:13px;color:inherit">
            <span>{{ getDisplayText(value) }}</span>
            <span style="margin-left:4px;font-size:10px;opacity:0.5">&#9662;</span>
          </div>
          <div #selectDropdown role="listbox"
               style="position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:var(--ogrid-bg, #fff);border:1px solid var(--ogrid-border, rgba(0,0,0,0.12));z-index:10;box-shadow:0 4px 16px rgba(0,0,0,0.2);text-align:left;font-size:13px;font-family:inherit">
            @for (opt of selectOptions(); track opt; let i = $index) {
              <div role="option"
                   [attr.aria-selected]="i === highlightedIndex()"
                   (click)="commitValue(opt)"
                   [style]="i === highlightedIndex() ? 'padding:6px 8px;cursor:pointer;color:var(--ogrid-fg, #242424);font-size:13px;background:var(--ogrid-bg-hover, #e8f0fe)' : 'padding:6px 8px;cursor:pointer;color:var(--ogrid-fg, #242424);font-size:13px'">
                {{ getDisplayText(opt) }}
              </div>
            }
          </div>
        </div>
      }
      @case ('checkbox') {
        <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%">
          <input
            type="checkbox"
            [checked]="!!localValue()"
            (change)="commitValue($any($event.target).checked)"
            (keydown)="onCheckboxKeyDown($event)"
          />
        </div>
      }
      @case ('date') {
        @if (getCellEditorType() === 'native') {
          <input
            #inputEl
            type="date"
            [value]="localValue()"
            (input)="localValue.set($any($event.target).value)"
            (keydown)="onTextKeyDown($event)"
            (blur)="onTextBlur()"
            [style]="getInputStyle()"
          />
        } @else {
          <input
            #inputEl
            type="text"
            [placeholder]="getDatePlaceholder()"
            [value]="localValue()"
            (input)="localValue.set($any($event.target).value)"
            (keydown)="onTextKeyDown($event)"
            (blur)="onTextBlur()"
            [style]="getInputStyle()"
          />
        }
      }
      @default {
        <input
          #inputEl
          type="text"
          [value]="localValue()"
          (input)="localValue.set($any($event.target).value)"
          (keydown)="onTextKeyDown($event)"
          (blur)="onTextBlur()"
          [style]="getInputStyle()"
        />
      }
    }
`;

export const INLINE_CELL_EDITOR_STYLES = `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
`;
