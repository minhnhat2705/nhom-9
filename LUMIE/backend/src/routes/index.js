const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const productController = require('../controllers/productController');
const categoryController = require('../controllers/categoryController');
const supplierController = require('../controllers/supplierController');
const warehouseController = require('../controllers/warehouseController');
const inventoryController = require('../controllers/inventoryController');
const thresholdController = require('../controllers/stockThresholdController');

router.post('/auth/login', authController.login);
router.post('/auth/logout', auth, authController.logout);
router.post('/auth/change-password', auth, authController.changePassword);
router.get('/auth/profile', auth, authController.getProfile);

router.get('/users', auth, requireRole('MANAGER'), userController.getUsers);
router.get('/users/:id', auth, requireRole('MANAGER'), userController.getUserById);
router.post('/users', auth, requireRole('MANAGER'), userController.createUser);
router.put('/users/:id', auth, requireRole('MANAGER'), userController.updateUser);
router.post('/users/:id/reset-password', auth, requireRole('MANAGER'), userController.resetPassword);
router.delete('/users/:id', auth, requireRole('MANAGER'), userController.deleteUser);

router.get('/products', auth, productController.getProducts);
router.get('/products/:id', auth, productController.getProductById);
router.post('/products', auth, requireRole('MANAGER'), productController.createProduct);
router.put('/products/:id', auth, requireRole('MANAGER'), productController.updateProduct);
router.delete('/products/:id', auth, requireRole('MANAGER'), productController.deleteProduct);

router.get('/categories', auth, categoryController.getCategories);
router.post('/categories', auth, requireRole('MANAGER'), categoryController.createCategory);
router.put('/categories/:id', auth, requireRole('MANAGER'), categoryController.updateCategory);
router.delete('/categories/:id', auth, requireRole('MANAGER'), categoryController.deleteCategory);
router.get('/collections', auth, categoryController.getCollections);
router.post('/collections', auth, requireRole('MANAGER'), categoryController.createCollection);
router.put('/collections/:id', auth, requireRole('MANAGER'), categoryController.updateCollection);
router.delete('/collections/:id', auth, requireRole('MANAGER'), categoryController.deleteCollection);

router.get('/suppliers', auth, supplierController.getSuppliers);
router.get('/suppliers/:id', auth, supplierController.getSupplierById);
router.post('/suppliers', auth, requireRole('MANAGER'), supplierController.createSupplier);
router.put('/suppliers/:id', auth, requireRole('MANAGER'), supplierController.updateSupplier);
router.delete('/suppliers/:id', auth, requireRole('MANAGER'), supplierController.deleteSupplier);

router.get('/warehouses', auth, warehouseController.getWarehouses);
router.get('/warehouses/:id', auth, warehouseController.getWarehouseById);
router.post('/warehouses', auth, requireRole('MANAGER'), warehouseController.createWarehouse);
router.put('/warehouses/:id', auth, requireRole('MANAGER'), warehouseController.updateWarehouse);
router.delete('/warehouses/:id', auth, requireRole('MANAGER'), warehouseController.deactivateWarehouse);

router.get('/inventory', auth, inventoryController.getInventory);
router.get('/inventory/snapshot', auth, inventoryController.getInventorySnapshot);
router.get('/inventory/stock-card/:variant_id', auth, inventoryController.getStockCard);
router.get('/stock-thresholds', auth, thresholdController.getThresholds);
router.post('/stock-thresholds', auth, requireRole('MANAGER'), thresholdController.setThreshold);
router.post('/stock-thresholds/bulk', auth, requireRole('MANAGER'), thresholdController.setBulkThresholds);

