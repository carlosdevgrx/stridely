import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import stridelyLogo from '../assets/stridely-logo.svg';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      setTimeout(() => navigate('/login'), 3000);
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
            <img src={stridelyLogo} alt="Stridely" className="auth__hero-icon" />
            <span className="auth__hero-name">Stridely</span>
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
            <img src={stridelyLogo} alt="Stridely" className="auth__logo-icon" />
            <span className="auth__logo-name">Stridely</span>
          </div>

          {success ? (
            <div className="auth__success">
              <span className="auth__success-icon">✅</span>
              <h3>¡Cuenta creada!</h3>
              <p>Revisa tu email para confirmar tu cuenta.<br />Redirigiendo al login...</p>
            </div>
          ) : (
            <>
              <h1 className="auth__title">Crea tu cuenta</h1>

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
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>

                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="confirmPassword">Confirmar contraseña</label>
                  <input
                    className="auth-form__input"
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                </div>

                {error && <p className="auth-form__error">{error}</p>}

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
