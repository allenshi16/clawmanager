import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

// Auth Pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

// Dashboard Pages
import UserDashboard from '../pages/dashboard/UserDashboard';
import AdminDashboard from '../pages/admin/AdminDashboard';

// Admin Pages
import UserManagementPage from '../pages/admin/UserManagementPage';
import InstanceManagementPage from '../pages/admin/InstanceManagementPage';
import AIGatewayPage from '../pages/admin/AIGatewayPage';
import AIAuditPage from '../pages/admin/AIAuditPage';
import CostsPage from '../pages/admin/CostsPage';
import AdminSecurityDashboardPage from '../pages/admin/security/AdminSecurityDashboardPage';
import AdminSecurityReportsPage from '../pages/admin/security/AdminSecurityReportsPage';
import AdminSecurityScannerConfigPage from '../pages/admin/security/AdminSecurityScannerConfigPage';
import RiskRulesPage from '../pages/admin/RiskRulesPage';
import ModelManagementPage from '../pages/admin/ModelManagementPage';
import SystemSettingsPage from '../pages/admin/SystemSettingsPage';
import RuntimePodsPage from '../pages/admin/RuntimePodsPage';
import UserSettingsPage from '../pages/settings/UserSettingsPage';
import OpenClawConfigCenterPage from '../pages/openclaw/OpenClawConfigCenterPage';

// Instance Pages
import InstanceListPage from '../pages/instances/InstanceListPage';
import CreateInstancePage from '../pages/instances/CreateInstancePage';
import InstanceDetailPage from '../pages/instances/InstanceDetailPage';
import InstancePortalPage from '../pages/instances/InstancePortalPage';
import TeamListPage from '../pages/teams/TeamListPage';
import CreateTeamPage from '../pages/teams/CreateTeamPage';
import TeamDetailPage from '../pages/teams/TeamDetailPage';
import LandingPage from '../pages/landing/LandingPage';
import AgentMarketplacePage from '../pages/marketplace/AgentMarketplacePage';
import AgentDetailPage from '../pages/marketplace/AgentDetailPage';
import QuickCreatePage from '../pages/marketplace/QuickCreatePage';
import ForkPage from '../pages/marketplace/ForkPage';
import InstanceChatPage from '../pages/instances/InstanceChatPage';
import ChannelsPage from '../pages/settings/ChannelsPage';
import BillingPage from '../pages/billing/BillingPage';
import AgentVariantManagementPage from '../pages/admin/AgentVariantManagementPage';
import VariantVersionHistoryPage from '../pages/admin/VariantVersionHistoryPage';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t('common.loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Admin Route Component
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t('common.loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirects to dashboard if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t('common.loading')}</div>
      </div>
    );
  }

  if (isAuthenticated) {
    // Redirect admin to admin dashboard, users to user dashboard
    if (user?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* User Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <UserDashboard />
          </ProtectedRoute>
        }
      />

      {/* Instance Routes */}
      <Route
        path="/instances"
        element={
          <ProtectedRoute>
            <InstanceListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instances/new"
        element={
          <ProtectedRoute>
            <CreateInstancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instances/:id"
        element={
          <ProtectedRoute>
            <InstanceDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal"
        element={
          <ProtectedRoute>
            <InstancePortalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams"
        element={
          <ProtectedRoute>
            <TeamListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/new"
        element={
          <ProtectedRoute>
            <CreateTeamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams/:id"
        element={
          <ProtectedRoute>
            <TeamDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/openclaw-configs"
        element={
          <ProtectedRoute>
            <OpenClawConfigCenterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <UserSettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <UserManagementPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/instances"
        element={
          <AdminRoute>
            <InstanceManagementPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/runtime-pods"
        element={
          <AdminRoute>
            <RuntimePodsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/security"
        element={
          <AdminRoute>
            <AdminSecurityDashboardPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/security/reports"
        element={
          <AdminRoute>
            <AdminSecurityReportsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/security/scanner"
        element={
          <AdminRoute>
            <AdminSecurityScannerConfigPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/assets"
        element={<Navigate to="/admin/security" replace />}
      />
      <Route
        path="/admin/skills"
        element={<Navigate to="/admin/security" replace />}
      />
      <Route
        path="/admin/ai-gateway"
        element={
          <AdminRoute>
            <AIGatewayPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/ai-audit"
        element={
          <AdminRoute>
            <AIAuditPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/costs"
        element={
          <AdminRoute>
            <CostsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/risk-rules"
        element={
          <AdminRoute>
            <RiskRulesPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/models"
        element={
          <AdminRoute>
            <ModelManagementPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AdminRoute>
            <SystemSettingsPage />
          </AdminRoute>
        }
      />

      <Route path="/" element={<LandingPage />} />
      <Route
        path="/marketplace"
        element={<ProtectedRoute><AgentMarketplacePage /></ProtectedRoute>}
      />
      <Route
        path="/marketplace/:slug"
        element={<ProtectedRoute><AgentDetailPage /></ProtectedRoute>}
      />
      <Route
        path="/marketplace/:slug/quick-create"
        element={<ProtectedRoute><QuickCreatePage /></ProtectedRoute>}
      />
      <Route
        path="/marketplace/:slug/fork"
        element={<ProtectedRoute><ForkPage /></ProtectedRoute>}
      />
      <Route
        path="/instances/:id/chat"
        element={<ProtectedRoute><InstanceChatPage /></ProtectedRoute>}
      />
      <Route
        path="/settings/channels"
        element={<ProtectedRoute><ChannelsPage /></ProtectedRoute>}
      />
      <Route
        path="/billing"
        element={<ProtectedRoute><BillingPage /></ProtectedRoute>}
      />
      <Route
        path="/admin/agent-variants"
        element={<AdminRoute><AgentVariantManagementPage /></AdminRoute>}
      />
      <Route
        path="/admin/agent-variants/:id/versions"
        element={<AdminRoute><VariantVersionHistoryPage /></AdminRoute>}
      />
      <Route
        path="/admin/billing"
        element={<AdminRoute><BillingPage /></AdminRoute>}
      />
    </Routes>
  );
}

function Router() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default Router;
