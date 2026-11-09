import React, { useState, useEffect, useCallback } from 'react';
import { aiService } from '../services/aiService';
import { warehouseService } from '../services/productService';
import toast from 'react-hot-toast';
import { FiUploadCloud, FiAlertCircle, FiCheckCircle, FiFileText, FiRefreshCw } from 'react-icons/fi';

export default function SalesHistoryImport() {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    warehouseService.getWarehouses().then(r => setWarehouses(r.data || [])).catch(() => {});
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await aiService.getSalesHistory({
        warehouse_id: selectedWarehouse || undefined,
        limit: 50,
      });
      setHistory(res.data || []);
    } catch (e) {
      toast.error('Không thể tải lịch sử bán hàng');
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setImportResult(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Vui lòng chọn file Excel hoặc CSV');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);

    setImporting(true);
    try {
      const res = await aiService.importSalesHistory(formData);
      setImportResult(res.data);
      toast.success(res.message || 'Import dữ liệu bán hàng thành công!');
      fetchHistory();
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi import file');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nhập dữ liệu bán hàng lịch sử (US-34)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tải lên file doanh số theo ngày để cung cấp dữ liệu huấn luyện cho mô hình AI dự báo nhu cầu
        </p>
      </div>

      {/* Upload Box */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Tải lên file dữ liệu (.xlsx, .csv)</h2>
        <p className="text-xs text-gray-500 mb-4">
          File cần có các cột: <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-700">date</code> (YYYY-MM-DD), <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-700">warehouse_code</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-700">sku</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-700">quantity_sold</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-700">selling_price</code>
        </p>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-500 transition-colors bg-gray-50">
            <FiUploadCloud className="mx-auto text-4xl text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-1">
              Kéo thả file vào đây hoặc <label className="text-purple-600 font-medium hover:underline cursor-pointer">
                chọn từ máy tính
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
              </label>
            </p>
            {file && (
              <p className="text-xs font-medium text-purple-700 mt-2 bg-purple-100 py-1 px-3 rounded-full inline-block">
                📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={!file || importing}
              className="btn-primary flex items-center gap-2"
            >
              {importing ? 'Đang phân tích & lưu...' : 'Tiến hành Nhập dữ liệu'}
            </button>
          </div>
        </form>

        {/* Import Results Report */}
        {importResult && (
          <div className="mt-6 p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FiCheckCircle className="text-green-600" /> Kết quả xử lý file
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-gray-500 text-xs">Thành công: </span>
                <span className="font-bold text-green-600">{importResult.success_count} dòng</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-gray-500 text-xs">Bị lỗi / Bỏ qua: </span>
                <span className="font-bold text-rose-600">{importResult.error_count} dòng</span>
              </div>
            </div>

            {importResult.warning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2">
                <FiAlertCircle className="text-lg flex-shrink-0" />
                <span>{importResult.warning}</span>
              </div>
            )}

            {importResult.errors && importResult.errors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Chi tiết các dòng lỗi:</p>
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded bg-white text-xs">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="p-2 text-rose-600">
                      Dòng {err.row}: {err.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Preview */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Dữ liệu bán hàng gần đây ({history.length} bản ghi)
          </h2>
          <div className="flex items-center gap-2">
            <select
              className="input-field text-xs py-1.5"
              value={selectedWarehouse}
              onChange={e => setSelectedWarehouse(e.target.value)}
            >
              <option value="">Tất cả kho</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <button
              onClick={fetchHistory}
              className="p-1.5 text-gray-500 hover:text-purple-600 rounded"
              title="Làm mới"
            >
              <FiRefreshCw className={loadingHistory ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500 bg-gray-50">
                <th className="py-2 px-3 text-left">Ngày bán</th>
                <th className="py-2 px-3 text-left">SKU</th>
                <th className="py-2 px-3 text-left">Sản phẩm</th>
                <th className="py-2 px-3 text-left">Kho</th>
                <th className="py-2 px-3 text-right">Số lượng</th>
                <th className="py-2 px-3 text-right">Đơn giá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingHistory ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={6} className="py-3 px-3"><div className="h-4 bg-gray-200 animate-pulse rounded" /></td></tr>
                ))
              ) : history.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Chưa có dữ liệu</td></tr>
              ) : (
                history.map((h, i) => (
                  <tr key={h.id || i} className="hover:bg-gray-50 text-xs">
                    <td className="py-2 px-3 text-gray-600 font-medium">
                      {h.sale_date ? new Date(h.sale_date).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td className="py-2 px-3 font-mono text-purple-700">{h.sku}</td>
                    <td className="py-2 px-3 text-gray-900">{h.product_name} ({h.size}/{h.color})</td>
                    <td className="py-2 px-3 text-gray-600">{h.warehouse_name}</td>
                    <td className="py-2 px-3 text-right font-bold text-gray-900">{h.quantity_sold}</td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      {h.selling_price ? Number(h.selling_price).toLocaleString('vi-VN') + ' đ' : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
