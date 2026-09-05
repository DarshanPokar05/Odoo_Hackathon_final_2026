import api from './axios';

// ── Warehouse CRUD ────────────────────────────────────────────────────────────
export const listWarehouses  = ()          => api.get('/warehouses').then(r => r.data.data);
export const getWarehouse    = (id)        => api.get(`/warehouses/${id}`).then(r => r.data.data);
export const createWarehouse = (body)      => api.post('/warehouses', body).then(r => r.data.data);
export const updateWarehouse = (id, body)  => api.put(`/warehouses/${id}`, body).then(r => r.data.data);
export const deleteWarehouse = (id)        => api.delete(`/warehouses/${id}`).then(r => r.data.data);

// ── StockLevel sub-routes ─────────────────────────────────────────────────────
export const listStock    = (warehouseId)        => api.get(`/warehouses/${warehouseId}/stock`).then(r => r.data.data);
export const setStock     = (warehouseId, body)  => api.put(`/warehouses/${warehouseId}/stock`, body).then(r => r.data.data);
export const adjustStock  = (warehouseId, body)  => api.post(`/warehouses/${warehouseId}/stock/adjust`, body).then(r => r.data.data);
