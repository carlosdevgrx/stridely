import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Activity } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import { supabase } from '../services/supabase/client';
import { TrainingPlan } from '../components/features/training/TrainingPlan';
import type { StoredPlan } from '../components/features/training/TrainingPlan';
import './TrainingPlanPage.scss';

const TrainingPlanPage: React.FC = () => {
  const { signOut, user } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { activities, isConnected, fetchActivities, athleteData } = useStrava();
  const [activePlan, setActivePlan] = useState<StoredPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const firstName   = displayName.split(' ')[0];
  const initials    = displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatarUrl   = (athleteData?.profile_medium ?? athleteData?.profile ?? null) as string | null;

  useEffect(() => {
    if (isConnected) fetchActivities().catch(() => {});
  }, [isConnected, fetchActivities]);

  useEffect(() => {
    if (!user) return;
    setLoadingPlan(true);
    supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setActivePlan(data as StoredPlan | null);
        setLoadingPlan(false);
      });
  }, [user]);

  const NAV_ITEMS = [
    { label: 'Dashboard',         path: '/dashboard',       icon: <LayoutDashboard size={18} strokeWidth={2} /> },
    { label: 'Plan de entreno',   path: '/training-plan',   icon: <ClipboardList   size={18} strokeWidth={2} /> },
    { label: 'Actividades',       path: '/activities',      icon: <Activity        size={18} strokeWidth={2} /> },
  ];

  const Sidebar = () => (
    <aside className="tpp__sidebar">
      <div className="tpp__sidebar-brand">
        <span className="tpp__sidebar-brand-icon">🏃</span>
        <span className="tpp__sidebar-brand-name">Stridely</span>
      </div>

      <nav className="tpp__nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`tpp__nav-item${location.pathname === item.path ? ' tpp__nav-item--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="tpp__sidebar-footer">
        <div className="tpp__avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} />
            : <span className="tpp__avatar-initials">{initials}</span>
          }
        </div>
        <div className="tpp__sidebar-user">
          <strong>{firstName}</strong>
          <button className="tpp__sidebar-signout" onClick={signOut}>Cerrar sesión</button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="tpp">
      <Sidebar />
      <div className="tpp__page">
        <div className="tpp__main">
          <div className="tpp__heading">
            <div>
              <h1 className="tpp__title">Plan de entrenamiento</h1>
              <p className="tpp__sub">Tu programa personalizado generado con IA</p>
            </div>
          </div>

          {/* Full-width plan card */}
          <div className="tpp__plan-wrap">
            <TrainingPlan
              plan={activePlan}
              loading={loadingPlan}
              activities={activities}
              userId={user?.id ?? ''}
              onPlanCreated={setActivePlan}
              onPlanAbandoned={() => setActivePlan(null)}
              fullPage
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingPlanPage;
