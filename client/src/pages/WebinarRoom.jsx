import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp,
  Circle, MessageSquare, Users, Send, Hand, Check, Link,
  ShieldCheck, AlertCircle, ChevronDown
} from 'lucide-react';
import io from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

/* ─── Role badge ─── */
const RoleBadge = ({ role }) => {
  const map = {
    host:     { label: 'HOST',     bg: '#7C3AED', color: 'white' },
    panelist: { label: 'PANELIST', bg: '#0EA5E9', color: 'white' },
    attendee: { label: 'ATTENDEE', bg: '#e5e7eb', color: '#374151' },
  };
  const s = map[role] || map.attendee;
  return (
    <span style={{ backgroundColor: s.bg, color: s.color, padding: '0.15rem 0.6rem', borderRadius: '1rem', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em' }}>
      {s.label}
    </span>
  );
};

/* ─── Q&A Item ─── */
const QAItem = ({ q, isHost, onAnswer }) => {
  const [ans, setAns] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <div style={{ backgroundColor: 'var(--bg-color)', borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px' }}>{q.name}</p>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{q.question}</p>
          {q.answer && (
            <p style={{ fontSize: '0.83rem', color: 'var(--primary-purple)', marginTop: '6px', borderLeft: '2px solid var(--primary-purple)', paddingLeft: '8px' }}>
              {q.answer}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, alignItems: 'center' }}>
          {!q.answer && isHost && (
            <button onClick={() => setOpen(!open)} style={{ background: 'var(--primary-purple)', color: 'white', borderRadius: '6px', padding: '0.25rem 0.7rem', fontSize: '0.75rem', fontWeight: 600 }}>
              Answer
            </button>
          )}
          {q.upvotes > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>▲ {q.upvotes}</span>
          )}
        </div>
      </div>
      {open && isHost && !q.answer && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input value={ans} onChange={e => setAns(e.target.value)} placeholder="Type your answer…" style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }} />
          <button onClick={() => { onAnswer(q.id, ans); setOpen(false); }} style={{ background: 'var(--primary-purple)', color: 'white', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, fontSize: '0.85rem' }}>Reply</button>
        </div>
      )}
    </div>
  );
};

