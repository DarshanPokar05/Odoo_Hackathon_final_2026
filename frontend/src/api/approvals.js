import api from './axios';

const BASE = '/approvals';

export const approvalsApi = {
  list:               (params)        => api.get(BASE, { params }).then(r => r.data.data),
  getOne:             (id)            => api.get(`${BASE}/${id}`).then(r => r.data.data),
  approve:            (id, body)      => api.patch(`${BASE}/${id}/approve`, body).then(r => r.data.data),
  reject:             (id, body)      => api.patch(`${BASE}/${id}/reject`, body).then(r => r.data.data),
  returnForRevision:  (id, body)      => api.patch(`${BASE}/${id}/return-for-revision`, body).then(r => r.data.data),
};
