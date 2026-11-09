const crypto = require('crypto');
const pool = require('../config/db');
const inventory = require('../services/inventoryService');

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
const tx = async fn => {
  const db = await pool.getConnection();
  try { await db.beginTransaction(); const out = await fn(db); await db.commit(); return out; }
  catch (e) { await db.rollback(); throw e; }
  finally { db.release(); }
};
const isId = x => Number.isInteger(Number(x)) && Number(x) > 0;
const makeCode = prefix => prefix + '-' + new Date().toISOString().slice(0,10).replace(/-/g,'') +
  '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
const scope = (req, warehouseId) => {
  if (req.user.role === 'STAFF' && Number(req.user.warehouse_id) !== Number(warehouseId))
    throw fail(403, 'Bạn chỉ được thao tác tại kho được phân công.');
};
const ensureInventory = async (db, variantId, warehouseId) => {
  await db.query('INSERT INTO inventory (variant_id,warehouse_id) VALUES (?,?) ON DUPLICATE KEY UPDATE variant_id=VALUES(variant_id)', [variantId,warehouseId]);
  const [rows] = await db.query('SELECT * FROM inventory WHERE variant_id=? AND warehouse_id=? FOR UPDATE', [variantId,warehouseId]);
  return rows[0];
};
const notify = async (db, role, warehouseId, type, id, title, message, userId) => {
  let users;
  if (userId) {
    const [rows] = await db.query("SELECT id FROM users WHERE id=? AND status='ACTIVE'", [userId]);
    users = rows;
  } else {
    const [rows] = await db.query("SELECT id FROM users WHERE role=? AND status='ACTIVE' AND (warehouse_id=? OR warehouse_id IS NULL)", [role,warehouseId]);
    users = rows;
  }
  if (users.length) await db.query(
    'INSERT INTO user_notifications (user_id,reference_type,reference_id,title,message,is_read,is_resolved,created_at) VALUES ?',
    [users.map(u => [u.id,type,id,title,message,0,0,new Date()])]
  );
};
const resolveLines = async (db, items, needsCost) => {
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Phiếu phải có ít nhất một SKU.');
  const used = new Set(), lines = [];
  for (const item of items) {
    const quantity = Number(item.quantity), cost = Number(item.unit_cost);
    if (!Number.isInteger(quantity) || quantity <= 0) throw fail(400, 'Số lượng phải là số nguyên dương.');
    if (needsCost && (!Number.isFinite(cost) || cost <= 0)) throw fail(400, 'Giá nhập phải lớn hơn 0.');
    let variantId = isId(item.variant_id) ? Number(item.variant_id) : null;
    if (!variantId && (item.sku || item.barcode)) {
      const key = item.sku || item.barcode;
      const [rows] = await db.query("SELECT pv.id FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE (pv.sku=? OR pv.barcode=?) AND pv.status='ACTIVE' AND p.status='ACTIVE'", [key,key]);
      if (rows.length) variantId = rows[0].id;
    }
    if (!variantId) throw fail(400, 'Không tìm thấy SKU hoặc mã vạch hợp lệ.');
    if (used.has(variantId)) throw fail(400, 'Không nhập lặp SKU trong cùng phiếu.');
    used.add(variantId);
    const [valid] = await db.query("SELECT pv.id FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE pv.id=? AND pv.status='ACTIVE' AND p.status='ACTIVE'", [variantId]);
    if (!valid.length) throw fail(400, 'SKU không tồn tại hoặc đã ngừng kinh doanh.');
    lines.push({ variant_id:variantId, quantity, unit_cost:cost });
  }
  return lines;
};

