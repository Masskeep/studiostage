import React from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Settings, Sun, Moon } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="container header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
        <div className="header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          StudioStage
        </div>
        
        {user && (
          <nav className="header-nav">
            <NavLink to="/meetings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Meetings
            </NavLink>
            <NavLink to="/webinars" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Webinars
            </NavLink>
            <NavLink to="/recordings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Recordings
            </NavLink>
          </nav>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        {user && (
          <button style={{ background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <Settings size={20} />
          </button>
        )}

        {/* ── Dark/Light Toggle (Always Visible) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sun size={15} style={{ color: isDark ? 'var(--text-secondary)' : 'var(--primary-purple)', flexShrink: 0 }} />
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            <div className="theme-toggle-thumb" />
          </button>
          <Moon size={15} style={{ color: isDark ? 'var(--primary-purple)' : 'var(--text-secondary)', flexShrink: 0 }} />
        </div>

        {user && (
          <>
            {/* User Avatar */}
            <div style={{
              width: '36px',
              height: '36px',
              backgroundColor: 'var(--primary-purple)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              flexShrink: 0,
            }}>
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
            >
              <LogOut size={16} /> Sign Out
            </button>
            <button className="btn-primary" onClick={() => navigate('/meetings')}>
              Start Meeting
            </button>
          </>
        )}
        
        {!user && (
          <button className="btn-primary" onClick={() => navigate('/auth')} style={{ padding: '0.6rem 1.4rem', fontSize: '0.9rem', marginLeft: '0.5rem' }}>
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
