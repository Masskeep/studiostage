import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleStartMeeting = () => {
    if (!user) {
      navigate('/auth');
    } else {
      navigate('/meetings');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main className="container" style={{ flex: 1, display: 'flex', alignItems: 'center', marginTop: '4rem' }}>
        <div style={{ flex: 1, paddingRight: '3rem' }} className="animate-fade-in">
          <span style={{
            backgroundColor: 'var(--card-purple-light)',
            color: 'var(--primary-purple)',
            padding: '0.35rem 0.9rem',
            borderRadius: '1rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.08em'
          }}>
            NOW STREAMING IN 4K
          </span>
          <h1 style={{ fontSize: '5rem', marginTop: '1.25rem', marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>
            Elevate Your <br />
            <span className="text-gradient">Digital</span><br />
            <span className="text-gradient">Presence.</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', marginBottom: '2.5rem', maxWidth: '520px', lineHeight: 1.7 }}>
            StudioStage transforms ordinary video calls into premium broadcast experiences. A digital sanctuary for professionals who value clarity, privacy, and aesthetic excellence.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn-primary" onClick={handleStartMeeting} style={{ padding: '0.9rem 2rem', fontSize: '1.05rem' }}>
              {user ? 'Go to Meetings →' : 'Get Started →'}
            </button>
            {!user && (
              <button className="btn-secondary" onClick={() => navigate('/auth')} style={{ padding: '0.9rem 2rem', fontSize: '1.05rem' }}>
                Sign In
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }} className="animate-fade-in">
          <div style={{
            background: 'linear-gradient(145deg, #1A1A24 0%, #2A2A3A 100%)',
            borderRadius: '24px',
            height: '500px',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 30px 60px rgba(92,51,246,0.15)',
          }}>
            {/* Animated gradient overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 30%, rgba(92,51,246,0.3) 0%, transparent 60%)' }} />

            <div style={{
              position: 'absolute',
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              color: 'rgba(255,255,255,0.3)', fontSize: '1rem',
              fontFamily: 'var(--font-display)', textAlign: 'center'
            }}>
              HD Video Preview
            </div>

            {/* Mock controls pill */}
            <div style={{
              position: 'absolute', bottom: '2rem', right: '2rem',
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              padding: '1rem 1.5rem',
              borderRadius: '16px',
              display: 'flex', gap: '0.75rem',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {['var(--primary-purple)', 'var(--primary-purple)', '#D32F2F'].map((bg, i) => (
                <div key={i} style={{ background: bg, borderRadius: '50%', width: '38px', height: '38px' }} />
              ))}
            </div>
          </div>

          {/* Feature chips */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            {['End-to-End Encrypted', 'HD Video', '4K Screen Share', 'Cloud Recording'].map(feat => (
              <span key={feat} style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '0.4rem 0.9rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 500,
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
              }}>{feat}</span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