const cfg = {
  inbound:{table:'inbound_orders',items:'inbound_order_items',warehouse:'warehouse_id',prefix:'PN'},
  outbound:{table:'outbound_orders',items:'outbound_order_items',warehouse:'from_warehouse_id',prefix:'PX'},
  transfer:{table:'transfer_orders',items:'transfer_order_items',warehouse:'from_warehouse_id',prefix:'DC'}
};
const listOrders = kind => wrap(async (req,res) => {
  const c=cfg[kind], args=[]; let where='WHERE 1=1';
  if (req.query.status) { where+=' AND o.status=?'; args.push(req.query.status); }
  if (req.user.role==='STAFF') {
    if (kind==='inbound') { where+=' AND o.warehouse_id=?'; args.push(req.user.warehouse_id); }
    else { where+=' AND (o.from_warehouse_id=? OR o.to_warehouse_id=?)'; args.push(req.user.warehouse_id,req.user.warehouse_id); }
  } else if (req.query.warehouse_id) {
    if (kind==='inbound') { where+=' AND o.warehouse_id=?'; args.push(req.query.warehouse_id); }
    else { where+=' AND (o.from_warehouse_id=? OR o.to_warehouse_id=?)'; args.push(req.query.warehouse_id,req.query.warehouse_id); }
  }
  const page=Math.max(1,parseInt(req.query.page,10)||1), limit=Math.min(100,Math.max(1,parseInt(req.query.limit,10)||20));
  const [rows]=await pool.query('SELECT o.* FROM '+c.table+' o '+where+' ORDER BY o.created_at DESC LIMIT ? OFFSET ?',
    [...args,limit,(page-1)*limit]);
  res.json({success:true,data:rows,pagination:{page,limit}});
});
const getOrder = kind => wrap(async (req,res) => {
  const c=cfg[kind], [heads]=await pool.query('SELECT * FROM '+c.table+' WHERE id=?',[req.params.id]);
  if (!heads.length) throw fail(404,'Không tìm thấy phiếu.');
  const h=heads[0];
  if (req.user.role==='STAFF' && Number(h[c.warehouse])!==Number(req.user.warehouse_id) &&
      Number(h.to_warehouse_id)!==Number(req.user.warehouse_id)) throw fail(403,'Bạn không có quyền xem phiếu này.');
  const [items]=await pool.query('SELECT i.*,pv.sku,pv.barcode,pv.size,pv.color,p.name AS product_name FROM '+c.items+
    ' i JOIN product_variants pv ON pv.id=i.variant_id JOIN products p ON p.id=pv.product_id WHERE i.order_id=? ORDER BY i.id',[req.params.id]);
  res.json({success:true,data:{...h,items}});
});

