import React, { useEffect, useState, useCallback } from 'react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import { supabase } from '../services/supabase/client';
import { TrainingPlan } from '../components/features/training/TrainingPlan';
import type { StoredPlan } from '../components/features/training/TrainingPlan';
import { useCoachChat } from '../context/CoachChatContext';
import { getPlanCurrentWeek, isSessionCompleted } from '../utils/planUtils';

const GOAL_LABELS: Record<string, string> = {
  '5km': '5 km', '10km': '10 km', 'half': 'Media maratón', 'marathon': 'Maratón',
};
import AppSidebar from '../components/common/AppSidebar';
import './TrainingPlanPage.scss';

const TrainingPlanPage: React.FC = () => {
  const { user } = useAuthContext();
  const { activities, isConnected, fetchActivities } = useStrava();
  const [activePlan, setActivePlan] = useState<StoredPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const { setCoachCtx, planModifiedAt } = useCoachChat();

  useEffect(() => {
    if (isConnected) fetchActivities().catch(() => {});
  }, [isConnected, fetchActivities]);

  const fetchPlan = useCallback(() => {
    if (!user) return;
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

  // Carga inicial del plan
  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  // Refetch cuando el coach modifica el plan
  useEffect(() => {
    if (planModifiedAt !== null) fetchPlan();
  }, [planModifiedAt, fetchPlan]);

  // Pasar contexto del plan al coach
  useEffect(() => {
    if (!activePlan) return;
    const currentWeek   = getPlanCurrentWeek(activePlan);
    const todayDow      = new Date().getDay();
    const todayDayNum   = todayDow === 0 ? 7 : todayDow;
    const weekSessions  = (activePlan.weeks.find(w => w.week === currentWeek)?.sessions ?? [])
      .map(s => ({
        ...s,
        completed: isSessionCompleted(s, currentWeek, activePlan, activities),
      }));

    // Próxima sesión pendiente para el resumen rápido
    const next = weekSessions.find(s => !s.completed && s.day_number >= todayDayNum);
    const upcomingLabel = next ? `${next.type} ${next.duration}` : undefined;

    setCoachCtx({
      plan_goal:          activePlan.goal,
      plan_id:            activePlan.id,
      current_week:       currentWeek,
      total_weeks:        activePlan.total_weeks,
      today_day_number:   todayDayNum,
      week_sessions:      weekSessions,
      upcoming_session:   upcomingLabel,
      recent_activities:  activities.slice(0, 8).map(a => ({
        distance: a.distance,
        duration: a.duration,
        pace:     a.pace,
      })),
    });
  }, [activePlan, activities, setCoachCtx]);

  return (
    <div className="tpp">
      <AppSidebar />
      <div className="tpp__page">
        <div className="tpp__main">
          <div className="tpp__hero-banner">
            <div className="tpp__hero-banner-content">
              <h1 className="tpp__title">Plan de entrenamiento</h1>
              <p className="tpp__sub">Tu programa personalizado generado con IA</p>
            </div>
            {activePlan && !loadingPlan && (
              <p className="tpp__hero-banner-big" aria-hidden="true">
                {GOAL_LABELS[activePlan.goal] ?? activePlan.goal}
              </p>
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
