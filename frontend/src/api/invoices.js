import api from './axios';

export const invoicesApi = {
  list:         (params) => api.get('/invoices', { params }).then(r => r.data.data),
  getOne:       (id)     => api.get(`/invoices/${id}`).then(r => r.data.data),
  createOrder:  (body)   => api.post('/payments/create-order', body).then(r => r.data.data),
  verifyPayment:(body)   => api.post('/payments/verify', body).then(r => r.data.data),
};
