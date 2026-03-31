import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

const AuthPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in
  if (user) return <Navigate to="/" replace />;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin
      ? { email: formData.email, password: formData.password }
      : { name: formData.name, email: formData.email, password: formData.password };

    try {
      const res = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.msg || 'Something went wrong');
      } else {
        login(data.token, data.user);
        navigate('/');
      }
    } catch (err) {
      setError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)' }}>
      {/* Minimal Header */}
      <header style={{ padding: '1.5rem 2rem', display: 'flex', alignItems: 'center' }}>
        <div className="header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          StudioStage
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--card-bg)',
          borderRadius: '24px',
          padding: '3rem',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
          animation: 'fadeIn 0.5s ease'
        }}>
          {/* Toggle */}
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-color)', borderRadius: '12px', padding: '4px', marginBottom: '2rem' }}>
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', backgroundColor: isLogin ? 'var(--primary-purple)' : 'transparent', color: isLogin ? 'white' : 'var(--text-secondary)', fontWeight: isLogin ? 600 : 400, boxShadow: isLogin ? '0 2px 8px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s' }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', backgroundColor: !isLogin ? 'var(--primary-purple)' : 'transparent', color: !isLogin ? 'white' : 'var(--text-secondary)', fontWeight: !isLogin ? 600 : 400, boxShadow: !isLogin ? '0 2px 8px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s' }}
            >
              Create Account
            </button>
          </div>

          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
            {isLogin ? 'Welcome back' : 'Join StudioStage'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            {isLogin ? 'Sign in to your sanctuary.' : 'Create your premium meeting account.'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!isLogin && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</label>
                <input
                  name="name"
                  type="text"
                  placeholder="Alex Rivera"
                  value={formData.name}
                  onChange={handleChange}
                  required={!isLogin}
                  style={inputStyle}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ backgroundColor: '#FFEBEE', color: '#C62828', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', borderLeft: '4px solid #C62828' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1rem', marginTop: '0.5rem', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Please wait...' : (isLogin ? 'Sign In →' : 'Create Account →')}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

const inputStyle = {
  width: '100%',
  padding: '0.9rem 1rem',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-color)',
  fontSize: '1rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s',
};

export default AuthPage;
