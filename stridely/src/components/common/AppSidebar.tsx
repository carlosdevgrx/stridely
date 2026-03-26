import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Activity } from 'lucide-react';
import { useStrava } from '../../hooks/useStrava';
import { useAuthContext } from '../../context/AuthContext';
import './AppSidebar.scss';

const NAV_ITEMS = [
  { label: 'Dashboard',       path: '/dashboard',     icon: <LayoutDashboard size={18} strokeWidth={2} /> },
  { label: 'Plan de entreno', path: '/training-plan', icon: <ClipboardList   size={18} strokeWidth={2} /> },
  { label: 'Actividades',     path: '/activities',    icon: <Activity        size={18} strokeWidth={2} /> },
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

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <span className="app-sidebar__brand-name">Stridely</span>
      </div>

      <nav className="app-sidebar__nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`app-sidebar__nav-item${location.pathname === item.path ? ' app-sidebar__nav-item--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

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
  );
};

export default AppSidebar;
