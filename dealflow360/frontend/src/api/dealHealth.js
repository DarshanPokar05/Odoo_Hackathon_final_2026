import api from './axios';

export const dealHealthApi = {
  list:     (params)      => api.get('/deal-health', { params }).then(r => r.data.data),
  getOne:   (id)          => api.get(`/deal-health/${id}`).then(r => r.data.data),
  resolve:  (id)          => api.patch(`/deal-health/${id}/resolve`).then(r => r.data.data),
  escalate: (id, body)    => api.patch(`/deal-health/${id}/escalate`, body).then(r => r.data.data),
};
