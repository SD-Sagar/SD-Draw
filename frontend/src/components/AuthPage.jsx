import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Logo from './Logo';
import './AuthPage.css';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await axios.post(endpoint, { username, password });
      localStorage.setItem('sd_token', res.data.token);
      localStorage.setItem('sd_user', res.data.username);
      navigate('/draw');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Make sure backend is running.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-logo-container">
        <Logo size={120} className="logo-icon" />
        <h1 className="auth-title">Welcome to SD-Draw</h1>
        <p className="auth-subtitle">Your infinite vector canvas.</p>
      </div>

      <div className="auth-form-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              required 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" className="auth-btn">
            {isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <span onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Register here' : 'Login here'}
          </span>
        </div>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <button 
          type="button" 
          className="guest-btn"
          onClick={() => {
            localStorage.removeItem('sd_token');
            localStorage.removeItem('sd_user');
            localStorage.setItem('sd_guest', 'true');
            navigate('/draw');
          }}
        >
          Try Guest Mode
        </button>

        <div className="auth-footer">
          <p className="trademark-text">
            <span className="copyright-icon">&copy;</span>{new Date().getFullYear()} Sagar dey. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