/* ─── Main WebinarRoom ─── */
const WebinarRoom = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const state = location.state || {};
  const role = state.role || 'attendee'; // 'host' | 'panelist' | 'attendee'
  const displayName = state.name || user?.name || 'Guest';
  const isHost = role === 'host';
  const canSpeak = role === 'host' || role === 'panelist';

  /* ── Media State ── */
  const [micOn, setMicOn] = useState(canSpeak);
  const [camOn, setCamOn] = useState(canSpeak);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  /* ── Panel State ── */
  const [activePanel, setActivePanel] = useState('qa'); // 'qa' | 'chat' | 'participants'
  const [panelOpen, setPanelOpen] = useState(true);

  /* ── Chat ── */
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  /* ── Q&A ── */
  const [questions, setQuestions] = useState([
    { id: 1, name: 'Priya M.', question: 'Will this feature be available on mobile?', answer: '', upvotes: 5 },
    { id: 2, name: 'Rahul S.', question: 'How does the recording work?', answer: '', upvotes: 2 },
  ]);
  const [qaInput, setQaInput] = useState('');

  /* ── Participants ── */
  const [participants, setParticipants] = useState([
    { id: 'me', name: displayName, role, handRaised: false },
  ]);
  const [handRaised, setHandRaised] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(1);

  /* ── Socket & Media refs ── */
  const socketRef = useRef();
  const localVideoRef = useRef();
  const userStreamRef = useRef();
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);
  const recordingStartRef = useRef(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedTime(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  // Start media + socket
  useEffect(() => {
    socketRef.current = io(SERVER_URL);

    const initMedia = async () => {
      if (!canSpeak) return; // Attendees get no media
      try {
        // Always request BOTH audio and video, then control via track.enabled
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getAudioTracks().forEach(t => { t.enabled = micOn; });
        stream.getVideoTracks().forEach(t => { t.enabled = camOn; });
        userStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Media error:', err);
      }
    };

    initMedia();

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-room', id, socketRef.current.id, displayName);
    });

    socketRef.current.on('receive-message', (data) => {
      setChatMessages(prev => [...prev, data]);
    });

    socketRef.current.on('user-connected', (userId, name) => {
      setAttendeeCount(c => c + 1);
      setParticipants(prev => [...prev, { id: userId, name, role: 'attendee', handRaised: false }]);
    });

    socketRef.current.on('user-disconnected', (userId) => {
      setAttendeeCount(c => Math.max(1, c - 1));
      setParticipants(prev => prev.filter(p => p.id !== userId));
    });

    // Cleanup on tab close
    const handleBeforeUnload = () => {
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(t => t.stop());
        userStreamRef.current = null;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      socketRef.current?.disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socketRef.current?.disconnect();
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(t => t.stop());
        userStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    };
  }, [id, canSpeak, displayName]);

  /* ── Controls ── */
  const toggleMic = () => {
    if (userStreamRef.current) {
      const track = userStreamRef.current.getAudioTracks()[0];
      if (track) { track.enabled = !micOn; setMicOn(!micOn); }
    }
  };

  const toggleCam = () => {
    if (userStreamRef.current) {
      const track = userStreamRef.current.getVideoTracks()[0];
      if (track) { track.enabled = !camOn; setCamOn(!camOn); }
    }
  };

  const handleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        userStreamRef.current = s;
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
        s.getVideoTracks()[0].onended = () => handleScreenShare();
        setIsScreenSharing(true);
      } else {
        const s = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
        userStreamRef.current = s;
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
        setIsScreenSharing(false);
      }
    } catch (e) { console.error(e); }
  };

  const handleRecord = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!userStreamRef.current) return;
      recordedChunksRef.current = [];
      recordingStartRef.current = Date.now();
      const mr = new MediaRecorder(userStreamRef.current, { mimeType: 'video/webm' });
      mr.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const durationMs = Date.now() - (recordingStartRef.current || Date.now());
        const filename = `StudioStage_Webinar_${id}_${new Date().toISOString().replace(/:/g, '-')}.webm`;

        // Save metadata to localStorage
        const existing = JSON.parse(localStorage.getItem('ss_recordings') || '[]');
        existing.unshift({
          id: `rec_${Date.now()}`,
          meetingId: id,
          type: 'webinar',
          title: `Webinar — ${id}`,
          recordedAt: new Date().toISOString(),
          durationMs,
          sizeBytes: blob.size,
          filename,
        });
        localStorage.setItem('ss_recordings', JSON.stringify(existing));

        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename, style: 'display:none' });
        document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    }
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim() && socketRef.current) {
      socketRef.current.emit('send-message', chatInput, displayName);
      setChatInput('');
    }
  };

  const submitQuestion = (e) => {
    e.preventDefault();
    if (!qaInput.trim()) return;
    setQuestions(prev => [...prev, { id: Date.now(), name: displayName, question: qaInput, answer: '', upvotes: 0 }]);
    setQaInput('');
  };

  const answerQuestion = (qid, answer) => {
    setQuestions(prev => prev.map(q => q.id === qid ? { ...q, answer } : q));
  };

  const toggleHand = () => {
    setHandRaised(!handRaised);
    // In a real app we'd emit this via socket
  };

  const shareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/webinar/${id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const endWebinar = () => {
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(t => t.stop());
      userStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    socketRef.current?.disconnect();
    navigate('/webinars');
  };

  /* ── Render helper: control button ── */
  const CtrlBtn = ({ active, onClick, ActiveIcon, InactiveIcon, label, danger }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
      <button onClick={onClick} title={label} style={{
        backgroundColor: danger ? (active ? '#D32F2F' : 'rgba(255,255,255,0.12)') : (active ? 'white' : 'rgba(255,255,255,0.12)'),
        color: danger ? 'white' : (active ? 'var(--primary-purple)' : 'white'),
        borderRadius: '50%', width: 48, height: 48,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.15s',
      }}>
        {active && InactiveIcon ? <InactiveIcon size={20} /> : <ActiveIcon size={20} />}
      </button>
      {label && <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>}
    </div>
  );

  /* ── Panel header tabs ── */
  const Tab = ({ id: tid, label }) => (
    <button onClick={() => setActivePanel(tid)} style={{
      flex: 1, padding: '0.9rem 0.5rem', borderBottom: `2px solid ${activePanel === tid ? 'var(--primary-purple)' : 'transparent'}`,
      color: activePanel === tid ? 'var(--primary-purple)' : 'var(--text-secondary)',
      fontWeight: activePanel === tid ? 700 : 500, background: 'transparent',
      fontSize: '0.75rem', letterSpacing: '0.05em', transition: 'all 0.15s',
    }}>{label}</button>
  );

  /* ─────────────── JSX ─────────────── */
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0E0E14' }}>

      {/* ── Top Bar ── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.5rem', backgroundColor: '#18181f', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', color: 'white', cursor: 'pointer' }} onClick={endWebinar}>
            StudioStage
          </div>
          <div style={{ height: 18, width: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Webinar · {id}</span>
          <RoleBadge role={role} />
          {isRecording && (
            <span style={{ backgroundColor: '#450a0a', color: '#f87171', padding: '0.2rem 0.65rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#f87171', display: 'inline-block' }} /> REC
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Live Duration */}
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(elapsedTime)}
          </span>
          {/* Attendees */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'rgba(255,255,255,0.06)', padding: '0.35rem 0.8rem', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
            <Users size={15} /> {attendeeCount} Attending
          </div>
          {/* Share */}
          <button onClick={shareLink} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            backgroundColor: linkCopied ? 'rgba(34,197,94,0.15)' : 'rgba(92,51,246,0.2)',
            color: linkCopied ? '#4ade80' : 'var(--primary-purple)',
            border: `1px solid ${linkCopied ? 'rgba(34,197,94,0.3)' : 'rgba(92,51,246,0.3)'}`,
            borderRadius: '8px', padding: '0.4rem 1rem', fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.2s',
          }}>
            {linkCopied ? <Check size={14} /> : <Link size={14} />}
            {linkCopied ? 'Copied!' : 'Share Webinar'}
          </button>
          <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: 'var(--primary-purple)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '1rem', gap: '1rem' }}>

        {/* Stage (video) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>

          {/* Main Stage */}
          <div style={{ flex: 1, backgroundColor: '#0E0E14', borderRadius: '16px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            {canSpeak ? (
              <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isScreenSharing ? 'none' : 'scaleX(-1)' }} />
            ) : (
              // Attendee view — placeholder stage
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
                <Radio size={64} style={{ marginBottom: '1rem', color: 'var(--primary-purple)', opacity: 0.6 }} />
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'rgba(255,255,255,0.6)' }}>Webinar is Live</p>
                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Waiting for host video…</p>
              </div>
            )}

            {/* Stage overlays */}
            {canSpeak && (
              <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', padding: '0.3rem 0.75rem', borderRadius: '6px', color: 'white', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {displayName} <RoleBadge role={role} />
                {isScreenSharing && <span style={{ backgroundColor: 'var(--primary-purple)', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem' }}>SHARING</span>}
              </div>
            )}

            {/* LIVE badge */}
            <div style={{ position: 'absolute', top: '1rem', left: '1rem', backgroundColor: '#D32F2F', color: 'white', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--card-bg)', display: 'inline-block' }} /> LIVE
            </div>
          </div>

          {/* ── Controls Bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '0.75rem 2rem', backgroundColor: '#5C33F6', borderRadius: '18px', flexWrap: 'wrap' }}>
            {canSpeak && (
              <>
                <CtrlBtn active={!micOn} onClick={toggleMic} ActiveIcon={Mic} InactiveIcon={MicOff} label={micOn ? 'Mute' : 'Unmute'} />
                <CtrlBtn active={!camOn} onClick={toggleCam} ActiveIcon={Video} InactiveIcon={VideoOff} label={camOn ? 'Stop Cam' : 'Start Cam'} />
                <div style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />
                <CtrlBtn active={isScreenSharing} onClick={handleScreenShare} ActiveIcon={MonitorUp} label="Share" />
                <CtrlBtn active={isRecording} onClick={handleRecord} ActiveIcon={Circle} danger={isRecording} label={isRecording ? 'Stop' : 'Record'} />
              </>
            )}

            {/* Attendee: Hand Raise */}
            {!canSpeak && (
              <CtrlBtn
                active={handRaised}
                onClick={toggleHand}
                ActiveIcon={Hand}
                label={handRaised ? 'Lower Hand' : 'Raise Hand'}
              />
            )}

            <CtrlBtn active={panelOpen && activePanel === 'qa'} onClick={() => { setActivePanel('qa'); setPanelOpen(true); }} ActiveIcon={MessageSquare} label="Q&A" />
            <CtrlBtn active={panelOpen && activePanel === 'chat'} onClick={() => { setActivePanel('chat'); setPanelOpen(true); }} ActiveIcon={MessageSquare} label="Chat" />
            <CtrlBtn active={panelOpen && activePanel === 'participants'} onClick={() => { setActivePanel('participants'); setPanelOpen(true); }} ActiveIcon={Users} label="People" />

            <div style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />

            <button onClick={endWebinar} style={{ backgroundColor: '#D32F2F', color: 'white', padding: '0.6rem 1.75rem', borderRadius: '22px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <PhoneOff size={17} /> {isHost ? 'End Webinar' : 'Leave'}
            </button>
          </div>
        </div>

        {/* ── Side Panel ── */}
        {panelOpen && (
          <div style={{ width: '340px', backgroundColor: 'var(--card-bg)', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)', flexShrink: 0 }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
              <Tab id="qa" label="Q & A" />
              <Tab id="chat" label="CHAT" />
              <Tab id="participants" label="PEOPLE" />
            </div>

            {/* ── Q&A Panel ── */}
            {activePanel === 'qa' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                  {questions.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '2rem' }}>No questions yet.</p>}
                  {questions.map(q => (
                    <QAItem key={q.id} q={q} isHost={isHost} onAnswer={answerQuestion} />
                  ))}
                </div>
                <form onSubmit={submitQuestion} style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem' }}>
                  <input
                    value={qaInput} onChange={e => setQaInput(e.target.value)}
                    placeholder="Ask a question…"
                    style={{ flex: 1, padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.88rem', fontFamily: 'inherit' }}
                  />
                  <button type="submit" style={{ backgroundColor: 'var(--primary-purple)', color: 'white', borderRadius: '10px', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}

            {/* ── Chat Panel ── */}
            {activePanel === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {chatMessages.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '2rem' }}>Chat is quiet — say something!</p>}
                  {chatMessages.map((m, i) => {
                    const mine = m.senderName === displayName;
                    return (
                      <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '2px', textAlign: mine ? 'right' : 'left' }}>{mine ? 'You' : m.senderName} · {m.time}</div>
                        <div style={{ backgroundColor: mine ? 'var(--primary-purple)' : 'var(--bg-color)', color: mine ? 'white' : 'var(--text-primary)', padding: '0.65rem 0.9rem', borderRadius: '12px', borderBottomRightRadius: mine ? 2 : 12, borderBottomLeftRadius: mine ? 12 : 2, fontSize: '0.88rem' }}>
                          {m.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={sendChat} style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem' }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message audience…" style={{ flex: 1, padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.88rem', fontFamily: 'inherit' }} />
                  <button type="submit" style={{ backgroundColor: 'var(--primary-purple)', color: 'white', borderRadius: '10px', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}

            {/* ── Participants Panel ── */}
            {activePanel === 'participants' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {attendeeCount} Participant{attendeeCount !== 1 ? 's' : ''}
                </p>
                {participants.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ width: 34, height: 34, backgroundColor: 'var(--card-purple-light)', color: 'var(--primary-purple)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>{p.name} {p.id === 'me' ? '(You)' : ''}</p>
                    </div>
                    <RoleBadge role={p.role} />
                    {p.handRaised && <Hand size={14} style={{ color: '#F59E0B' }} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default WebinarRoom;
