import api from './axios.js';

const BASE = '/price-lists';

export const priceListsApi = {
  list:   (params)     => api.get(BASE, { params }).then(r => r.data.data),
  getOne: (id)         => api.get(`${BASE}/${id}`).then(r => r.data.data),
  create: (body)       => api.post(BASE, body).then(r => r.data.data),
  update: (id, body)   => api.put(`${BASE}/${id}`, body).then(r => r.data.data),
  remove: (id)         => api.delete(`${BASE}/${id}`).then(r => r.data.data),
};
