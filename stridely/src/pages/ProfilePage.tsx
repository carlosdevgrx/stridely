import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Activity, LogOut, Unlink } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import './ProfilePage.scss';

const NAV_ITEMS = [
  { label: 'Dashboard',       path: '/dashboard',       icon: <LayoutDashboard size={18} strokeWidth={2} /> },
  { label: 'Plan de entreno', path: '/training-plan',   icon: <ClipboardList   size={18} strokeWidth={2} /> },
  { label: 'Actividades',     path: '/activities',      icon: <Activity        size={18} strokeWidth={2} /> },
];

const ProfilePage: React.FC = () => {
  const { signOut, user } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected, disconnectStrava, athleteData } = useStrava();

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const firstName   = displayName.split(' ')[0];
  const initials    = displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatarUrl   = (athleteData?.profile_medium ?? athleteData?.profile ?? null) as string | null;

  const handleDisconnectStrava = async () => {
    await disconnectStrava();
    navigate('/dashboard');
  };

  const Sidebar = () => (
    <aside className="prf__sidebar">
      <div className="prf__sidebar-brand">
        <span className="prf__sidebar-brand-icon">🏃</span>
        <span className="prf__sidebar-brand-name">Stridely</span>
      </div>

      <nav className="prf__nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`prf__nav-item${location.pathname === item.path ? ' prf__nav-item--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <button
        className="prf__sidebar-footer prf__sidebar-footer--active"
        onClick={() => navigate('/profile')}
      >
        <div className="prf__avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} />
            : <span className="prf__avatar-initials">{initials}</span>
          }
        </div>
        <div className="prf__sidebar-user">
          <strong>{firstName}</strong>
        </div>
      </button>
    </aside>
  );

  return (
    <div className="prf">
      <Sidebar />
      <div className="prf__page">
        <div className="prf__main">
          <h1 className="prf__title">Perfil</h1>

          <div className="prf__card prf__card--profile">
            <div className="prf__profile-avatar">
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} className="prf__profile-avatar-img" />
                : <span className="prf__profile-avatar-initials">{initials}</span>
              }
            </div>
            <div className="prf__profile-info">
              <h2 className="prf__profile-name">{displayName}</h2>
              <p className="prf__profile-email">{user?.email}</p>
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
