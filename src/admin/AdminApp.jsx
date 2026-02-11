import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AdminLayout from './AdminLayout'

// Pages
import AdminDashboard from './pages/AdminDashboard'
import OrdersManagement from './pages/OrdersManagement'
import UsersManagement from './pages/UsersManagement'
import AbandonedCarts from './pages/AbandonedCarts'
import RecoveryTemplates from './pages/RecoveryTemplates'
import WebhookSettings from './pages/WebhookSettings'
import AppSettings from './pages/AppSettings'
import Documentation from './pages/Documentation'
import CleanupDuplicates from './pages/CleanupDuplicates'

// Admin Protected Route
function AdminProtectedRoute({ children, adminOnly = false }) {
    const { user, canAccessAdmin, isAdmin, loading, roleLoading } = useAuth()

    if (loading || roleLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (!canAccessAdmin) {
        return <Navigate to="/" replace />
    }

    if (adminOnly && !isAdmin) {
        return <Navigate to="/admin" replace />
    }

    return children
}

export default function AdminApp() {
    return (
        <AdminProtectedRoute>
            <Routes>
                <Route element={<AdminLayout />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="orders" element={<OrdersManagement />} />
                    <Route path="users" element={<UsersManagement />} />
                    <Route path="abandoned-carts" element={<AbandonedCarts />} />
                    <Route path="documentation" element={<Documentation />} />
                    <Route
                        path="cleanup"
                        element={
                            <AdminProtectedRoute adminOnly>
                                <CleanupDuplicates />
                            </AdminProtectedRoute>
                        }
                    />
                    <Route
                        path="templates"
                        element={
                            <AdminProtectedRoute adminOnly>
                                <RecoveryTemplates />
                            </AdminProtectedRoute>
                        }
                    />
                    <Route
                        path="webhooks"
                        element={
                            <AdminProtectedRoute adminOnly>
                                <WebhookSettings />
                            </AdminProtectedRoute>
                        }
                    />
                    <Route
                        path="settings"
                        element={
                            <AdminProtectedRoute adminOnly>
                                <AppSettings />
                            </AdminProtectedRoute>
                        }
                    />
                </Route>
            </Routes>
        </AdminProtectedRoute>
    )
}