const createInbound = wrap(async (req,res) => {
  const {supplier_id,warehouse_id,items,notes}=req.body;
  if (!isId(supplier_id)||!isId(warehouse_id)) throw fail(400,'Nhà cung cấp và kho nhận là bắt buộc.');
  scope(req,warehouse_id);
  const id=await tx(async db => {
    const [s]=await db.query("SELECT id FROM suppliers WHERE id=? AND status='ACTIVE'",[supplier_id]);
    const [w]=await db.query("SELECT id FROM warehouses WHERE id=? AND status='ACTIVE'",[warehouse_id]);
    if (!s.length||!w.length) throw fail(400,'Nhà cung cấp hoặc kho không hoạt động.');
    const lines=await resolveLines(db,items,true);
    const [head]=await db.query("INSERT INTO inbound_orders (order_no,supplier_id,warehouse_id,status,created_by,notes) VALUES (?,?,?,'PENDING',?,?)",
      [makeCode('PN'),supplier_id,warehouse_id,req.user.id,notes||null]);
    for (const x of lines) {
      await db.query('INSERT INTO inbound_order_items (order_id,variant_id,quantity,unit_cost) VALUES (?,?,?,?)',[head.insertId,x.variant_id,x.quantity,x.unit_cost]);
      const inv=await ensureInventory(db,x.variant_id,warehouse_id);
      await db.query('UPDATE inventory SET incoming_stock=incoming_stock+? WHERE id=?',[x.quantity,inv.id]);
    }
    await notify(db,'MANAGER',warehouse_id,'INBOUND_ORDER',head.insertId,'Phiếu nhập kho cần duyệt','Có phiếu nhập mới cần duyệt.');
    return head.insertId;
  });
  res.status(201).json({success:true,message:'Đã tạo phiếu nhập chờ duyệt.',data:{id}});
});
const approveInbound = wrap(async (req,res) => {
  await tx(async db => {
    const [heads]=await db.query('SELECT * FROM inbound_orders WHERE id=? FOR UPDATE',[req.params.id]);
    if (!heads.length) throw fail(404,'Không tìm thấy phiếu nhập.');
    const h=heads[0]; if (h.status!=='PENDING') throw fail(409,'Phiếu này đã được xử lý.');
    const [items]=await db.query('SELECT * FROM inbound_order_items WHERE order_id=? FOR UPDATE',[req.params.id]);
    const received=req.body.received_quantities||{};
    for (const x of items) {
      const qty=received[x.variant_id]===undefined?Number(x.quantity):Number(received[x.variant_id]);
      if (!Number.isInteger(qty)||qty<0||qty>Number(x.quantity)) throw fail(400,'Số lượng nhận không hợp lệ.');
      const inv=await ensureInventory(db,x.variant_id,h.warehouse_id), after=Number(inv.actual_stock)+qty;
      await db.query('UPDATE inventory SET actual_stock=?,incoming_stock=GREATEST(0,incoming_stock-?) WHERE id=?',[after,x.quantity,inv.id]);
      await db.query('UPDATE inbound_order_items SET received_qty=? WHERE id=?',[qty,x.id]);
      if (qty) await inventory.recordStockMovement({variant_id:x.variant_id,warehouse_id:h.warehouse_id,movement_type:'INBOUND',
        reference_type:'INBOUND_ORDER',reference_id:Number(req.params.id),quantity:qty,qty_before:Number(inv.actual_stock),qty_after:after,
        note:'Duyệt phiếu nhập '+h.order_no,created_by:req.user.id},db);
      await inventory.checkAndCreateAlert(x.variant_id,h.warehouse_id,db);
      await inventory.autoCloseAlerts(x.variant_id,h.warehouse_id,db);
    }
    await db.query("UPDATE inbound_orders SET status='APPROVED',approved_by=?,updated_at=NOW() WHERE id=?",[req.user.id,req.params.id]);
    await notify(db,null,null,'INBOUND_ORDER',Number(req.params.id),'Phiếu nhập đã được duyệt','Phiếu '+h.order_no+' đã được duyệt.',h.created_by);
  });
  res.json({success:true,message:'Đã duyệt phiếu nhập.'});
});

