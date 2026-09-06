import api from './axios';

export const subscriptionsApi = {
  list:    (params)    => api.get('/subscriptions', { params }).then(r => r.data.data),
  getOne:  (id)        => api.get(`/subscriptions/${id}`).then(r => r.data.data),
  create:  (body)      => api.post('/subscriptions', body).then(r => r.data.data),
  modify:  (id, body)  => api.patch(`/subscriptions/${id}/modify`, body).then(r => r.data.data),
  cancel:  (id, body)  => api.patch(`/subscriptions/${id}/cancel`, body).then(r => r.data.data),
};
