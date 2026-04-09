import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import { useAuthContext } from './context/AuthContext'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import AuthCallback from './pages/AuthCallback'
import ActivityDetailPage from './pages/ActivityDetail'
import TrainingPlanPage from './pages/TrainingPlanPage'
import ActivitiesPage from './pages/ActivitiesPage'
import SessionDetailPage from './pages/SessionDetailPage'
import ProfilePage from './pages/ProfilePage'
import StatsPage from './pages/StatsPage'
import PrivacyPage from './pages/PrivacyPage'

/** Redirige a /dashboard si ya hay sesión activa */
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuthContext();
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <LoadingSpinner message="Cargando..." />
    </div>
  );
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app">
          <Routes>
            <Route path="/" element={
              <GuestRoute>
                <Navigate to="/login" replace />
              </GuestRoute>
            } />
            <Route path="/login" element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            } />
            <Route path="/register" element={
              <GuestRoute>
                <Register />
              </GuestRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/activity/:id" element={
              <ProtectedRoute>
                <ActivityDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/training-plan" element={
              <ProtectedRoute>
                <TrainingPlanPage />
              </ProtectedRoute>
            } />
            <Route path="/activities" element={
              <ProtectedRoute>
                <ActivitiesPage />
              </ProtectedRoute>
            } />
            <Route path="/training-plan/session/:planId/:week/:day" element={
              <ProtectedRoute>
                <SessionDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/auth/callback" element={
              <ProtectedRoute>
                <AuthCallback />
              </ProtectedRoute>
            } />
            <Route path="/stats" element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