const createOutbound = wrap(async (req,res) => {
  const {from_warehouse_id,to_warehouse_id,purpose='STORE_SUPPLY',items,notes}=req.body;
  if (!isId(from_warehouse_id)) throw fail(400,'Kho xuất là bắt buộc.');
  scope(req,from_warehouse_id);
  if (!['STORE_SUPPLY','DISPOSAL','OTHER'].includes(purpose)) throw fail(400,'Mục đích xuất không hợp lệ.');
  if (purpose==='STORE_SUPPLY'&&!isId(to_warehouse_id)) throw fail(400,'Chọn kho nhận hàng.');
  if (to_warehouse_id&&Number(to_warehouse_id)===Number(from_warehouse_id)) throw fail(400,'Kho nhận phải khác kho xuất.');
  const id=await tx(async db => {
    const lines=await resolveLines(db,items,false);
    const [head]=await db.query("INSERT INTO outbound_orders (order_no,from_warehouse_id,to_warehouse_id,status,purpose,created_by,notes) VALUES (?,?,?,'PENDING',?,?,?)",
      [makeCode('PX'),from_warehouse_id,to_warehouse_id||null,purpose,req.user.id,notes||null]);
    for (const x of lines) {
      const inv=await ensureInventory(db,x.variant_id,from_warehouse_id);
      if (Number(inv.actual_stock)-Number(inv.reserved_stock)<x.quantity) throw fail(409,'Tồn khả dụng không đủ cho SKU '+x.variant_id+'.');
      await db.query('UPDATE inventory SET reserved_stock=reserved_stock+? WHERE id=?',[x.quantity,inv.id]);
      await db.query('INSERT INTO outbound_order_items (order_id,variant_id,quantity) VALUES (?,?,?)',[head.insertId,x.variant_id,x.quantity]);
    }
    await notify(db,'MANAGER',from_warehouse_id,'OUTBOUND_ORDER',head.insertId,'Phiếu xuất kho cần duyệt','Có phiếu xuất mới cần duyệt.');
    return head.insertId;
  });
  res.status(201).json({success:true,message:'Đã tạo phiếu xuất chờ duyệt.',data:{id}});
});
const approveOutbound = wrap(async (req,res) => {
  await tx(async db => {
    const [heads]=await db.query('SELECT * FROM outbound_orders WHERE id=? FOR UPDATE',[req.params.id]);
    if (!heads.length) throw fail(404,'Không tìm thấy phiếu xuất.');
    const h=heads[0]; if (h.status!=='PENDING') throw fail(409,'Phiếu này đã được xử lý.');
    const [items]=await db.query('SELECT * FROM outbound_order_items WHERE order_id=? FOR UPDATE',[req.params.id]);
    for (const x of items) {
      const inv=await ensureInventory(db,x.variant_id,h.from_warehouse_id), qty=Number(x.quantity);
      if (Number(inv.actual_stock)<qty||Number(inv.reserved_stock)<qty) throw fail(409,'Tồn kho đã thay đổi; không thể duyệt.');
      const after=Number(inv.actual_stock)-qty;
      await db.query('UPDATE inventory SET actual_stock=?,reserved_stock=reserved_stock-? WHERE id=?',[after,qty,inv.id]);
      await inventory.recordStockMovement({variant_id:x.variant_id,warehouse_id:h.from_warehouse_id,movement_type:'OUTBOUND',
        reference_type:'OUTBOUND_ORDER',reference_id:Number(req.params.id),quantity:-qty,qty_before:Number(inv.actual_stock),qty_after:after,
        note:'Duyệt phiếu xuất '+h.order_no,created_by:req.user.id},db);
      if (h.to_warehouse_id) {
        const dest=await ensureInventory(db,x.variant_id,h.to_warehouse_id), afterDest=Number(dest.actual_stock)+qty;
        await db.query('UPDATE inventory SET actual_stock=? WHERE id=?',[afterDest,dest.id]);
        await inventory.recordStockMovement({variant_id:x.variant_id,warehouse_id:h.to_warehouse_id,movement_type:'TRANSFER_IN',
          reference_type:'OUTBOUND_ORDER',reference_id:Number(req.params.id),quantity:qty,qty_before:Number(dest.actual_stock),qty_after:afterDest,
          note:'Nhận từ phiếu xuất '+h.order_no,created_by:req.user.id},db);
        await inventory.checkAndCreateAlert(x.variant_id,h.to_warehouse_id,db);
      }
      await inventory.checkAndCreateAlert(x.variant_id,h.from_warehouse_id,db);
    }
    await db.query("UPDATE outbound_orders SET status='APPROVED',approved_by=?,updated_at=NOW() WHERE id=?",[req.user.id,req.params.id]);
    await notify(db,null,null,'OUTBOUND_ORDER',Number(req.params.id),'Phiếu xuất đã được duyệt','Phiếu '+h.order_no+' đã được duyệt.',h.created_by);
  });
  res.json({success:true,message:'Đã duyệt phiếu xuất.'});
});

