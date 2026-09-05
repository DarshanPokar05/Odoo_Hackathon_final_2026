import api from './axios';

export const portalApi = {
  changePassword:  (body)      => api.post('/portal/auth/change-password', body).then(r => r.data.data),
  listQuotations:  ()          => api.get('/portal/quotations').then(r => r.data.data),
  getQuotation:    (id)        => api.get(`/portal/quotations/${id}`).then(r => r.data.data),
  postMessage:     (id, body)  => api.post(`/portal/quotations/${id}/messages`, body).then(r => r.data.data),
  counterDiscount: (id, body)  => api.post(`/portal/quotations/${id}/counter-discount`, body).then(r => r.data.data),
  confirm:         (id)        => api.post(`/portal/quotations/${id}/confirm`).then(r => r.data.data),
};
