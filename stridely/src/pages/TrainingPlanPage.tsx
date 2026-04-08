import React, { useEffect, useState } from 'react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import { supabase } from '../services/supabase/client';
import { TrainingPlan } from '../components/features/training/TrainingPlan';
import type { StoredPlan } from '../components/features/training/TrainingPlan';

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
