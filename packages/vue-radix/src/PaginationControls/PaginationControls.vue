<script setup lang="ts">
import { computed } from 'vue';
import { getPaginationViewModel } from '@alaarab/ogrid-vue';

export interface IPaginationControlsProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  entityLabelPlural?: string;
  className?: string;
}

const props = withDefaults(defineProps<IPaginationControlsProps>(), {
  pageSizeOptions: () => [10, 25, 50, 100],
  entityLabelPlural: 'items',
  className: '',
});

const vm = computed(() =>
  getPaginationViewModel(
    props.currentPage,
    props.pageSize,
    props.totalCount,
    props.pageSizeOptions ? { pageSizeOptions: props.pageSizeOptions } : undefined
  )
);

const handlePageSizeChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  props.onPageSizeChange(Number(target.value));
};
</script>

<template>
  <div v-if="vm" :class="['pagination', className]" role="navigation" aria-label="Pagination">
    <div class="pagination-info">
      Showing {{ vm.startItem }} to {{ vm.endItem }} of {{ totalCount.toLocaleString() }} {{ entityLabelPlural }}
    </div>

    <div class="pagination-controls">
      <button
        type="button"
        class="nav-btn"
        @click="onPageChange(1)"
        :disabled="currentPage === 1"
        aria-label="First page"
      >
        <span aria-hidden>«</span>
      </button>
      <button
        type="button"
        class="nav-btn"
        @click="onPageChange(currentPage - 1)"
        :disabled="currentPage === 1"
        aria-label="Previous page"
      >
        <span aria-hidden>‹</span>
      </button>

      <div class="page-numbers">
        <template v-if="vm.showStartEllipsis">
          <button
            type="button"
            class="page-btn"
            @click="onPageChange(1)"
            aria-label="Page 1"
          >
            1
          </button>
          <span class="ellipsis" aria-hidden>…</span>
        </template>

        <button
          v-for="pageNum in vm.pageNumbers"
          :key="pageNum"
          type="button"
          :class="['page-btn', { active: currentPage === pageNum }]"
          @click="onPageChange(pageNum)"
          :aria-label="`Page ${pageNum}`"
          :aria-current="currentPage === pageNum ? 'page' : undefined"
        >
          {{ pageNum }}
        </button>

        <template v-if="vm.showEndEllipsis">
          <span class="ellipsis" aria-hidden>…</span>
          <button
            type="button"
            class="page-btn"
            @click="onPageChange(vm.totalPages)"
            :aria-label="`Page ${vm.totalPages}`"
          >
            {{ vm.totalPages }}
          </button>
        </template>
      </div>

      <button
        type="button"
        class="nav-btn"
        @click="onPageChange(currentPage + 1)"
        :disabled="currentPage >= vm.totalPages"
        aria-label="Next page"
      >
        <span aria-hidden>›</span>
      </button>
      <button
        type="button"
        class="nav-btn"
        @click="onPageChange(vm.totalPages)"
        :disabled="currentPage >= vm.totalPages"
        aria-label="Last page"
      >
        <span aria-hidden>»</span>
      </button>
    </div>

    <div class="page-size-selector">
      <span class="page-size-label">Rows</span>
      <select
        class="page-size-select"
        :value="String(pageSize)"
        @change="handlePageSizeChange"
        aria-label="Rows per page"
      >
        <option v-for="n in vm.pageSizeOptions" :key="n" :value="n">
          {{ n }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import './PaginationControls.module.scss';
</style>
