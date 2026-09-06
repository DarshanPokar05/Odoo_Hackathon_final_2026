import api from './axios';

export const customersApi = {
  list:    ()   => api.get('/customers').then(r => r.data.data),
  getOne:  (id) => api.get(`/customers/${id}`).then(r => r.data.data),
  create:  (b)  => api.post('/customers', b).then(r => r.data.data),
  update:  (id, b) => api.patch(`/customers/${id}`, b).then(r => r.data.data),
  remove:  (id) => api.delete(`/customers/${id}`).then(r => r.data.data),
};
