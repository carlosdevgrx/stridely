// Componente de Login con Strava OAuth

import React from 'react';
import './StravaLogin.css';

interface StravaLoginProps {
  onSuccess?: () => void;
}

export const StravaLogin: React.FC<StravaLoginProps> = ({ onSuccess: _onSuccess }) => {
  const handleLogin = () => {
    const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = 'activity:read_all';
    
    const stravaOAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
    
    // Redirigir a Strava para autenticación
    window.location.href = stravaOAuthUrl;
  };

  return (
    <div className="strava-login">
      <button 
        className="strava-btn"
        onClick={handleLogin}
      >
        Conectar con Strava
      </button>
      <p className="strava-login-subtitle">
        Autoriza Stridely para acceder a tus datos de entrenamiento
      </p>
    </div>
  );
};
