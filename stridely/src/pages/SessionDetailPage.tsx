import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Zap } from 'lucide-react';
import { supabase } from '../services/supabase/client';
import type { StoredPlan, PlanSession } from '../components/features/training/TrainingPlan';
import AppSidebar from '../components/common/AppSidebar';
import './SessionDetailPage.scss';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const DAY_FULL: Record<number, string> = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo',
};
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function getSessionDate(startedAt: string, week: number, dayNumber: number): Date {
  const start = new Date(startedAt + 'T12:00:00');
  const dow = start.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  const planMonday = new Date(start);
  planMonday.setDate(start.getDate() + daysToMonday);
  const sessionDate = new Date(planMonday);
  sessionDate.setDate(planMonday.getDate() + (week - 1) * 7 + (dayNumber - 1));
  return sessionDate;
}

interface SessionDetail {
  intro: string;
  warm_up: string;
  main: string;
  cool_down: string;
  pace_target: string;
  estimated_time: string;
  tip: string;
}

const SessionDetailPage: React.FC = () => {
  const { planId, week: weekStr, day: dayStr } = useParams<{ planId: string; week: string; day: string }>();
  const navigate = useNavigate();

  const weekNum = parseInt(weekStr ?? '1', 10);
  const dayNum  = parseInt(dayStr  ?? '1', 10);

  const [plan, setPlan]               = useState<StoredPlan | null>(null);
  const [detail, setDetail]           = useState<SessionDetail | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    supabase
      .from('training_plans')
      .select('*')
      .eq('id', planId)
      .single()
      .then(({ data }) => {
        setPlan(data as StoredPlan | null);
        setLoadingPlan(false);
      });
  }, [planId]);

  const session: PlanSession | undefined = plan?.weeks
    ?.find(w => w.week === weekNum)
    ?.sessions.find(s => s.day_number === dayNum);

  useEffect(() => {
    if (!plan || !session) return;
    setLoadingDetail(true);
    setDetailError(null);
    fetch(`${API_BASE}/api/ai/session-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session,
        plan_goal: plan.goal,
        week: weekNum,
        total_weeks: plan.total_weeks,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.detail) {
          setDetail(d.detail);
          // Cache intro so Dashboard can read it without a separate API call
          if (d.detail.intro && planId) {
            const short = d.detail.intro.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
            localStorage.setItem(`sdp-intro-${planId}-w${weekNum}-d${dayNum}`, short);
          }
        } else setDetailError(d.error ?? 'Error al obtener los detalles');
      })
      .catch(err => setDetailError(err.message))
      .finally(() => setLoadingDetail(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, weekNum, dayNum]);

  const sessionDate = plan && session ? getSessionDate(plan.started_at, weekNum, dayNum) : null;

  return (
    <div className="sdp">
      <AppSidebar />
      <div className="sdp__page">
        <div className="sdp__main">
          <button className="sdp__back" onClick={() => navigate('/training-plan')}>
            <ArrowLeft size={15} />
            <span>Plan {plan?.goal ?? '...'} · Semana {weekNum}</span>
          </button>

          {loadingPlan ? (
            <div className="sdp__loading">
              <div className="sdp__spinner" />
            </div>
          ) : !session ? (
            <p className="sdp__not-found">Sesión no encontrada.</p>
          ) : (
            <div className="sdp__content">
              {/* Header */}
              <div className="sdp__header">
                <div className="sdp__header-badges">
                  <span className="sdp__plan-badge">Plan {plan?.goal}</span>
                  <span className="sdp__week-badge">Semana {weekNum} de {plan?.total_weeks}</span>
                </div>
                <h1 className="sdp__title">{session.type}: {session.duration}</h1>
                {sessionDate && (
                  <p className="sdp__date">
                    {DAY_FULL[dayNum]}, {sessionDate.getDate()} {MONTH_SHORT[sessionDate.getMonth()]}
                  </p>
                )}
                <div className="sdp__meta">
                  <span className="sdp__desc">{session.description}</span>
                  {session.intensity && (
                    <span className={`sdp__intensity sdp__intensity--${session.intensity}`}>
                      {session.intensity}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="sdp__stats">
                <div className="sdp__stat">
                  <Clock size={16} className="sdp__stat-icon" />
                  <div>
                    <span className="sdp__stat-label">Volumen</span>
                    <span className="sdp__stat-value">{session.duration}</span>
                  </div>
                </div>
                {session.pace_hint && (
                  <div className="sdp__stat">
                    <Zap size={16} className="sdp__stat-icon" />
                    <div>
                      <span className="sdp__stat-label">Ritmo sugerido</span>
                      <span className="sdp__stat-value">{session.pace_hint}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Detail */}
              {loadingDetail ? (
                <div className="sdp__detail-loading">
                  <div className="sdp__spinner" />
                  <span>El coach IA está preparando tus instrucciones...</span>
                </div>
              ) : detailError ? (
                <div className="sdp__error">⚠ {detailError}</div>
              ) : detail ? (
                <div className="sdp__detail">
                  <p className="sdp__detail-intro">{detail.intro}</p>

                  <div className="sdp__detail-grid">
                    <div className="sdp__detail-stat">
                      <span className="sdp__detail-stat-label">Tiempo estimado</span>
                      <span className="sdp__detail-stat-value">{detail.estimated_time}</span>
                    </div>
                    {detail.pace_target && (
                      <div className="sdp__detail-stat">
                        <span className="sdp__detail-stat-label">Ritmo objetivo</span>
                        <span className="sdp__detail-stat-value">{detail.pace_target}</span>
                      </div>
                    )}
                  </div>

                  <div className="sdp__blocks">
                    <div className="sdp__block sdp__block--warmup">
                      <span className="sdp__block-label">🔥 Calentamiento</span>
                      <p className="sdp__block-text">{detail.warm_up}</p>
                    </div>
                    <div className="sdp__block sdp__block--main">
                      <span className="sdp__block-label">⚡ Parte principal</span>
                      <p className="sdp__block-text">{detail.main}</p>
                    </div>
                    <div className="sdp__block sdp__block--cooldown">
                      <span className="sdp__block-label">🧘 Vuelta a la calma</span>
                      <p className="sdp__block-text">{detail.cool_down}</p>
                    </div>
                  </div>

                  <div className="sdp__tip">
                    <span className="sdp__tip-icon">💡</span>
                    <p className="sdp__tip-text">{detail.tip}</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionDetailPage;
