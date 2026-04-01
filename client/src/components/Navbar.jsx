import React, { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Sun, Moon, Menu, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="container header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
        <div className="header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          StudioStage
        </div>
        
        {user && (
          <nav className="header-nav desktop-only">
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

        <div className="desktop-only" style={{ gap: '1.5rem', alignItems: 'center' }}>
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

        {/* ── Mobile Hamburger Icon ── */}
        <button className="mobile-only" onClick={() => setIsMobileMenuOpen(true)} style={{ background: 'transparent', color: 'var(--text-primary)' }}>
          <Menu size={28} />
        </button>
      </div>

      {/* ── Mobile Menu Overlay ── */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div className="header-logo" onClick={() => { navigate('/'); closeMenu(); }} style={{ cursor: 'pointer' }}>
              StudioStage
            </div>
            <button onClick={closeMenu} style={{ background: 'transparent', color: 'var(--text-primary)' }}>
              <X size={28} />
            </button>
          </div>

          {user && (
            <nav className="mobile-menu-nav">
              <NavLink to="/meetings" onClick={closeMenu} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                Meetings
              </NavLink>
              <NavLink to="/webinars" onClick={closeMenu} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                Webinars
              </NavLink>
              <NavLink to="/recordings" onClick={closeMenu} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                Recordings
              </NavLink>
            </nav>
          )}

          <div className="mobile-menu-actions">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Theme</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sun size={15} style={{ color: isDark ? 'var(--text-secondary)' : 'var(--primary-purple)' }} />
                <button className="theme-toggle" onClick={toggleTheme}>
                  <div className="theme-toggle-thumb" />
                </button>
                <Moon size={15} style={{ color: isDark ? 'var(--primary-purple)' : 'var(--text-secondary)' }} />
              </div>
            </div>

            {user ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '40px', height: '40px', backgroundColor: 'var(--primary-purple)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: '1rem'
                  }}>
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user.name}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user.email || 'Pro Member'}</p>
                  </div>
                </div>
                <button className="btn-primary" onClick={() => { navigate('/meetings'); closeMenu(); }} style={{ padding: '1rem', fontSize: '1.1rem' }}>
                  Start Meeting
                </button>
                <button onClick={handleLogout} className="btn-secondary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1rem', marginTop: '0.5rem', fontSize: '1rem' }}>
                  <LogOut size={20} /> Sign Out
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={() => { navigate('/auth'); closeMenu(); }} style={{ padding: '1rem', marginTop: '1rem', fontSize: '1.1rem' }}>
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
