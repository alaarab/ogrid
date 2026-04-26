<script setup lang="ts">
import { computed } from 'vue';
import type { UserLike } from '@alaarab/ogrid-vue';

export interface PeopleFilterPopoverProps {
  selectedUser: UserLike | undefined;
  searchText: string;
  onSearchChange: (value: string) => void;
  suggestions: UserLike[];
  isLoading: boolean;
  onUserSelect: (user: UserLike) => void;
  onClearUser: () => void;
  inputRef?: any;
}

const props = defineProps<PeopleFilterPopoverProps>();

const getUserInitial = (user: UserLike) => {
  return user.displayName?.charAt(0) ?? '?';
};

const getUserKey = (user: UserLike) => {
  return user.id ?? user.email ?? user.displayName ?? '';
};
</script>

<template>
  <div>
    <div v-if="selectedUser" class="selected-user-section">
      <div class="selected-user-label">Currently filtered by:</div>
      <div class="selected-user">
        <div class="user-info">
          <img
            v-if="selectedUser.photo"
            :src="selectedUser.photo"
            alt=""
            width="32"
            height="32"
            style="border-radius: 50%"
          />
          <span
            v-else
            class="user-avatar"
            style="
              width: 32px;
              height: 32px;
              border-radius: var(--ogrid-radius-full, 50%);
              background: var(--ogrid-border, #e0e0e0);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
            "
          >
            {{ getUserInitial(selectedUser) }}
          </span>
          <div class="user-text">
            <div>{{ selectedUser.displayName }}</div>
            <div class="user-secondary">{{ selectedUser.email }}</div>
          </div>
        </div>
        <button
          type="button"
          class="remove-user-button"
          @click="onClearUser"
          aria-label="Remove filter"
        >
          ✕
        </button>
      </div>
    </div>

    <div class="popover-search">
      <div class="native-input-wrapper">
        <input
          :ref="inputRef"
          type="text"
          class="native-input"
          placeholder="Search for a person..."
          :value="searchText"
          @input="onSearchChange(($event.target as HTMLInputElement).value)"
          autocomplete="off"
        />
      </div>
    </div>

    <div class="popover-options">
      <div v-if="isLoading && searchText.trim()" class="loading-container">
        Searching...
      </div>
      <div
        v-else-if="suggestions.length === 0 && searchText.trim()"
        class="no-results"
      >
        No results found
      </div>
      <template v-else-if="searchText.trim()">
        <div
          v-for="user in suggestions"
          :key="getUserKey(user)"
          class="person-option"
          @click="onUserSelect(user)"
          @keydown.enter="onUserSelect(user)"
          role="button"
          tabindex="0"
        >
          <div class="user-info">
            <img
              v-if="user.photo"
              :src="user.photo"
              alt=""
              width="32"
              height="32"
              style="border-radius: 50%"
            />
            <span
              v-else
              style="
                width: 32px;
                height: 32px;
                border-radius: var(--ogrid-radius-full, 50%);
                background: var(--ogrid-border, #e0e0e0);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
              "
            >
              {{ getUserInitial(user) }}
            </span>
            <div class="user-text">
              <div>{{ user.displayName }}</div>
              <div class="user-secondary">{{ user.email }}</div>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="no-results">Type to search...</div>
    </div>

    <div v-if="selectedUser" class="popover-actions">
      <button type="button" class="clear-button" @click="onClearUser">
        Clear Filter
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import './ColumnHeaderFilter.module.scss';

.selected-user-section {
  padding: 8px 12px;
  border-bottom: 1px solid var(--ogrid-border, #e0e0e0);
}

.selected-user-label {
  font-size: 11px;
  color: var(--ogrid-muted, #666);
  margin-bottom: 4px;
}

.selected-user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.user-text {
  min-width: 0;
  font-size: 13px;
  .user-secondary {
    font-size: 12px;
    color: var(--ogrid-muted, #666);
  }
}

.remove-user-button {
  padding: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--ogrid-muted, #666);
  flex-shrink: 0;
  &:hover {
    color: var(--ogrid-fg, #333);
  }
}

.native-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 1px solid var(--ogrid-border, #d1d1d1);
  border-radius: var(--ogrid-radius, 4px);
  background: var(--ogrid-bg, #fff);
  padding: 6px 12px;
  min-height: 36px;
  box-sizing: border-box;
  &:focus-within {
    border-color: var(--ogrid-primary, #0066cc);
    outline: none;
  }
}

.native-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  padding: 0;
  font-size: 14px;
  font-family: inherit;
  background: transparent;
  color: var(--ogrid-fg, #242424);
  &::placeholder {
    color: var(--ogrid-muted, #707070);
  }
}

.person-option {
  padding: 8px 12px;
  cursor: pointer;
  &:hover {
    background: var(--ogrid-bg-hover, #f5f5f5);
  }
}
</style>
