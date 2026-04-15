import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { StravaProvider } from './context/StravaContext'
import { CoachChatProvider } from './context/CoachChatContext'
import CoachChatPanel from './components/features/coach/CoachChatPanel'
import ProtectedRoute, { StravaRoute } from './components/common/ProtectedRoute'
import { useAuthContext } from './context/AuthContext'
import { LoadingSpinner } from './components/common/LoadingSpinner'

const Login            = lazy(() => import('./pages/Login'))
const Register         = lazy(() => import('./pages/Register'))
const Dashboard        = lazy(() => import('./pages/Dashboard'))
const AuthCallback     = lazy(() => import('./pages/AuthCallback'))
const ActivityDetailPage = lazy(() => import('./pages/ActivityDetail'))
const TrainingPlanPage = lazy(() => import('./pages/TrainingPlanPage'))
const ActivitiesPage   = lazy(() => import('./pages/ActivitiesPage'))
const SessionDetailPage = lazy(() => import('./pages/SessionDetailPage'))
const ProfilePage      = lazy(() => import('./pages/ProfilePage'))
const StatsPage        = lazy(() => import('./pages/StatsPage'))
const PrivacyPage      = lazy(() => import('./pages/PrivacyPage'))

const PageSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <LoadingSpinner message="Cargando..." />
  </div>
)

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
        <StravaProvider>
        <CoachChatProvider>
        <div className="app">
          <CoachChatPanel />
          <Suspense fallback={<PageSpinner />}>
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
              <StravaRoute>
                <ActivityDetailPage />
              </StravaRoute>
            } />
            <Route path="/training-plan" element={
              <StravaRoute>
                <TrainingPlanPage />
              </StravaRoute>
            } />
            <Route path="/activities" element={
              <StravaRoute>
                <ActivitiesPage />
              </StravaRoute>
            } />
            <Route path="/training-plan/session/:planId/:week/:day" element={
              <StravaRoute>
                <SessionDetailPage />
              </StravaRoute>
            } />
            <Route path="/auth/callback" element={
              <ProtectedRoute>
                <AuthCallback />
              </ProtectedRoute>
            } />
            <Route path="/stats" element={
              <StravaRoute>
                <StatsPage />
              </StravaRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Routes>
          </Suspense>
        </div>
        </CoachChatProvider>
        </StravaProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
