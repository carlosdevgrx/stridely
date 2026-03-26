import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrava } from '../hooks/useStrava';
import { formatDistance, formatDuration, formatPace, formatDate } from '../utils/formatters';
import type { Workout } from '../types';
import AppSidebar from '../components/common/AppSidebar';
import './ActivitiesPage.scss';

const TYPE_LABEL: Record<string, string> = { run: 'Carrera', trail: 'Trail', race: 'Race' };
const TYPE_ICON:  Record<string, string> = { run: '🏃', trail: '🏔️', race: '🏅' };

const ActivitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const { activities, loading, error, fetchActivities, isConnected } = useStrava();

  useEffect(() => {
    if (isConnected) fetchActivities().catch(() => {});
  }, [isConnected, fetchActivities]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="acp__loading">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="acp__skeleton" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="acp__error">
          <p>Error al cargar actividades: {error}</p>
          <button className="acp__retry" onClick={() => fetchActivities()}>Reintentar</button>
        </div>
      );
    }

    if (activities.length === 0) {
      return (
        <div className="acp__empty">
          <span className="acp__empty-icon">🏃</span>
          <p className="acp__empty-title">Sin actividades</p>
          <p className="acp__empty-sub">Conecta Strava y sal a correr para ver tus carreras aquí</p>
        </div>
      );
    }

    return (
      <div className="acp__grid">
        {activities.map((activity: Workout) => (
          <div
            key={activity.id}
            className="acp__card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/activity/${activity.id}`)}
            onKeyDown={e => e.key === 'Enter' && navigate(`/activity/${activity.id}`)}
          >
            <div className="acp__card-header">
              <h3 className="acp__card-name">{activity.name}</h3>
              <span className="acp__card-type">
                {TYPE_ICON[activity.type] ?? '🏃'} {TYPE_LABEL[activity.type] ?? activity.type}
              </span>
            </div>
            <p className="acp__card-date">{formatDate(activity.date)}</p>
            <div className="acp__card-stats">
              <div className="acp__card-stat">
                <span className="acp__card-stat-label">Distancia</span>
                <span className="acp__card-stat-value">{formatDistance(activity.distance)}</span>
              </div>
              <div className="acp__card-stat">
                <span className="acp__card-stat-label">Tiempo</span>
                <span className="acp__card-stat-value">{formatDuration(activity.duration)}</span>
              </div>
              <div className="acp__card-stat">
                <span className="acp__card-stat-label">Ritmo</span>
                <span className="acp__card-stat-value">{formatPace(activity.pace)}</span>
              </div>
              {activity.elevation > 0 && (
                <div className="acp__card-stat">
                  <span className="acp__card-stat-label">Desnivel</span>
                  <span className="acp__card-stat-value">{Math.round(activity.elevation)} m</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="acp">
      <AppSidebar />
      <div className="acp__page">
        <div className="acp__main">
          <div className="acp__heading">
            <div>
              <h1 className="acp__title">Actividades</h1>
              <p className="acp__sub">
                {loading ? 'Cargando...' : `${activities.length} carreras`}
              </p>
            </div>
          </div>

          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ActivitiesPage;
