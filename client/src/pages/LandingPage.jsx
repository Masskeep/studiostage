import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const startMeeting = async () => {
    setLoading(true);
    try {
      // In a real app we would call the backend:
      // const res = await fetch('http://localhost:5000/api/meetings/create', { method: 'POST' });
      // const data = await res.json();
      // But for a simple MVP flow, we can just generate a client-side random ID or use a mocked one
      const meetingId = Math.random().toString(36).substring(2, 9);
      navigate(`/room/\${meetingId}/lobby`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="container header">
        <div className="header-logo">StudioStage</div>
        <nav className="header-nav">
          <a href="#" className="nav-link active">Meetings</a>
          <a href="#" className="nav-link">Webinars</a>
          <a href="#" className="nav-link">Recordings</a>
        </nav>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <a href="#" className="nav-link">Sign In</a>
          <button className="btn-primary" onClick={startMeeting}>Join Meeting</button>
        </div>
      </header>

      <main className="container" style={{ flex: 1, display: 'flex', alignItems: 'center', marginTop: '4rem' }}>
        <div style={{ flex: 1, paddingRight: '2rem' }} className="animate-fade-in">
          <span style={{ backgroundColor: 'var(--card-purple-light)', color: 'var(--primary-purple)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
            NOW STREAMING IN 4K
          </span>
          <h1 style={{ fontSize: '5rem', marginTop: '1rem', marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>
            Elevate Your <br />
            <span className="text-gradient">Digital</span> <br />
            <span className="text-gradient">Presence.</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '2.5rem', maxWidth: '80%' }}>
            StudioStage transforms ordinary video calls into premium broadcast experiences. A digital sanctuary for professionals who value clarity, privacy, and aesthetic excellence.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn-primary" onClick={startMeeting} disabled={loading}>
              {loading ? 'Starting...' : 'Start Meeting →'}
            </button>
            <button className="btn-secondary">Schedule Webinar</button>
          </div>
        </div>
        
        <div style={{ flex: 1, position: 'relative' }} className="animate-fade-in">
          {/* Aesthetic hero image representation */}
          <div style={{ 
            background: 'linear-gradient(145deg, #1A1A1A 0%, #2A2A35 100%)', 
            borderRadius: '24px',
            height: '500px',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
             <div style={{
                position: 'absolute',
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                color: 'white', opacity: 0.5, fontSize: '1.5rem', fontFamily: 'var(--font-display)'
             }}>
                 [ Premium Video Placeholder ]
             </div>
             
             {/* Overlay card */}
             <div style={{
               position: 'absolute',
               bottom: '2rem', right: '2rem',
               background: 'rgba(255,255,255,0.1)',
               backdropFilter: 'blur(10px)',
               padding: '1rem 2rem',
               borderRadius: '16px',
               color: 'white',
               display: 'flex',
               gap: '1rem'
             }}>
               {/* Controls mockup */}
               <div style={{background: 'var(--primary-purple)', borderRadius: '50%', width: '40px', height: '40px'}} />
               <div style={{background: 'var(--primary-purple)', borderRadius: '50%', width: '40px', height: '40px'}} />
               <div style={{background: '#D32F2F', borderRadius: '50%', width: '40px', height: '40px'}} />
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
