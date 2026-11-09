const pool = require('../config/db');
const getAvailableStock = async (variantId,warehouseId,conn=pool) => {
  const [r]=await conn.query('SELECT actual_stock,reserved_stock FROM inventory WHERE variant_id=? AND warehouse_id=?',[variantId,warehouseId]);
  return r.length?Math.max(0,Number(r[0].actual_stock)-Number(r[0].reserved_stock)):0;
};
const recordStockMovement = async (m,conn=pool) => {
  await conn.query('INSERT INTO stock_movements (variant_id,warehouse_id,movement_type,reference_type,reference_id,quantity,qty_before,qty_after,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',
    [m.variant_id,m.warehouse_id,m.movement_type,m.reference_type,m.reference_id,m.quantity,m.qty_before,m.qty_after,m.note||null,m.created_by]);
};
const checkAndCreateAlert = async (variantId,warehouseId,conn=pool) => {
  const [r]=await conn.query('SELECT i.actual_stock,i.reserved_stock,st.min_stock,st.safety_stock,pv.sku,p.name AS product_name,p.id AS product_id FROM inventory i LEFT JOIN stock_thresholds st ON st.variant_id=i.variant_id AND st.warehouse_id=i.warehouse_id JOIN product_variants pv ON pv.id=i.variant_id JOIN products p ON p.id=pv.product_id WHERE i.variant_id=? AND i.warehouse_id=?',[variantId,warehouseId]);
  if(!r.length||r[0].min_stock===null||Number(r[0].actual_stock)>=Number(r[0].min_stock))return;
  const x=r[0],severity=Number(x.actual_stock)===0||Number(x.actual_stock)<Number(x.safety_stock)?'HIGH':'MEDIUM';
  await require('./alertService').createAlert('BELOW_MIN_STOCK',variantId,x.product_id,warehouseId,severity,
    'SKU '+x.sku+' ('+x.product_name+') có tồn thực tế '+x.actual_stock+', thấp hơn mức tối thiểu '+x.min_stock+'.',
    {actual_stock:Number(x.actual_stock),available_stock:Math.max(0,Number(x.actual_stock)-Number(x.reserved_stock)),min_stock:Number(x.min_stock),safety_stock:Number(x.safety_stock)},conn);
};
const autoCloseAlerts = async (variantId,warehouseId,conn=pool) => {
  const [r]=await conn.query('SELECT i.actual_stock,st.min_stock FROM inventory i JOIN stock_thresholds st ON st.variant_id=i.variant_id AND st.warehouse_id=i.warehouse_id WHERE i.variant_id=? AND i.warehouse_id=?',[variantId,warehouseId]);
  if(r.length&&Number(r[0].actual_stock)>=Number(r[0].min_stock))
    await conn.query("UPDATE alerts SET status='AUTO_CLOSED',closed_at=NOW() WHERE variant_id=? AND warehouse_id=? AND alert_type='BELOW_MIN_STOCK' AND status='OPEN'",[variantId,warehouseId]);
};
const checkSizeBreakAlert = async (productId,warehouseId,conn=pool) => {
  const [rows]=await conn.query(
    'SELECT sizes.size,COALESCE(sales.sold_90d,0) AS sold_90d,COALESCE(stock.actual_stock,0) AS actual_stock '+
    'FROM (SELECT DISTINCT size FROM product_variants WHERE product_id=? AND status=\'ACTIVE\' AND size IS NOT NULL) sizes '+
    'LEFT JOIN (SELECT pv.size,SUM(sh.quantity_sold) AS sold_90d FROM product_variants pv JOIN sales_history sh ON sh.variant_id=pv.id WHERE pv.product_id=? AND sh.warehouse_id=? AND sh.sale_date>=DATE_SUB(CURRENT_DATE(),INTERVAL 90 DAY) GROUP BY pv.size) sales ON sales.size=sizes.size '+
    'LEFT JOIN (SELECT pv.size,SUM(i.actual_stock) AS actual_stock FROM product_variants pv LEFT JOIN inventory i ON i.variant_id=pv.id AND i.warehouse_id=? WHERE pv.product_id=? AND pv.status=\'ACTIVE\' GROUP BY pv.size) stock ON stock.size=sizes.size',
    [productId,productId,warehouseId,warehouseId,productId]);
  const core=rows.slice().sort((a,b)=>Number(b.sold_90d)-Number(a.sold_90d)).slice(0,2);
  const missing=core.filter(x=>Number(x.sold_90d)>0&&Number(x.actual_stock)===0).map(x=>x.size);
  if(!missing.length||rows.reduce((n,x)=>n+Number(x.actual_stock),0)===0)return;
  await require('./alertService').createAlert('SIZE_BREAK',null,productId,warehouseId,'HIGH','Đứt size chủ lực '+missing.join(', ')+' của sản phẩm tại kho.',{missing_core_sizes:missing,size_stock:rows},conn);
};
module.exports={getAvailableStock,recordStockMovement,checkAndCreateAlert,autoCloseAlerts,checkSizeBreakAlert};