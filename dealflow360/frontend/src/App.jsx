import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/authContext.jsx';

// Layout
import AppLayout from './components/AppLayout.jsx';

// Auth pages (no layout)
import LoginPage          from './pages/LoginPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';

// Internal pages (wrapped in AppLayout)
import DashboardPage        from './pages/DashboardPage.jsx';
import ProductDashboardPage from './pages/ProductDashboardPage.jsx';
import ProductDetailPage    from './pages/ProductDetailPage.jsx';
import DiscountConfigPage   from './pages/DiscountConfigPage.jsx';

// ── Route guard ───────────────────────────────────────────────────────────────
function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"           element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* Private — wrapped in AppLayout */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index                             element={<DashboardPage />} />

        {/* Product — Screen 16 + 17 */}
        {/* NOTE: static "products/new" and "products/pricing" MUST come before the :id wildcard */}
        <Route path="products"                   element={<ProductDashboardPage />} />
        <Route path="products/new"               element={<ProductDetailPage />} />
        <Route path="products/pricing"           element={<ProductDashboardPage />} />
        <Route path="products/:id"               element={<ProductDetailPage />} />

        {/* Discount Tiers & Approval Chains — Screen 18 */}
        <Route path="discount-config"            element={<DiscountConfigPage />} />

        {/* Fallback for unbuilt pages — keeps nav working */}
        <Route path="*" element={
          <div className="py-16 text-center text-gray-400">
            This module will be built in a future phase.
          </div>
        } />
      </Route>
    </Routes>
  );
}
