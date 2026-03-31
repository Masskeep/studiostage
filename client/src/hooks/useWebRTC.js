import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

export const useWebRTC = (roomId, userState) => {
  const [peers, setPeers] = useState({});
  const [messages, setMessages] = useState([]);
  const socketRef = useRef();
  const userStreamRef = useRef();
  const peersRef = useRef({});

  useEffect(() => {
    if (!roomId || !userState) return;

    socketRef.current = io(SERVER_URL);
    
    // Get Local Media
    navigator.mediaDevices.getUserMedia({
      video: userState.camOn,
      audio: userState.micOn
    }).then(stream => {
      userStreamRef.current = stream;
      
      const myId = socketRef.current.id; // Usually available after connection, but better to use socket.id inside the connect event
      
      socketRef.current.on('connect', () => {
        socketRef.current.emit('join-room', roomId, socketRef.current.id, userState.name);
      });

      socketRef.current.on('user-connected', (userId, name) => {
        const peer = createPeer(userId, socketRef.current.id, stream);
        peersRef.current[userId] = peer;
        setPeers(prev => ({ ...prev, [userId]: { peer, name } }));
      });

      socketRef.current.on('offer', async (offer, senderId, name) => {
        const peer = createPeer(senderId, socketRef.current.id, stream, true, offer);
        peersRef.current[senderId] = peer;
        setPeers(prev => ({ ...prev, [senderId]: { peer, name } }));
      });

      socketRef.current.on('answer', (answer, senderId) => {
        const peer = peersRef.current[senderId];
        if (peer) {
          peer.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socketRef.current.on('ice-candidate', (candidate, senderId) => {
        const peer = peersRef.current[senderId];
        if (peer) {
          peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socketRef.current.on('user-disconnected', userId => {
        if (peersRef.current[userId]) {
          peersRef.current[userId].close();
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
      }
      Object.values(peersRef.current).forEach(peer => peer.close());
    };
  }, [roomId, userState]);

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

    // For receiving tracks (video/audio from remote peer)
    peer.oninteract = (e) => {
      console.log('Got remote track', e);
    } // Usually handled by the component listening to the peer object

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

  return { peers, userStream: userStreamRef.current, messages, sendMessage, toggleMedia };
};
