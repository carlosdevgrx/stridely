/**
 * Home Page - Página principal
 */

import React from 'react';
import { useAuthContext } from '../context/AuthContext';
import { StravaLogin } from '../components/features/strava/StravaLogin';
import './Home.css';

const HomePage: React.FC = () => {
  const { user, isAuthenticated } = useAuthContext();

  return (
    <div className="home-page">
      <header className="home-header">
        <h1 className="home-title">🏃 Stridely</h1>
        <p className="home-subtitle">Tu entrenador personal de carreras con IA</p>
      </header>

      <main className="home-content">
        {isAuthenticated ? (
          <div className="authenticated">
            <div className="welcome-box">
              <h2>¡Bienvenido, {user?.name}!</h2>
              <p>Tus datos de entrenamiento están listos para analizar</p>
            </div>
            <div className="cta-buttons">
              <a href="/dashboard" className="btn btn-primary">
                Ver Mis Entrenamientos
              </a>
              <a href="/recommendations" className="btn btn-secondary">
                Obtener Recomendaciones
              </a>
            </div>
          </div>
        ) : (
          <div className="not-authenticated">
            <div className="feature-box">
              <h2>Conecta tu cuenta de Strava</h2>
              <p>Obtén análisis personalizados de tus entrenamientos y recomendaciones de IA para mejorar tu rendimiento</p>
              
              <StravaLogin />

              <div className="features">
                <div className="feature">
                  <h3>📊 Análisis de Datos</h3>
                  <p>Visualiza todos tus entrenamientos en un solo lugar</p>
                </div>
                <div className="feature">
                  <h3>🤖 Recomendaciones IA</h3>
                  <p>Obtén planes personalizados según tus datos</p>
                </div>
                <div className="feature">
                  <h3>🎯 Planes de Entrenamiento</h3>
                  <p>Prepara maratones, media maratones y más</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;
