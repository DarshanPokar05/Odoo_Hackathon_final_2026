import api from './axios';

const BASE = '/quotations';

export const quotationsApi = {
  // List / get
  list:        (params)    => api.get(BASE, { params }).then(r => r.data.data),
  getOne:      (id)        => api.get(`${BASE}/${id}`).then(r => r.data.data),

  // Create
  create:      (body)      => api.post(BASE, body).then(r => r.data.data),

  // Line management
  addLine:     (id, body)          => api.post(`${BASE}/${id}/lines`, body).then(r => r.data.data),
  updateLine:  (id, lineId, body)  => api.patch(`${BASE}/${id}/lines/${lineId}`, body).then(r => r.data.data),
  removeLine:  (id, lineId)        => api.delete(`${BASE}/${id}/lines/${lineId}`).then(r => r.data.data),

  // Workflow
  saveDraft:   (id, body)  => api.patch(`${BASE}/${id}/save-draft`, body).then(r => r.data.data),
  submit:      (id)        => api.post(`${BASE}/${id}/submit`).then(r => r.data.data),

  // Upsell suggestions (served from /upsell module)
  getSuggestions: (id)     => api.get(`/upsell/suggestions/${id}`).then(r => r.data.data),
};
