import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CanvasEngine from './components/CanvasEngine';
import Toolbox from './components/Toolbox';
import AuthPage from './components/AuthPage';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('sd_token');
  const isGuest = localStorage.getItem('sd_guest') === 'true';
  
  if (!token && !isGuest) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const CanvasPage = () => {
  return (
    <>
      <Toolbox />
      <CanvasEngine />
    </>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route 
          path="/draw" 
          element={
            <ProtectedRoute>
              <CanvasPage />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
