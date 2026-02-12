<script setup lang="ts">
import { computed, type PropType } from 'vue';
import { getStatusBarParts } from '@alaarab/ogrid-vue';

export interface StatusBarProps {
  totalCount: number;
  filteredCount?: number;
  selectedCount?: number;
  selectedCellCount?: number;
  aggregation?: {
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  } | null;
  suppressRowCount?: boolean;
}

const props = defineProps({
  totalCount: { type: Number, required: true },
  filteredCount: { type: Number, default: undefined },
  selectedCount: { type: Number, default: undefined },
  selectedCellCount: { type: Number, default: undefined },
  aggregation: { type: Object as PropType<StatusBarProps['aggregation']>, default: undefined },
  suppressRowCount: { type: Boolean, default: false },
});

const parts = computed(() => getStatusBarParts(props));
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    class="ogrid-status-bar"
  >
    <span
      v-for="(part, index) in parts"
      :key="part.key"
      class="ogrid-status-bar-item"
      :class="{ 'has-divider': index < parts.length - 1 }"
    >
      <span class="ogrid-status-bar-label">{{ part.label }}</span>
      <span class="ogrid-status-bar-value">{{ part.value.toLocaleString() }}</span>
    </span>
  </div>
</template>

<style scoped>
.ogrid-status-bar {
  margin-top: auto;
  padding: 6px 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  background-color: rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.875rem;
}

.ogrid-status-bar-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ogrid-status-bar-item.has-divider {
  margin-right: 16px;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  padding-right: 16px;
}

.ogrid-status-bar-label {
  color: rgba(0, 0, 0, 0.6);
}

.ogrid-status-bar-value {
  font-weight: 600;
}
</style>
