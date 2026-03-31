import React, { useEffect, useRef, useState } from 'react';
import { Pin, PinOff } from 'lucide-react';

const VideoParticipant = ({ stream, isLocal, name, onPin, isPinned, showPin = true }) => {
  const videoRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: '#1a1a24',
        border: isPinned ? '2px solid var(--primary-purple)' : '1px solid rgba(255,255,255,0.08)',
        transition: 'border-color 0.2s',
      }}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: isLocal ? 'scaleX(-1)' : 'none',
          }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a24 0%, #2a2a3a 100%)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            backgroundColor: 'var(--primary-purple)',
            color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', fontWeight: 700,
            fontFamily: 'var(--font-display)',
          }}>
            {(name || 'G').charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Name tag */}
      <div style={{
        position: 'absolute',
        bottom: '0.6rem',
        left: '0.6rem',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        padding: '0.2rem 0.55rem',
        borderRadius: '5px',
        color: 'white',
        fontSize: '0.78rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
      }}>
        {name} {isLocal ? '(You)' : ''}
      </div>

      {/* Pin button on hover */}
      {showPin && hovered && onPin && (
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            backgroundColor: isPinned ? 'var(--primary-purple)' : 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            color: 'white',
            borderRadius: '8px',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.15s',
          }}
          title={isPinned ? 'Unpin' : 'Pin this video'}
        >
          {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
      )}
    </div>
  );
};

export default VideoParticipant;
