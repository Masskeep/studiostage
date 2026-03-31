import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Settings } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

const Lobby = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isValidating, setIsValidating] = useState(true);
  const [meetingError, setMeetingError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const validateAndStart = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/meetings/${id}`);
        if (!res.ok) {
          if (mounted) {
            setMeetingError('This meeting does not exist or has expired.');
            setIsValidating(false);
          }
          return;
        }

        if (mounted) setIsValidating(false);

        // Stop any existing tracks first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camOn,
          audio: micOn
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (mounted) {
          setMeetingError('Error connecting to server.');
          setIsValidating(false);
        }
        console.error('Validation or media error:', err);
      }
    };

    validateAndStart();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [camOn, micOn]);

  const handleJoin = () => {
    if (!name.trim()) return alert('Please enter your display name');
    
    // Explicitly release camera before unmounting/navigating
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    navigate(`/room/${id}`, { state: { name: name.trim(), micOn, camOn } });
  };

  if (isValidating) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)' }}>
        <Navbar />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Validating meeting link...</p>
        </main>
      </div>
    );
  }

  if (meetingError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)' }}>
        <Navbar />
        <main className="container" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '3rem', borderRadius: '20px', border: '1px solid var(--border-color)', textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ width: 64, height: 64, backgroundColor: 'rgba(211,47,47,0.1)', color: '#D32F2F', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <Settings size={32} /> {/* Using settings as generic icon here, could be X icon */}
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Meeting Not Found</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{meetingError}</p>
            <button className="btn-primary" onClick={() => navigate('/dashboard')} style={{ width: '100%' }}>
              Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main className="container" style={{ flex: 1, display: 'flex', paddingTop: '2rem', gap: '3rem', paddingBottom: '3rem' }}>
        {/* Left: Camera Preview */}
        <div style={{ flex: 2 }} className="animate-fade-in">
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Ready to join?</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Check your audio and video settings before stepping onto the stage.
          </p>

          {/* Camera Preview */}
          <div style={{
            backgroundColor: 'var(--dark-panel)',
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative',
            aspectRatio: '16/9',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />

            {/* Camera status badge */}
            <div style={{
              position: 'absolute', top: '1rem', left: '1rem',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              color: 'white',
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.75rem', fontWeight: 600
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: camOn ? '#4CAF50' : '#F44336' }} />
              CAMERA {camOn ? 'ON' : 'OFF'}
            </div>

            {/* Controls overlay */}
            <div style={{
              position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(92,51,246,0.85)',
              backdropFilter: 'blur(10px)',
              padding: '0.6rem 1.2rem',
              borderRadius: '30px',
              display: 'flex', gap: '0.75rem'
            }}>
              {[
                { on: micOn, toggle: () => setMicOn(!micOn), On: Mic, Off: MicOff },
                { on: camOn, toggle: () => setCamOn(!camOn), On: Video, Off: VideoOff },
              ].map(({ on, toggle, On, Off }, i) => (
                <button
                  key={i}
                  onClick={toggle}
                  style={{
                    background: on ? 'white' : '#FF4444',
                    color: on ? 'var(--primary-purple)' : 'white',
                    borderRadius: '50%', width: 44, height: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  {on ? <On size={20} /> : <Off size={20} />}
                </button>
              ))}
              <button style={{ background: 'white', color: 'var(--primary-purple)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Settings size={20} />
              </button>
            </div>
          </div>

          {/* Name + Join */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Display Name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '0.9rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', fontSize: '1rem', fontFamily: 'inherit' }}
              />
            </div>
            <button className="btn-secondary" style={{ padding: '0.9rem 1.5rem', whiteSpace: 'nowrap' }}>Audio Only</button>
            <button className="btn-primary" onClick={handleJoin} style={{ padding: '0.9rem 2rem', whiteSpace: 'nowrap' }}>Join Now</button>
          </div>
        </div>

        {/* Right: Meeting Details */}
        <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '2rem', border: '1px solid var(--border-color)', height: 'fit-content', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <p style={{ color: 'var(--primary-purple)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.5rem' }}>MEETING DETAILS</p>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Meeting Room</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '2rem' }}>
            StudioStage Sanctuary • ID: <strong>{id}</strong>
          </p>

          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.75rem' }}>ROOM INFO</p>
            <p style={{ fontSize: '0.9rem', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
              Share the URL to invite participants to this room.
            </p>
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href.replace('/lobby', '/lobby'))}
              className="btn-secondary"
              style={{ marginTop: '1rem', width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
            >
              Copy Invite Link
            </button>
          </div>

          <div style={{
            backgroundColor: 'rgba(255,152,0,0.08)',
            borderLeft: '3px solid #FF9800',
            padding: '1rem',
            borderRadius: '6px',
          }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', color: '#E65100' }}>PRO TIP</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Ensure your microphone is 6 inches from your mouth for the best audio fidelity on the sanctuary stage.
            </p>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <span>🔒</span> END-TO-END ENCRYPTED
          </div>
        </div>
      </main>
    </div>
  );
};

export default Lobby;
