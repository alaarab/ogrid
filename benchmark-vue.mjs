/**
 * Vue DataGridTable Performance Benchmark
 *
 * Tests render performance with 1000+ rows to determine if memoization is needed.
 */

import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';

// Generate 1000 rows of mock data
const generateMockData = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
    age: 20 + (i % 50),
    email: `person${i}@example.com`,
    department: ['Engineering', 'Sales', 'Marketing', 'HR'][i % 4],
    salary: 50000 + (i * 1000),
  }));
};

const columns = [
  { columnId: 'id', label: 'ID', field: 'id', type: 'numeric' },
  { columnId: 'name', label: 'Name', field: 'name', type: 'text' },
  { columnId: 'age', label: 'Age', field: 'age', type: 'numeric' },
  { columnId: 'email', label: 'Email', field: 'email', type: 'text' },
  { columnId: 'department', label: 'Department', field: 'department', type: 'text' },
  { columnId: 'salary', label: 'Salary', field: 'salary', type: 'numeric' },
];

console.log('Vue DataGridTable Performance Benchmark');
console.log('=========================================\n');

// Test with 1000 rows
const data1000 = generateMockData(1000);

console.log(`Testing with ${data1000.length} rows...`);

// Simulated render test (SSR since we can't use DOM)
const testApp = createSSRApp({
  template: `
    <div>
      <table>
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.columnId">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in items" :key="item.id" :class="{ selected: idx === selectedRow }">
            <td v-for="col in columns" :key="col.columnId">{{ item[col.field] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  data() {
    return {
      items: data1000,
      columns: columns,
      selectedRow: -1
    };
  }
});

// Measure initial render
const startInitial = performance.now();
await renderToString(testApp);
const endInitial = performance.now();
const initialRenderTime = (endInitial - startInitial).toFixed(2);

console.log(`Initial render (1000 rows): ${initialRenderTime}ms`);

// Simulate selection change by creating new app instance with selection
const testAppWithSelection = createSSRApp({
  template: `
    <div>
      <table>
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.columnId">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in items" :key="item.id" :class="{ selected: idx === selectedRow }">
            <td v-for="col in columns" :key="col.columnId">{{ item[col.field] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  data() {
    return {
      items: data1000,
      columns: columns,
      selectedRow: 500  // Row 500 selected
    };
  }
});

const startSelection = performance.now();
await renderToString(testAppWithSelection);
const endSelection = performance.now();
const selectionRenderTime = (endSelection - startSelection).toFixed(2);

console.log(`Re-render with selection change: ${selectionRenderTime}ms`);

console.log('\n=========================================');
console.log('BENCHMARK RESULTS:');
console.log('=========================================');
console.log(`Rows: 1000`);
console.log(`Initial render: ${initialRenderTime}ms`);
console.log(`Selection change render: ${selectionRenderTime}ms`);

if (parseFloat(selectionRenderTime) > 100) {
  console.log('\n⚠️  PERFORMANCE ISSUE DETECTED');
  console.log('   Selection change took >100ms');
  console.log('   Memoization recommended');
} else {
  console.log('\n✅ PERFORMANCE ACCEPTABLE');
  console.log('   Selection change took <100ms');
  console.log('   Memoization may not be needed');
}

console.log('\nNote: This is SSR benchmark. Client-side rendering may differ.');
console.log('Vue\'s fine-grained reactivity may perform better in browser.');