const createTransfer = wrap(async (req,res) => {
  const {from_warehouse_id,to_warehouse_id,items,notes}=req.body;
  if (!isId(from_warehouse_id)||!isId(to_warehouse_id)||Number(from_warehouse_id)===Number(to_warehouse_id)) throw fail(400,'Chọn hai kho khác nhau.');
  scope(req,from_warehouse_id);
  const id=await tx(async db => {
    const lines=await resolveLines(db,items,false);
    const [head]=await db.query("INSERT INTO transfer_orders (order_no,from_warehouse_id,to_warehouse_id,status,created_by,notes) VALUES (?,?,?,'PENDING',?,?)",
      [makeCode('DC'),from_warehouse_id,to_warehouse_id,req.user.id,notes||null]);
    for (const x of lines) {
      const inv=await ensureInventory(db,x.variant_id,from_warehouse_id);
      if (Number(inv.actual_stock)-Number(inv.reserved_stock)<x.quantity) throw fail(409,'Tồn khả dụng không đủ cho SKU '+x.variant_id+'.');
      await db.query('UPDATE inventory SET reserved_stock=reserved_stock+? WHERE id=?',[x.quantity,inv.id]);
      await db.query('INSERT INTO transfer_order_items (order_id,variant_id,shipped_qty) VALUES (?,?,?)',[head.insertId,x.variant_id,x.quantity]);
    }
    await notify(db,'MANAGER',from_warehouse_id,'TRANSFER_ORDER',head.insertId,'Phiếu điều chuyển cần duyệt','Có phiếu điều chuyển mới cần duyệt.');
    return head.insertId;
  });
  res.status(201).json({success:true,message:'Đã tạo phiếu điều chuyển chờ duyệt.',data:{id}});
});
const approveTransfer = wrap(async (req,res) => {
  await tx(async db => {
    const [heads]=await db.query('SELECT * FROM transfer_orders WHERE id=? FOR UPDATE',[req.params.id]);
    if (!heads.length) throw fail(404,'Không tìm thấy phiếu điều chuyển.');
    const h=heads[0]; if (h.status!=='PENDING') throw fail(409,'Phiếu này đã được xử lý.');
    const [items]=await db.query('SELECT * FROM transfer_order_items WHERE order_id=? FOR UPDATE',[req.params.id]);
    for (const x of items) {
      const inv=await ensureInventory(db,x.variant_id,h.from_warehouse_id), qty=Number(x.shipped_qty);
      if (Number(inv.actual_stock)<qty||Number(inv.reserved_stock)<qty) throw fail(409,'Tồn kho đã thay đổi; không thể duyệt.');
      const after=Number(inv.actual_stock)-qty;
      await db.query('UPDATE inventory SET actual_stock=?,reserved_stock=reserved_stock-? WHERE id=?',[after,qty,inv.id]);
      await inventory.recordStockMovement({variant_id:x.variant_id,warehouse_id:h.from_warehouse_id,movement_type:'TRANSFER_OUT',
        reference_type:'TRANSFER_ORDER',reference_id:Number(req.params.id),quantity:-qty,qty_before:Number(inv.actual_stock),qty_after:after,
        note:'Xuất chuyển '+h.order_no,created_by:req.user.id},db);
      await inventory.checkAndCreateAlert(x.variant_id,h.from_warehouse_id,db);
    }
    await db.query("UPDATE transfer_orders SET status='IN_TRANSIT',approved_by=?,updated_at=NOW() WHERE id=?",[req.user.id,req.params.id]);
    await notify(db,'STAFF',h.to_warehouse_id,'TRANSFER_ORDER',Number(req.params.id),'Hàng điều chuyển đang trên đường','Phiếu '+h.order_no+' đang được chuyển đến kho của bạn.');
  });
  res.json({success:true,message:'Đã duyệt; hàng đang vận chuyển.'});
});
const confirmTransferReceived = wrap(async (req,res) => {
  await tx(async db => {
    const [heads]=await db.query('SELECT * FROM transfer_orders WHERE id=? FOR UPDATE',[req.params.id]);
    if (!heads.length) throw fail(404,'Không tìm thấy phiếu điều chuyển.');
    const h=heads[0]; if (h.status!=='IN_TRANSIT') throw fail(409,'Phiếu chưa ở trạng thái đang vận chuyển.');
    scope(req,h.to_warehouse_id);
    const [items]=await db.query('SELECT * FROM transfer_order_items WHERE order_id=? FOR UPDATE',[req.params.id]);
    const input=Array.isArray(req.body.items)?req.body.items:[];
    for (const x of items) {
      const found=input.find(y=>Number(y.variant_id)===Number(x.variant_id));
      const qty=found?Number(found.received_qty):Number(x.shipped_qty);
      if (!Number.isInteger(qty)||qty<0||qty>Number(x.shipped_qty)) throw fail(400,'Số lượng nhận không hợp lệ.');
      const inv=await ensureInventory(db,x.variant_id,h.to_warehouse_id), after=Number(inv.actual_stock)+qty;
      await db.query('UPDATE inventory SET actual_stock=? WHERE id=?',[after,inv.id]);
      await db.query('UPDATE transfer_order_items SET received_qty=?,discrepancy_qty=? WHERE id=?',[qty,qty-Number(x.shipped_qty),x.id]);
      if (qty) await inventory.recordStockMovement({variant_id:x.variant_id,warehouse_id:h.to_warehouse_id,movement_type:'TRANSFER_IN',
        reference_type:'TRANSFER_ORDER',reference_id:Number(req.params.id),quantity:qty,qty_before:Number(inv.actual_stock),qty_after:after,
        note:'Nhận hàng từ '+h.order_no,created_by:req.user.id},db);
      await inventory.checkAndCreateAlert(x.variant_id,h.to_warehouse_id,db);
    }
    await db.query("UPDATE transfer_orders SET status='COMPLETED',updated_at=NOW() WHERE id=?",[req.params.id]);
    await notify(db,'MANAGER',h.from_warehouse_id,'TRANSFER_ORDER',Number(req.params.id),'Đã xác nhận nhận hàng','Kho đích xác nhận phiếu '+h.order_no+'.');
  });
  res.json({success:true,message:'Đã xác nhận hàng nhận.'});
});

