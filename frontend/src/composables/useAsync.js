import { ref, shallowRef } from 'vue';

/**
 * useAsync composable for handling asynchronous operations (like API calls)
 * @param {Function} asyncFunction - The asynchronous function to execute
 * @param {Object} options - Options for the composable
 * @param {boolean} options.immediate - Whether to execute the function immediately (default: false)
 * @param {any} options.initialData - Initial value for the data (default: null)
 */
export function useAsync(asyncFunction, options = {}) {
  const { immediate = false, initialData = null } = options;

  const data = ref(initialData);
  const error = shallowRef(null);
  const loading = ref(false);

  const execute = async (...args) => {
    loading.value = true;
    error.value = null;

    try {
      const result = await asyncFunction(...args);
      data.value = result;
      return result;
    } catch (err) {
      error.value = err;
      console.error('useAsync error:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  if (immediate) {
    execute();
  }

  return {
    data,
    error,
    loading,
    execute
  };
}
