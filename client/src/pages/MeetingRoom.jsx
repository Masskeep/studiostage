import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Circle, MessageSquare, Send } from 'lucide-react';
import VideoParticipant from '../components/VideoParticipant';
import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:5000';

const MeetingRoom = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const userState = location.state || { name: 'Guest', micOn: true, camOn: true };
  
  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  
  const [micOn, setMicOn] = useState(userState.micOn);
  const [camOn, setCamOn] = useState(userState.camOn);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const socketRef = useRef();
  const userStreamRef = useRef();
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);
  const [peersStreams, setPeersStreams] = useState({});

  useEffect(() => {
    socketRef.current = io(SERVER_URL);

    navigator.mediaDevices.getUserMedia({
      video: userState.camOn,
      audio: userState.micOn
    }).then(stream => {
      userStreamRef.current = stream;
      
      socketRef.current.on('connect', () => {
        socketRef.current.emit('join-room', id, socketRef.current.id, userState.name);
      });

      socketRef.current.on('receive-message', (data) => {
        setMessages(prev => [...prev, data]);
      });

      // Simple implementation: Just logging users since full WebRTC is complex for single file MVP
      // In a real WebRTC app, setup peer connections here.
      console.log('Joined room', id);

    }).catch(err => {
      console.error('Failed to get local stream', err);
    });

    return () => {
      socketRef.current?.disconnect();
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [id, userState]);

  const toggleMic = () => {
    if (userStreamRef.current) {
      const audioTrack = userStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleCam = () => {
    if (userStreamRef.current) {
      const videoTrack = userStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !camOn;
        setCamOn(!camOn);
      }
    }
  };

  const handleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        userStreamRef.current = screenStream;
        setIsScreenSharing(true);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
        userStreamRef.current = stream;
        setIsScreenSharing(false);
      }
      // Re-render local video trigger
      setCamOn(prev => !prev);
      setTimeout(() => setCamOn(prev => !prev), 10);
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
      const options = { mimeType: 'video/webm; codecs=vp9' };
      mediaRecorderRef.current = new MediaRecorder(userStreamRef.current, options);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `StudioStage_Recording_\${new Date().toISOString()}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim() && socketRef.current) {
      socketRef.current.emit('send-message', chatInput, userState.name);
      setChatInput('');
    }
  };

  const leaveMeeting = () => {
    navigate('/');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)' }}>
      {/* Header */}
      <header className="container" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)' }}>
        <div className="header-logo">StudioStage</div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Design Critique: Q4 Roadmap</span>
          {isRecording && <span style={{ backgroundColor: '#FFEBEE', color: 'var(--error-color)', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--error-color)', animation: 'pulse 1.5s infinite' }}></div>REC</span>}
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '1rem', gap: '1rem' }}>
        
        {/* Videos Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          
          {/* Main Speaker View */}
          <div style={{ flex: 1, backgroundColor: 'var(--dark-bg)', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
             {/* We mock the speaker as local stream for visual purposes, in reality this would be dynamic */}
             <VideoParticipant stream={userStreamRef.current} isLocal={true} name={userState.name} />
          </div>
          
          {/* Controls Bar */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', padding: '1rem', backgroundColor: 'var(--primary-purple)', borderRadius: '24px', position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', width: 'fit-content' }}>
            <button onClick={toggleMic} style={{ backgroundColor: micOn ? 'white' : 'var(--error-color)', color: micOn ? 'var(--primary-purple)' : 'white', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {micOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button onClick={toggleCam} style={{ backgroundColor: camOn ? 'white' : 'var(--error-color)', color: camOn ? 'var(--primary-purple)' : 'white', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {camOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            
            <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.5rem' }}></div>
            
            <button onClick={handleScreenShare} style={{ backgroundColor: isScreenSharing ? 'white' : 'rgba(255,255,255,0.1)', color: isScreenSharing ? 'var(--primary-purple)' : 'white', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
              <MonitorUp size={24} />
            </button>
            <button onClick={handleRecord} style={{ backgroundColor: isRecording ? 'var(--error-color)' : 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Circle size={24} fill={isRecording ? 'white' : 'transparent'} />
            </button>
            <button onClick={() => setChatOpen(!chatOpen)} style={{ backgroundColor: chatOpen ? 'white' : 'rgba(255,255,255,0.1)', color: chatOpen ? 'var(--primary-purple)' : 'white', borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={24} />
            </button>
            
            <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.5rem' }}></div>
            
            <button onClick={leaveMeeting} className="btn-primary" style={{ backgroundColor: 'var(--error-color)', padding: '0 2rem', borderRadius: '25px', color: 'white' }}>
              <PhoneOff size={20} style={{ marginRight: '8px' }} />
              Leave Meeting
            </button>
          </div>
        </div>

        {/* Side Panel (Chat) */}
        {chatOpen && (
          <div style={{ width: '350px', backgroundColor: 'white', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1, textAlign: 'center', paddingBottom: '0.5rem', borderBottom: '2px solid var(--primary-purple)', color: 'var(--primary-purple)', fontWeight: 600, fontSize: '0.9rem' }}>CHAT</div>
              <div style={{ flex: 1, textAlign: 'center', paddingBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>PARTICIPANTS (1)</div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.senderName === userState.name ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                     <span>{msg.senderName}</span>
                     <span>{msg.time}</span>
                   </div>
                   <div style={{ 
                     backgroundColor: msg.senderName === userState.name ? 'var(--primary-purple)' : 'var(--card-purple-light)', 
                     color: msg.senderName === userState.name ? 'white' : 'var(--text-primary)',
                     padding: '0.8rem',
                     borderRadius: '12px',
                     borderBottomRightRadius: msg.senderName === userState.name ? 0 : '12px',
                     borderBottomLeftRadius: msg.senderName === userState.name ? '12px' : 0,
                     fontSize: '0.9rem'
                   }}>
                     {msg.message}
                   </div>
                </div>
              ))}
            </div>
            
            <form onSubmit={sendMessage} style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem' }}>
              <input 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message..." 
                style={{ flex: 1, padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}
              />
              <button type="submit" style={{ backgroundColor: 'transparent', color: 'var(--primary-purple)' }}>
                <Send size={24} />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default MeetingRoom;
