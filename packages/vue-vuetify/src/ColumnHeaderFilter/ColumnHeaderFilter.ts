import { defineComponent, h, type PropType, type VNode, type Component } from 'vue';
import { VBtn, VIcon, VMenu, VTooltip, VCard } from 'vuetify/components';
import {
  useColumnHeaderFilterState,
  type ColumnFilterType,
  type IDateFilterValue,
  type UserLike,
} from '@alaarab/ogrid-vue';
import { TextFilterPopover } from './TextFilterPopover';
import { MultiSelectFilterPopover } from './MultiSelectFilterPopover';
import { PeopleFilterPopover } from './PeopleFilterPopover';

// Vuetify component types don't align with h() overloads; cast to Component
const _VBtn = VBtn as Component;
const _VIcon = VIcon as Component;
const _VMenu = VMenu as Component;
const _VTooltip = VTooltip as Component;
const _VCard = VCard as Component;

export interface IColumnHeaderFilterProps {
  columnKey: string;
  columnName: string;
  filterType: ColumnFilterType;
  isSorted?: boolean;
  isSortedDescending?: boolean;
  onSort?: () => void;
  selectedValues?: string[];
  onFilterChange?: (values: string[]) => void;
  options?: string[];
  isLoadingOptions?: boolean;
  textValue?: string;
  onTextChange?: (value: string) => void;
  selectedUser?: UserLike;
  onUserChange?: (user: UserLike | undefined) => void;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  dateValue?: IDateFilterValue;
  onDateChange?: (value: IDateFilterValue | undefined) => void;
}

