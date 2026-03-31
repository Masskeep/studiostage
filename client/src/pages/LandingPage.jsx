import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Video, MessageSquare } from 'lucide-react';
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
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}>
            A New Stepping Stone
          </span>
          <h1 style={{ fontSize: '5rem', marginTop: '1.25rem', marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>
            Elevate Your <br />
            <span className="text-gradient" style={{ fontStyle: 'italic' }}>Digital</span><br />
            <span className="text-gradient" style={{ fontStyle: 'italic' }}>Presence.</span>
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
          {/* Main User Image */}
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '24px',
            height: '460px',
            width: '90%',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 30px 60px rgba(0,0,0,0.15)',
          }}>
            {/* The user will drop hero-main.jpg into public folder */}
            <img 
              src="/hero-main.jpg" 
              alt="Professional Video Call" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=1000'; }}
            />

            {/* Floating controls pill (Bottom Left) */}
            <div style={{
              position: 'absolute', bottom: '1.5rem', left: '1.5rem',
              background: 'var(--primary-purple)',
              padding: '0.9rem 1.4rem',
              borderRadius: '30px',
              display: 'flex', gap: '1.25rem',
              color: 'white',
              boxShadow: '0 10px 30px rgba(92,51,246,0.4)',
              alignItems: 'center'
            }}>
              <Mic size={20} />
              <Video size={20} />
              <MessageSquare size={20} />
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
