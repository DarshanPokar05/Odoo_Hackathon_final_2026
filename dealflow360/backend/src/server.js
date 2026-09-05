'use strict';

// Load and validate env vars first — everything else depends on them.
require('./config/env');

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const { PORT, CLIENT_URL, NODE_ENV } = require('./config/env');
const { initSocket }                  = require('./config/socket');
const { errorHandler }                = require('./middleware/errorHandler');

// ── Cron jobs ─────────────────────────────────────────────────────────────────
const { scheduleMonthlyBilling }       = require('./jobs/monthlyBilling');
const { scheduleStalledDealDetection } = require('./jobs/stalledDealDetection');

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes          = require('./modules/auth/routes');
const customerRoutes      = require('./modules/customers/routes');
const productRoutes       = require('./modules/products/routes');
const categoryRoutes      = require('./modules/categories/routes');
const priceListRoutes     = require('./modules/priceLists/routes');
const discountCfgRoutes   = require('./modules/discountConfig/routes');
const quotationRoutes     = require('./modules/quotations/routes');
const approvalRoutes      = require('./modules/approvals/routes');
const upsellRoutes        = require('./modules/upsell/routes');
const warehouseRoutes     = require('./modules/warehouses/routes');
const fulfillmentRoutes   = require('./modules/fulfillment/routes');
const subscriptionRoutes  = require('./modules/subscriptions/routes');
const billingRoutes       = require('./modules/billing/routes');
const invoiceRoutes       = require('./modules/invoices/routes');
const paymentRoutes       = require('./modules/payments/routes');
const portalRoutes        = require('./modules/portal/routes');
const dealHealthRoutes    = require('./modules/dealHealth/routes');
const reportRoutes        = require('./modules/reports/routes');
const notificationRoutes  = require('./modules/notifications/routes');
const activityLogRoutes   = require('./modules/activityLogs/routes');

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin:      CLIENT_URL,
  credentials: true,
}));

app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check (no auth) ────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',            authRoutes);
app.use('/api/customers',       customerRoutes);
app.use('/api/products',        productRoutes);
app.use('/api/categories',      categoryRoutes);
app.use('/api/price-lists',     priceListRoutes);
app.use('/api/discount-config', discountCfgRoutes);
app.use('/api/quotations',      quotationRoutes);
app.use('/api/approvals',       approvalRoutes);
app.use('/api/upsell',          upsellRoutes);
app.use('/api/warehouses',      warehouseRoutes);
app.use('/api/fulfillment',     fulfillmentRoutes);
app.use('/api/subscriptions',   subscriptionRoutes);
app.use('/api/billing',         billingRoutes);
app.use('/api/invoices',        invoiceRoutes);
app.use('/api/payments',        paymentRoutes);
app.use('/api/portal',          portalRoutes);
app.use('/api/deal-health',     dealHealthRoutes);
app.use('/api/reports',         reportRoutes);
app.use('/api/notifications',   notificationRoutes);
app.use('/api/activity-logs',   activityLogRoutes);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }));

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

// ── HTTP server + Socket.io ───────────────────────────────────────────────────
const httpServer = http.createServer(app);
initSocket(httpServer);

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[server] DealFlow360 backend running on port ${PORT} (${NODE_ENV})`);
  console.log(`[server] Socket.io attached`);

  // Register cron jobs after server is up
  scheduleMonthlyBilling();
  scheduleStalledDealDetection();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — shutting down gracefully');
  httpServer.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
});

module.exports = { app, httpServer };
