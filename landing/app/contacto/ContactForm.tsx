'use client';

import { useState, useId } from 'react';
import { Send, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import s from './contact.module.scss';

interface FormState {
  name:    string;
  email:   string;
  topic:   string;
  message: string;
}

interface FieldErrors {
  name?:    string;
  email?:   string;
  message?: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

const TOPICS = [
  { value: 'general',      label: 'Consulta general'         },
  { value: 'soporte',      label: 'Soporte técnico'          },
  { value: 'colaboracion', label: 'Colaboración / Partnership'},
  { value: 'prensa',       label: 'Prensa / Medios'          },
  { value: 'otro',         label: 'Otro'                     },
];

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim() || form.name.trim().length < 2)
    errors.name = 'Escribe tu nombre (mínimo 2 caracteres).';
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = 'Introduce un email válido.';
  if (!form.message.trim() || form.message.trim().length < 10)
    errors.message = 'El mensaje debe tener al menos 10 caracteres.';
  return errors;
}

export default function ContactForm() {
  const uid = useId();

  const [form, setForm] = useState<FormState>({ name: '', email: '', topic: 'general', message: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    // Limpiar error de campo al escribir
    if (errors[key as keyof FieldErrors]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.error ?? 'Error desconocido. Inténtalo de nuevo.');
        setStatus('error');
        return;
      }

      setStatus('success');
      setForm({ name: '', email: '', topic: 'general', message: '' });
    } catch {
      setErrorMsg('No se pudo conectar con el servidor. Comprueba tu conexión.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className={`${s.toast} ${s['toast--success']}`} role="status">
        <CheckCircle size={20} className={s.toast__icon} aria-hidden="true" />
        <div className={s.toast__text}>
          <strong>¡Mensaje enviado!</strong>
          Te respondemos en menos de 48 horas. Revisa también tu carpeta de spam por si acaso.
        </div>
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={handleSubmit} noValidate>

      {/* Nombre + Email */}
      <div className={s.row}>
        <div className={s.field}>
          <label htmlFor={`${uid}-name`} className={s.label}>Nombre</label>
          <input
            id={`${uid}-name`}
            className={s.input}
            type="text"
            placeholder="Tu nombre"
            autoComplete="name"
            value={form.name}
            onChange={set('name')}
            aria-describedby={errors.name ? `${uid}-name-err` : undefined}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <span id={`${uid}-name-err`} className={s.fieldError} role="alert">
              <AlertCircle size={12} aria-hidden="true" /> {errors.name}
            </span>
          )}
        </div>

        <div className={s.field}>
          <label htmlFor={`${uid}-email`} className={s.label}>Email</label>
          <input
            id={`${uid}-email`}
            className={s.input}
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            aria-describedby={errors.email ? `${uid}-email-err` : undefined}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <span id={`${uid}-email-err`} className={s.fieldError} role="alert">
              <AlertCircle size={12} aria-hidden="true" /> {errors.email}
            </span>
          )}
        </div>
      </div>

      {/* Tema */}
      <div className={s.field}>
        <label htmlFor={`${uid}-topic`} className={s.label}>Tema</label>
        <select
          id={`${uid}-topic`}
          className={s.select}
          value={form.topic}
          onChange={set('topic')}
        >
          {TOPICS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Mensaje */}
      <div className={s.field}>
        <label htmlFor={`${uid}-message`} className={s.label}>Mensaje</label>
        <textarea
          id={`${uid}-message`}
          className={s.textarea}
          placeholder="Cuéntanos en qué podemos ayudarte..."
          value={form.message}
          onChange={set('message')}
          aria-describedby={errors.message ? `${uid}-msg-err` : undefined}
          aria-invalid={!!errors.message}
        />
        {errors.message && (
          <span id={`${uid}-msg-err`} className={s.fieldError} role="alert">
            <AlertCircle size={12} aria-hidden="true" /> {errors.message}
          </span>
        )}
      </div>

      {/* Error global */}
      {status === 'error' && (
        <div className={`${s.toast} ${s['toast--error']}`} role="alert">
          <AlertCircle size={20} className={s.toast__icon} aria-hidden="true" />
          <div className={s.toast__text}><strong>Algo salió mal</strong>{errorMsg}</div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className={s.submit}
        disabled={status === 'loading'}
        aria-busy={status === 'loading'}
      >
        {status === 'loading' ? (
          <>
            <span className={s.submit__spinner} aria-hidden="true" />
            Enviando…
          </>
        ) : (
          <>
            Enviar mensaje <Send size={15} aria-hidden="true" />
          </>
        )}
      </button>

    </form>
  );
}
