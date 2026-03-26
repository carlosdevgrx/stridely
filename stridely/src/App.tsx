import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import AuthCallback from './pages/AuthCallback'
import ActivityDetailPage from './pages/ActivityDetail'
import TrainingPlanPage from './pages/TrainingPlanPage'
import SessionDetailPage from './pages/SessionDetailPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
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
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
