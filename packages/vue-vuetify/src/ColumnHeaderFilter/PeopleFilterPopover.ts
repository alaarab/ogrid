import { defineComponent, h, type PropType, type Component } from 'vue';
import { VBtn, VTextField, VProgressCircular, VAvatar, VIcon, VDivider } from 'vuetify/components';
const _VBtn = VBtn as Component;
const _VTextField = VTextField as Component;
const _VProgressCircular = VProgressCircular as Component;
const _VAvatar = VAvatar as Component;
const _VIcon = VIcon as Component;
const _VDivider = VDivider as Component;
import type { UserLike } from '@alaarab/ogrid-vue';

export const PeopleFilterPopover = defineComponent({
  name: 'PeopleFilterPopover',
  props: {
    selectedUser: { type: Object as PropType<UserLike>, default: undefined },
    searchText: { type: String, required: true },
    onSearchChange: { type: Function as PropType<(value: string) => void>, required: true },
    suggestions: { type: Array as PropType<UserLike[]>, required: true },
    isLoading: { type: Boolean, default: false },
    onUserSelect: { type: Function as PropType<(user: UserLike) => void>, required: true },
    onClearUser: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    return () =>
      h('div', { style: { width: '300px' } }, [
        // Selected user display
        ...(props.selectedUser ? [
          h('div', { style: { padding: '12px 12px 8px', borderBottom: '1px solid rgba(0,0,0,0.12)' } }, [
            h('span', { style: { fontSize: '0.75rem', color: 'rgba(0,0,0,0.6)' } }, 'Currently filtered by:'),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' } }, [
              h(_VAvatar, { size: 32, image: props.selectedUser.photo },
                () => props.selectedUser?.displayName?.[0] ?? ''),
              h('div', { style: { flex: '1', minWidth: '0' } }, [
                h('div', { style: { fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, props.selectedUser?.displayName),
                h('div', { style: { fontSize: '0.75rem', color: 'rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, props.selectedUser?.email),
              ]),
              h(_VBtn, {
                icon: true,
                size: 'x-small',
                variant: 'text',
                'aria-label': 'Remove filter',
                onClick: props.onClearUser,
              }, () => h(_VIcon, { size: '16' }, () => 'mdi-close')),
            ]),
          ]),
        ] : []),

        // Search input
        h('div', { style: { padding: '12px 12px 4px' } },
          h(_VTextField, {
            modelValue: props.searchText,
            'onUpdate:modelValue': (v: string) => props.onSearchChange(v),
            placeholder: 'Search for a person...',
            density: 'compact',
            variant: 'outlined',
            hideDetails: true,
            autocomplete: 'off',
            prependInnerIcon: 'mdi-magnify',
            onKeydown: (e: KeyboardEvent) => e.stopPropagation(),
          })
        ),

        // Suggestions list
        h('div', { style: { maxHeight: '240px', overflowY: 'auto' } },
          props.isLoading && props.searchText.trim()
            ? h('div', { style: { display: 'flex', justifyContent: 'center', padding: '16px 0' } },
                h(_VProgressCircular, { size: 24, indeterminate: true }))
            : props.suggestions.length === 0 && props.searchText.trim()
              ? h('div', { style: { padding: '16px 0', textAlign: 'center', fontSize: '0.875rem', color: 'rgba(0,0,0,0.6)' } }, 'No results found')
              : props.searchText.trim()
                ? props.suggestions.map((user) =>
                    h('div', {
                      key: user.id || user.email || user.displayName,
                      style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer' },
                      onClick: () => props.onUserSelect(user),
                      onMouseenter: (e: MouseEvent) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; },
                      onMouseleave: (e: MouseEvent) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; },
                    }, [
                      h(_VAvatar, { size: 32, image: user.photo },
                        () => user.displayName?.[0] ?? ''),
                      h('div', { style: { flex: '1', minWidth: '0' } }, [
                        h('div', { style: { fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, user.displayName),
                        h('div', { style: { fontSize: '0.75rem', color: 'rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, user.email),
                      ]),
                    ])
                  )
                : h('div', { style: { padding: '16px 0', textAlign: 'center', fontSize: '0.875rem', color: 'rgba(0,0,0,0.6)' } }, 'Type to search...')
        ),

        // Clear filter button
        ...(props.selectedUser ? [
          h(_VDivider),
          h('div', { style: { padding: '8px 12px' } },
            h(_VBtn, { size: 'small', variant: 'text', block: true, onClick: props.onClearUser }, () => 'Clear Filter')
          ),
        ] : []),
      ]);
  },
});
