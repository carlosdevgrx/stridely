import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Activity, User, BarChart2, Zap, Flame, Trophy, Wind, Target, Mountain, Heart, Star } from 'lucide-react';
import stridelyLogo from '../../assets/stridely-logo.svg';
import { useStrava } from '../../hooks/useStrava';
import { useAuthContext } from '../../context/AuthContext';
import './AppSidebar.scss';

const MOTIVATIONAL = [
  { icon: Zap,      text: 'Cada kilómetro que corres es uno que no puedes quitarte.' },
  { icon: Flame,    text: 'No pares cuando estés cansado. Para cuando hayas terminado.' },
  { icon: Trophy,   text: 'El dolor de hoy es la fuerza de mañana.' },
  { icon: Wind,     text: 'Corre como si no hubiera meta. Vive como si no hubiera límite.' },
  { icon: Target,   text: 'Un pequeño progreso cada día suma grandes resultados.' },
  { icon: Mountain, text: 'Las montañas grandes se escalan con pasos pequeños.' },
  { icon: Heart,    text: 'Entrena duro, recupera bien, repite.' },
  { icon: Star,     text: 'Tu única competencia eres tú mismo de ayer.' },
];

const NAV_ITEMS = [
  { label: 'Dashboard',       path: '/dashboard',     icon: <LayoutDashboard size={18} strokeWidth={2} />, also: [] },
  { label: 'Plan de entreno', path: '/training-plan', icon: <ClipboardList   size={18} strokeWidth={2} />, also: [] },
  { label: 'Actividades',     path: '/activities',    icon: <Activity        size={18} strokeWidth={2} />, also: ['/activity/'] },
  { label: 'Estadísticas',    path: '/stats',          icon: <BarChart2       size={18} strokeWidth={2} />, also: [] },
];

const BOTTOM_ITEMS = [
  { label: 'Inicio',  path: '/dashboard',       Icon: LayoutDashboard, also: [] },
  { label: 'Plan',    path: '/training-plan',   Icon: ClipboardList,   also: [] },
  { label: 'Salidas', path: '/activities',      Icon: Activity,        also: ['/activity/'] },
  { label: 'Stats',   path: '/stats',            Icon: BarChart2,       also: [] },
];

const AppSidebar: React.FC = () => {
  const { user } = useAuthContext();
  const { athleteData } = useStrava();
  const navigate = useNavigate();
  const location = useLocation();

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const firstName   = displayName.split(' ')[0];
  const initials    = displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatarUrl   = (athleteData?.profile_medium ?? athleteData?.profile ?? null) as string | null;

  const motiv = useMemo(() => MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)], []);
  const MotivIcon = motiv.icon;

  return (
    <>
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <img src={stridelyLogo} alt="" className="app-sidebar__brand-logo" aria-hidden="true" />
          <span className="app-sidebar__brand-name">Stridely</span>
        </div>
        <div className="app-sidebar__brand-sep" />

        <nav className="app-sidebar__nav">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path
              || location.pathname.startsWith(item.path + '/')
              || item.also.some(p => location.pathname.startsWith(p));
            return (
            <button
              key={item.path}
              className={`app-sidebar__nav-item${isActive ? ' app-sidebar__nav-item--active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
            );
          })}
        </nav>

        {/* Motivational card */}
        <div className="app-sidebar__motiv">
          <div className="app-sidebar__motiv-icon-wrap" aria-hidden="true">
            <MotivIcon size={22} strokeWidth={1.5} />
          </div>
          <p className="app-sidebar__motiv-text">{motiv.text}</p>
        </div>

        <button
          className={`app-sidebar__footer${location.pathname === '/profile' ? ' app-sidebar__footer--active' : ''}`}
          onClick={() => navigate('/profile')}
        >
          <div className="app-sidebar__avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} />
              : <span className="app-sidebar__avatar-initials">{initials}</span>
            }
          </div>
          <span className="app-sidebar__user-name">{firstName}</span>
        </button>
      </aside>

      <div className="app-sidebar__bottom-fade" />
      <nav className="app-sidebar__bottom-nav" aria-label="Navegación principal">
        {BOTTOM_ITEMS.map(({ label, path, Icon, also }) => {
          const active = location.pathname === path
            || location.pathname.startsWith(path + '/')
            || also.some(p => location.pathname.startsWith(p));
          return (
            <button
              key={path}
              className={`app-sidebar__bottom-nav-item${active ? ' app-sidebar__bottom-nav-item--active' : ''}`}
              onClick={() => navigate(path)}
              aria-label={label}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className="app-sidebar__bottom-nav-label">{label}</span>
            </button>
          );
        })}
        <button
          className={`app-sidebar__bottom-nav-item${location.pathname === '/profile' ? ' app-sidebar__bottom-nav-item--active' : ''}`}
          onClick={() => navigate('/profile')}
          aria-label="Perfil"
        >
          <User size={20} strokeWidth={location.pathname === '/profile' ? 2.2 : 1.8} />
          <span className="app-sidebar__bottom-nav-label">Perfil</span>
        </button>
      </nav>
    </>
  );
};

export default AppSidebar;