const reject = kind => wrap(async (req,res) => {
  const reason=String(req.body.rejection_reason||'').trim(); if (!reason) throw fail(400,'Vui lòng nhập lý do từ chối.');
  const c=cfg[kind];
  await tx(async db => {
    const [heads]=await db.query('SELECT * FROM '+c.table+' WHERE id=? FOR UPDATE',[req.params.id]);
    if (!heads.length) throw fail(404,'Không tìm thấy phiếu.');
    const h=heads[0]; if (h.status!=='PENDING') throw fail(409,'Chỉ phiếu đang chờ duyệt mới được từ chối.');
    const [items]=await db.query('SELECT * FROM '+c.items+' WHERE order_id=? FOR UPDATE',[req.params.id]);
    const wh=kind==='inbound'?h.warehouse_id:h.from_warehouse_id;
    for (const x of items) {
      const inv=await ensureInventory(db,x.variant_id,wh), qty=Number(x.quantity||x.shipped_qty);
      if (kind==='inbound') await db.query('UPDATE inventory SET incoming_stock=GREATEST(0,incoming_stock-?) WHERE id=?',[qty,inv.id]);
      else await db.query('UPDATE inventory SET reserved_stock=GREATEST(0,reserved_stock-?) WHERE id=?',[qty,inv.id]);
    }
    await db.query('UPDATE '+c.table+" SET status='REJECTED',rejection_reason=?,approved_by=?,updated_at=NOW() WHERE id=?",[reason,req.user.id,req.params.id]);
    await notify(db,null,null,kind.toUpperCase()+'_ORDER',Number(req.params.id),'Phiếu bị từ chối','Phiếu '+h.order_no+' bị từ chối: '+reason,h.created_by);
  });
  res.json({success:true,message:'Đã từ chối phiếu.'});
});

