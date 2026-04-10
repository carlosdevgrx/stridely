import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { useStrava } from '../../hooks/useStrava';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { session, loading } = useAuthContext();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/** Redirige a /dashboard si Strava no está conectado */
export const StravaRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { session, loading: authLoading } = useAuthContext();
  const { isConnected, initializing } = useStrava();

  if (authLoading || initializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!isConnected) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
