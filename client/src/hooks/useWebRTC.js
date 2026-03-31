import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

export const useWebRTC = (roomId, userState) => {
  const [peers, setPeers] = useState({});
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const socketRef = useRef();
  const userStreamRef = useRef();
  const peersRef = useRef({});

  useEffect(() => {
    if (!roomId || !userState) return;

    socketRef.current = io(SERVER_URL);

    // Always request both audio and video, then mute/disable tracks as needed
    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    }).then(stream => {
      // Mute/disable tracks based on lobby preferences
      stream.getAudioTracks().forEach(t => { t.enabled = userState.micOn; });
      stream.getVideoTracks().forEach(t => { t.enabled = userState.camOn; });

      userStreamRef.current = stream;

      socketRef.current.on('connect', () => {
        socketRef.current.emit('join-room', roomId, socketRef.current.id, userState.name);
        // Add self to participants
        setParticipants([{ id: socketRef.current.id, name: userState.name, isLocal: true }]);
      });

      socketRef.current.on('user-connected', (userId, name) => {
        // Add to participants list
        setParticipants(prev => {
          if (prev.find(p => p.id === userId)) return prev;
          return [...prev, { id: userId, name, isLocal: false }];
        });

        const peer = createPeer(userId, socketRef.current.id, stream);
        peersRef.current[userId] = { peerConnection: peer, name };
        // peers state is updated when ontrack fires
      });

      socketRef.current.on('offer', async (offer, senderId, name) => {
        // Add to participants list
        setParticipants(prev => {
          if (prev.find(p => p.id === senderId)) return prev;
          return [...prev, { id: senderId, name, isLocal: false }];
        });

        const peer = createPeer(senderId, socketRef.current.id, stream, true, offer);
        peersRef.current[senderId] = { peerConnection: peer, name };
      });

      socketRef.current.on('answer', (answer, senderId) => {
        const peerObj = peersRef.current[senderId];
        if (peerObj) {
          peerObj.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socketRef.current.on('ice-candidate', (candidate, senderId) => {
        const peerObj = peersRef.current[senderId];
        if (peerObj) {
          peerObj.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socketRef.current.on('user-disconnected', userId => {
        // Remove from participants
        setParticipants(prev => prev.filter(p => p.id !== userId));

        if (peersRef.current[userId]) {
          peersRef.current[userId].peerConnection.close();
          delete peersRef.current[userId];
          setPeers(prev => {
            const nextPeers = { ...prev };
            delete nextPeers[userId];
            return nextPeers;
          });
        }
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
      Object.values(peersRef.current).forEach(peerObj => peerObj.peerConnection?.close());
      peersRef.current = {};
    };
  }, [roomId]);

  const createPeer = (userToSignal, callerId, stream, isIncoming = false, offer = null) => {
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

    // Receive remote tracks
    peer.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        setPeers(prev => ({
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
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socketRef.current.emit('offer', peer.localDescription, userToSignal);
        } catch (err) {
          console.error(err);
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

  const sendMessage = (message) => {
    socketRef.current.emit('send-message', message, userState.name);
  };

  const toggleMedia = (type, enable) => {
    if (userStreamRef.current) {
      if (type === 'audio') {
        userStreamRef.current.getAudioTracks().forEach(t => t.enabled = enable);
      } else {
        userStreamRef.current.getVideoTracks().forEach(t => t.enabled = enable);
      }
    }
  };

  const cleanup = useCallback(() => {
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(track => track.stop());
      userStreamRef.current = null;
    }
    Object.values(peersRef.current).forEach(peerObj => peerObj.peerConnection?.close());
    peersRef.current = {};
    socketRef.current?.disconnect();
  }, []);

  return {
    peers,
    userStream: userStreamRef.current,
    userStreamRef,
    messages,
    participants,
    sendMessage,
    toggleMedia,
    cleanup,
    socketRef
  };
};
