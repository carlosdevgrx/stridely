import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Route, AlarmClock, Gauge } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import polylineDecoder from '@mapbox/polyline';
import { stravaClient } from '../services/strava/client';
import { supabase } from '../services/supabase/client';
import type { ActivityDetail } from '../types';
import { formatDistance, formatDuration, formatPace, formatDate } from '../utils/formatters';
import AppSidebar from '../components/common/AppSidebar';
import 'leaflet/dist/leaflet.css';
import './ActivityDetail.scss';

const TYPE_LABEL: Record<string, string> = { run: 'Carrera', trail: 'Trail', race: 'Race' };
const TYPE_ICON: Record<string, string>  = { run: '🏃', trail: '🏔️', race: '🏅' };

// Ajusta el mapa al polyline automáticamente
function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 1) {
      map.fitBounds(coords, { padding: [24, 24] });
    }
  }, [map, coords]);
  return null;
}

interface StravaDetailRaw {
  id: number;
  name?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  start_date?: string;
  sport_type?: string;
  total_elevation_gain?: number;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  calories?: number;
  map?: { polyline?: string; summary_polyline?: string };
  splits_metric?: SplitMetric[];
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  description?: string | null;
  trainer?: boolean;
  commute?: boolean;
  elev_high?: number;
  elev_low?: number;
}

function mapRawToDetail(raw: StravaDetailRaw): ActivityDetail {
  const distance = raw.distance ?? 0;
  const movingTime = raw.moving_time ?? 0;
  return {
    id:           String(raw.id),
    name:         raw.name ?? '',
    distance,
    duration:     movingTime,
    elapsedTime:  raw.elapsed_time ?? 0,
    pace:         distance > 0 ? movingTime / (distance / 1000) : 0,
    date:         new Date(raw.start_date),
    type:         raw.sport_type === 'Run' ? 'run' : 'trail',
    elevation:    raw.total_elevation_gain ?? 0,
    avgSpeed:     (raw.average_speed ?? 0) * 3.6,
    maxSpeed:     (raw.max_speed ?? 0) * 3.6,
    avgHeartRate: raw.average_heartrate ?? null,
    maxHeartRate: raw.max_heartrate ?? null,
    avgCadence:   raw.average_cadence ? Math.round(raw.average_cadence * 2) : null,
    calories:     raw.calories ?? null,
    polyline:     raw.map?.polyline ?? raw.map?.summary_polyline ?? null,
    splitsMetric: raw.splits_metric ?? [],
    startLat:     raw.start_latlng?.[0] ?? null,
    startLng:     raw.start_latlng?.[1] ?? null,
  };
}

const ActivityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Sin sesión');

        const { data: conn } = await supabase
          .from('strava_connections')
          .select('access_token')
          .eq('user_id', user.id)
          .single();

        if (!conn?.access_token) throw new Error('Strava no conectado');

        stravaClient.setAccessToken(conn.access_token);
        const raw = await stravaClient.getActivityById(id);
        setDetail(mapRawToDetail(raw));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar la actividad');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const routeCoords: [number, number][] =
    detail?.polyline ? polylineDecoder.decode(detail.polyline) : [];

  const mapCenter: [number, number] =
    routeCoords.length > 0 ? routeCoords[Math.floor(routeCoords.length / 2)] : [40.416, -3.703];

  if (loading) {
    return (
      <div className="detail">
        <AppSidebar />
        <div className="detail__page">
          <div className="detail__loading">
            <div className="detail__spinner" />
            <p>Cargando actividad...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="detail">
        <AppSidebar />
        <div className="detail__page">
          <div className="detail__error">
            <p>{error ?? 'Actividad no encontrada'}</p>
            <button onClick={() => navigate('/dashboard')} className="detail__back-btn">
              <ArrowLeft size={16} strokeWidth={2.5} />
              Volver al dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="detail">
      <AppSidebar />
      <div className="detail__page">
        <div className="detail__main">
        <div className="detail__body">
        {/* Nav bar */}
        <div className="detail__nav">
          <button className="detail__nav-back" onClick={() => navigate(-1)} aria-label="Volver">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="detail__nav-center">
            <h1 className="detail__nav-title">{detail.name}</h1>
            <p className="detail__nav-sub">
              {TYPE_ICON[detail.type] ?? '🏃'} {TYPE_LABEL[detail.type] ?? detail.type} · {formatDate(detail.date)}
            </p>
          </div>
          <div className="detail__nav-spacer" />
        </div>

        {/* Mapa — full-bleed en móvil, con tema claro y línea corporativa */}
        {routeCoords.length > 0 && (
          <div className="detail__map-wrap">
            <MapContainer
              center={mapCenter}
              zoom={13}
              className="detail__map"
              scrollWheelZoom={false}
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              />
              <Polyline
                positions={routeCoords}
                pathOptions={{ color: '#A78BFA', weight: 5, opacity: 1 }}
              />
              <FitBounds coords={routeCoords} />
            </MapContainer>
          </div>
        )}

        {/* Primary KPI stat cards */}
        <div className="detail__kpis">
          <div className="detail__kpi detail__kpi--dist">
            <div className="detail__kpi-icon"><Route size={22} strokeWidth={1.75} /></div>
            <span className="detail__kpi-label">Distancia</span>
            <span className="detail__kpi-value">{formatDistance(detail.distance)}</span>
          </div>
          <div className="detail__kpi detail__kpi--time">
            <div className="detail__kpi-icon"><AlarmClock size={22} strokeWidth={1.75} /></div>
            <span className="detail__kpi-label">Tiempo</span>
            <span className="detail__kpi-value">{formatDuration(detail.duration)}</span>
          </div>
          <div className="detail__kpi detail__kpi--pace">
            <div className="detail__kpi-icon"><Gauge size={22} strokeWidth={1.75} /></div>
            <span className="detail__kpi-label">Ritmo</span>
            <span className="detail__kpi-value">{formatPace(detail.pace)}</span>
          </div>
        </div>

        {/* Stats secundarios */}
        <div className="detail__stats-grid">
          {detail.elevation > 0 && (
            <div className="detail__stat-card">
              <span className="detail__stat-icon">⛰️</span>
              <span className="detail__stat-value">{Math.round(detail.elevation)} m</span>
              <span className="detail__stat-label">Desnivel +</span>
            </div>
          )}
          {detail.avgHeartRate && (
            <div className="detail__stat-card">
              <span className="detail__stat-icon">❤️</span>
              <span className="detail__stat-value">{Math.round(detail.avgHeartRate)} bpm</span>
              <span className="detail__stat-label">FC media</span>
            </div>
          )}
          {detail.maxHeartRate && (
            <div className="detail__stat-card">
              <span className="detail__stat-icon">🔴</span>
              <span className="detail__stat-value">{Math.round(detail.maxHeartRate)} bpm</span>
              <span className="detail__stat-label">FC máxima</span>
            </div>
          )}
          {detail.avgCadence && (
            <div className="detail__stat-card">
              <span className="detail__stat-icon">🦵</span>
              <span className="detail__stat-value">{detail.avgCadence} spm</span>
              <span className="detail__stat-label">Cadencia</span>
            </div>
          )}
          {detail.calories && (
            <div className="detail__stat-card">
              <span className="detail__stat-icon">🔥</span>
              <span className="detail__stat-value">{detail.calories}</span>
              <span className="detail__stat-label">Calorías</span>
            </div>
          )}
          <div className="detail__stat-card">
            <span className="detail__stat-icon">⚡</span>
            <span className="detail__stat-value">{detail.avgSpeed.toFixed(1)} km/h</span>
            <span className="detail__stat-label">Vel. media</span>
          </div>
          <div className="detail__stat-card">
            <span className="detail__stat-icon">🚀</span>
            <span className="detail__stat-value">{detail.maxSpeed.toFixed(1)} km/h</span>
            <span className="detail__stat-label">Vel. máxima</span>
          </div>
          <div className="detail__stat-card">
            <span className="detail__stat-icon">⏱️</span>
            <span className="detail__stat-value">{formatDuration(detail.elapsedTime)}</span>
            <span className="detail__stat-label">Tiempo total</span>
          </div>
        </div>

        {/* Splits por km */}
        {detail.splitsMetric.length > 0 && (
          <div className="detail__splits">
            <h2 className="detail__splits-title">Splits por km</h2>
            <div className="detail__splits-table">
              <div className="detail__splits-head">
                <span>Km</span>
                <span>Distancia</span>
                <span>Tiempo</span>
                <span>Ritmo</span>
                {detail.splitsMetric[0].average_heartrate && <span>FC</span>}
              </div>
              {detail.splitsMetric.map((split) => {
                const pace = split.distance > 0
                  ? split.moving_time / (split.distance / 1000)
                  : 0;
                return (
                  <div key={split.split} className="detail__splits-row">
                    <span className="detail__splits-km">{split.split}</span>
                    <span>{(split.distance / 1000).toFixed(2)} km</span>
                    <span>{formatDuration(split.moving_time)}</span>
                    <span>{formatPace(pace)}</span>
                    {split.average_heartrate && (
                      <span>{Math.round(split.average_heartrate)} bpm</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
};

export default ActivityDetailPage;
