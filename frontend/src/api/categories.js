import api from './axios.js';

const BASE = '/categories';

export const categoriesApi = {
  list:   ()           => api.get(BASE).then(r => r.data.data),
  getOne: (id)         => api.get(`${BASE}/${id}`).then(r => r.data.data),
  create: (body)       => api.post(BASE, body).then(r => r.data.data),
  update: (id, body)   => api.put(`${BASE}/${id}`, body).then(r => r.data.data),
  remove: (id)         => api.delete(`${BASE}/${id}`).then(r => r.data.data),
};
