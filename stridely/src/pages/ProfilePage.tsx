import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, Unlink, ChevronRight, MapPin, Footprints, Trophy, BarChart2, Activity, Trash2 } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import AppSidebar from '../components/common/AppSidebar';
import './ProfilePage.scss';

const ProfilePage: React.FC = () => {
  const { signOut, user, deleteAccount } = useAuthContext();
  const navigate = useNavigate();
  const { isConnected, disconnectStrava, athleteData, activities, fetchActivities, loading } = useStrava();
  const didFetch = useRef(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const initials    = displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatarUrl   = (athleteData?.profile_medium ?? athleteData?.profile ?? null) as string | null;
  const city        = athleteData?.city as string | null;
  const country     = athleteData?.country as string | null;
  const location    = [city, country].filter(Boolean).join(', ');

  useEffect(() => {
    if (isConnected && !didFetch.current) {
      didFetch.current = true;
      fetchActivities().catch(() => {});
    }
  }, [isConnected, fetchActivities]);

  const highlights = useMemo(() => {
    if (!activities.length) return null;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const totalKm = activities.reduce((s, a) => s + a.distance / 1000, 0);
    const weekKm  = activities
      .filter(a => new Date(a.date) >= startOfWeek)
      .reduce((s, a) => s + a.distance / 1000, 0);
    const longest = Math.max(...activities.map(a => a.distance / 1000));
    return { totalKm, weekKm, longest, count: activities.length };
  }, [activities]);

  const handleDisconnectStrava = async () => {
    await disconnectStrava();
    navigate('/dashboard');
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    setDeleting(true);
    const { error } = await deleteAccount();
    setDeleting(false);
    if (error) {
      setDeleteError(error);
    } else {
      navigate('/login');
    }
  };

  const fmt = (n: number) => n % 1 === 0 ? n.toString() : n.toFixed(1);

  return (
    <div className="prf">
      <AppSidebar />
      <div className="prf__page">
        <div className="prf__main">

          {showDeleteModal && (
            <DeleteModal
              onConfirm={handleDeleteAccount}
              onCancel={() => { setShowDeleteModal(false); setDeleteError(null); }}
              error={deleteError}
              loading={deleting}
            />
          )}
          <h1 className="prf__title">Perfil</h1>

          {/* ── Hero ── */}
          <div className="prf__hero">
            <div className="prf__hero-avatar">
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} className="prf__hero-avatar-img" />
                : <span className="prf__hero-avatar-initials">{initials}</span>
              }
            </div>
            <div className="prf__hero-info">
              <h2 className="prf__hero-name">{displayName}</h2>
              {location && (
                <p className="prf__hero-location">
                  <MapPin size={13} strokeWidth={2} />
                  {location}
                </p>
              )}
            </div>
          </div>

          {/* ── Content grid ── */}
          <div className="prf__content">

          {/* ── Running Highlights ── */}
          {isConnected && (
            <button className="prf__highlights" onClick={() => navigate('/stats')}>
              <div className="prf__highlights-head">
                <span className="prf__highlights-title">Running Highlights</span>
                <span className="prf__highlights-link">
                  Ver estadísticas <ChevronRight size={14} strokeWidth={2} />
                </span>
              </div>

              {/* 2 featured stats */}
              <div className="prf__hstats">
                <div className="prf__hstat prf__hstat--purple">
                  <div className="prf__hstat-icon">
                    <Footprints size={22} strokeWidth={1.8} />
                  </div>
                  <div className="prf__hstat-value">
                    {loading || !highlights ? '—' : fmt(highlights.weekKm)}
                    {highlights && <span className="prf__hstat-unit">km</span>}
                  </div>
                  <div className="prf__hstat-label">Kilometraje semanal</div>
                </div>
                <div className="prf__hstat prf__hstat--gold">
                  <div className="prf__hstat-icon">
                    <Trophy size={22} strokeWidth={1.8} />
                  </div>
                  <div className="prf__hstat-value">
                    {loading || !highlights ? '—' : fmt(highlights.longest)}
                    {highlights && <span className="prf__hstat-unit">km</span>}
                  </div>
                  <div className="prf__hstat-label">Carrera más larga</div>
                </div>
              </div>

              {/* Secondary stats row */}
              <div className="prf__highlights-secondary">
                <div className="prf__mini-stat">
                  <div className="prf__mini-stat-icon prf__mini-stat-icon--blue"><BarChart2 size={15} strokeWidth={2} /></div>
                  <span className="prf__mini-stat-label">Total acumulado</span>
                  <span className="prf__mini-stat-value">{loading || !highlights ? '—' : `${Math.round(highlights.totalKm)} km`}</span>
                </div>
                <div className="prf__mini-stat">
                  <div className="prf__mini-stat-icon prf__mini-stat-icon--green"><Activity size={15} strokeWidth={2} /></div>
                  <span className="prf__mini-stat-label">Actividades</span>
                  <span className="prf__mini-stat-value">{loading || !highlights ? '—' : highlights.count}</span>
                </div>
              </div>
            </button>
          )}

          {/* ── Settings column ── */}
          <div className="prf__settings">

            {/* Account */}
            <div className="prf__card">
              <h3 className="prf__card-title">Cuenta</h3>
              <div className="prf__actions">
                {isConnected && (
                  <button className="prf__action prf__action--danger" onClick={handleDisconnectStrava}>
                    <Unlink size={18} />
                    <span>Desconectar Strava</span>
                  </button>
                )}
                <button className="prf__action prf__action--signout" onClick={signOut}>
                  <LogOut size={18} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
              <div className="prf__legal">
                <Link to="/privacy">Política de Privacidad</Link>
              </div>
            </div>

            {/* Danger zone */}
            <div className="prf__card prf__card--danger">
              <h3 className="prf__card-title prf__card-title--danger">Zona peligrosa</h3>
              <p className="prf__danger-desc">
                Al eliminar tu cuenta se borrarán permanentemente todos tus datos.
                Esta acción no se puede deshacer.
              </p>
              <button className="prf__action prf__action--delete" onClick={() => setShowDeleteModal(true)}>
                <Trash2 size={18} />
                <span>Eliminar mi cuenta y datos</span>
              </button>
            </div>

          </div>{/* end prf__settings */}

          </div>{/* end prf__content */}

        </div>
      </div>
    </div>
  );
};

// ─── Confirmation Modal ───────────────────────────────────────────────────────
interface DeleteModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  error: string | null;
  loading: boolean;
}
const DeleteModal: React.FC<DeleteModalProps> = ({ onConfirm, onCancel, error, loading }) => (
  <div className="prf-modal-overlay" onClick={onCancel}>
    <div className="prf-modal" onClick={(e) => e.stopPropagation()}>
      <div className="prf-modal__icon"><Trash2 size={28} /></div>
      <h2 className="prf-modal__title">¿Eliminar cuenta?</h2>
      <p className="prf-modal__body">
        Esta acción es <strong>irreversible</strong>. Se borrarán tu cuenta,
        historial de entrenamientos, plan activo y todos tus datos personales.
      </p>
      {error && <p className="prf-modal__error">{error}</p>}
      <div className="prf-modal__actions">
        <button className="prf-modal__cancel" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button className="prf-modal__confirm" onClick={onConfirm} disabled={loading}>
          {loading ? 'Eliminando...' : 'Sí, eliminar mi cuenta'}
        </button>
      </div>
    </div>
  </div>
);

export default ProfilePage;
