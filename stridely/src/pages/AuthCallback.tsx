// Página de callback de OAuth

import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

const AuthCallback: React.FC = () => {
  const [message, setMessage] = useState('Procesando autenticación...');
  const [isProcessing, setIsProcessing] = useState(true); // eslint-disable-line

  useEffect(() => {
    const exchangeCodeForToken = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');

        if (error) {
          setMessage(`Error: ${error}`);
          setIsProcessing(false);
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
          return;
        }

        if (!code) {
          setMessage('Código no encontrado');
          setIsProcessing(false);
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
          return;
        }

        // Intercambiar código por token con el backend
        console.log('Intercambiando código por token...');
        const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/strava/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Error al intercambiar código:', error);
          setMessage(`Error: ${error.error}`);
          setIsProcessing(false);
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
          return;
        }

        const data = await response.json();
        console.log('Token obtenido:', data);

        // Guardar token en localStorage
        localStorage.setItem('strava_token', data.token);
        localStorage.setItem('strava_athlete', JSON.stringify(data.athlete));

        setMessage('¡Autenticación exitosa! Redirigiendo...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } catch (err) {
        console.error('Error:', err);
        setMessage(`Error: ${err instanceof Error ? err.message : 'Desconocido'}`);
        setIsProcessing(false);
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    };

    exchangeCodeForToken();
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <LoadingSpinner message={message} />
      </div>
    </div>
  );
};

export default AuthCallback;
