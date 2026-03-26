import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Unlink } from 'lucide-react';
import { useStrava } from '../hooks/useStrava';
import { useAuthContext } from '../context/AuthContext';
import AppSidebar from '../components/common/AppSidebar';
import './ProfilePage.scss';

const ProfilePage: React.FC = () => {
  const { signOut, user } = useAuthContext();
  const navigate = useNavigate();
  const { isConnected, disconnectStrava, athleteData } = useStrava();

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? '';
  const initials    = displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatarUrl   = (athleteData?.profile_medium ?? athleteData?.profile ?? null) as string | null;

  const handleDisconnectStrava = async () => {
    await disconnectStrava();
    navigate('/dashboard');
  };

  return (
    <div className="prf">
      <AppSidebar />
      <div className="prf__page">
        <div className="prf__main">
          <h1 className="prf__title">Perfil</h1>

          <div className="prf__card prf__card--profile">
            <div className="prf__profile-avatar">
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} className="prf__profile-avatar-img" />
                : <span className="prf__profile-avatar-initials">{initials}</span>
              }
            </div>
            <div className="prf__profile-info">
              <h2 className="prf__profile-name">{displayName}</h2>
              <p className="prf__profile-email">{user?.email}</p>
            </div>
          </div>

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
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
