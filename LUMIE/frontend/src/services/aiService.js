import api from './api';

export const aiService = {
  runForecast: (variantId, warehouseId) =>
    api.post('/forecasts/run', { variant_id: variantId, warehouse_id: warehouseId }),

  getForecasts: (params) => api.get('/forecasts', { params }),

  getForecastAccuracy: (variantId, warehouseId) =>
    api.get('/forecasts/accuracy', { params: { variant_id: variantId, warehouse_id: warehouseId } }),

  getSuggestions: (params) => api.get('/reorder-suggestions', { params }),

  getSuggestionById: (id) => api.get(`/reorder-suggestions/${id}`),

  runSuggestions: (warehouseId) =>
    api.post('/reorder-suggestions/run', { warehouse_id: warehouseId }),

  adjustSuggestion: (id, data) => api.put(`/reorder-suggestions/${id}/adjust`, data),

  approveSuggestion: (id) => api.post(`/reorder-suggestions/${id}/approve`),

  rejectSuggestion: (id, rejection_reason) =>
    api.post(`/reorder-suggestions/${id}/reject`, { rejection_reason }),

  importSalesHistory: (formData) =>
    api.post('/sales-history/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getSalesHistory: (params) => api.get('/sales-history', { params }),
};
