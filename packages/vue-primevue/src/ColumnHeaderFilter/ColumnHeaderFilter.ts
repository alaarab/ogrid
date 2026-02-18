import { defineComponent, h, ref, watch, type PropType, type VNode } from 'vue';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import Tooltip from 'primevue/tooltip';
import {
  useColumnHeaderFilterState,
  type ColumnFilterType,
  type IDateFilterValue,
  type UserLike,
} from '@alaarab/ogrid-vue';
import { TextFilterPopover } from './TextFilterPopover';
import { MultiSelectFilterPopover } from './MultiSelectFilterPopover';
import { PeopleFilterPopover } from './PeopleFilterPopover';

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
  directives: { tooltip: Tooltip },
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
    const filterPopoverRef = ref<InstanceType<typeof Popover> | null>(null);

    const state = useColumnHeaderFilterState({
      filterType: props.filterType,
      isSorted: props.isSorted,
      isSortedDescending: props.isSortedDescending,
      onSort: props.onSort,
      selectedValues: props.selectedValues,
      onFilterChange: props.onFilterChange,
      options: props.options,
      isLoadingOptions: props.isLoadingOptions,
      textValue: props.textValue,
      onTextChange: props.onTextChange,
      selectedUser: props.selectedUser,
      onUserChange: props.onUserChange,
      peopleSearch: props.peopleSearch,
      dateValue: props.dateValue,
      onDateChange: props.onDateChange,
    });

    const toggleFilter = (event: Event) => {
      filterPopoverRef.value?.toggle(event);
      state.setFilterOpen(!state.isFilterOpen.value);
    };

    // Auto-close PrimeVue Popover when internal state closes (e.g. after Apply)
    watch(() => state.isFilterOpen.value, (open) => {
      if (!open) {
        filterPopoverRef.value?.hide();
      }
    });

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
          h('span', {
            'data-header-label': '',
            title: props.columnName,
            style: {
              fontWeight: '600',
              fontSize: '0.875rem',
              lineHeight: '1.4',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            },
          }, props.columnName)
        ),

        // Sort + filter buttons
        h('div', { style: { display: 'flex', alignItems: 'center', marginLeft: '4px', flexShrink: '0' } }, [
          // Sort button
          ...(props.onSort ? [
            h(Button, {
              icon: props.isSorted
                ? (props.isSortedDescending ? 'pi pi-arrow-down' : 'pi pi-arrow-up')
                : 'pi pi-sort-alt',
              size: 'small',
              text: true,
              rounded: true,
              severity: props.isSorted ? undefined : 'secondary',
              'aria-label': `Sort by ${props.columnName}`,
              title: props.isSorted ? (props.isSortedDescending ? 'Sorted descending' : 'Sorted ascending') : 'Sort',
              onClick: state.handlers.handleSortClick,
            }),
          ] : []),

          // Filter icon + popover
          ...(props.filterType !== 'none' ? [
            h('div', { style: { position: 'relative' } }, [
              h(Button, {
                icon: 'pi pi-filter',
                size: 'small',
                text: true,
                rounded: true,
                severity: state.hasActiveFilter.value || state.isFilterOpen.value ? undefined : 'secondary',
                'aria-label': `Filter ${props.columnName}`,
                title: `Filter ${props.columnName}`,
                onClick: toggleFilter,
              }),
              ...(state.hasActiveFilter.value ? [
                h('div', {
                  style: {
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--p-primary-color, #3B82F6)',
                  },
                }),
              ] : []),
              h(Popover, {
                ref: (el: unknown) => { filterPopoverRef.value = el as InstanceType<typeof Popover>; },
              }, {
                default: () => h('div', {
                  ref: (el: unknown) => { state.popoverRef.value = el as HTMLDivElement; },
                  onClick: (e: MouseEvent) => e.stopPropagation(),
                }, [
                  // Filter title
                  h('div', {
                    style: {
                      borderBottom: '1px solid rgba(0,0,0,0.12)',
                      padding: '8px 12px',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                    },
                  }, `Filter: ${props.columnName}`),
                  renderPopoverContent(),
                ]),
              }),
            ]),
          ] : []),
        ]),
      ]);
    };
  },
});
