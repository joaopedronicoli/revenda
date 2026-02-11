import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Register from './pages/Register'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import PendingApproval from './pages/PendingApproval'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import OrderReview from './pages/OrderReview'
import Confirmation from './pages/Confirmation'
import Layout from './components/Layout'
import AdminApp from './admin/AdminApp'

const ProtectedRoute = ({ children, allowPending = false }) => {
  const { user, loading, approvalStatus, roleLoading, canAccessAdmin } = useAuth()

  if (loading || roleLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>

  if (!user) return <Navigate to="/login" />

  // Allow admins to bypass approval check
  if (canAccessAdmin) return children

  // Block non-approved users unless explicitly allowed
  if (!allowPending && approvalStatus !== 'approved') {
    return <Navigate to="/pending-approval" />
  }

  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/pending-approval" element={
              <ProtectedRoute allowPending={true}>
                <PendingApproval />
              </ProtectedRoute>
            } />

            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />

            <Route path="/order-review" element={
              <ProtectedRoute>
                <Layout>
                  <OrderReview />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/confirmation" element={
              <ProtectedRoute>
                <Layout>
                  <Confirmation />
                </Layout>
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin/*" element={<AdminApp />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
