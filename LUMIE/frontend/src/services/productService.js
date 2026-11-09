import api from './api';

// ─── Product Service ───────────────────────────────────────────────────────────
export const productService = {
  getProducts: (params) => api.get('/products', { params }),
  getProductById: (id) => api.get(`/products/${id}`),
  createProduct: (data) => api.post('/products', data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  discontinueProduct: (id) => api.post(`/products/${id}/discontinue`),
};

// ─── Category Service ──────────────────────────────────────────────────────────
export const categoryService = {
  getCategories: (params) => api.get('/categories', { params }),
  getCategoryById: (id) => api.get(`/categories/${id}`),
  createCategory: (data) => api.post('/categories', data),
  updateCategory: (id, data) => api.put(`/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/categories/${id}`),
};

// ─── Collection Service ────────────────────────────────────────────────────────
export const collectionService = {
  getCollections: (params) => api.get('/collections', { params }),
  getCollectionById: (id) => api.get(`/collections/${id}`),
  createCollection: (data) => api.post('/collections', data),
  updateCollection: (id, data) => api.put(`/collections/${id}`, data),
  deleteCollection: (id) => api.delete(`/collections/${id}`),
};

// ─── Supplier Service ──────────────────────────────────────────────────────────
export const supplierService = {
  getSuppliers: (params) => api.get('/suppliers', { params }),
  getSupplierById: (id) => api.get(`/suppliers/${id}`),
  createSupplier: (data) => api.post('/suppliers', data),
  updateSupplier: (id, data) => api.put(`/suppliers/${id}`, data),
  deleteSupplier: (id) => api.delete(`/suppliers/${id}`),
  activateSupplier: (id) => api.post(`/suppliers/${id}/activate`),
  deactivateSupplier: (id) => api.post(`/suppliers/${id}/deactivate`),
};

// ─── Warehouse Service ─────────────────────────────────────────────────────────
export const warehouseService = {
  getWarehouses: (params) => api.get('/warehouses', { params }),
  getWarehouseById: (id) => api.get(`/warehouses/${id}`),
  createWarehouse: (data) => api.post('/warehouses', data),
  updateWarehouse: (id, data) => api.put(`/warehouses/${id}`, data),
  deleteWarehouse: (id) => api.delete(`/warehouses/${id}`),
  activateWarehouse: (id) => api.post(`/warehouses/${id}/activate`),
  deactivateWarehouse: (id) => api.post(`/warehouses/${id}/deactivate`),
};

// ─── User Service ──────────────────────────────────────────────────────────────
export const userService = {
  getUsers: (params) => api.get('/users', { params }),
  getUserById: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
  deleteUser: (id) => api.delete(`/users/${id}`),
  activateUser: (id) => api.post(`/users/${id}/activate`),
  deactivateUser: (id) => api.post(`/users/${id}/deactivate`),
};

// ─── Report Service ────────────────────────────────────────────────────────────
export const reportService = {
  getDashboard: (params) => api.get('/dashboard', { params }),
  getPeriodReport: (params) => api.get('/reports/period', { params }),
  getInventoryByCategory: (params) => api.get('/reports/inventory-by-category', { params }),
  getInventoryReport: (params) => api.get('/reports/inventory', { params }),
  exportExcel: (type, params) =>
    api.get(`/reports/export-${type}-excel`, { params, responseType: 'blob' }),
  exportPDF: (type, params) =>
    api.get(`/reports/export-${type}-pdf`, { params, responseType: 'blob' }),
};

// ─── Alert Service ─────────────────────────────────────────────────────────────
export const alertService = {
  getAlerts: (params) => api.get('/alerts', { params }),
  getAlertById: (id) => api.get(`/alerts/${id}`),
  closeAlert: (id) => api.post(`/alerts/${id}/close`),
  runChecks: () => api.post('/alerts/run-checks'),
};

// ─── Purchase Order Service ────────────────────────────────────────────────────
export const purchaseOrderService = {
  getOrders: (params) => api.get('/purchase-orders', { params }),
  getById: (id) => api.get(`/purchase-orders/${id}`),
  createFromSuggestions: (suggestionIds) =>
    api.post('/purchase-orders/from-suggestions', { suggestion_ids: suggestionIds }),
  exportPDF: (id) =>
    api.get(`/purchase-orders/${id}/export-pdf`, { responseType: 'blob' }),
  exportExcel: (id) =>
    api.get(`/purchase-orders/${id}/export-excel`, { responseType: 'blob' }),
};

// ─── Inventory Service ─────────────────────────────────────────────────────────
export const inventoryService = {
  getInventory: (params) => api.get('/inventory', { params }),
  getStockCard: (params) => api.get('/inventory/stock-card', { params }),
  getThresholds: (params) => api.get('/inventory/thresholds', { params }),
  updateThreshold: (id, data) => api.put(`/inventory/thresholds/${id}`, data),
  bulkUpdateThresholds: (data) => api.post('/inventory/thresholds/bulk', data),
};

// ─── Inbound Order Service ─────────────────────────────────────────────────────
export const inboundService = {
  getOrders: (params) => api.get('/inbound-orders', { params }),
  getById: (id) => api.get(`/inbound-orders/${id}`),
  createOrder: (data) => api.post('/inbound-orders', data),
  approveOrder: (id) => api.post(`/inbound-orders/${id}/approve`),
  rejectOrder: (id, data) => api.post(`/inbound-orders/${id}/reject`, data),
};

// ─── Outbound Order Service ────────────────────────────────────────────────────
export const outboundService = {
  getOrders: (params) => api.get('/outbound-orders', { params }),
  getById: (id) => api.get(`/outbound-orders/${id}`),
  createOrder: (data) => api.post('/outbound-orders', data),
  approveOrder: (id) => api.post(`/outbound-orders/${id}/approve`),
  rejectOrder: (id, data) => api.post(`/outbound-orders/${id}/reject`, data),
};

// ─── Transfer Order Service ────────────────────────────────────────────────────
export const transferService = {
  getOrders: (params) => api.get('/transfer-orders', { params }),
  getById: (id) => api.get(`/transfer-orders/${id}`),
  createOrder: (data) => api.post('/transfer-orders', data),
  approveOrder: (id) => api.post(`/transfer-orders/${id}/approve`),
  rejectOrder: (id, data) => api.post(`/transfer-orders/${id}/reject`, data),
  confirmReceived: (id, data) => api.post(`/transfer-orders/${id}/confirm-received`, data),
};

// ─── Stocktake Service ─────────────────────────────────────────────────────────
export const stocktakeService = {
  getSessions: (params) => api.get('/stocktake-sessions', { params }),
  getSessionById: (id) => api.get(`/stocktake-sessions/${id}`),
  createSession: (data) => api.post('/stocktake-sessions', data),
  updateSessionItem: (sessionId, itemId, data) =>
    api.put(`/stocktake-sessions/${sessionId}/items/${itemId}`, data),
  saveDraft: (sessionId, data) =>
    api.post(`/stocktake-sessions/${sessionId}/save-draft`, data),
  submitSession: (sessionId) =>
    api.post(`/stocktake-sessions/${sessionId}/submit`),
  approveSession: (sessionId) =>
    api.post(`/stocktake-sessions/${sessionId}/approve`),
  requestRecount: (sessionId, data) =>
    api.post(`/stocktake-sessions/${sessionId}/request-recount`, data),
};

// ─── Reorder Suggestion Service ────────────────────────────────────────────────
export const reorderService = {
  getSuggestions: (params) => api.get('/reorder-suggestions', { params }),
  getSuggestionById: (id) => api.get(`/reorder-suggestions/${id}`),
  updateSuggestion: (id, data) => api.put(`/reorder-suggestions/${id}`, data),
  approveSuggestion: (id) => api.post(`/reorder-suggestions/${id}/approve`),
  rejectSuggestion: (id) => api.post(`/reorder-suggestions/${id}/reject`),
  runSuggestions: (params) => api.post('/reorder-suggestions/run', params),
  bulkApprove: (ids) => api.post('/reorder-suggestions/bulk-approve', { ids }),
};

// ─── Sales History Service ─────────────────────────────────────────────────────
export const salesHistoryService = {
  getSalesHistory: (params) => api.get('/sales-history', { params }),
  importSalesHistory: (formData) =>
    api.post('/sales-history/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getSalesChart: (params) => api.get('/sales-history/chart', { params }),
};

// ─── Demand Forecast Service ───────────────────────────────────────────────────
export const forecastService = {
  getForecast: (params) => api.get('/forecasts', { params }),
  runForecast: (data) => api.post('/forecasts/run', data),
  getForecastAccuracy: (params) => api.get('/forecasts/accuracy', { params }),
};
