import React, { useEffect, useRef } from 'react';

const VideoParticipant = ({ stream, isLocal, name }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--dark-bg)' }}>
      <video 
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isLocal ? 'scaleX(-1)' : 'none' }}
      />
      <div style={{
          position: 'absolute',
          bottom: '1rem',
          left: '1rem',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          color: 'white',
          fontSize: '0.8rem',
          fontWeight: 500
      }}>
        {name} {isLocal ? '(You)' : ''}
      </div>
    </div>
  );
};

export default VideoParticipant;
