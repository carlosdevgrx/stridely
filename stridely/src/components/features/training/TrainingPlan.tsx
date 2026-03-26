import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../../services/supabase/client';
import type { Workout } from '../../../types';
import './TrainingPlan.scss';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const DAY_NAMES: Record<number, string> = {
  1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom',
};

export interface PlanSession {
  day_number: number;
  type: string;
  duration: string;
  description: string;
}

export interface PlanWeek {
  week: number;
  sessions: PlanSession[];
}

export interface StoredPlan {
  id: string;
  goal: '5km' | '10km';
  sessions_per_week: number;
  total_weeks: number;
  weeks: PlanWeek[];
  started_at: string;
}

interface Props {
  plan: StoredPlan | null;
  loading: boolean;
  activities: Workout[];
  userId: string;
  onPlanCreated: (plan: StoredPlan) => void;
  onPlanAbandoned?: () => void;
  fullPage?: boolean;
}

export const TrainingPlan: React.FC<Props> = ({ plan, loading, activities, userId, onPlanCreated, onPlanAbandoned, fullPage = false }) => {
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedGoal, setSelectedGoal] = useState<'5km' | '10km' | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  const handleAbandon = async () => {
    if (!plan) return;
    setAbandoning(true);
    await supabase.from('training_plans').update({ status: 'abandoned' }).eq('id', plan.id);
    setAbandoning(false);
    setShowAbandonModal(false);
    onPlanAbandoned?.();
  };

  const currentWeek = plan
    ? Math.min(
        Math.floor((Date.now() - new Date(plan.started_at).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1,
        plan.total_weeks,
      )
    : 1;

  const progress = plan ? Math.round((currentWeek / plan.total_weeks) * 100) : 0;
  const weekSessions = plan?.weeks?.find(w => w.week === currentWeek)?.sessions ?? [];
  const allWeeks = plan?.weeks ?? [];

  const openModal = () => {
    setStep(1);
    setSelectedGoal(null);
    setSelectedDays(null);
    setGenError(null);
    setShowModal(true);
  };

  const handleGenerate = async () => {
    if (!selectedGoal || !selectedDays) return;
    setStep(3);
    setGenerating(true);
    setGenError(null);

    try {
      const r = await fetch(`${API_BASE}/api/ai/training-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: selectedGoal,
          days_per_week: selectedDays,
          activities: activities.slice(0, 5),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.plan) throw new Error(d.error ?? 'Error generando plan');

      const today = new Date().toISOString().split('T')[0];
      const { data: saved, error: dbErr } = await supabase
        .from('training_plans')
        .insert({
          user_id: userId,
          goal: selectedGoal,
          sessions_per_week: selectedDays,
          total_weeks: d.plan.total_weeks,
          weeks: d.plan.weeks,
          started_at: today,
          status: 'active',
        })
        .select()
        .single();

      if (dbErr) throw new Error('Error guardando el plan. Asegúrate de crear la tabla training_plans en Supabase.');

      onPlanCreated(saved as StoredPlan);
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setGenError(msg);
      setStep(2);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="tplan">
        {loading ? (
          <div className="tplan__loading">
            <div className="tplan__skeleton tplan__skeleton--title" />
            <div className="tplan__skeleton tplan__skeleton--bar" />
            <div className="tplan__skeleton tplan__skeleton--row" />
            <div className="tplan__skeleton tplan__skeleton--row" />
          </div>
        ) : plan ? (
          <>
            <div className="tplan__top">
              <div className="tplan__header-row">
                <span className="tplan__badge">📋 Plan activo</span>
                <div className="tplan__header-actions">
                  <span className="tplan__goal-tag">{plan.goal}</span>
                  <button
                    className="tplan__abandon-btn"
                    onClick={() => setShowAbandonModal(true)}
                    title="Abandonar plan"
                    aria-label="Abandonar plan"
                  >
                    <Trash2 size={13} strokeWidth={2} />
                    {fullPage && <span>Abandonar</span>}
                  </button>
                </div>
              </div>
              <div className="tplan__week-row">
                <span className="tplan__week-label">Semana {currentWeek} de {plan.total_weeks}</span>
                <span className="tplan__week-pct">{progress}%</span>
              </div>
              <div className="tplan__bar-track">
                <div className="tplan__bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="tplan__sessions">
              {fullPage ? (
                // Full page: show all weeks
                allWeeks.map(week => (
                  <div key={week.week} className="tplan__week-block">
                    <p className={`tplan__sessions-title${week.week === currentWeek ? ' tplan__sessions-title--current' : ''}`}>
                      {week.week === currentWeek ? `▶ Semana ${week.week} — actual` : `Semana ${week.week}`}
                    </p>
                    {week.sessions.map((s, i) => (
                      <div key={i} className="tplan__session">
                        <span className="tplan__session-day">{DAY_NAMES[s.day_number]}</span>
                        <div className="tplan__session-info">
                          <span className="tplan__session-type">{s.type}</span>
                          <span className="tplan__session-dur">{s.duration}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                // Dashboard card: only current week
                <>
                  <p className="tplan__sessions-title">Esta semana</p>
                  {weekSessions.length > 0 ? weekSessions.map((s, i) => (
                    <div key={i} className="tplan__session">
                      <span className="tplan__session-day">{DAY_NAMES[s.day_number]}</span>
                      <div className="tplan__session-info">
                        <span className="tplan__session-type">{s.type}</span>
                        <span className="tplan__session-dur">{s.duration}</span>
                      </div>
                    </div>
                  )) : (
                    <p className="tplan__sessions-empty">No hay sesiones para esta semana</p>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="tplan__empty">
            <div className="tplan__empty-icon">🎯</div>
            <p className="tplan__empty-title">Sin plan activo</p>
            <p className="tplan__empty-sub">Crea un plan personalizado con IA para alcanzar tu próximo objetivo</p>
            <button className="tplan__cta" onClick={openModal}>Empezar un plan</button>
          </div>
        )}
      </div>

      {showAbandonModal && (
        <div className="tplan-overlay" onClick={() => !abandoning && setShowAbandonModal(false)}>
          <div className="tplan-modal tplan-modal--abandon" onClick={e => e.stopPropagation()}>
            {!abandoning && (
              <button className="tplan-modal__close" onClick={() => setShowAbandonModal(false)} aria-label="Cerrar">✕</button>
            )}
            <div className="tplan-modal__abandon-icon">🗑️</div>
            <h2 className="tplan-modal__title">¿Abandonar el plan?</h2>
            <p className="tplan-modal__sub">
              Perderás tu progreso en el plan <strong>{plan?.goal}</strong>. Podrás crear uno nuevo cuando quieras.
            </p>
            <div className="tplan-modal__footer">
              <button
                className="tplan-modal__btn tplan-modal__btn--ghost"
                onClick={() => setShowAbandonModal(false)}
                disabled={abandoning}
              >
                Cancelar
              </button>
              <button
                className="tplan-modal__btn tplan-modal__btn--danger"
                onClick={handleAbandon}
                disabled={abandoning}
              >
                {abandoning ? 'Abandonando...' : 'Sí, abandonar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="tplan-overlay" onClick={() => !generating && setShowModal(false)}>
          <div className="tplan-modal" onClick={e => e.stopPropagation()}>
            {!generating && (
              <button className="tplan-modal__close" onClick={() => setShowModal(false)} aria-label="Cerrar">✕</button>
            )}

            {/* Step 1: Goal */}
            {step === 1 && (
              <div className="tplan-modal__step">
                <p className="tplan-modal__step-num">Paso 1 de 2</p>
                <h2 className="tplan-modal__title">¿Cuál es tu objetivo?</h2>
                <p className="tplan-modal__sub">Crearemos un plan basado en tus actividades de Strava</p>
                <div className="tplan-modal__options">
                  <button
                    className={`tplan-modal__option${selectedGoal === '5km' ? ' tplan-modal__option--selected' : ''}`}
                    onClick={() => setSelectedGoal('5km')}
                  >
                    <span className="tplan-modal__option-icon">🏃</span>
                    <span className="tplan-modal__option-title">Mis primeros 5 km</span>
                    <span className="tplan-modal__option-sub">Ideal para empezar a correr</span>
                  </button>
                  <button
                    className={`tplan-modal__option${selectedGoal === '10km' ? ' tplan-modal__option--selected' : ''}`}
                    onClick={() => setSelectedGoal('10km')}
                  >
                    <span className="tplan-modal__option-icon">🚀</span>
                    <span className="tplan-modal__option-title">Llegar a los 10 km</span>
                    <span className="tplan-modal__option-sub">Para corredores con algo de base</span>
                  </button>
                </div>
                <button
                  className="tplan-modal__btn"
                  disabled={!selectedGoal}
                  onClick={() => setStep(2)}
                >
                  Continuar →
                </button>
              </div>
            )}

            {/* Step 2: Days per week */}
            {step === 2 && (
              <div className="tplan-modal__step">
                <p className="tplan-modal__step-num">Paso 2 de 2</p>
                <h2 className="tplan-modal__title">¿Cuántos días a la semana?</h2>
                <p className="tplan-modal__sub">Elige los días que puedes comprometerte a entrenar</p>
                <div className="tplan-modal__days">
                  {[2, 3, 4].map(d => (
                    <button
                      key={d}
                      className={`tplan-modal__day-opt${selectedDays === d ? ' tplan-modal__day-opt--selected' : ''}`}
                      onClick={() => setSelectedDays(d)}
                    >
                      <span className="tplan-modal__day-num">{d}</span>
                      <span className="tplan-modal__day-label">días/semana</span>
                    </button>
                  ))}
                </div>
                {genError && <p className="tplan-modal__error">⚠ {genError}</p>}
                <div className="tplan-modal__footer">
                  <button className="tplan-modal__btn tplan-modal__btn--ghost" onClick={() => setStep(1)}>← Atrás</button>
                  <button className="tplan-modal__btn" disabled={!selectedDays} onClick={handleGenerate}>
                    ✨ Generar mi plan
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Generating */}
            {step === 3 && (
              <div className="tplan-modal__generating">
                <div className="tplan-modal__spinner" />
                <p className="tplan-modal__gen-title">Creando tu plan...</p>
                <p className="tplan-modal__gen-sub">La IA está analizando tus datos y diseñando un plan a tu medida. Esto puede tardar unos segundos.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
