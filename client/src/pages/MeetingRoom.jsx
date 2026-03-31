import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Circle,
  MessageSquare, Send, Link, Check, Users, LayoutGrid, Maximize2
} from 'lucide-react';
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

  /* ── Chat State ── */
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  /* ── Media State ── */
  const [micOn, setMicOn] = useState(userState.micOn);
  const [camOn, setCamOn] = useState(userState.camOn);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  /* ── Panel State ── */
  const [sidePanel, setSidePanel] = useState('chat'); // 'chat' | 'participants' | null
  const [panelOpen, setPanelOpen] = useState(true);

  /* ── Participants & Peers ── */
  const [participants, setParticipants] = useState([
    { id: 'me', name: userState.name, isLocal: true }
  ]);
  const [remotePeers, setRemotePeers] = useState({}); // { peerId: { stream, name } }

  /* ── Gallery/Pin State ── */
  const [pinnedUser, setPinnedUser] = useState(null); // null = gallery mode, 'me' or peerId = speaker mode

  /* ── Refs ── */
  const socketRef = useRef();
  const userStreamRef = useRef();
  const localVideoRef = useRef();
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);
  const recordingStartRef = useRef(null);
  const peersRef = useRef({});

  /* ── Cleanup function ── */
  const cleanupMedia = useCallback(() => {
    // Stop user stream
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(track => track.stop());
      userStreamRef.current = null;
    }
    // Stop any video element srcObject
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    // Close all peer connections
    Object.values(peersRef.current).forEach(peerObj => {
      if (peerObj.peerConnection) peerObj.peerConnection.close();
    });
    peersRef.current = {};
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.emit('leave-room');
      socketRef.current.disconnect();
    }
  }, []);

  /* ── WebRTC Peer Creation ── */
  const createPeer = (userToSignal, stream, isIncoming = false, offer = null) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', event.candidate, userToSignal);
      }
    };

    // Receive remote video/audio tracks
    peer.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        setRemotePeers(prev => ({
          ...prev,
          [userToSignal]: {
            stream: remoteStream,
            name: peersRef.current[userToSignal]?.name || 'Participant'
          }
        }));
      }
    };

    if (!isIncoming) {
      peer.onnegotiationneeded = async () => {
        try {
          const sdpOffer = await peer.createOffer();
          await peer.setLocalDescription(sdpOffer);
          socketRef.current.emit('offer', peer.localDescription, userToSignal);
        } catch (err) {
          console.error('Offer error:', err);
        }
      };
    } else {
      peer.setRemoteDescription(new RTCSessionDescription(offer)).then(async () => {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socketRef.current.emit('answer', answer, userToSignal);
      });
    }

    return peer;
  };

  /* ── Initialize Socket + Media ── */
  useEffect(() => {
    socketRef.current = io(SERVER_URL);

    // Always request BOTH audio and video, then mute/disable based on lobby state
    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    }).then(stream => {
      // Apply lobby preferences
      stream.getAudioTracks().forEach(t => { t.enabled = userState.micOn; });
      stream.getVideoTracks().forEach(t => { t.enabled = userState.camOn; });

      userStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socketRef.current.on('connect', () => {
        socketRef.current.emit('join-room', id, socketRef.current.id, userState.name);
      });

      // New user joined the room
      socketRef.current.on('user-connected', (userId, name) => {
        setParticipants(prev => {
          if (prev.find(p => p.id === userId)) return prev;
          return [...prev, { id: userId, name, isLocal: false }];
        });

        const peer = createPeer(userId, stream);
        peersRef.current[userId] = { peerConnection: peer, name };
      });

      // Received an offer from another peer
      socketRef.current.on('offer', async (offer, senderId, name) => {
        setParticipants(prev => {
          if (prev.find(p => p.id === senderId)) return prev;
          return [...prev, { id: senderId, name, isLocal: false }];
        });

        const peer = createPeer(senderId, stream, true, offer);
        peersRef.current[senderId] = { peerConnection: peer, name };
      });

      socketRef.current.on('answer', (answer, senderId) => {
        const peerObj = peersRef.current[senderId];
        if (peerObj?.peerConnection) {
          peerObj.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socketRef.current.on('ice-candidate', (candidate, senderId) => {
        const peerObj = peersRef.current[senderId];
        if (peerObj?.peerConnection) {
          peerObj.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socketRef.current.on('user-disconnected', userId => {
        setParticipants(prev => prev.filter(p => p.id !== userId));
        setPinnedUser(prev => prev === userId ? null : prev);

        if (peersRef.current[userId]) {
          peersRef.current[userId].peerConnection?.close();
          delete peersRef.current[userId];
          setRemotePeers(prev => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
        }
      });

      socketRef.current.on('receive-message', (data) => {
        setMessages(prev => [...prev, data]);
      });
    }).catch(err => {
      console.error('Failed to get local stream', err);
    });

    // beforeunload: stop camera even if user closes the tab
    const handleBeforeUnload = () => cleanupMedia();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupMedia();
    };
  }, [id]);

  /* ── Media Controls ── */
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
          handleScreenShare();
        };
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getAudioTracks().forEach(t => { t.enabled = micOn; });
        stream.getVideoTracks().forEach(t => { t.enabled = camOn; });
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
    cleanupMedia();
    navigate('/');
  };

  /* ── Gallery Grid Helper ── */
  const getGridStyle = (totalCount) => {
    if (totalCount <= 1) return { gridTemplateColumns: '1fr' };
    if (totalCount === 2) return { gridTemplateColumns: '1fr 1fr' };
    if (totalCount <= 4) return { gridTemplateColumns: '1fr 1fr' };
    if (totalCount <= 6) return { gridTemplateColumns: '1fr 1fr 1fr' };
    return { gridTemplateColumns: '1fr 1fr 1fr' };
  };

  /* ── Build list of all video tiles ── */
  const allTiles = [
    { id: 'me', name: userState.name, stream: userStreamRef.current, isLocal: true },
    ...Object.entries(remotePeers).map(([peerId, { stream, name }]) => ({
      id: peerId, name, stream, isLocal: false,
    })),
  ];

  const isPinMode = pinnedUser !== null;
  const pinnedTile = isPinMode ? allTiles.find(t => t.id === pinnedUser) : null;
  const unpinnedTiles = isPinMode ? allTiles.filter(t => t.id !== pinnedUser) : allTiles;

  /* ── Control Button ── */
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

  /* ── Toggle Side Panel ── */
  const togglePanel = (panel) => {
    if (sidePanel === panel && panelOpen) {
      setPanelOpen(false);
    } else {
      setSidePanel(panel);
      setPanelOpen(true);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0E0E14' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#18181f' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', color: 'white', cursor: 'pointer' }} onClick={leaveMeeting}>StudioStage</div>
          <div style={{ height: '20px', width: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Room: {id}</span>
          {isRecording && (
            <span style={{ backgroundColor: '#450a0a', color: '#f87171', padding: '0.2rem 0.65rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#f87171', display: 'inline-block', animation: 'pulse 1.2s infinite' }} /> REC
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'rgba(255,255,255,0.06)', padding: '0.35rem 0.8rem', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
            <Users size={15} /> {participants.length} Participant{participants.length !== 1 ? 's' : ''}
          </div>
          <button
            onClick={shareMeetingLink}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: linkCopied ? 'rgba(34,197,94,0.15)' : 'rgba(92,51,246,0.2)',
              color: linkCopied ? '#4ade80' : 'var(--primary-purple)',
              borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem',
              border: `1px solid ${linkCopied ? 'rgba(34,197,94,0.3)' : 'rgba(92,51,246,0.3)'}`,
              transition: 'all 0.2s'
            }}
          >
            {linkCopied ? <Check size={16} /> : <Link size={16} />}
            {linkCopied ? 'Copied!' : 'Share'}
          </button>
          <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: 'var(--primary-purple)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
            {(userState.name || 'G').charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '0.75rem', gap: '0.75rem' }}>

        {/* Video Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>

          {/* ── SPEAKER MODE (Pinned) ── */}
          {isPinMode && pinnedTile ? (
            <div style={{ flex: 1, display: 'flex', gap: '0.75rem', minHeight: 0 }}>
              {/* Main pinned video — 75% */}
              <div style={{ flex: 3, minHeight: 0 }}>
                <VideoParticipant
                  stream={pinnedTile.isLocal ? userStreamRef.current : pinnedTile.stream}
                  isLocal={pinnedTile.isLocal}
                  name={pinnedTile.name}
                  isPinned={true}
                  onPin={() => setPinnedUser(null)}
                />
              </div>
              {/* Sidebar strip — 25% */}
              {unpinnedTiles.length > 0 && (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  overflowY: 'auto',
                  minWidth: '160px',
                  maxWidth: '240px',
                }}>
                  {unpinnedTiles.map(tile => (
                    <div key={tile.id} style={{ height: '140px', flexShrink: 0 }}>
                      <VideoParticipant
                        stream={tile.isLocal ? userStreamRef.current : tile.stream}
                        isLocal={tile.isLocal}
                        name={tile.name}
                        isPinned={false}
                        onPin={() => setPinnedUser(tile.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── GALLERY MODE ── */
            <div style={{
              flex: 1,
              display: 'grid',
              ...getGridStyle(allTiles.length),
              gap: '0.5rem',
              minHeight: 0,
            }}>
              {allTiles.map(tile => (
                <div key={tile.id} style={{ minHeight: 0, minWidth: 0 }}>
                  <VideoParticipant
                    stream={tile.isLocal ? userStreamRef.current : tile.stream}
                    isLocal={tile.isLocal}
                    name={tile.name}
                    isPinned={false}
                    onPin={() => setPinnedUser(tile.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '0.75rem 2rem',
            backgroundColor: '#5C33F6',
            borderRadius: '20px',
            flexWrap: 'wrap',
          }}>
            {ctrlBtn(micOn, toggleMic, Mic, MicOff, micOn ? 'Mute' : 'Unmute')}
            {ctrlBtn(camOn, toggleCam, Video, VideoOff, camOn ? 'Stop Video' : 'Start Video')}

            <div style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />

            {ctrlBtn(!isScreenSharing, handleScreenShare, MonitorUp, MonitorUp, 'Share')}
            {ctrlBtn(!isRecording, handleRecord, Circle, Circle, 'Record')}

            <div style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />

            {/* View toggle */}
            {ctrlBtn(!isPinMode, () => setPinnedUser(isPinMode ? null : 'me'), LayoutGrid, Maximize2, isPinMode ? 'Gallery' : 'Speaker')}

            {ctrlBtn(panelOpen && sidePanel === 'chat', () => togglePanel('chat'), MessageSquare, MessageSquare, 'Chat')}
            {ctrlBtn(panelOpen && sidePanel === 'participants', () => togglePanel('participants'), Users, Users, 'People')}

            <div style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />

            <button
              onClick={leaveMeeting}
              style={{ backgroundColor: '#D32F2F', color: 'white', padding: '0.65rem 1.75rem', borderRadius: '25px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}
            >
              <PhoneOff size={18} /> Leave
            </button>
          </div>
        </div>

        {/* ── Side Panel ── */}
        {panelOpen && (
          <div style={{ width: '320px', backgroundColor: '#18181f', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            {/* Panel Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {[{ id: 'chat', label: 'CHAT' }, { id: 'participants', label: 'PEOPLE' }].map(tab => (
                <button key={tab.id} onClick={() => setSidePanel(tab.id)} style={{
                  flex: 1, textAlign: 'center', padding: '0.9rem', background: 'transparent',
                  borderBottom: `2px solid ${sidePanel === tab.id ? 'var(--primary-purple)' : 'transparent'}`,
                  color: sidePanel === tab.id ? 'var(--primary-purple)' : 'rgba(255,255,255,0.5)',
                  fontWeight: sidePanel === tab.id ? 700 : 500, fontSize: '0.78rem', letterSpacing: '0.05em',
                  transition: 'all 0.15s',
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Chat ── */}
            {sidePanel === 'chat' && (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', marginTop: '2rem' }}>
                      No messages yet. Say hello!
                    </div>
                  )}
                  {messages.map((msg, i) => {
                    const isMine = msg.senderName === userState.name;
                    return (
                      <div key={i} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '3px', textAlign: isMine ? 'right' : 'left' }}>
                          {isMine ? 'You' : msg.senderName} · {msg.time}
                        </div>
                        <div style={{
                          backgroundColor: isMine ? 'var(--primary-purple)' : 'rgba(255,255,255,0.08)',
                          color: 'white',
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

                <form onSubmit={sendMessage} style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    style={{
                      flex: 1, padding: '0.7rem 0.9rem', borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: 'white',
                      fontSize: '0.88rem', fontFamily: 'inherit',
                    }}
                  />
                  <button type="submit" style={{ backgroundColor: 'var(--primary-purple)', color: 'white', borderRadius: '10px', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Send size={16} />
                  </button>
                </form>
              </>
            )}

            {/* ── Participants Panel ── */}
            {sidePanel === 'participants' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {participants.length} Participant{participants.length !== 1 ? 's' : ''}
                </p>
                {participants.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 0.5rem',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{
                      width: 34, height: 34,
                      backgroundColor: 'var(--primary-purple)',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.85rem', flexShrink: 0
                    }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'white' }}>
                        {p.name} {p.isLocal ? '(You)' : ''}
                      </p>
                    </div>
                    {p.isLocal && (
                      <span style={{
                        backgroundColor: 'rgba(92,51,246,0.2)',
                        color: 'var(--primary-purple)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '1rem',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                      }}>HOST</span>
                    )}
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

export default MeetingRoom;
