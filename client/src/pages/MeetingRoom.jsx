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

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [micOn, setMicOn] = useState(userState.micOn);
  const [camOn, setCamOn] = useState(userState.camOn);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sidePanel, setSidePanel] = useState('chat');
  const [panelOpen, setPanelOpen] = useState(false); // closed by default on mobile
  const [participants, setParticipants] = useState([{ id: 'me', name: userState.name, isLocal: true }]);
  const [remotePeers, setRemotePeers] = useState({});
  const [pinnedUser, setPinnedUser] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [adminId, setAdminId] = useState(null);
  const [meetingStartTime, setMeetingStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [showHandoffModal, setShowHandoffModal] = useState(false);

  const socketRef = useRef();
  const userStreamRef = useRef();
  const localVideoRef = useRef();
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);
  const recordingStartRef = useRef(null);
  const peersRef = useRef({});

  const cleanupMedia = useCallback(() => {
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(track => track.stop());
      userStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    Object.values(peersRef.current).forEach(peerObj => {
      if (peerObj.peerConnection) peerObj.peerConnection.close();
    });
    peersRef.current = {};
    if (socketRef.current) {
      socketRef.current.emit('leave-room');
      socketRef.current.disconnect();
    }
  }, []);

  const leaveMeeting = useCallback(() => {
    const isAdmin = adminId === socketRef.current?.id;
    const others = participants.filter(p => !p.isLocal);
    
    if (isAdmin && others.length > 0) {
      setShowHandoffModal(true);
    } else {
      cleanupMedia();
      navigate(user ? '/dashboard' : '/');
    }
  }, [navigate, cleanupMedia, user, adminId, participants]);

  const confirmLeaveHandoff = (nextAdminId) => {
    if (nextAdminId) {
      socketRef.current.emit('transfer-admin', nextAdminId);
    }
    setShowHandoffModal(false);
    cleanupMedia();
    navigate(user ? '/dashboard' : '/');
  };

  useEffect(() => {
    if (!meetingStartTime) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - meetingStartTime) / 1000);
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      const h = Math.floor(diff / 3600);
      setElapsedTime(h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingStartTime]);

  const createPeer = useCallback((targetId, stream, isIncoming = false, offer = null, peerName = 'Participant') => {
    // If we already have a connection AND this is an outgoing call, skip
    // But if incoming (offer), always accept it – close stale connection first
    if (peersRef.current[targetId]?.peerConnection) {
      if (!isIncoming) {
        console.log(`Outgoing peer to ${targetId} already exists, skipping`);
        return peersRef.current[targetId].peerConnection;
      }
      // Incoming offer: tear down old connection and rebuild
      console.log(`Replacing stale peer for ${targetId} with fresh incoming offer`);
      peersRef.current[targetId].peerConnection.close();
      delete peersRef.current[targetId];
    }

    console.log(`Creating peer connection to ${targetId} (incoming: ${isIncoming})`);

    const peer = new RTCPeerConnection({
      iceServers: [
        // STUN servers (for discovering public IPs)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        // TURN servers (MANDATORY for cellular/mobile Symmetric NAT traversal)
        // Using OpenRelay project for testing NAT traversal. In prod, use standard paid TURN like Twilio/Metered.
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    });

    const localTracks = stream?.getTracks() || [];
    if (localTracks.length > 0) {
      localTracks.forEach(track => peer.addTrack(track, stream));
    } else {
      // If we joined with no media (e.g., cell phone without permission), we MUST add transceivers 
      // to force an SDP offer to generate, so we can still RECEIVE video from others.
      peer.addTransceiver('video', { direction: 'recvonly' });
      peer.addTransceiver('audio', { direction: 'recvonly' });
    }

    peer.onicecandidate = event => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', event.candidate, targetId);
      }
    };

    peer.ontrack = (event) => {
      console.log(`Received remote track from ${targetId}`);
      const remoteStream = event.streams[0];
      if (remoteStream) {
        setRemotePeers(prev => ({
          ...prev,
          [targetId]: { stream: remoteStream, name: peerName }
        }));
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log(`Peer ${targetId} ICE: ${peer.iceConnectionState}`);
      if (peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'disconnected') {
        console.log(`Peer ${targetId} connection failed/disconnected`);
      }
    };

    // Store early so name and queue are available
    peersRef.current[targetId] = { peerConnection: peer, name: peerName, iceQueue: [] };

    if (!isIncoming) {
      peer.onnegotiationneeded = async () => {
        try {
          const sdpOffer = await peer.createOffer();
          await peer.setLocalDescription(sdpOffer);
          socketRef.current.emit('offer', peer.localDescription, targetId);
        } catch (err) {
          console.error('Offer error:', err);
        }
      };
    } else if (offer) {
      peer.setRemoteDescription(new RTCSessionDescription(offer)).then(async () => {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socketRef.current.emit('answer', answer, targetId);

        // Process queued ICE candidates now that remote description is set
        const peerObj = peersRef.current[targetId];
        if (peerObj && peerObj.iceQueue) {
          for (const c of peerObj.iceQueue) {
            await peer.addIceCandidate(new RTCIceCandidate(c)).catch(e => console.warn('ICE warn:', e));
          }
          peerObj.iceQueue = [];
        }
      }).catch(err => console.error('Answer error:', err));
    }

    return peer;
  }, []);

  useEffect(() => {
    let mounted = true;
    socketRef.current = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    const init = async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

        stream.getAudioTracks().forEach(t => { t.enabled = userState.micOn; });
        stream.getVideoTracks().forEach(t => { t.enabled = userState.camOn; });
      } catch (err) {
        console.warn('Camera/Mic permission denied or unavailable. Joining as viewer.', err);
        stream = new MediaStream(); // Blank stream
        setMicOn(false);
        setCamOn(false);
      }

      userStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Set up ALL socket listeners - MUST run regardless of camera success
      socketRef.current.on('connect', () => {
          console.log('Socket connected:', socketRef.current.id);
          setConnectionStatus('connected');
          socketRef.current.emit('join-room', id, socketRef.current.id, userState.name);
        });

        socketRef.current.on('disconnect', () => {
          console.log('Socket disconnected');
          setConnectionStatus('disconnected');
        });

        // When we join, server sends us a list of everyone already in the room
        socketRef.current.on('room-info', ({ users, startTime, adminId: currentAdmin }) => {
          console.log('Room info:', users, startTime, currentAdmin);
          setMeetingStartTime(startTime);
          setAdminId(currentAdmin);
          users.forEach(({ id: peerId, name }) => {
            setParticipants(prev => {
              if (prev.find(p => p.id === peerId)) return prev;
              return [...prev, { id: peerId, name, isLocal: false }];
            });
            // Create peer connection and send offer to each existing user
            createPeer(peerId, stream, false, null, name);
          });
        });

        socketRef.current.on('admin-changed', newAdmin => setAdminId(newAdmin));
        
        socketRef.current.on('kicked-from-room', () => {
          alert('You have been removed from the meeting by the Host.');
          cleanupMedia();
          navigate(user ? '/dashboard' : '/');
        });

        // A NEW user joined AFTER us
        socketRef.current.on('user-connected', (userId, name) => {
          console.log(`New user connected: ${userId} (${name})`);
          setParticipants(prev => {
            if (prev.find(p => p.id === userId)) return prev;
            return [...prev, { id: userId, name, isLocal: false }];
          });
          // Don't create peer here — they will send us an offer via existing-users
        });

        // Received an offer from another peer
        socketRef.current.on('offer', (offer, senderId, name) => {
          console.log(`Received offer from: ${senderId} (${name})`);
          setParticipants(prev => {
            if (prev.find(p => p.id === senderId)) return prev;
            return [...prev, { id: senderId, name, isLocal: false }];
          });
          // createPeer handles stale teardown internally for incoming offers
          createPeer(senderId, stream, true, offer, name);
        });

        socketRef.current.on('answer', async (answer, senderId) => {
          console.log(`Received answer from: ${senderId}`);
          const peerObj = peersRef.current[senderId];
          if (peerObj?.peerConnection) {
            try {
              await peerObj.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
              
              // Process queued ICE candidates
              if (peerObj.iceQueue) {
                for (const c of peerObj.iceQueue) {
                  await peerObj.peerConnection.addIceCandidate(new RTCIceCandidate(c)).catch(e => console.warn('ICE warn:', e));
                }
                peerObj.iceQueue = [];
              }
            } catch (err) {
              console.error('Error setting remote answer:', err);
            }
          }
        });

        socketRef.current.on('ice-candidate', (candidate, senderId) => {
          const peerObj = peersRef.current[senderId];
          if (peerObj?.peerConnection) {
            if (peerObj.peerConnection.remoteDescription) {
              peerObj.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn('ICE error:', e));
            } else {
              // Queue candidate if remote description isn't set yet
              peerObj.iceQueue.push(candidate);
            }
          }
        });

        socketRef.current.on('user-disconnected', userId => {
          console.log(`User disconnected: ${userId}`);
          setParticipants(prev => prev.filter(p => p.id !== userId));
          setPinnedUser(prev => prev === userId ? null : prev);
          if (peersRef.current[userId]) {
            peersRef.current[userId].peerConnection?.close();
            delete peersRef.current[userId];
            setRemotePeers(prev => { const next = { ...prev }; delete next[userId]; return next; });
          }
        });

        socketRef.current.on('receive-message', (data) => {
          setMessages(prev => [...prev, data]);
        });

        // If socket is already connected by the time we set up listeners
        if (socketRef.current.connected) {
          setConnectionStatus('connected');
          socketRef.current.emit('join-room', id, socketRef.current.id, userState.name);
        }

    };

    init();

    const handleBeforeUnload = () => cleanupMedia();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      mounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupMedia();
    };
  }, [id, createPeer, cleanupMedia]);

  const toggleMic = () => {
    if (userStreamRef.current) {
      const t = userStreamRef.current.getAudioTracks()[0];
      if (t) { t.enabled = !micOn; setMicOn(!micOn); }
    }
  };

  const toggleCam = () => {
    if (userStreamRef.current) {
      const t = userStreamRef.current.getVideoTracks()[0];
      if (t) { t.enabled = !camOn; setCamOn(!camOn); }
    }
  };

  const handleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        userStreamRef.current = s;
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
        setIsScreenSharing(true);
        s.getVideoTracks()[0].onended = () => handleScreenShare();
      } else {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        s.getAudioTracks().forEach(t => { t.enabled = micOn; });
        s.getVideoTracks().forEach(t => { t.enabled = camOn; });
        userStreamRef.current = s;
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
        setIsScreenSharing(false);
      }
    } catch (e) { console.error(e); }
  };

  const handleRecord = () => {
    if (isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); }
    else {
      if (!userStreamRef.current) return;
      recordedChunksRef.current = [];
      recordingStartRef.current = Date.now();
      let mt = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) mt = 'video/webm; codecs=vp9';
      mediaRecorderRef.current = new MediaRecorder(userStreamRef.current, { mimeType: mt });
      mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const dur = Date.now() - (recordingStartRef.current || Date.now());
        const fn = `StudioStage_${id}_${new Date().toISOString().replace(/:/g, '-')}.webm`;
        const ex = JSON.parse(localStorage.getItem('ss_recordings') || '[]');
        ex.unshift({ id: `rec_${Date.now()}`, meetingId: id, type: 'meeting', title: `Meeting — ${id}`, recordedAt: new Date().toISOString(), durationMs: dur, sizeBytes: blob.size, filename: fn });
        localStorage.setItem('ss_recordings', JSON.stringify(ex));
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: fn, style: 'display:none' });
        document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  const shareMeetingLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${id}/lobby`);
    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim() && socketRef.current) { socketRef.current.emit('send-message', chatInput, userState.name); setChatInput(''); }
  };


  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const getGridStyle = (n) => {
    if (n <= 1) return { gridTemplateColumns: '1fr' };
    if (isMobile) return { gridTemplateColumns: n === 1 ? '1fr' : '1fr 1fr' };
    if (n === 2) return { gridTemplateColumns: '1fr 1fr' };
    if (n <= 4) return { gridTemplateColumns: '1fr 1fr' };
    return { gridTemplateColumns: '1fr 1fr 1fr' };
  };

  const allTiles = participants.map(p => {
    if (p.isLocal) return { id: 'me', name: userState.name, stream: userStreamRef.current, isLocal: true };
    return { id: p.id, name: p.name, stream: remotePeers[p.id]?.stream || null, isLocal: false };
  });

  const isPinMode = pinnedUser !== null;
  const pinnedTile = isPinMode ? allTiles.find(t => t.id === pinnedUser) : null;
  const unpinnedTiles = isPinMode ? allTiles.filter(t => t.id !== pinnedUser) : allTiles;

  const ctrlBtn = (active, onClick, ActiveIcon, InactiveIcon, label) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
      <button onClick={onClick} title={label} className="ctrl-btn" style={{
        backgroundColor: active ? 'white' : 'rgba(255,255,255,0.12)',
        color: active ? 'var(--primary-purple)' : 'white',
        borderRadius: '50%', width: 44, height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.15s'
      }}>
        {active ? <ActiveIcon size={20} /> : (InactiveIcon ? <InactiveIcon size={20} /> : <ActiveIcon size={20} />)}
      </button>
      <span className="ctrl-label" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{label}</span>
    </div>
  );

  const togglePanel = (panel) => {
    if (sidePanel === panel && panelOpen) setPanelOpen(false);
    else { setSidePanel(panel); setPanelOpen(true); }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0E0E14' }}>
      <header className="meeting-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <div className="meeting-logo" onClick={leaveMeeting}>SS</div>
          <span className="meeting-room-id hide-mobile">Room: {id}</span>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.3rem 0.6rem', borderRadius: '8px' }}>
            {elapsedTime}
          </span>
          {isRecording && (
            <span style={{ backgroundColor: '#450a0a', color: '#f87171', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f87171', display: 'inline-block' }} /> REC
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Connection indicator */}
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: connectionStatus === 'connected' ? '#4ade80' : connectionStatus === 'connecting' ? '#fbbf24' : '#f87171', flexShrink: 0 }} title={connectionStatus} />
          <div className="meeting-participants-badge">
            <Users size={14} /> {participants.length}
          </div>
          <button onClick={shareMeetingLink} className="meeting-share-btn" style={{
            backgroundColor: linkCopied ? 'rgba(34,197,94,0.15)' : 'rgba(92,51,246,0.2)',
            color: linkCopied ? '#4ade80' : 'var(--primary-purple)',
            border: `1px solid ${linkCopied ? 'rgba(34,197,94,0.3)' : 'rgba(92,51,246,0.3)'}`,
          }}>
            {linkCopied ? <Check size={14} /> : <Link size={14} />}
            <span className="share-text">{linkCopied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="meeting-content">
        <div className="meeting-video-area">
          {/* SPEAKER MODE */}
          {isPinMode && pinnedTile ? (
            <div className="speaker-layout">
              <div className="speaker-main">
                <VideoParticipant stream={pinnedTile.isLocal ? userStreamRef.current : pinnedTile.stream} isLocal={pinnedTile.isLocal}
                  name={pinnedTile.name} isPinned={true} onPin={() => setPinnedUser(null)} />
              </div>
              {unpinnedTiles.length > 0 && (
                <div className="speaker-sidebar">
                  {unpinnedTiles.map(tile => (
                    <div key={tile.id} className="speaker-sidebar-tile">
                      <VideoParticipant stream={tile.isLocal ? userStreamRef.current : tile.stream} isLocal={tile.isLocal}
                        name={tile.name} isPinned={false} onPin={() => setPinnedUser(tile.id)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* GALLERY MODE */
            <div className="gallery-grid" style={getGridStyle(allTiles.length)}>
              {allTiles.map(tile => (
                <div key={tile.id} className="gallery-tile">
                  <VideoParticipant stream={tile.isLocal ? userStreamRef.current : tile.stream} isLocal={tile.isLocal}
                    name={tile.name} isPinned={false} onPin={() => setPinnedUser(tile.id)} />
                </div>
              ))}
            </div>
          )}

          {/* Controls Bar */}
          <div className="meeting-controls">
            {ctrlBtn(micOn, toggleMic, Mic, MicOff, micOn ? 'Mute' : 'Unmute')}
            {ctrlBtn(camOn, toggleCam, Video, VideoOff, camOn ? 'Camera' : 'Camera')}
            <div className="ctrl-divider" />
            <span className="hide-mobile">{ctrlBtn(!isScreenSharing, handleScreenShare, MonitorUp, MonitorUp, 'Share')}</span>
            <span className="hide-mobile">{ctrlBtn(!isRecording, handleRecord, Circle, Circle, 'Record')}</span>
            <span className="hide-mobile"><div className="ctrl-divider" /></span>
            {ctrlBtn(!isPinMode, () => setPinnedUser(isPinMode ? null : 'me'), LayoutGrid, Maximize2, isPinMode ? 'Grid' : 'Pin')}
            {ctrlBtn(panelOpen && sidePanel === 'chat', () => togglePanel('chat'), MessageSquare, MessageSquare, 'Chat')}
            {ctrlBtn(panelOpen && sidePanel === 'participants', () => togglePanel('participants'), Users, Users, 'People')}
            <div className="ctrl-divider" />
            <button onClick={leaveMeeting} className="leave-btn">
              <PhoneOff size={16} /> <span className="hide-mobile">Leave</span>
            </button>
          </div>
        </div>

        {/* Side Panel */}
        {panelOpen && (
          <div className="meeting-side-panel">
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {[{ id: 'chat', label: 'CHAT' }, { id: 'participants', label: 'PEOPLE' }].map(tab => (
                <button key={tab.id} onClick={() => setSidePanel(tab.id)} style={{
                  flex: 1, textAlign: 'center', padding: '0.8rem', background: 'transparent',
                  borderBottom: `2px solid ${sidePanel === tab.id ? 'var(--primary-purple)' : 'transparent'}`,
                  color: sidePanel === tab.id ? 'var(--primary-purple)' : 'rgba(255,255,255,0.5)',
                  fontWeight: sidePanel === tab.id ? 700 : 500, fontSize: '0.75rem', letterSpacing: '0.05em', transition: 'all 0.15s',
                }}>{tab.label}</button>
              ))}
              <button onClick={() => setPanelOpen(false)} style={{
                background: 'transparent', color: 'rgba(255,255,255,0.5)', padding: '0.8rem',
                fontSize: '1.2rem', lineHeight: 1, fontWeight: 700, flexShrink: 0,
              }} title="Close panel">✕</button>
            </div>

            {sidePanel === 'chat' && (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {messages.length === 0 && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginTop: '2rem' }}>No messages yet.</div>}
                  {messages.map((msg, i) => {
                    const isMine = msg.senderName === userState.name;
                    return (
                      <div key={i} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginBottom: '2px', textAlign: isMine ? 'right' : 'left' }}>
                          {isMine ? 'You' : msg.senderName} · {msg.time}
                        </div>
                        <div style={{
                          backgroundColor: isMine ? 'var(--primary-purple)' : 'rgba(255,255,255,0.08)', color: 'white',
                          padding: '0.6rem 0.8rem', borderRadius: '12px',
                          borderBottomRightRadius: isMine ? 2 : 12, borderBottomLeftRadius: isMine ? 12 : 2,
                          fontSize: '0.85rem', lineHeight: 1.4
                        }}>{msg.message}</div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={sendMessage} style={{ padding: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message..."
                    style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.85rem', fontFamily: 'inherit' }}
                  />
                  <button type="submit" style={{ backgroundColor: 'var(--primary-purple)', color: 'white', borderRadius: '8px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Send size={14} />
                  </button>
                </form>
              </>
            )}

            {sidePanel === 'participants' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {participants.length} Participant{participants.length !== 1 ? 's' : ''}
                </p>
                {participants.map(p => {
                  const isUserAdmin = p.id === adminId || (p.isLocal && socketRef.current?.id === adminId);
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: 30, height: 30, backgroundColor: isUserAdmin ? '#FFD700' : 'var(--primary-purple)', color: isUserAdmin ? '#000' : 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{p.name} {p.isLocal ? '(You)' : ''}</span>
                          {isUserAdmin && <span title="Host" style={{ fontSize: '0.7rem' }}>👑</span>}
                        </p>
                      </div>
                      {socketRef.current?.id === adminId && !p.isLocal && (
                        <button onClick={() => socketRef.current.emit('kick-participant', p.id)} style={{ background: 'rgba(211,47,47,0.15)', color: '#ef4444', border: '1px solid rgba(211,47,47,0.3)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Admin Handoff Modal */}
      {showHandoffModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--card-bg)', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '90%', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Transfer Host Duty</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Before you leave, you must transfer your admin privileges to another user so the meeting can continue securely.
            </p>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem' }}>
              {participants.filter(p => !p.isLocal).map(p => (
                <div key={p.id} onClick={() => confirmLeaveHandoff(p.id)} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--primary-purple)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{p.name.charAt(0).toUpperCase()}</div>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowHandoffModal(false)} className="btn-secondary" style={{ width: '100%' }}>Cancel Leave</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingRoom;
