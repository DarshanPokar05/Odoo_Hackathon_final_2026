import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/authContext.jsx';

// Layouts
import AppLayout    from './components/AppLayout.jsx';
import PortalLayout from './components/PortalLayout.jsx';

// Auth pages (no layout)
import LoginPage          from './pages/LoginPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';

// Internal pages
import DashboardPage         from './pages/DashboardPage.jsx';
import ProductDashboardPage  from './pages/ProductDashboardPage.jsx';
import ProductDetailPage     from './pages/ProductDetailPage.jsx';
import DiscountConfigPage    from './pages/DiscountConfigPage.jsx';
import FulfillmentListPage   from './pages/FulfillmentListPage.jsx';
import FulfillmentDetailPage from './pages/FulfillmentDetailPage.jsx';
import QuotationsListPage    from './pages/QuotationsListPage.jsx';
import QuotationDetailPage   from './pages/QuotationDetailPage.jsx';
import ApprovalsListPage     from './pages/ApprovalsListPage.jsx';
import ApprovalDetailPage    from './pages/ApprovalDetailPage.jsx';
import SubscriptionsListPage from './pages/SubscriptionsListPage.jsx';
import BillingDetailPage     from './pages/BillingDetailPage.jsx';
import InvoicesListPage      from './pages/InvoicesListPage.jsx';
import InvoiceDetailPage     from './pages/InvoiceDetailPage.jsx';
import DealHealthPage        from './pages/DealHealthPage.jsx';
import ReportsPage           from './pages/ReportsPage.jsx';

// Customer portal pages (separate layout)
import PortalQuotationsPage  from './pages/portal/PortalQuotationsPage.jsx';
import PortalNegotiationPage from './pages/portal/PortalNegotiationPage.jsx';

// Route guards
function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function InternalRoute({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role === 'CUSTOMER') return <Navigate to="/portal" replace />;
  return children;
}

function CustomerRoute({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'CUSTOMER') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"           element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* Customer Portal */}
      <Route
        path="/portal"
        element={
          <CustomerRoute>
            <PortalLayout />
          </CustomerRoute>
        }
      >
        <Route index      element={<PortalQuotationsPage />} />
        <Route path=":id" element={<PortalNegotiationPage />} />
      </Route>

      {/* Internal workspace */}
      <Route
        path="/"
        element={
          <InternalRoute>
            <AppLayout />
          </InternalRoute>
        }
      >
        <Route index element={<DashboardPage />} />

        {/* Quotations */}
        <Route path="quotations"     element={<QuotationsListPage />} />
        <Route path="quotations/new" element={<QuotationDetailPage />} />
        <Route path="quotations/:id" element={<QuotationDetailPage />} />

        {/* Approvals */}
        <Route path="approvals"     element={<ApprovalsListPage />} />
        <Route path="approvals/:id" element={<ApprovalDetailPage />} />

        {/* Fulfillment */}
        <Route path="fulfillment"          element={<FulfillmentListPage />} />
        <Route path="fulfillment/:orderId" element={<FulfillmentDetailPage />} />

        {/* Subscriptions */}
        <Route path="subscriptions"     element={<SubscriptionsListPage />} />
        <Route path="subscriptions/:id" element={<BillingDetailPage />} />

        {/* Invoices */}
        <Route path="invoices"     element={<InvoicesListPage />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />

        {/* Deal Health */}
        <Route path="deal-health" element={<DealHealthPage />} />

        {/* Reports */}
        <Route path="reports" element={<ReportsPage />} />

        {/* Products - static routes BEFORE :id wildcard */}
        <Route path="products"         element={<ProductDashboardPage />} />
        <Route path="products/new"     element={<ProductDetailPage />} />
        <Route path="products/pricing" element={<ProductDashboardPage />} />
        <Route path="products/:id"     element={<ProductDetailPage />} />

        {/* Discount config */}
        <Route path="discount-config" element={<DiscountConfigPage />} />

        {/* 404 */}
        <Route path="*" element={
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Page not found.
          </div>
        } />
      </Route>
    </Routes>
  );
}
