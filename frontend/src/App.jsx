import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CanvasEngine from './components/CanvasEngine';
import Toolbox from './components/Toolbox';
import AuthPage from './components/AuthPage';
import useCollaboration from './hooks/useCollaboration';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('sd_token');
  const isGuest = localStorage.getItem('sd_guest') === 'true';
  
  if (!token && !isGuest) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const CanvasPage = () => {
  const { joinRoom } = useCollaboration();

  React.useEffect(() => {
    const handleJoin = (e) => joinRoom(e.detail);
    window.addEventListener('join-room', handleJoin);
    
    // Check URL for room parameter
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) joinRoom(room);

    return () => window.removeEventListener('join-room', handleJoin);
  }, [joinRoom]);

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
