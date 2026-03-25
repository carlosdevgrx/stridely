// Página Dashboard - Muestra actividades

import React, { useEffect, useState } from 'react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import { StravaLogin } from '../components/features/strava/StravaLogin';
import type { Workout } from '../types';
import { formatDistance, formatDuration, formatPace, formatDate } from '../utils/formatters';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { signOut, user } = useAuthContext();
  const { activities, loading, error, fetchActivities, isConnected, disconnectStrava } = useStrava();
  const [localActivities, setLocalActivities] = useState<Workout[]>([]);

  // Cargar actividades cuando Strava está conectado
  useEffect(() => {
    if (isConnected) {
      fetchActivities().catch(() => {});
    }
  }, [isConnected, fetchActivities]);

  useEffect(() => {
    setLocalActivities(activities);
  }, [activities]);

  // Cabecera común
  const Header = () => (
    <div className="dashboard-header">
      <h1>🏃 Stridely</h1>
      <div className="dashboard-user">
        <span>{user?.email}</span>
        <button onClick={signOut} className="btn-logout">Cerrar sesión</button>
      </div>
    </div>
  );

  // Si Strava no está conectado, mostrar pantalla de conexión
  if (!isConnected) {
    return (
      <div className="dashboard">
        <Header />
        <div className="strava-connect-section">
          <h2>Conecta tu cuenta de Strava</h2>
          <p>Para ver tus actividades y obtener análisis personalizados, conecta tu cuenta de Strava.</p>
          <StravaLogin />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard">
        <Header />
        <div className="dashboard-loading">
          <div className="spinner"></div>
          <p>Cargando tus actividades...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <Header />
        <div className="dashboard-error">
          <h2>Error al cargar actividades</h2>
          <p>{error}</p>
          <button onClick={() => fetchActivities()} className="btn-retry">Reintentar</button>
          <button onClick={disconnectStrava} className="btn-disconnect">Desconectar Strava</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Header />

      <div className="dashboard-content-header">
        <p>{localActivities.length} actividades encontradas</p>
        <button onClick={disconnectStrava} className="btn-disconnect">Desconectar Strava</button>
      </div>

      <div className="activities-grid">
        {localActivities.length === 0 ? (
          <p className="no-activities">No hay actividades cargadas</p>
        ) : (
          localActivities.map((activity) => (
            <div key={activity.id} className="activity-card">
              <div className="activity-header">
                <h3>{activity.name}</h3>
                <span className="activity-type">{activity.type}</span>
              </div>

              <div className="activity-date">
                {formatDate(activity.date)}
              </div>

              <div className="activity-stats">
                <div className="stat">
                  <label>Distancia</label>
                  <span>{formatDistance(activity.distance)}</span>
                </div>
                <div className="stat">
                  <label>Tiempo</label>
                  <span>{formatDuration(activity.duration)}</span>
                </div>
                <div className="stat">
                  <label>Ritmo</label>
                  <span>{formatPace(activity.pace)}</span>
                </div>
                {activity.elevation > 0 && (
                  <div className="stat">
                    <label>Elevación</label>
                    <span>{Math.round(activity.elevation)} m</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;
