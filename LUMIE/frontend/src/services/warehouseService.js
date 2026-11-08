/**
 * src/services/warehouseService.js - API calls cho Warehouse
 */

import api from './api';

const warehouseService = {
  getWarehouses: async () => {
    const response = await api.get('/warehouses');
    return response.data.data;
  },

  createWarehouse: async (data) => {
    const response = await api.post('/warehouses', data);
    return response.data;
  },
};

export default warehouseService;
