import api from './axios';

// ── Order fulfillment list & detail ───────────────────────────────────────────
export const listFulfillmentOrders  = ()          => api.get('/fulfillment').then(r => r.data.data);
export const getFulfillmentDetail   = (orderId)   => api.get(`/fulfillment/${orderId}`).then(r => r.data.data);

// ── Split workflow ────────────────────────────────────────────────────────────
export const suggestSplit  = (orderId)        => api.post(`/fulfillment/${orderId}/suggest-split`).then(r => r.data.data);
export const acceptSplit   = (orderId)        => api.post(`/fulfillment/${orderId}/accept-split`).then(r => r.data.data);
export const overrideSplit = (orderId, body)  => api.post(`/fulfillment/${orderId}/override`, body).then(r => r.data.data);

// ── Backorder consolidation ───────────────────────────────────────────────────
export const consolidateBackorder = (backorderId) =>
  api.post(`/fulfillment/backorders/${backorderId}/consolidate`).then(r => r.data.data);
