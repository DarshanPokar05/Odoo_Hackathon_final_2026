import api from './axios.js';

const BASE = '/discount-config';

export const discountConfigApi = {
  // Tier ceilings
  listCeilings:   ()             => api.get(`${BASE}/ceilings`).then(r => r.data.data),
  updateCeiling:  (tier, body)   => api.put(`${BASE}/ceilings/${tier}`, body).then(r => r.data.data),

  // Approval chain rules
  listApprovalRules:  ()       => api.get(`${BASE}/approval-rules`).then(r => r.data.data),
  saveApprovalRules:  (rules)  => api.put(`${BASE}/approval-rules`, { rules }).then(r => r.data.data),
};
