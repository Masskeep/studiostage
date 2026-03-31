import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Circle, MessageSquare, Send, Link, Check } from 'lucide-react';
import VideoParticipant from '../components/VideoParticipant';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

const MeetingRoom = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userState = location.state || { name: user?.name || 'Guest', micOn: true, camOn: true };

  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [micOn, setMicOn] = useState(userState.micOn);
  const [camOn, setCamOn] = useState(userState.camOn);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const socketRef = useRef();
  const userStreamRef = useRef();
  const localVideoRef = useRef();
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);
  const recordingStartRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SERVER_URL);

    navigator.mediaDevices.getUserMedia({
      video: userState.camOn,
      audio: userState.micOn
    }).then(stream => {
      userStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socketRef.current.on('connect', () => {
        socketRef.current.emit('join-room', id, socketRef.current.id, userState.name);
      });

      socketRef.current.on('receive-message', (data) => {
        setMessages(prev => [...prev, data]);
      });
    }).catch(err => {
      console.error('Failed to get local stream', err);
    });

    return () => {
      socketRef.current?.disconnect();
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
        userStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    };
  }, [id]);

  const toggleMic = () => {
    if (userStreamRef.current) {
      const audioTrack = userStreamRef.current.getAudioTracks()[0];
      if (audioTrack) { audioTrack.enabled = !micOn; setMicOn(!micOn); }
    }
  };

  const toggleCam = () => {
    if (userStreamRef.current) {
      const videoTrack = userStreamRef.current.getVideoTracks()[0];
      if (videoTrack) { videoTrack.enabled = !camOn; setCamOn(!camOn); }
    }
  };

  const handleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        userStreamRef.current = screenStream;
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        setIsScreenSharing(true);
        screenStream.getVideoTracks()[0].onended = () => {
          // User stopped sharing via browser UI
          handleScreenShare();
        };
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
        userStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setIsScreenSharing(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecord = () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      if (!userStreamRef.current) return;
      recordedChunksRef.current = [];
      recordingStartRef.current = Date.now();
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
        mimeType = 'video/webm; codecs=vp9';
      }
      mediaRecorderRef.current = new MediaRecorder(userStreamRef.current, { mimeType });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const durationMs = Date.now() - (recordingStartRef.current || Date.now());
        const filename = `StudioStage_${id}_${new Date().toISOString().replace(/:/g, '-')}.webm`;

        // Save metadata to localStorage
        const existing = JSON.parse(localStorage.getItem('ss_recordings') || '[]');
        existing.unshift({
          id: `rec_${Date.now()}`,
          meetingId: id,
          type: 'meeting',
          title: `Meeting — ${id}`,
          recordedAt: new Date().toISOString(),
          durationMs,
          sizeBytes: blob.size,
          filename,
        });
        localStorage.setItem('ss_recordings', JSON.stringify(existing));

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: filename, style: 'display:none' });
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  const shareMeetingLink = () => {
    const link = `${window.location.origin}/room/${id}/lobby`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim() && socketRef.current) {
      socketRef.current.emit('send-message', chatInput, userState.name);
      setChatInput('');
    }
  };

  const leaveMeeting = () => {
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(track => track.stop());
      userStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (socketRef.current) socketRef.current.emit('leave-room');
    navigate('/');
  };

  const ctrlBtn = (active, onClick, ActiveIcon, InactiveIcon, label) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={onClick}
        title={label}
        style={{
          backgroundColor: active ? 'white' : 'rgba(255,255,255,0.12)',
          color: active ? 'var(--primary-purple)' : 'white',
          borderRadius: '50%', width: 50, height: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s'
        }}
      >
        {active ? <ActiveIcon size={22} /> : (InactiveIcon ? <InactiveIcon size={22} /> : <ActiveIcon size={22} />)}
      </button>
      {label && <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{label}</span>}
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 2rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div className="header-logo" onClick={leaveMeeting} style={{ cursor: 'pointer' }}>StudioStage</div>
          <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border-color)' }} />
          <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Room: {id}</span>
          {isRecording && (
            <span style={{ backgroundColor: '#FFEBEE', color: '#C62828', padding: '0.2rem 0.65rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#C62828', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
              RECORDING
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Share Link Button */}
          <button
            onClick={shareMeetingLink}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              backgroundColor: linkCopied ? '#E8F5E9' : 'var(--card-purple-light)',
              color: linkCopied ? '#2E7D32' : 'var(--primary-purple)',
              borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem',
              border: `1px solid ${linkCopied ? '#A5D6A7' : 'rgba(92,51,246,0.2)'}`,
              transition: 'all 0.2s'
            }}
          >
            {linkCopied ? <Check size={16} /> : <Link size={16} />}
            {linkCopied ? 'Link Copied!' : 'Share Meeting'}
          </button>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--primary-purple)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
            {(userState.name || 'G').charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '1rem', gap: '1rem' }}>

        {/* Video Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', gap: '1rem' }}>

          {/* Main Video */}
          <div style={{ flex: 1, backgroundColor: 'var(--dark-bg)', borderRadius: '16px', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isScreenSharing ? 'none' : 'scaleX(-1)' }}
            />
            <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', backgroundColor: 'rgba(0,0,0,0.5)', padding: '0.3rem 0.7rem', borderRadius: '6px', color: 'white', fontSize: '0.85rem', fontWeight: 500 }}>
              {userState.name} (You)
              {isScreenSharing && <span style={{ marginLeft: '0.5rem', backgroundColor: 'var(--primary-purple)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}>SHARING</span>}
            </div>
          </div>

          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '0.75rem 2rem',
            backgroundColor: 'var(--primary-purple)',
            borderRadius: '20px',
            flexWrap: 'wrap',
          }}>
            {ctrlBtn(micOn, toggleMic, Mic, MicOff, micOn ? 'Mute' : 'Unmute')}
            {ctrlBtn(camOn, toggleCam, Video, VideoOff, camOn ? 'Stop Video' : 'Start Video')}

            <div style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />

            {ctrlBtn(!isScreenSharing, handleScreenShare, MonitorUp, MonitorUp, 'Share')}
            {ctrlBtn(!isRecording, handleRecord, Circle, Circle, 'Record')}
            {ctrlBtn(!chatOpen, () => setChatOpen(!chatOpen), MessageSquare, MessageSquare, 'Chat')}

            <div style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />

            <button
              onClick={leaveMeeting}
              style={{ backgroundColor: '#D32F2F', color: 'white', padding: '0.65rem 1.75rem', borderRadius: '25px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}
            >
              <PhoneOff size={18} /> Leave Meeting
            </button>
          </div>
        </div>

        {/* Chat Panel */}
        {chatOpen && (
          <div style={{ width: '340px', backgroundColor: 'var(--card-bg)', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            {/* Panel Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '1rem', borderBottom: '2px solid var(--primary-purple)', color: 'var(--primary-purple)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em' }}>CHAT</div>
              <div style={{ flex: 1, textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.05em' }}>PARTICIPANTS</div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '2rem' }}>
                  No messages yet. Say hello!
                </div>
              )}
              {messages.map((msg, i) => {
                const isMine = msg.senderName === userState.name;
                return (
                  <div key={i} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px', textAlign: isMine ? 'right' : 'left' }}>
                      {isMine ? 'You' : msg.senderName} · {msg.time}
                    </div>
                    <div style={{
                      backgroundColor: isMine ? 'var(--primary-purple)' : 'var(--bg-color)',
                      color: isMine ? 'white' : 'var(--text-primary)',
                      padding: '0.7rem 0.9rem',
                      borderRadius: '14px',
                      borderBottomRightRadius: isMine ? 2 : 14,
                      borderBottomLeftRadius: isMine ? 14 : 2,
                      fontSize: '0.9rem',
                      lineHeight: 1.45
                    }}>
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chat Input */}
            <form onSubmit={sendMessage} style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message..."
                style={{
                  flex: 1, padding: '0.75rem 1rem', borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-color)',
                  fontSize: '0.9rem', fontFamily: 'inherit'
                }}
              />
              <button type="submit" style={{ backgroundColor: 'var(--primary-purple)', color: 'white', borderRadius: '10px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default MeetingRoom;
