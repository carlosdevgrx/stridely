/**
 * LoadingSpinner - Componente de carga
 */

import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  message = 'Cargando...',
}) => {
  return (
    <div className={`spinner-container spinner-${size}`}>
      <div className="spinner" />
      {message && <p>{message}</p>}
    </div>
  );
};
