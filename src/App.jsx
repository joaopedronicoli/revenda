import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { initTracking } from './utils/tracking'
import Register from './pages/Register'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import PendingVerification from './pages/PendingVerification'
import PendingApproval from './pages/PendingApproval'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import OrderReview from './pages/OrderReview'
import Confirmation from './pages/Confirmation'
import Referrals from './pages/Referrals'
import Rankings from './pages/Rankings'
import ResellerDashboard from './pages/ResellerDashboard'
import IndicacaoRegister from './pages/IndicacaoRegister'
import IndicacaoDashboard from './pages/IndicacaoDashboard'
import Layout from './components/Layout'
import CompleteProfile from './pages/CompleteProfile'
import AdminApp from './admin/AdminApp'
import Maintenance from './pages/Maintenance'

const ProtectedRoute = ({ children, allowPending = false, allowUnverified = false, allowIncomplete = false }) => {
  const { user, loading, approvalStatus, roleLoading, canAccessAdmin, isEmailVerified, isProfileComplete, maintenanceMode } = useAuth()
  const location = useLocation()

  if (loading || roleLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>

  if (!user) return <Navigate to="/login" />

  // Allow admins to bypass all checks
  if (canAccessAdmin) return children

  // Maintenance mode — block non-admin users
  if (maintenanceMode) return <Navigate to="/maintenance" />

  // Check profile completeness (document_type must exist)
  if (!allowIncomplete && !isProfileComplete) {
    return <Navigate to={`/complete-profile?returnTo=${encodeURIComponent(location.pathname)}`} />
  }

  // Check email verification
  if (!allowUnverified && !isEmailVerified) {
    return <Navigate to="/pending-verification" />
  }

  // Block non-approved users unless explicitly allowed
  if (!allowPending && approvalStatus !== 'approved') {
    return <Navigate to="/pending-approval" />
  }

  return children
}

export default function App() {
  useEffect(() => { initTracking() }, [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/maintenance" element={<Maintenance />} />

            <Route path="/complete-profile" element={
              <ProtectedRoute allowPending={true} allowUnverified={true} allowIncomplete={true}>
                <CompleteProfile />
              </ProtectedRoute>
            } />

            <Route path="/pending-verification" element={
              <ProtectedRoute allowPending={true} allowUnverified={true}>
                <PendingVerification />
              </ProtectedRoute>
            } />

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

            <Route path="/referrals" element={
              <ProtectedRoute>
                <Layout>
                  <Referrals />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/rankings" element={
              <ProtectedRoute>
                <Layout>
                  <Rankings />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/my-dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <ResellerDashboard />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/indicacao/register" element={
              <ProtectedRoute>
                <Layout>
                  <IndicacaoRegister />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/indicacao/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <IndicacaoDashboard />
                </Layout>
              </ProtectedRoute>
            } />

            {/* Cart redirect (cart is shown on Dashboard) */}
            <Route path="/cart" element={<Navigate to="/" replace />} />

            {/* Admin Routes */}
            <Route path="/admin/*" element={<AdminApp />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
