// Página Dashboard - Muestra actividades

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrava } from '../hooks/useStrava';
import type { Workout } from '../types';
import { formatDistance, formatDuration, formatPace, formatDate } from '../utils/formatters';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { activities, loading, error, fetchActivities, isAuthenticated } = useStrava();
  const [localActivities, setLocalActivities] = useState<Workout[]>([]);

  // Verificar autenticación
  useEffect(() => {
    const token = localStorage.getItem('strava_token');
    if (!token) {
      navigate('/');
    }
  }, [navigate]);

  // Cargar actividades
  useEffect(() => {
    if (isAuthenticated) {
      console.log('Dashboard: Cargando actividades...');
      fetchActivities().catch((err) => {
        console.error('Error fetching activities in Dashboard:', err);
      });
    }
  }, [isAuthenticated, fetchActivities]);

  useEffect(() => {
    setLocalActivities(activities);
  }, [activities]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Cargando tus actividades...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Error al cargar actividades</h2>
        <p>{error}</p>
        <button onClick={() => fetchActivities()} className="btn-retry">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Mis Entrenamientos</h1>
        <p>{localActivities.length} actividades encontradas</p>
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
