import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  const [streamObj, setStreamObj] = useState(null);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [showGuestChoice, setShowGuestChoice] = useState(!user);

  useEffect(() => {
    let mounted = true;

    const initLobby = async () => {
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
      } catch (err) {
        if (mounted) {
          setMeetingError('Error connecting to signaling server.');
          setIsValidating(false);
        }
        console.error('Validation error:', err);
        return;
      }

      // If valid, explicitly ask for media ONCE
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MediaDevices API not available. You must use HTTPS or localhost to access the camera.');
        }
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) {
          initialStream.getTracks().forEach(t => t.stop());
          return;
        }
        
        // Apply default micOn/camOn states visually
        initialStream.getAudioTracks().forEach(t => t.enabled = micOn);
        initialStream.getVideoTracks().forEach(t => t.enabled = camOn);
        
        streamRef.current = initialStream;
        setStreamObj(initialStream);
        if (videoRef.current) videoRef.current.srcObject = initialStream;
      } catch (mediaErr) {
        console.error('Media error:', mediaErr);
        if (mounted) {
          // Instead of a blocking alert, show a retry button in the UI
          setCameraBlocked({ name: mediaErr.name, message: mediaErr.message });
          setCamOn(false);
          setMicOn(false);
        }
      }
    };

    initLobby();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [id]); // Only run once per meeting ID

  // Toggle tracks without recreating the entire MediaStream (which crashes mobile browsers)
  useEffect(() => {
    if (streamObj) {
      streamObj.getAudioTracks().forEach(t => t.enabled = micOn);
      streamObj.getVideoTracks().forEach(t => t.enabled = camOn);
    }
  }, [micOn, camOn, streamObj]);

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

  const requestMediaAccess = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not available. You must use HTTPS or localhost to access the camera.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      stream.getAudioTracks().forEach(t => t.enabled = true);
      stream.getVideoTracks().forEach(t => t.enabled = true);
      
      streamRef.current = stream;
      setStreamObj(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      setCameraBlocked(false);
      setCamOn(true);
      setMicOn(true);
    } catch (err) {
      alert(`Camera blocked by Chrome (${err.name}: ${err.message}). Are you on HTTP or HTTPS? Have you checked Chrome app permissions?`);
    }
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
            <button className="btn-primary" onClick={() => navigate(user ? '/meetings' : '/')} style={{ width: '100%' }}>
              Return Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (showGuestChoice) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)' }}>
        <Navbar />
        <main className="container" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            backgroundColor: 'var(--card-bg)', padding: '3rem', borderRadius: '24px',
            border: '1px solid var(--border-color)', textAlign: 'center', maxWidth: '440px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.08)', animation: 'fadeIn 0.5s ease'
          }}>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>Join Meeting</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
              You are not logged in. How would you like to join this meeting?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                onClick={() => navigate('/auth', { state: { returnTo: `/room/${id}/lobby` } })}
                className="btn-primary" style={{ padding: '1.1rem', fontSize: '1rem' }}>
                Log In or Sign Up
              </button>
              <button
                onClick={() => setShowGuestChoice(false)}
                className="btn-secondary" style={{ padding: '1.1rem', fontSize: '1rem' }}>
                Join as Guest Directly
              </button>
            </div>
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

            {cameraBlocked && (
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'rgba(0,0,0,0.8)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10
              }}>
                <p style={{ color: 'white', marginBottom: '1rem', textAlign: 'center', padding: '0 1rem', fontSize: '0.9rem' }}>
                  Your phone blocked camera access.<br/>
                  <span style={{ color: '#F44336', fontSize: '0.8rem', marginTop: '0.5rem', display: 'block' }}>
                    Error: {cameraBlocked.name}
                  </span>
                </p>
                <button onClick={requestMediaAccess} className="btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
                  Retry Permissions
                </button>
              </div>
            )}

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
