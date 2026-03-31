import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Settings } from 'lucide-react';

const Lobby = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    let stream = null;
    const startPreview = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: camOn, 
          audio: micOn 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing media devices:', err);
      }
    };
    startPreview();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [camOn, micOn]); // Note: In a real app we would just toggle tracks instead of re-requesting in dev

  const handleJoin = () => {
    if (!name) return alert('Please enter your name');
    // Pass state via router state or context. We use router state here for simplicity.
    navigate(`/room/\${id}`, { 
      state: { name, micOn, camOn }
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="container header" style={{ padding: '1rem 2rem' }}>
        <div className="header-logo">StudioStage</div>
      </header>
      
      <main className="container" style={{ flex: 1, display: 'flex', paddingTop: '2rem', gap: '3rem' }}>
        <div style={{ flex: 2 }} className="animate-fade-in">
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Ready to join?</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Check your audio and video settings before stepping onto the stage.</p>
          
          <div style={{ 
            backgroundColor: 'var(--dark-panel)', 
            borderRadius: '16px', 
            overflow: 'hidden',
            position: 'relative',
            aspectRatio: '16/9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
            {/* Status indicator */}
            <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', background: 'rgba(0,0,0,0.6)', padding: '0.4rem 0.8rem', borderRadius: '4px', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: camOn ? 'var(--success-color)' : 'var(--error-color)' }} />
              CAMERA {camOn ? 'ON' : 'OFF'}
            </div>
            
            {/* Controls overlay */}
            <div style={{
               position: 'absolute',
               bottom: '2rem',
               background: 'rgba(92, 51, 246, 0.8)',
               backdropFilter: 'blur(10px)',
               padding: '0.75rem 1.5rem',
               borderRadius: '30px',
               display: 'flex',
               gap: '1rem'
            }}>
              <button onClick={() => setMicOn(!micOn)} style={{ background: micOn ? 'white' : '#FF4B4B', color: micOn ? 'black' : 'white', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button onClick={() => setCamOn(!camOn)} style={{ background: camOn ? 'white' : '#FF4B4B', color: camOn ? 'black' : 'white', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {camOn ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <button style={{ background: 'white', color: 'black', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Settings size={20} />
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Display Name</label>
              <input 
                type="text" 
                placeholder="Enter your name" 
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(0,0,0,0.03)',
                  fontSize: '1rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <button className="btn-secondary" style={{ marginTop: '1.5rem', padding: '1rem 1.5rem' }}>Join with Audio Only</button>
            <button className="btn-primary" onClick={handleJoin} style={{ marginTop: '1.5rem', padding: '1rem 2.5rem' }}>Join Now</button>
          </div>
        </div>
        
        <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', border: '1px solid var(--border-color)', height: 'fit-content' }}>
          <p style={{ color: 'var(--primary-purple)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>MEETING DETAILS</p>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Weekly Design Sync</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>StudioStage Sanctuary • ID: {id}</p>
          
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem' }}>In the Room (4)</h3>
              <span style={{ color: 'var(--primary-purple)' }}>👥</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                 <div style={{ width: '32px', height: '32px', backgroundColor: 'var(--card-purple-light)', color: 'var(--primary-purple)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>AR</div>
                 <div>
                   <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Alex Rivera</p>
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Host</p>
                 </div>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                 <div style={{ width: '32px', height: '32px', backgroundColor: 'var(--card-purple-light)', color: 'var(--primary-purple)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>JC</div>
                 <div>
                   <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Jordan Chen</p>
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Speaker</p>
                 </div>
               </div>
            </div>
          </div>
          
          <div style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', borderLeft: '4px solid #FF9800', padding: '1rem', borderRadius: '4px', marginTop: '2rem' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              💡 PRO TIP
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Ensure your microphone is 6 inches from your mouth for the best audio fidelity on the sanctuary stage.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Lobby;
