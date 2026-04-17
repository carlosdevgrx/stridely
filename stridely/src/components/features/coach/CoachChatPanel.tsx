import React, { useEffect, useRef, useCallback, useState } from 'react';
import { X, SendHorizonal, CheckCircle2, ArrowRight } from 'lucide-react';
import striderAvatar from '../../../assets/avatar_strider.jpg';
import { useCoachChat, type ActionDetail } from '../../../context/CoachChatContext';
import { useAuthContext } from '../../../context/AuthContext';
import './CoachChatPanel.scss';
// ─── Day names (1=Lun ... 7=Dom) ─────────────────────────────────────────────
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ─── Tarjeta de sesión movida ─────────────────────────────────────────────
const MoveSessionCard: React.FC<{ meta: ActionDetail }> = ({ meta }) => {
  const intensity = (meta.session_intensity ?? '').toLowerCase().trim();
  return (
    <div className="coach-move-card">
      <div className="coach-move-card__header">
        <CheckCircle2 size={13} aria-hidden />
        <span>Sesión reprogramada</span>
      </div>
      <div className="coach-move-card__body">
        <div className="coach-move-card__info">
          <span className="coach-move-card__name">{meta.session_type}</span>
          {meta.session_duration && (
            <span className="coach-move-card__duration">{meta.session_duration}</span>
          )}
          {intensity && (
            <span className={`coach-move-card__badge coach-move-card__badge--${intensity}`}>
              {meta.session_intensity}
            </span>
          )}
        </div>
        <div className="coach-move-card__days">
          <div className="coach-move-card__day coach-move-card__day--from">
            {DAY_SHORT[(meta.from_day ?? 1) - 1]}
          </div>
          <ArrowRight size={14} className="coach-move-card__arrow" aria-hidden />
          <div className="coach-move-card__day coach-move-card__day--to">
            {DAY_SHORT[(meta.to_day ?? 1) - 1]}
          </div>
        </div>
      </div>
    </div>
  );
};
// ─── Sugerencias iniciales ────────────────────────────────────────────────────
const SUGGESTIONS = [
  '¿Cómo es mi ritmo ideal?',
  '¿Cuántos días descanso?',
  'Tengo agujetas, ¿salgo?',
  '¿Qué como antes de correr?',
];

// ─── Componente principal ─────────────────────────────────────────────────────
const CoachChatPanel: React.FC = () => {
  const { isOpen, messages, isLoading, close, sendMessage } = useCoachChat();
  const { user } = useAuthContext();
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'Atleta';
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  // Scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Foco en el input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    await sendMessage(text);
  }, [inputValue, isLoading, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sin Shift → enviar; Shift+Enter → nueva línea
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Auto-height
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const handleSuggestion = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay oscuro solo en mobile */}
      <div className="coach-overlay" onClick={close} aria-hidden />

      {/* Panel */}
      <div
        className="coach-panel"
        role="dialog"
        aria-label="Coach Strider"
        aria-modal="true"
      >
        {/* ── Header ── */}
        <header className="coach-panel__header">
          <div className="coach-panel__avatar" aria-hidden>
            <img src={striderAvatar} alt="Strider" />
          </div>
          <div className="coach-panel__title-wrap">
            <div className="coach-panel__title">Strider</div>
            <div className="coach-panel__status">
              <span className="coach-panel__status-dot" aria-hidden />
              Online
            </div>
          </div>
          <button
            className="coach-panel__close"
            onClick={close}
            aria-label="Cerrar chat"
          >
            <X size={20} />
          </button>
        </header>

        {/* ── Mensajes ── */}
        <div className="coach-panel__messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="coach-panel__empty">
              <h2 className="coach-panel__empty-greeting">
                Hola {firstName}
              </h2>
              <p className="coach-panel__empty-sub">Soy Strider. Pregúntame sobre tu entrenamiento, ritmos, descanso o nutrición deportiva.</p>
              <div className="coach-panel__suggestions">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    className="coach-panel__suggestion"
                    onClick={() => handleSuggestion(s)}
                    disabled={isLoading}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`coach-msg coach-msg--${msg.role}`}
              >
                {msg.role === 'system' ? (
                  msg.meta
                    ? <MoveSessionCard meta={msg.meta} />
                    : (
                      <div className="coach-msg__system">
                        <CheckCircle2 size={14} aria-hidden />
                        {msg.content}
                      </div>
                    )
                ) : (
                  <>
                    {msg.role === 'assistant' && (
                      <div className="coach-msg__avatar" aria-hidden>
                        <img src={striderAvatar} alt="Strider" />
                      </div>
                    )}
                    <div className="coach-msg__bubble">
                      {msg.content}
                    </div>
                  </>
                )}
              </div>
            ))
          )}

          {/* Indicador "escribiendo..." */}
          {isLoading && (
            <div className="coach-typing">
              <div className="coach-msg__avatar" aria-hidden>
                <img src={striderAvatar} alt="Strider" />
              </div>
              <div className="coach-typing__dots" aria-label="Strider está escribiendo">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ── */}
        <div className="coach-panel__input-area">
          <div className="coach-panel__input-wrap">
            <textarea
              ref={inputRef}
              className="coach-panel__input"
              placeholder="Pregúntame algo..."
              rows={1}
              value={inputValue}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              aria-label="Mensaje al coach"
            />
            <button
              className="coach-panel__send"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              aria-label="Enviar mensaje"
            >
              <SendHorizonal size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CoachChatPanel;
