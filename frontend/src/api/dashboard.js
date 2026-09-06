import api from './axios';

export const dashboardApi = {
  getStats:        () => api.get('/reports?take=5').then(r => r.data.data),
  recentActivity:  () => api.get('/activity-logs?limit=20').then(r => r.data.data),
  pendingApprovals:() => api.get('/approvals?status=PENDING').then(r => r.data.data),
  openQuotations:  () => api.get('/quotations?status=DRAFT').then(r => r.data.data),
  atRiskDeals:     () => api.get('/deal-health?resolved=false').then(r => r.data.data),
};
