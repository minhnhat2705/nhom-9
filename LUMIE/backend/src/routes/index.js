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
router.post('/inbound-orders', auth, requireRole('STAFF'), workflow.createInbound);
router.post('/inbound-orders/:id/approve', auth, requireRole('MANAGER'), workflow.approveInbound);
router.post('/inbound-orders/:id/reject', auth, requireRole('MANAGER'), workflow.rejectInbound);
router.get('/outbound-orders', auth, workflow.listOutbound);
router.get('/outbound-orders/:id', auth, workflow.getOutbound);
router.post('/outbound-orders', auth, requireRole('STAFF'), workflow.createOutbound);
router.post('/outbound-orders/:id/approve', auth, requireRole('MANAGER'), workflow.approveOutbound);
router.post('/outbound-orders/:id/reject', auth, requireRole('MANAGER'), workflow.rejectOutbound);
router.get('/transfer-orders', auth, workflow.listTransfers);
router.get('/transfer-orders/:id', auth, workflow.getTransfer);
router.post('/transfer-orders', auth, requireRole('STAFF'), workflow.createTransfer);
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
module.exports = router;
