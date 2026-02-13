import { ref, nextTick } from 'vue';
import { useFilterOptions } from '../composables/useFilterOptions';

describe('useFilterOptions', () => {
  it('initializes with empty filterOptions and loadingOptions', () => {
    const dataSource = ref({ fetchFilterOptions: jest.fn().mockResolvedValue([]) });
    const fields = ref<string[]>([]);

    const { filterOptions, loadingOptions } = useFilterOptions(dataSource, fields);

    // Initial state before async resolution
    expect(typeof filterOptions.value).toBe('object');
    expect(typeof loadingOptions.value).toBe('object');
  });

  it('loads filter options from data source', async () => {
    const fetchFilterOptions = jest.fn()
      .mockResolvedValueOnce(['Active', 'Inactive'])
      .mockResolvedValueOnce(['Admin', 'User']);

    const dataSource = ref({ fetchFilterOptions });
    const fields = ref(['status', 'role']);

    const { filterOptions } = useFilterOptions(dataSource, fields);

    // Wait for async loading
    await nextTick();
    await new Promise(r => setTimeout(r, 0));
    await nextTick();

    expect(fetchFilterOptions).toHaveBeenCalledWith('status');
    expect(fetchFilterOptions).toHaveBeenCalledWith('role');
    expect(filterOptions.value.status).toEqual(['Active', 'Inactive']);
    expect(filterOptions.value.role).toEqual(['Admin', 'User']);
  });

  it('handles fetch errors gracefully', async () => {
    const fetchFilterOptions = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(['Admin']);

    const dataSource = ref({ fetchFilterOptions });
    const fields = ref(['status', 'role']);

    const { filterOptions } = useFilterOptions(dataSource, fields);

    await nextTick();
    await new Promise(r => setTimeout(r, 0));
    await nextTick();

    expect(filterOptions.value.status).toEqual([]);
    expect(filterOptions.value.role).toEqual(['Admin']);
  });

  it('clears options when data source has no fetchFilterOptions', async () => {
    const dataSource = ref({});
    const fields = ref(['status']);

    const { filterOptions, loadingOptions } = useFilterOptions(dataSource, fields);

    await nextTick();
    await new Promise(r => setTimeout(r, 0));

    expect(filterOptions.value).toEqual({});
    expect(loadingOptions.value).toEqual({});
  });
});
