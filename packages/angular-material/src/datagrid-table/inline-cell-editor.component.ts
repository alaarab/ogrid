import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseInlineCellEditorComponent } from '@alaarab/ogrid-angular';

@Component({
  selector: 'ogrid-mat-inline-cell-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
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
          <input
            #richSelectInput
            type="text"
            [value]="searchText()"
            (input)="onRichSelectSearch($any($event.target).value)"
            (keydown)="onRichSelectKeyDown($event)"
            placeholder="Search..."
            style="width:100%;padding:0;border:none;background:transparent;color:inherit;font:inherit;font-size:13px;outline:none;min-width:0"
          />
          <div #richSelectDropdown role="listbox"
               style="position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:var(--ogrid-bg, #fff);border:1px solid var(--ogrid-border, rgba(0,0,0,0.12));z-index:10;box-shadow:0 4px 16px rgba(0,0,0,0.2)">
            @for (opt of filteredOptions(); track opt; let i = $index) {
              <div role="option"
                   [attr.aria-selected]="i === highlightedIndex()"
                   (click)="commitValue(opt)"
                   [style]="i === highlightedIndex() ? 'padding:6px 8px;cursor:pointer;color:var(--ogrid-fg, #242424);background:var(--ogrid-bg-hover, #e8f0fe)' : 'padding:6px 8px;cursor:pointer;color:var(--ogrid-fg, #242424)'">
                {{ getDisplayText(opt) }}
              </div>
            }
            @if (filteredOptions().length === 0) {
              <div style="padding:6px 8px;color:var(--ogrid-muted, #999)">No matches</div>
            }
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
               style="position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:var(--ogrid-bg, #fff);border:1px solid var(--ogrid-border, rgba(0,0,0,0.12));z-index:10;box-shadow:0 4px 16px rgba(0,0,0,0.2)">
            @for (opt of selectOptions(); track opt; let i = $index) {
              <div role="option"
                   [attr.aria-selected]="i === highlightedIndex()"
                   (click)="commitValue(opt)"
                   [style]="i === highlightedIndex() ? 'padding:6px 8px;cursor:pointer;color:var(--ogrid-fg, #242424);background:var(--ogrid-bg-hover, #e8f0fe)' : 'padding:6px 8px;cursor:pointer;color:var(--ogrid-fg, #242424)'">
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
        <input
          #inputEl
          type="date"
          [value]="localValue()"
          (change)="commitValue($any($event.target).value)"
          (keydown)="onTextKeyDown($event)"
          (blur)="onTextBlur()"
          [style]="getInputStyle()"
        />
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
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `],
})
export class InlineCellEditorComponent<T = unknown> extends BaseInlineCellEditorComponent<T> {}
