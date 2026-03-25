import React from 'react';
import { Navigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  return <Navigate to="/login" replace />;
};

export default HomePage;
