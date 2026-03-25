// Página de callback de OAuth - Conecta Strava con la cuenta del usuario

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { supabase } from '../services/supabase/client';

const AuthCallback: React.FC = () => {
  const [message, setMessage] = useState('Conectando tu cuenta de Strava...');
  const navigate = useNavigate();

  useEffect(() => {
    const exchangeCodeForToken = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');

        if (error) {
          setMessage(`Error: ${error}`);
          setTimeout(() => navigate('/dashboard'), 2000);
          return;
        }

        if (!code) {
          setMessage('Código no encontrado');
          setTimeout(() => navigate('/dashboard'), 2000);
          return;
        }

        const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/strava/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setMessage(`Error: ${errorData.error}`);
          setTimeout(() => navigate('/dashboard'), 2000);
          return;
        }

        const data = await response.json();

        // Guardar token de Strava en Supabase asociado al usuario
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No hay sesión de usuario activa');

        const { error: dbError } = await supabase
          .from('strava_connections')
          .upsert({
            user_id: user.id,
            access_token: data.token,
            refresh_token: data.refresh_token ?? '',
            expires_at: data.expires_at ?? 0,
            athlete_id: data.athlete?.id ?? null,
            athlete_data: data.athlete ?? null,
          }, { onConflict: 'user_id' });

        if (dbError) throw new Error(dbError.message);

        setMessage('¡Strava conectado correctamente!');
        setTimeout(() => navigate('/dashboard'), 1500);
      } catch (err) {
        console.error('Error:', err);
        setMessage(`Error: ${err instanceof Error ? err.message : 'Desconocido'}`);
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    };

    exchangeCodeForToken();
  }, [navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <LoadingSpinner message={message} />
      </div>
    </div>
  );
};

export default AuthCallback;
