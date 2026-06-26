import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import Logo from './Logo';
import './AuthPage.css';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      let data, errorObj;
      
      if (isLogin) {
        const res = await supabase.auth.signInWithPassword({ email, password });
        data = res.data;
        errorObj = res.error;
      } else {
        const res = await supabase.auth.signUp({ email, password });
        data = res.data;
        errorObj = res.error;
      }

      if (errorObj) throw errorObj;
      
      if (data.session) {
        localStorage.setItem('sd_token', data.session.access_token);
        localStorage.setItem('sd_user', data.user.email.split('@')[0]); // Use part of email as username display
        navigate('/draw');
      } else if (!isLogin) {
        // If confirm email is enabled in Supabase
        setError('Account created! Please check your email to verify.');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
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
            <label>Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
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
