import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import totalWhiteLogo from '../assets/logo-total-white.svg';
import corporateLogo from '../assets/logo-corporativo.svg';
import './Auth.scss';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=1200&auto=format&fit=crop&q=80';

const Register: React.FC = () => {
  const { signUp } = useAuthContext();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acceptedPrivacy) {
      setError('Debes aceptar la Política de Privacidad para continuar');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, name);
    if (error) {
      setError(error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="auth">
      {/* Hero — foto lateral (solo desktop) */}
      <div
        className="auth__hero"
        style={HERO_IMAGE ? { '--auth-hero-image': `url(${HERO_IMAGE})` } as React.CSSProperties : {}}
      >
        <div className="auth__hero-overlay" />
        <div className="auth__hero-content">
          <div className="auth__hero-logo">
            <img src={totalWhiteLogo} alt="Stridely" className="auth__hero-logo-img" />
          </div>
          <p className="auth__hero-tagline">
            Analiza tus entrenamientos y alcanza tus metas con inteligencia artificial.
          </p>
        </div>
      </div>

      {/* Panel — formulario */}
      <div className="auth__panel">
        <div className="auth__panel-inner">

          <div className="auth__logo">
            <img src={corporateLogo} alt="Stridely" className="auth__logo-img" />
          </div>

          {success ? (
            <div className="auth__success">
              <span className="auth__success-icon">✅</span>
              <h3>¡Cuenta creada!</h3>
              <p>Hemos enviado un email de confirmación a <strong>{email}</strong>.<br />Confírmalo para activar tu cuenta.</p>
              <button className="auth-form__submit" onClick={() => navigate('/login')}>
                Ir al inicio de sesión
              </button>
            </div>
          ) : (
            <>
              <h1 className="auth__title">Crea tu cuenta</h1>
              <p className="auth__subtitle">Únete y empieza a entrenar con IA</p>

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="name">Nombre</label>
                  <input
                    className="auth-form__input"
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="email">Email</label>
                  <input
                    className="auth-form__input"
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="password">Contraseña</label>
                  <input
                    className="auth-form__input"
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <span className="auth-form__hint">Mínimo 6 caracteres</span>
                </div>

                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="confirmPassword">Confirmar contraseña</label>
                  <input
                    className="auth-form__input"
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    required
                    autoComplete="new-password"
                  />
                </div>

                {error && <p className="auth-form__error">{error}</p>}

                <label className="auth-form__privacy">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  />
                  <span>
                    He leído y acepto la{' '}
                    <Link to="/privacy" target="_blank" rel="noopener noreferrer">Política de Privacidad</Link>
                  </span>
                </label>

                <button type="submit" className="auth-form__submit" disabled={loading}>
                  {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                </button>
              </form>

              <div className="auth__footer">
                ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Register;
