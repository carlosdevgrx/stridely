import React, { useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Unlink, ChevronRight, MapPin, Footprints, Trophy, BarChart2, Activity } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import AppSidebar from '../components/common/AppSidebar';
import './ProfilePage.scss';

const ProfilePage: React.FC = () => {
  const { signOut, user } = useAuthContext();
  const navigate = useNavigate();
  const { isConnected, disconnectStrava, athleteData, activities, fetchActivities, loading } = useStrava();
  const didFetch = useRef(false);

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const initials    = displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatarUrl   = (athleteData?.profile_medium ?? athleteData?.profile ?? null) as string | null;
  const city        = athleteData?.city as string | null;
  const country     = athleteData?.country as string | null;
  const location    = [city, country].filter(Boolean).join(', ');

  useEffect(() => {
    if (isConnected && !didFetch.current) {
      didFetch.current = true;
      fetchActivities().catch(() => {});
    }
  }, [isConnected, fetchActivities]);

  const highlights = useMemo(() => {
    if (!activities.length) return null;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const totalKm = activities.reduce((s, a) => s + a.distance / 1000, 0);
    const weekKm  = activities
      .filter(a => new Date(a.date) >= startOfWeek)
      .reduce((s, a) => s + a.distance / 1000, 0);
    const longest = Math.max(...activities.map(a => a.distance / 1000));
    return { totalKm, weekKm, longest, count: activities.length };
  }, [activities]);

  const handleDisconnectStrava = async () => {
    await disconnectStrava();
    navigate('/dashboard');
  };

  const fmt = (n: number) => n % 1 === 0 ? n.toString() : n.toFixed(1);

  return (
    <div className="prf">
      <AppSidebar />
      <div className="prf__page">
        <div className="prf__main">
          <h1 className="prf__title">Perfil</h1>

          {/* ── 2-column grid ── */}
          <div className="prf__grid">

            {/* Left: Hero */}
            <div className="prf__hero">
              <div className="prf__hero-avatar">
                {avatarUrl
                  ? <img src={avatarUrl} alt={displayName} className="prf__hero-avatar-img" />
                  : <span className="prf__hero-avatar-initials">{initials}</span>
                }
              </div>
              <h2 className="prf__hero-name">{displayName}</h2>
              {location && (
                <p className="prf__hero-location">
                  <MapPin size={13} strokeWidth={2} />
                  {location}
                </p>
              )}
            </div>

            {/* Right: highlights + account */}
            <div className="prf__right">

          {/* ── Running Highlights ── */}
          {isConnected && (
            <button className="prf__highlights" onClick={() => navigate('/stats')}>
              <div className="prf__highlights-head">
                <span className="prf__highlights-title">Running Highlights</span>
                <span className="prf__highlights-link">
                  Ver estadísticas <ChevronRight size={14} strokeWidth={2} />
                </span>
              </div>

              {/* 2 featured stats */}
              <div className="prf__hstats">
                <div className="prf__hstat prf__hstat--purple">
                  <div className="prf__hstat-icon">
                    <Footprints size={22} strokeWidth={1.8} />
                  </div>
                  <div className="prf__hstat-value">
                    {loading || !highlights ? '—' : fmt(highlights.weekKm)}
                    {highlights && <span className="prf__hstat-unit">km</span>}
                  </div>
                  <div className="prf__hstat-label">Kilometraje semanal</div>
                </div>
                <div className="prf__hstat prf__hstat--gold">
                  <div className="prf__hstat-icon">
                    <Trophy size={22} strokeWidth={1.8} />
                  </div>
                  <div className="prf__hstat-value">
                    {loading || !highlights ? '—' : fmt(highlights.longest)}
                    {highlights && <span className="prf__hstat-unit">km</span>}
                  </div>
                  <div className="prf__hstat-label">Carrera más larga</div>
                </div>
              </div>

              {/* Secondary stats row */}
              <div className="prf__highlights-secondary">
                <div className="prf__mini-stat">
                  <div className="prf__mini-stat-icon prf__mini-stat-icon--blue"><BarChart2 size={15} strokeWidth={2} /></div>
                  <span className="prf__mini-stat-label">Total acumulado</span>
                  <span className="prf__mini-stat-value">{loading || !highlights ? '—' : `${Math.round(highlights.totalKm)} km`}</span>
                </div>
                <div className="prf__mini-stat">
                  <div className="prf__mini-stat-icon prf__mini-stat-icon--green"><Activity size={15} strokeWidth={2} /></div>
                  <span className="prf__mini-stat-label">Actividades</span>
                  <span className="prf__mini-stat-value">{loading || !highlights ? '—' : highlights.count}</span>
                </div>
              </div>
            </button>
          )}

          {/* ── Account ── */}
          <div className="prf__card">
            <h3 className="prf__card-title">Cuenta</h3>
            <div className="prf__actions">
              {isConnected && (
                <button className="prf__action prf__action--danger" onClick={handleDisconnectStrava}>
                  <Unlink size={18} />
                  <span>Desconectar Strava</span>
                </button>
              )}
              <button className="prf__action prf__action--signout" onClick={signOut}>
                <LogOut size={18} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>

            </div>{/* end prf__right */}
          </div>{/* end prf__grid */}

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