const listAlerts = wrap(async (req,res) => {
  let where='WHERE 1=1'; const args=[];
  if (req.query.status) { where+=' AND a.status=?'; args.push(req.query.status); }
  if (req.user.role==='STAFF') { where+=' AND a.warehouse_id=?'; args.push(req.user.warehouse_id); }
  else if (req.query.warehouse_id) { where+=' AND a.warehouse_id=?'; args.push(req.query.warehouse_id); }
  const [rows]=await pool.query('SELECT a.*,pv.sku,p.name AS product_name,w.name AS warehouse_name FROM alerts a LEFT JOIN product_variants pv ON pv.id=a.variant_id LEFT JOIN products p ON p.id=a.product_id LEFT JOIN warehouses w ON w.id=a.warehouse_id '+where+' ORDER BY a.created_at DESC LIMIT 200',args);
  res.json({success:true,data:rows});
});
const closeAlert = wrap(async (req,res) => {
  const [r]=await pool.query("UPDATE alerts SET status='MANUALLY_CLOSED',closed_at=NOW() WHERE id=? AND status='OPEN'",[req.params.id]);
  if (!r.affectedRows) throw fail(404,'Cảnh báo không tồn tại hoặc đã xử lý.');
  res.json({success:true});
});
const listNotifications = wrap(async (req,res) => {
  const page=Math.max(1,parseInt(req.query.page,10)||1), limit=Math.min(100,Math.max(1,parseInt(req.query.limit,10)||20));
  const [rows]=await pool.query('SELECT * FROM user_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?',[req.user.id,limit,(page-1)*limit]);
  const [[c]]=await pool.query('SELECT COUNT(*) AS total FROM user_notifications WHERE user_id=?',[req.user.id]);
  res.json({success:true,data:rows,pagination:{total:Number(c.total),page,limit}});
});
const unreadCount = wrap(async (req,res) => {
  const [[r]]=await pool.query('SELECT COUNT(*) AS count FROM user_notifications WHERE user_id=? AND is_read=0',[req.user.id]);
  res.json({success:true,data:{count:Number(r.count)}});
});
const markRead = wrap(async (req,res) => {
  const [r]=await pool.query('UPDATE user_notifications SET is_read=1 WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  if (!r.affectedRows) throw fail(404,'Không tìm thấy thông báo.');
  res.json({success:true});
});
const markAllRead = wrap(async (req,res) => {
  await pool.query('UPDATE user_notifications SET is_read=1 WHERE user_id=? AND is_read=0',[req.user.id]); res.json({success:true});
});
const resolveNotification = wrap(async (req,res) => {
  const [r]=await pool.query('UPDATE user_notifications SET is_read=1,is_resolved=1 WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  if (!r.affectedRows) throw fail(404,'Không tìm thấy thông báo.');
  res.json({success:true});
});
const deleteNotification = wrap(async (req,res) => {
  const [r]=await pool.query('DELETE FROM user_notifications WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  if (!r.affectedRows) throw fail(404,'Không tìm thấy thông báo.');
  res.json({success:true});
});
const dashboard = wrap(async (req,res) => {
  const wh=req.user.role==='STAFF'?req.user.warehouse_id:req.query.warehouse_id, clause=wh?' AND i.warehouse_id=?':'', args=wh?[wh]:[];
  const [[stock]]=await pool.query("SELECT COALESCE(SUM(i.actual_stock*p.cost_price),0) AS inventory_value,COUNT(DISTINCT i.variant_id) AS sku_count FROM inventory i JOIN product_variants pv ON pv.id=i.variant_id JOIN products p ON p.id=pv.product_id WHERE p.status='ACTIVE'"+clause,args);
  const [below]=await pool.query('SELECT COUNT(*) AS total FROM inventory i JOIN stock_thresholds st ON st.variant_id=i.variant_id AND st.warehouse_id=i.warehouse_id WHERE i.actual_stock<st.min_stock'+clause,args);
  const alertClause=wh?' AND a.warehouse_id=?':'', alertArgs=wh?[wh]:[];
  const [alerts]=await pool.query("SELECT id,alert_type,severity,message,created_at FROM alerts a WHERE status='OPEN'"+alertClause+' ORDER BY created_at DESC LIMIT 8',alertArgs);
  res.json({success:true,data:{inventory_value:Number(stock.inventory_value),sku_count:Number(stock.sku_count),below_threshold_count:Number(below[0].total),open_alert_count:alerts.length,latest_alerts:alerts}});
});

const runAlertChecks = wrap(async (req,res) => {
  const jobs=require('../services/alertService');
  await Promise.all([jobs.runForecastStockoutCheck(),jobs.runSlowMovingCheck(),jobs.runSizeBreakCheck()]);
  res.json({success:true,message:'Đã cập nhật cảnh báo dự báo, hàng bán chậm và đứt size.'});
});
module.exports = {
  listInbound:listOrders('inbound'),getInbound:getOrder('inbound'),createInbound,approveInbound,rejectInbound:reject('inbound'),
  listOutbound:listOrders('outbound'),getOutbound:getOrder('outbound'),createOutbound,approveOutbound,rejectOutbound:reject('outbound'),
  listTransfers:listOrders('transfer'),getTransfer:getOrder('transfer'),createTransfer,approveTransfer,rejectTransfer:reject('transfer'),
  confirmTransferReceived,listAlerts,closeAlert,runAlertChecks,listNotifications,unreadCount,markRead,markAllRead,resolveNotification,deleteNotification,
  getDashboard:dashboard
};