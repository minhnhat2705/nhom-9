-- =============================================================================
-- Lumié Smart Warehouse Management System
-- Database Schema - schema.sql
-- MySQL 8.0+  |  Character Set: utf8mb4  |  Collation: utf8mb4_unicode_ci
-- =============================================================================

CREATE DATABASE IF NOT EXISTS lumie_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE lumie_db;

-- Enforce foreign key constraints
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- TABLE: warehouses
-- Must be created before users (FK: users.warehouse_id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS warehouses (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    code            VARCHAR(20)     NOT NULL,
    name            VARCHAR(150)    NOT NULL,
    type            ENUM('MAIN_WAREHOUSE','STORE_WAREHOUSE') NOT NULL,
    address         VARCHAR(300)    NULL,
    manager_name    VARCHAR(100)    NULL,
    status          ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_warehouses        PRIMARY KEY (id),
    CONSTRAINT uq_warehouses_code   UNIQUE (code),
    CONSTRAINT uq_warehouses_name   UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Physical warehouses and store locations';

-- =============================================================================
-- TABLE: users
-- System accounts with RBAC roles
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    full_name       VARCHAR(100)    NOT NULL,
    email           VARCHAR(150)    NOT NULL,
    phone           VARCHAR(20)     NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    role            ENUM('MANAGER','STAFF') NOT NULL DEFAULT 'STAFF',
    warehouse_id    INT UNSIGNED    NULL COMMENT 'Primary warehouse assignment',
    status          ENUM('ACTIVE','DELETED') NOT NULL DEFAULT 'ACTIVE',
    login_attempts  TINYINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until    DATETIME        NULL COMMENT 'Account locked until this timestamp',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_users             PRIMARY KEY (id),
    CONSTRAINT uq_users_email       UNIQUE (email),
    CONSTRAINT fk_users_warehouse   FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='System user accounts with role-based access control';

-- =============================================================================
-- TABLE: categories
-- Product classification (Ao, Quan, Vay/Dam, ...)
-- =============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100)    NOT NULL,
    description TEXT            NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_categories        PRIMARY KEY (id),
    CONSTRAINT uq_categories_name   UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Product categories';

-- =============================================================================
-- TABLE: collections
-- Seasonal fashion collections
-- =============================================================================
CREATE TABLE IF NOT EXISTS collections (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150)    NOT NULL,
    season      ENUM('Xuân-Hè','Thu-Đông','Quanh năm') NOT NULL,
    year        SMALLINT UNSIGNED NOT NULL,
    description TEXT            NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_collections       PRIMARY KEY (id),
    CONSTRAINT uq_collections_name  UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Seasonal fashion collections';

-- =============================================================================
-- TABLE: suppliers
-- Goods suppliers / vendors
-- =============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    code            VARCHAR(20)     NOT NULL,
    name            VARCHAR(150)    NOT NULL,
    email           VARCHAR(150)    NULL,
    phone           VARCHAR(20)     NULL,
    lead_time_days  INT UNSIGNED    NOT NULL COMMENT 'Days from order to delivery',
    moq             INT UNSIGNED    NOT NULL COMMENT 'Minimum order quantity',
    payment_terms   VARCHAR(200)    NULL COMMENT 'e.g. NET30, COD, 50% advance',
    status          ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_suppliers             PRIMARY KEY (id),
    CONSTRAINT uq_suppliers_code        UNIQUE (code),
    CONSTRAINT chk_suppliers_lead_time  CHECK (lead_time_days > 0),
    CONSTRAINT chk_suppliers_moq        CHECK (moq > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Product suppliers and vendors';

-- =============================================================================
-- TABLE: products
-- Master product catalogue
-- =============================================================================
CREATE TABLE IF NOT EXISTS products (
    id              INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    code            VARCHAR(30)         NOT NULL,
    name            VARCHAR(200)        NOT NULL,
    category_id     INT UNSIGNED        NOT NULL,
    collection_id   INT UNSIGNED        NULL,
    supplier_id     INT UNSIGNED        NOT NULL,
    cost_price      DECIMAL(15,2)       NOT NULL COMMENT 'Wholesale / cost price',
    selling_price   DECIMAL(15,2)       NOT NULL COMMENT 'Retail selling price',
    image_url       VARCHAR(500)        NULL,
    status          ENUM('ACTIVE','DISCONTINUED') NOT NULL DEFAULT 'ACTIVE',
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_products              PRIMARY KEY (id),
    CONSTRAINT fk_products_category     FOREIGN KEY (category_id)
        REFERENCES categories (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_products_collection   FOREIGN KEY (collection_id)
        REFERENCES collections (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_products_supplier     FOREIGN KEY (supplier_id)
        REFERENCES suppliers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_products_cost_price      CHECK (cost_price > 0),
    CONSTRAINT chk_products_selling_price   CHECK (selling_price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Master product catalogue';

-- =============================================================================
-- TABLE: product_variants
-- SKU-level variants: each Size x Color combination gets a unique SKU + barcode
-- =============================================================================
CREATE TABLE IF NOT EXISTS product_variants (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    product_id  INT UNSIGNED    NOT NULL,
    sku         VARCHAR(50)     NOT NULL COMMENT 'e.g. LM-AO001-DEN-M',
    barcode     VARCHAR(20)     NOT NULL COMMENT '8-13 digit EAN/UPC barcode',
    size        ENUM('XS','S','M','L','XL','XXL','ONE_SIZE') NOT NULL,
    color       VARCHAR(50)     NOT NULL COMMENT 'Human-readable colour name',
    color_code  VARCHAR(7)      NULL     COMMENT 'Hex colour code e.g. #1A1A2E',
    status      ENUM('ACTIVE','DISCONTINUED') NOT NULL DEFAULT 'ACTIVE',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_product_variants          PRIMARY KEY (id),
    CONSTRAINT uq_product_variants_sku      UNIQUE (sku),
    CONSTRAINT uq_product_variants_barcode  UNIQUE (barcode),
    CONSTRAINT fk_product_variants_product  FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Product variants: one row per SKU (Size x Color combination)';

-- =============================================================================
-- TABLE: inventory
-- Real-time stock levels per variant per warehouse
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    variant_id      INT UNSIGNED    NOT NULL,
    warehouse_id    INT UNSIGNED    NOT NULL,
    actual_stock    INT             NOT NULL DEFAULT 0 COMMENT 'Physical stock on hand',
    reserved_stock  INT             NOT NULL DEFAULT 0 COMMENT 'Qty allocated to pending orders',
    incoming_stock  INT             NOT NULL DEFAULT 0 COMMENT 'Qty expected from pending receipts and purchase orders',
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_inventory                 PRIMARY KEY (id),
    CONSTRAINT uq_inventory_variant_wh      UNIQUE (variant_id, warehouse_id),
    CONSTRAINT fk_inventory_variant         FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_inventory_warehouse       FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_inventory_actual_stock   CHECK (actual_stock >= 0),
    CONSTRAINT chk_inventory_reserved_stock CHECK (reserved_stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Real-time inventory levels per variant per warehouse';

CREATE INDEX idx_inventory_warehouse ON inventory (warehouse_id);
CREATE INDEX idx_inventory_variant   ON inventory (variant_id);

-- =============================================================================
-- TABLE: stock_thresholds
-- Minimum and safety stock levels per variant per warehouse
-- =============================================================================
CREATE TABLE IF NOT EXISTS stock_thresholds (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    variant_id      INT UNSIGNED    NOT NULL,
    warehouse_id    INT UNSIGNED    NOT NULL,
    min_stock       INT             NOT NULL DEFAULT 0 COMMENT 'Trigger reorder alert below this',
    safety_stock    INT             NOT NULL DEFAULT 0 COMMENT 'Buffer stock; must be >= min_stock',
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_stock_thresholds              PRIMARY KEY (id),
    CONSTRAINT uq_stock_thresholds_variant_wh   UNIQUE (variant_id, warehouse_id),
    CONSTRAINT fk_stock_thresholds_variant      FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stock_thresholds_warehouse    FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_thresholds_min_stock         CHECK (min_stock >= 0),
    CONSTRAINT chk_thresholds_safety_stock      CHECK (safety_stock >= min_stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Min-stock and safety-stock thresholds per variant per warehouse';

-- =============================================================================
-- TABLE: stock_movements
-- Immutable audit log of every stock change
-- =============================================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    variant_id      INT UNSIGNED    NOT NULL,
    warehouse_id    INT UNSIGNED    NOT NULL,
    movement_type   ENUM('INBOUND','OUTBOUND','TRANSFER_OUT','TRANSFER_IN','ADJUSTMENT') NOT NULL,
    reference_type  ENUM('INBOUND_ORDER','OUTBOUND_ORDER','TRANSFER_ORDER','STOCKTAKE')  NOT NULL,
    reference_id    INT UNSIGNED    NOT NULL COMMENT 'PK of the referenced order/stocktake',
    quantity        INT             NOT NULL COMMENT 'Positive = increase, negative = decrease',
    qty_before      INT             NOT NULL COMMENT 'Stock level before this movement',
    qty_after       INT             NOT NULL COMMENT 'Stock level after this movement',
    note            VARCHAR(500)    NULL,
    created_by      INT UNSIGNED    NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_stock_movements       PRIMARY KEY (id),
    CONSTRAINT fk_movements_variant     FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_movements_warehouse   FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_movements_created_by  FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Immutable stock movement audit log';

CREATE INDEX idx_movements_variant_wh   ON stock_movements (variant_id, warehouse_id);
CREATE INDEX idx_movements_created_at   ON stock_movements (created_at);
CREATE INDEX idx_movements_reference    ON stock_movements (reference_type, reference_id);

-- =============================================================================
-- TABLE: inbound_orders  (Phieu Nhap Kho)
-- =============================================================================
CREATE TABLE IF NOT EXISTS inbound_orders (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    order_no            VARCHAR(25)     NOT NULL COMMENT 'Format: PN-YYYYMMDD-XXX',
    supplier_id         INT UNSIGNED    NOT NULL,
    warehouse_id        INT UNSIGNED    NOT NULL,
    status              ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    created_by          INT UNSIGNED    NOT NULL,
    approved_by         INT UNSIGNED    NULL,
    rejection_reason    VARCHAR(500)    NULL,
    notes               TEXT            NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_inbound_orders        PRIMARY KEY (id),
    CONSTRAINT uq_inbound_orders_no     UNIQUE (order_no),
    CONSTRAINT fk_inbound_supplier      FOREIGN KEY (supplier_id)
        REFERENCES suppliers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_inbound_warehouse     FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_inbound_created_by    FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_inbound_approved_by   FOREIGN KEY (approved_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Inbound (receipt) orders - Phieu Nhap Kho';

-- =============================================================================
-- TABLE: inbound_order_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS inbound_order_items (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    order_id        INT UNSIGNED    NOT NULL,
    variant_id      INT UNSIGNED    NOT NULL,
    quantity        INT             NOT NULL COMMENT 'Ordered quantity',
    unit_cost       DECIMAL(15,2)   NOT NULL COMMENT 'Cost per unit at time of order',
    received_qty    INT             NULL     COMMENT 'Actual quantity received (may differ)',
    CONSTRAINT pk_inbound_order_items       PRIMARY KEY (id),
    CONSTRAINT fk_inbound_items_order       FOREIGN KEY (order_id)
        REFERENCES inbound_orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_inbound_items_variant     FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_inbound_items_qty        CHECK (quantity > 0),
    CONSTRAINT chk_inbound_items_unit_cost  CHECK (unit_cost > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Line items for inbound orders';

-- =============================================================================
-- TABLE: outbound_orders  (Phieu Xuat Kho)
-- =============================================================================
CREATE TABLE IF NOT EXISTS outbound_orders (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    order_no            VARCHAR(25)     NOT NULL COMMENT 'Format: PX-YYYYMMDD-XXX',
    from_warehouse_id   INT UNSIGNED    NOT NULL COMMENT 'Source warehouse',
    to_warehouse_id     INT UNSIGNED    NULL     COMMENT 'Destination store (nullable for disposal)',
    status              ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    purpose             ENUM('STORE_SUPPLY','DISPOSAL','OTHER') NOT NULL,
    created_by          INT UNSIGNED    NOT NULL,
    approved_by         INT UNSIGNED    NULL,
    rejection_reason    VARCHAR(500)    NULL,
    notes               TEXT            NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_outbound_orders       PRIMARY KEY (id),
    CONSTRAINT uq_outbound_orders_no    UNIQUE (order_no),
    CONSTRAINT fk_outbound_from_wh      FOREIGN KEY (from_warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_outbound_to_wh        FOREIGN KEY (to_warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_outbound_created_by   FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_outbound_approved_by  FOREIGN KEY (approved_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Outbound dispatch orders - Phieu Xuat Kho';

-- =============================================================================
-- TABLE: outbound_order_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS outbound_order_items (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    order_id    INT UNSIGNED    NOT NULL,
    variant_id  INT UNSIGNED    NOT NULL,
    quantity    INT             NOT NULL,
    CONSTRAINT pk_outbound_order_items      PRIMARY KEY (id),
    CONSTRAINT fk_outbound_items_order      FOREIGN KEY (order_id)
        REFERENCES outbound_orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_outbound_items_variant    FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_outbound_items_qty       CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Line items for outbound orders';

-- =============================================================================
-- TABLE: transfer_orders  (Phieu Dieu Chuyen)
-- =============================================================================
CREATE TABLE IF NOT EXISTS transfer_orders (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    order_no            VARCHAR(25)     NOT NULL COMMENT 'Format: DC-YYYYMMDD-XXX',
    from_warehouse_id   INT UNSIGNED    NOT NULL,
    to_warehouse_id     INT UNSIGNED    NOT NULL,
    status              ENUM('PENDING','APPROVED','IN_TRANSIT','COMPLETED','REJECTED') NOT NULL DEFAULT 'PENDING',
    created_by          INT UNSIGNED    NOT NULL,
    approved_by         INT UNSIGNED    NULL,
    rejection_reason    VARCHAR(500)    NULL,
    notes               TEXT            NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_transfer_orders       PRIMARY KEY (id),
    CONSTRAINT uq_transfer_orders_no    UNIQUE (order_no),
    CONSTRAINT fk_transfer_from_wh      FOREIGN KEY (from_warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_to_wh        FOREIGN KEY (to_warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_created_by   FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_approved_by  FOREIGN KEY (approved_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_transfer_diff_wh     CHECK (from_warehouse_id <> to_warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Inter-warehouse transfer orders - Phieu Dieu Chuyen';

-- =============================================================================
-- TABLE: transfer_order_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS transfer_order_items (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    order_id        INT UNSIGNED    NOT NULL,
    variant_id      INT UNSIGNED    NOT NULL,
    shipped_qty     INT             NOT NULL COMMENT 'Quantity dispatched from source',
    received_qty    INT             NULL     COMMENT 'Quantity confirmed at destination',
    discrepancy_qty INT             NULL     COMMENT 'received_qty - shipped_qty (negative = loss)',
    CONSTRAINT pk_transfer_order_items      PRIMARY KEY (id),
    CONSTRAINT fk_transfer_items_order      FOREIGN KEY (order_id)
        REFERENCES transfer_orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_items_variant    FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_transfer_items_shipped   CHECK (shipped_qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Line items for transfer orders';

-- =============================================================================
-- TABLE: stocktakes
-- Physical inventory count sessions
-- =============================================================================
CREATE TABLE IF NOT EXISTS stocktakes (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    warehouse_id    INT UNSIGNED    NOT NULL,
    scope           ENUM('FULL','BY_CATEGORY') NOT NULL DEFAULT 'FULL',
    category_id     INT UNSIGNED    NULL COMMENT 'Populated when scope = BY_CATEGORY',
    stocktake_date  DATE            NOT NULL,
    assigned_to     INT UNSIGNED    NOT NULL COMMENT 'Staff assigned to perform count',
    status          ENUM('OPEN','IN_PROGRESS','PENDING_APPROVAL','APPROVED','RECOUNT_REQUESTED') NOT NULL DEFAULT 'OPEN',
    created_by      INT UNSIGNED    NOT NULL,
    approved_by     INT UNSIGNED    NULL,
    notes           TEXT            NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_stocktakes                PRIMARY KEY (id),
    CONSTRAINT fk_stocktakes_warehouse      FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_stocktakes_category       FOREIGN KEY (category_id)
        REFERENCES categories (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_stocktakes_assigned_to    FOREIGN KEY (assigned_to)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_stocktakes_created_by     FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_stocktakes_approved_by    FOREIGN KEY (approved_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Stocktake (physical inventory count) sessions';

-- =============================================================================
-- TABLE: stocktake_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS stocktake_items (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    stocktake_id    INT UNSIGNED    NOT NULL,
    variant_id      INT UNSIGNED    NOT NULL,
    system_qty      INT             NOT NULL COMMENT 'System stock at time of stocktake creation',
    actual_qty      INT             NULL     COMMENT 'Physically counted quantity',
    diff_qty        INT             GENERATED ALWAYS AS (actual_qty - system_qty) VIRTUAL
                                    COMMENT 'Variance = actual - system (negative = shrinkage)',
    status          ENUM('DRAFT','SUBMITTED') NOT NULL DEFAULT 'DRAFT',
    CONSTRAINT pk_stocktake_items           PRIMARY KEY (id),
    CONSTRAINT fk_stocktake_items_session   FOREIGN KEY (stocktake_id)
        REFERENCES stocktakes (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stocktake_items_variant   FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Individual SKU count rows within a stocktake session';

-- =============================================================================
-- TABLE: sales_history
-- Daily aggregated sales data per variant per warehouse
-- =============================================================================
CREATE TABLE IF NOT EXISTS sales_history (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    variant_id      INT UNSIGNED    NOT NULL,
    warehouse_id    INT UNSIGNED    NOT NULL,
    sale_date       DATE            NOT NULL,
    quantity_sold   INT             NOT NULL,
    selling_price   DECIMAL(15,2)   NOT NULL COMMENT 'Actual selling price on that date',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_sales_history                 PRIMARY KEY (id),
    CONSTRAINT uq_sales_history_variant_wh_date UNIQUE (variant_id, warehouse_id, sale_date),
    CONSTRAINT fk_sales_history_variant         FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_sales_history_warehouse       FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_sales_history_qty            CHECK (quantity_sold > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Daily sales data aggregated per variant per warehouse';

CREATE INDEX idx_sales_history_variant_wh_date  ON sales_history (variant_id, warehouse_id, sale_date);
CREATE INDEX idx_sales_history_sale_date        ON sales_history (sale_date);

-- =============================================================================
-- TABLE: demand_forecasts
-- AI-generated 30-day rolling demand forecasts
-- =============================================================================
CREATE TABLE IF NOT EXISTS demand_forecasts (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    variant_id      INT UNSIGNED    NOT NULL,
    warehouse_id    INT UNSIGNED    NOT NULL,
    forecast_date   DATE            NOT NULL COMMENT 'Date for which demand is forecasted',
    forecasted_qty  DECIMAL(10,2)   NOT NULL,
    lower_bound     DECIMAL(10,2)   NOT NULL COMMENT '95% prediction interval lower bound',
    upper_bound     DECIMAL(10,2)   NOT NULL COMMENT '95% prediction interval upper bound',
    model_used      VARCHAR(50)     NOT NULL COMMENT 'e.g. Prophet, SARIMA, XGBoost',
    mape            DECIMAL(8,4)    NULL     COMMENT 'Mean Absolute Percentage Error',
    wape            DECIMAL(8,4)    NULL     COMMENT 'Weighted Absolute Percentage Error',
    generated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_demand_forecasts              PRIMARY KEY (id),
    CONSTRAINT uq_demand_forecasts_variant_date UNIQUE (variant_id, warehouse_id, forecast_date),
    CONSTRAINT fk_demand_forecasts_variant      FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_demand_forecasts_warehouse    FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='AI-generated daily demand forecasts per variant per warehouse';

-- =============================================================================
-- TABLE: reorder_suggestions
-- AI-generated purchase quantity suggestions
-- =============================================================================
CREATE TABLE IF NOT EXISTS reorder_suggestions (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    variant_id          INT UNSIGNED    NOT NULL,
    warehouse_id        INT UNSIGNED    NOT NULL,
    supplier_id         INT UNSIGNED    NOT NULL,
    ai_suggested_qty    INT             NOT NULL COMMENT 'Quantity recommended by AI model',
    adjusted_qty        INT             NULL     COMMENT 'Manager-adjusted quantity before PO creation',
    status              ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    urgency             ENUM('HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
    latest_order_date   DATE            NOT NULL COMMENT 'Must order by this date to avoid stockout',
    rejection_reason    VARCHAR(500)    NULL,
    cycle_date          DATE            NOT NULL COMMENT 'Forecast cycle that generated this suggestion',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_reorder_suggestions           PRIMARY KEY (id),
    CONSTRAINT fk_reorder_variant               FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reorder_warehouse             FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reorder_supplier              FOREIGN KEY (supplier_id)
        REFERENCES suppliers (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='AI reorder suggestions per variant per warehouse cycle';

-- =============================================================================
-- TABLE: purchase_orders
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    po_number       VARCHAR(25)     NOT NULL COMMENT 'Format: PO-YYYYMMDD-XXX',
    supplier_id     INT UNSIGNED    NOT NULL,
    warehouse_id    INT UNSIGNED    NOT NULL,
    total_amount    DECIMAL(18,2)   NOT NULL DEFAULT 0,
    status          ENUM('DRAFT','SENT','CONFIRMED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
    notes           TEXT            NULL,
    created_by      INT UNSIGNED    NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_purchase_orders   PRIMARY KEY (id),
    CONSTRAINT uq_purchase_orders_no UNIQUE (po_number),
    CONSTRAINT fk_po_supplier       FOREIGN KEY (supplier_id)
        REFERENCES suppliers (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_po_warehouse      FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_po_created_by     FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Purchase orders issued to suppliers';

-- =============================================================================
-- TABLE: purchase_order_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    po_id           INT UNSIGNED    NOT NULL,
    variant_id      INT UNSIGNED    NOT NULL,
    suggestion_id   INT UNSIGNED    NULL     COMMENT 'Links back to reorder_suggestion if AI-generated',
    quantity        INT             NOT NULL,
    unit_cost       DECIMAL(15,2)   NOT NULL,
    subtotal        DECIMAL(15,2)   GENERATED ALWAYS AS (quantity * unit_cost) STORED
                                    COMMENT 'Computed: quantity x unit_cost',
    CONSTRAINT pk_po_items              PRIMARY KEY (id),
    CONSTRAINT fk_po_items_po           FOREIGN KEY (po_id)
        REFERENCES purchase_orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_po_items_variant      FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_po_items_suggestion   FOREIGN KEY (suggestion_id)
        REFERENCES reorder_suggestions (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_po_items_qty         CHECK (quantity > 0),
    CONSTRAINT chk_po_items_unit_cost   CHECK (unit_cost > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Line items for purchase orders';

-- =============================================================================
-- TABLE: alerts
-- Smart alerts generated by the system
-- =============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    alert_type          ENUM('BELOW_MIN_STOCK','FORECAST_STOCKOUT','SLOW_MOVING','SIZE_BREAK') NOT NULL,
    variant_id          INT UNSIGNED    NULL COMMENT 'Specific SKU (NULL for product-level alerts)',
    product_id          INT UNSIGNED    NULL COMMENT 'Product level (e.g. SIZE_BREAK)',
    warehouse_id        INT UNSIGNED    NOT NULL,
    severity            ENUM('HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
    status              ENUM('OPEN','AUTO_CLOSED','MANUALLY_CLOSED') NOT NULL DEFAULT 'OPEN',
    days_of_supply      DECIMAL(8,2)    NULL COMMENT 'Estimated days until stockout',
    stagnant_capital    DECIMAL(15,2)   NULL COMMENT 'VND value of slow-moving stock',
    message             VARCHAR(500)    NOT NULL,
    metadata            JSON            NULL COMMENT 'Extra context (forecast data, size breakdown, etc.)',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at           DATETIME        NULL,
    CONSTRAINT pk_alerts            PRIMARY KEY (id),
    CONSTRAINT fk_alerts_variant    FOREIGN KEY (variant_id)
        REFERENCES product_variants (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alerts_product    FOREIGN KEY (product_id)
        REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alerts_warehouse  FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='System-generated smart alerts for stock, forecast and slow-moving';

CREATE INDEX idx_alerts_status_type         ON alerts (status, alert_type);
CREATE INDEX idx_alerts_variant_warehouse   ON alerts (variant_id, warehouse_id);

-- =============================================================================
-- TABLE: user_notifications
-- In-app notification inbox per user
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_notifications (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         INT UNSIGNED    NOT NULL,
    alert_id        INT UNSIGNED    NULL COMMENT 'Linked alert if notification is alert-related',
    reference_type  VARCHAR(50)     NULL COMMENT 'e.g. INBOUND_ORDER, TRANSFER_ORDER, ALERT',
    reference_id    INT UNSIGNED    NULL,
    title           VARCHAR(200)    NOT NULL,
    message         TEXT            NOT NULL,
    is_read         TINYINT(1)      NOT NULL DEFAULT 0,
    is_resolved     TINYINT(1)      NOT NULL DEFAULT 0,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_user_notifications    PRIMARY KEY (id),
    CONSTRAINT fk_notifications_user    FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_notifications_alert   FOREIGN KEY (alert_id)
        REFERENCES alerts (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='In-app notification inbox per user';

CREATE INDEX idx_notifications_user_read ON user_notifications (user_id, is_read);

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
