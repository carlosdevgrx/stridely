import React, { useEffect, useState } from 'react';
import { Target, CalendarDays, Flame } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import { supabase } from '../services/supabase/client';
import { TrainingPlan, getPlanCurrentWeek } from '../components/features/training/TrainingPlan';
import type { StoredPlan } from '../components/features/training/TrainingPlan';
import AppSidebar from '../components/common/AppSidebar';
import './TrainingPlanPage.scss';

const TrainingPlanPage: React.FC = () => {
  const { user } = useAuthContext();
  const { activities, isConnected, fetchActivities } = useStrava();
  const [activePlan, setActivePlan] = useState<StoredPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const GOAL_LABELS: Record<string, string> = {
    '5km': '5 km', '10km': '10 km', 'half': 'Media maratón', 'marathon': 'Maratón',
  };
  const currentWeek = activePlan ? getPlanCurrentWeek(activePlan) : 1;
  const progress = activePlan ? Math.round((currentWeek / activePlan.total_weeks) * 100) : 0;
  const sessionsThisWeek = activePlan?.weeks?.find(w => w.week === currentWeek)?.sessions?.length ?? 0;

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

  return (
    <div className="tpp">
      <AppSidebar />
      <div className="tpp__page">
        <div className="tpp__main">
          <div className="tpp__heading">
            <div>
              <h1 className="tpp__title">Plan de entrenamiento</h1>
              <p className="tpp__sub">Tu programa personalizado generado con IA</p>
            </div>
            {activePlan && !loadingPlan && (
              <div className="tpp__hero">
                <div className="tpp__hero-stats">
                  <div className="tpp__hero-stat">
                    <Target size={14} strokeWidth={2.5} />
                    <span>{GOAL_LABELS[activePlan.goal] ?? activePlan.goal}</span>
                  </div>
                  <span className="tpp__hero-dot" />
                  <div className="tpp__hero-stat">
                    <CalendarDays size={14} strokeWidth={2.5} />
                    <span>Semana {currentWeek} de {activePlan.total_weeks}</span>
                  </div>
                  <span className="tpp__hero-dot" />
                  <div className="tpp__hero-stat">
                    <Flame size={14} strokeWidth={2.5} />
                    <span>{sessionsThisWeek} sesiones esta semana</span>
                  </div>
                  <span className="tpp__hero-pct">{progress}%</span>
                </div>
                <div className="tpp__hero-bar">
                  <div className="tpp__hero-bar-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
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
