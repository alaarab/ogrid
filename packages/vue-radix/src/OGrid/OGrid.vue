<script setup lang="ts" generic="T extends Record<string, unknown>">
import { OGridLayout } from '@alaarab/ogrid-vue';
import DataGridTable from '../DataGridTable/DataGridTable.vue';
import type { IOGridProps } from '@alaarab/ogrid-core';

defineProps<IOGridProps<T>>();
</script>

<template>
  <OGridLayout v-bind="$props">
    <DataGridTable :grid-props="$props" />
  </OGridLayout>
</template>
