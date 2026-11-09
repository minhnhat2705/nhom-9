import api from './api';

export const inventoryService = {
  getInventory: (params) => api.get('/inventory', { params }),
  getStockCard: (variantId, warehouseId, params) =>
    api.get(`/inventory/stock-card/${variantId}`, { params: { warehouse_id: warehouseId, ...params } }),
  getInventorySnapshot: (variantId, warehouseId, asOfDate) =>
    api.get('/inventory/snapshot', { params: { variant_id: variantId, warehouse_id: warehouseId, as_of_date: asOfDate } }),
};

export const thresholdService = {
  getThresholds: (params) => api.get('/stock-thresholds', { params }),
  setThreshold: (data) => api.post('/stock-thresholds', data),
  setBulkThresholds: (items) => api.post('/stock-thresholds/bulk', { items }),
};

export const inboundService = {
  getOrders: (params) => api.get('/inbound-orders', { params }),
  getOrderById: (id) => api.get(`/inbound-orders/${id}`),
  createOrder: (data) => api.post('/inbound-orders', data),
  approve: (id, notes) => api.post(`/inbound-orders/${id}/approve`, { notes }),
  reject: (id, rejection_reason) => api.post(`/inbound-orders/${id}/reject`, { rejection_reason }),
};

export const outboundService = {
  getOrders: (params) => api.get('/outbound-orders', { params }),
  getOrderById: (id) => api.get(`/outbound-orders/${id}`),
  createOrder: (data) => api.post('/outbound-orders', data),
  approve: (id) => api.post(`/outbound-orders/${id}/approve`),
  reject: (id, rejection_reason) => api.post(`/outbound-orders/${id}/reject`, { rejection_reason }),
};

export const transferService = {
  getOrders: (params) => api.get('/transfer-orders', { params }),
  getOrderById: (id) => api.get(`/transfer-orders/${id}`),
  createOrder: (data) => api.post('/transfer-orders', data),
  approve: (id) => api.post(`/transfer-orders/${id}/approve`),
  confirmReceived: (id, items) => api.post(`/transfer-orders/${id}/confirm-received`, { items }),
  reject: (id, rejection_reason) => api.post(`/transfer-orders/${id}/reject`, { rejection_reason }),
};

export const stocktakeService = {
  getStocktakes: (params) => api.get('/stocktakes', { params }),
  getById: (id) => api.get(`/stocktakes/${id}`),
  create: (data) => api.post('/stocktakes', data),
  submitItems: (id, items) => api.put(`/stocktakes/${id}/items`, { items }),
  approve: (id) => api.post(`/stocktakes/${id}/approve`),
  requestRecount: (id, notes) => api.post(`/stocktakes/${id}/recount`, { notes }),
};