export const ColumnHeaderFilter = defineComponent({
  name: 'ColumnHeaderFilter',
  props: {
    columnKey: { type: String, required: true },
    columnName: { type: String, required: true },
    filterType: { type: String as PropType<ColumnFilterType>, required: true },
    isSorted: { type: Boolean, default: false },
    isSortedDescending: { type: Boolean, default: false },
    onSort: { type: Function as PropType<() => void>, default: undefined },
    selectedValues: { type: Array as PropType<string[]>, default: undefined },
    onFilterChange: { type: Function as PropType<(values: string[]) => void>, default: undefined },
    options: { type: Array as PropType<string[]>, default: () => [] },
    isLoadingOptions: { type: Boolean, default: false },
    textValue: { type: String, default: '' },
    onTextChange: { type: Function as PropType<(value: string) => void>, default: undefined },
    selectedUser: { type: Object as PropType<UserLike>, default: undefined },
    onUserChange: { type: Function as PropType<(user: UserLike | undefined) => void>, default: undefined },
    peopleSearch: { type: Function as PropType<(query: string) => Promise<UserLike[]>>, default: undefined },
    dateValue: { type: Object as PropType<IDateFilterValue>, default: undefined },
    onDateChange: { type: Function as PropType<(value: IDateFilterValue | undefined) => void>, default: undefined },
  },
  setup(props) {
    // Pass props directly so useColumnHeaderFilterState accesses reactive prop values
    const state = useColumnHeaderFilterState(props);

    const renderPopoverContent = (): VNode | null => {
      if (props.filterType === 'multiSelect') {
        return h(MultiSelectFilterPopover, {
          searchText: state.searchText.value,
          onSearchChange: state.setSearchText,
          options: props.options ?? [],
          filteredOptions: state.filteredOptions.value,
          selected: state.tempSelected.value,
          onOptionToggle: state.handlers.handleCheckboxChange,
          onSelectAll: state.handlers.handleSelectAll,
          onClearSelection: state.handlers.handleClearSelection,
          onApply: state.handlers.handleApplyMultiSelect,
          isLoading: props.isLoadingOptions,
        });
      }
      if (props.filterType === 'text') {
        return h(TextFilterPopover, {
          value: state.tempTextValue.value ?? '',
          onValueChange: state.setTempTextValue,
          onApply: state.handlers.handleTextApply,
          onClear: state.handlers.handleTextClear,
        });
      }
      if (props.filterType === 'people') {
        return h(PeopleFilterPopover, {
          selectedUser: props.selectedUser,
          searchText: state.peopleSearchText.value,
          onSearchChange: state.setPeopleSearchText,
          suggestions: state.peopleSuggestions.value,
          isLoading: state.isPeopleLoading.value,
          onUserSelect: state.handlers.handleUserSelect,
          onClearUser: state.handlers.handleClearUser,
        });
      }
      if (props.filterType === 'date') {
        return h('div', { style: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } }, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
            h('span', { style: { minWidth: '36px', fontSize: '0.75rem' } }, 'From:'),
            h('input', {
              type: 'date',
              value: state.tempDateFrom.value ?? '',
              onInput: (e: Event) => state.setTempDateFrom((e.target as HTMLInputElement).value),
              style: { flex: '1', padding: '4px 6px' },
            }),
          ]),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
            h('span', { style: { minWidth: '36px', fontSize: '0.75rem' } }, 'To:'),
            h('input', {
              type: 'date',
              value: state.tempDateTo.value ?? '',
              onInput: (e: Event) => state.setTempDateTo((e.target as HTMLInputElement).value),
              style: { flex: '1', padding: '4px 6px' },
            }),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' } }, [
            h('button', {
              onClick: state.handlers.handleDateClear,
              disabled: !state.tempDateFrom.value && !state.tempDateTo.value,
              style: { padding: '4px 12px', cursor: 'pointer' },
            }, 'Clear'),
            h('button', {
              onClick: state.handlers.handleDateApply,
              style: { padding: '4px 12px', cursor: 'pointer' },
            }, 'Apply'),
          ]),
        ]);
      }
      return null;
    };

    return () => {
      return h('div', {
        ref: (el: unknown) => { state.headerRef.value = el as HTMLDivElement; },
        style: { display: 'flex', alignItems: 'center', width: '100%', minWidth: '0' },
      }, [
        // Column name with tooltip
        h('div', { style: { flex: '1', minWidth: '0', overflow: 'hidden' } },
          h(_VTooltip, { text: props.columnName, location: 'top' }, {
            activator: ({ props: tipProps }: { props: Record<string, unknown> }) =>
              h('span', {
                ...tipProps,
                'data-header-label': '',
                style: {
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  lineHeight: '1.4',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'block',
                },
              }, props.columnName),
          })
        ),

        // Sort + filter buttons
        h('div', { style: { display: 'flex', alignItems: 'center', marginLeft: '4px', flexShrink: '0' } }, [
          // Filter icon + menu
          ...(props.filterType !== 'none' ? [
            h(_VMenu, {
              modelValue: state.isFilterOpen.value,
              'onUpdate:modelValue': (v: boolean) => state.setFilterOpen(v),
              closeOnContentClick: false,
              location: 'bottom start',
            }, {
              activator: ({ props: menuProps }: { props: Record<string, unknown> }) =>
                h('div', { style: { position: 'relative' } }, [
                  h(_VBtn, {
                    ...menuProps,
                    icon: true,
                    size: 'x-small',
                    variant: (state.hasActiveFilter.value || state.isFilterOpen.value) ? 'tonal' : 'text',
                    color: (state.hasActiveFilter.value || state.isFilterOpen.value) ? 'primary' : 'default',
                    'aria-label': `Filter ${props.columnName}`,
                    'aria-expanded': state.isFilterOpen.value,
                    'aria-haspopup': 'dialog',
                    title: `Filter ${props.columnName}`,
                    style: {
                      opacity: (state.hasActiveFilter.value || state.isFilterOpen.value) ? '1' : '0.7',
                    },
                  }, () => h(_VIcon, { size: '16' }, () => 'mdi-filter-variant')),
                  ...(state.hasActiveFilter.value ? [
                    h('div', {
                      style: {
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'rgb(var(--v-theme-primary))',
                        zIndex: '1',
                      },
                    }),
                  ] : []),
                ]),
              default: () => h(_VCard, {
                elevation: 8,
                ref: (el: unknown) => { state.popoverRef.value = el as HTMLDivElement; },
                onClick: (e: MouseEvent) => e.stopPropagation(),
              }, () => [
                h('div', {
                  style: {
                    borderBottom: '1px solid rgba(0,0,0,0.12)',
                    padding: '8px 12px',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    backgroundColor: 'rgb(var(--v-theme-surface))',
                  },
                }, `Filter: ${props.columnName}`),
                renderPopoverContent(),
              ]),
            }),
          ] : []),
        ]),
      ]);
    };
  },
});
