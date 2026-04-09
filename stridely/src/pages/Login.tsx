import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import stridelyLogo from '../assets/stridely-logo.svg';
import './Auth.scss';

// Pega aquí la URL de tu imagen de Unsplash
// Ejemplo: https://images.unsplash.com/photo-XXXXXXX?w=1200&auto=format&fit=crop&q=80
const HERO_IMAGE = 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=1200&auto=format&fit=crop&q=80';

const Login: React.FC = () => {
  const { signIn } = useAuthContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
    } else {
      navigate('/dashboard');
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

          <h1 className="auth__title">Bienvenido de nuevo</h1>
          <p className="auth__subtitle">Inicia sesión para ver tus entrenamientos</p>

          <form className="auth-form" onSubmit={handleSubmit}>
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
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && <p className="auth-form__error">{error}</p>}

            <button type="submit" className="auth-form__submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="auth__footer">
            ¿No tienes cuenta? <Link to="/register">Regístrate gratis</Link>
          </div>
          <div className="auth__footer auth__footer--privacy">
            <Link to="/privacy">Política de Privacidad</Link>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
