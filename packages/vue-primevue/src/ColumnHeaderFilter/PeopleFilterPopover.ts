import { defineComponent, h, type PropType } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Avatar from 'primevue/avatar';
import ProgressSpinner from 'primevue/progressspinner';
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
              h(Avatar, {
                image: props.selectedUser.photo,
                label: props.selectedUser.displayName?.[0] ?? '',
                size: 'normal',
                shape: 'circle',
              }),
              h('div', { style: { flex: '1', minWidth: '0' } }, [
                h('div', { style: { fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, props.selectedUser.displayName),
                h('div', { style: { fontSize: '0.75rem', color: 'rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, props.selectedUser.email),
              ]),
              h(Button, {
                icon: 'pi pi-times',
                size: 'small',
                text: true,
                rounded: true,
                'aria-label': 'Remove filter',
                onClick: props.onClearUser,
              }),
            ]),
          ]),
        ] : []),

        // Search input
        h('div', { style: { padding: '12px 12px 4px' } },
          h(InputText, {
            modelValue: props.searchText,
            'onUpdate:modelValue': (v: string) => props.onSearchChange(v),
            placeholder: 'Search for a person...',
            style: { width: '100%' },
            onKeydown: (e: KeyboardEvent) => e.stopPropagation(),
          })
        ),

        // Suggestions list
        h('div', { style: { maxHeight: '240px', overflowY: 'auto' } },
          props.isLoading && props.searchText.trim()
            ? h('div', { style: { display: 'flex', justifyContent: 'center', padding: '16px 0' } },
                h(ProgressSpinner, { style: { width: '24px', height: '24px' } }))
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
                      h(Avatar, {
                        image: user.photo,
                        label: user.displayName?.[0] ?? '',
                        size: 'normal',
                        shape: 'circle',
                      }),
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
          h('div', { style: { height: '1px', backgroundColor: 'rgba(0,0,0,0.12)' } }),
          h('div', { style: { padding: '8px 12px' } },
            h(Button, { size: 'small', text: true, style: { width: '100%' }, onClick: props.onClearUser }, () => 'Clear Filter')
          ),
        ] : []),
      ]);
  },
});