const workflow = require('../controllers/workflowController');
router.get('/inbound-orders', auth, workflow.listInbound);
router.get('/inbound-orders/:id', auth, workflow.getInbound);
router.post('/inbound-orders', auth, workflow.createInbound);
router.post('/inbound-orders/:id/approve', auth, requireRole('MANAGER'), workflow.approveInbound);
router.post('/inbound-orders/:id/reject', auth, requireRole('MANAGER'), workflow.rejectInbound);
router.get('/outbound-orders', auth, workflow.listOutbound);
router.get('/outbound-orders/:id', auth, workflow.getOutbound);
router.post('/outbound-orders', auth, workflow.createOutbound);
router.post('/outbound-orders/:id/approve', auth, requireRole('MANAGER'), workflow.approveOutbound);
router.post('/outbound-orders/:id/reject', auth, requireRole('MANAGER'), workflow.rejectOutbound);
router.get('/transfer-orders', auth, workflow.listTransfers);
router.get('/transfer-orders/:id', auth, workflow.getTransfer);
router.post('/transfer-orders', auth, workflow.createTransfer);
router.post('/transfer-orders/:id/approve', auth, requireRole('MANAGER'), workflow.approveTransfer);
router.post('/transfer-orders/:id/reject', auth, requireRole('MANAGER'), workflow.rejectTransfer);
router.post('/transfer-orders/:id/confirm-received', auth, workflow.confirmTransferReceived);
router.get('/alerts', auth, workflow.listAlerts);
router.post('/alerts/run-checks', auth, requireRole('MANAGER'), workflow.runAlertChecks);
router.post('/alerts/:id/close', auth, requireRole('MANAGER'), workflow.closeAlert);
router.get('/notifications', auth, workflow.listNotifications);
router.get('/notifications/unread-count', auth, workflow.unreadCount);
router.post('/notifications/read-all', auth, workflow.markAllRead);
router.post('/notifications/:id/read', auth, workflow.markRead);
router.post('/notifications/:id/resolve', auth, workflow.resolveNotification);
router.delete('/notifications/:id', auth, workflow.deleteNotification);
router.get('/dashboard', auth, workflow.getDashboard);

// V2 Routes
const v2 = require('../controllers/v2Controller');

// Stocktake
router.get('/stocktakes', auth, v2.getStocktakes);
router.get('/stocktakes/:id', auth, v2.getStocktakeById);
router.post('/stocktakes', auth, requireRole('MANAGER'), v2.createStocktake);
router.put('/stocktakes/:id/items', auth, v2.submitStocktakeItems);
router.post('/stocktakes/:id/approve', auth, requireRole('MANAGER'), v2.approveStocktake);
router.post('/stocktakes/:id/recount', auth, requireRole('MANAGER'), v2.requestRecount);

// Sales History
router.get('/sales-history', auth, requireRole('MANAGER'), v2.getSalesHistory);
router.post('/sales-history/import', auth, requireRole('MANAGER'), ...v2.importSalesHistory);

// Forecast
router.get('/forecasts', auth, requireRole('MANAGER'), v2.getForecasts);
router.post('/forecasts/run', auth, requireRole('MANAGER'), v2.runForecast);
router.get('/forecasts/accuracy', auth, requireRole('MANAGER'), v2.getForecastAccuracy);

// Reorder Suggestions
router.get('/reorder-suggestions', auth, requireRole('MANAGER'), v2.getSuggestions);
router.post('/reorder-suggestions/run', auth, requireRole('MANAGER'), v2.runSuggestions);
router.put('/reorder-suggestions/:id/adjust', auth, requireRole('MANAGER'), v2.adjustSuggestion);
router.post('/reorder-suggestions/:id/approve', auth, requireRole('MANAGER'), v2.approveSuggestion);
router.post('/reorder-suggestions/:id/reject', auth, requireRole('MANAGER'), v2.rejectSuggestion);

// Purchase Orders
router.get('/purchase-orders', auth, requireRole('MANAGER'), v2.getPurchaseOrders);
router.get('/purchase-orders/:id', auth, requireRole('MANAGER'), v2.getPurchaseOrderById);
router.post('/purchase-orders/from-suggestions', auth, requireRole('MANAGER'), v2.createPurchaseOrdersFromSuggestions);
router.get('/purchase-orders/:id/export-pdf', auth, requireRole('MANAGER'), v2.exportPOPDF);
router.get('/purchase-orders/:id/export-excel', auth, requireRole('MANAGER'), v2.exportPOExcel);

// Reports & Dashboard
router.get('/reports/period', auth, requireRole('MANAGER'), v2.getPeriodReport);
router.get('/reports/export-inventory-excel', auth, requireRole('MANAGER'), v2.exportInventoryExcel);
router.get('/reports/export-period-excel', auth, requireRole('MANAGER'), v2.exportPeriodExcel);
router.post('/alerts/scan', auth, requireRole('MANAGER'), v2.scanAlerts);

module.exports = router;
