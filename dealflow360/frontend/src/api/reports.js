import api from './axios';

export const reportsApi = {
  getSummary: (params) => api.get('/reports', { params }).then(r => r.data.data),
  exportPdf:  (params) => api.get('/reports/export/pdf', { params, responseType: 'blob' }),
  exportCsv:  (params) => api.get('/reports/export/csv', { params, responseType: 'blob' }),
};
