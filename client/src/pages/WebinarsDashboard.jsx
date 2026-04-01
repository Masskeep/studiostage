import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Radio, Calendar, Clock, Users, Link, Plus, Globe, X, ArrowRight } from 'lucide-react';
import Navbar from '../components/Navbar';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

const labelStyle = {
  display: 'block', fontSize: '0.75rem', fontWeight: 700,
  color: 'var(--text-secondary)', marginBottom: '6px',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const inputStyle = {
  width: '100%', padding: '0.9rem 1rem', borderRadius: '10px',
  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)',
  fontSize: '1rem', fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.2s',
};

/* ── Custom themed "Join as Attendee" modal ── */
const JoinAttendeeModal = ({ onClose, onJoin }) => {
  const [webinarId, setWebinarId] = useState('');
  const inputRef = useRef();

  useEffect(() => {
    inputRef.current?.focus();
    // Close on Escape
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (webinarId.trim()) onJoin(webinarId.trim());
  };

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(10, 10, 20, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Modal card — stop propagation so clicking inside doesn't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card-bg)',
          borderRadius: '24px',
          padding: '2.5rem',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
          border: '1px solid var(--border-color)',
          position: 'relative',
          animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '1.25rem', right: '1.25rem',
            background: 'var(--bg-color)', border: '1px solid var(--border-color)',
            borderRadius: '50%', width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-color)'}
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div style={{
          width: 56, height: 56, backgroundColor: 'var(--card-purple-light)',
          borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1.25rem',
        }}>
          <Globe size={28} color="var(--primary-purple)" />
        </div>

        <h2 style={{ fontSize: '1.6rem', marginBottom: '0.4rem', fontFamily: 'var(--font-display)' }}>
          Join as Attendee
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
          Enter the Webinar ID shared by the host to join as a view-only attendee. You can submit questions via Q&amp;A.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Webinar ID</label>
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. abc123x"
              value={webinarId}
              onChange={e => setWebinarId(e.target.value)}
              required
              style={{
                ...inputStyle,
                fontSize: '1.1rem',
                letterSpacing: '0.08em',
                borderColor: webinarId ? 'var(--primary-purple)' : 'var(--border-color)',
                boxShadow: webinarId ? '0 0 0 3px rgba(92,51,246,0.12)' : 'none',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Find the Webinar ID in the invite link you received.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ flex: 1, padding: '0.9rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 2, padding: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              Join Webinar <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </div>

      {/* Keyframe injection */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  );
};

/* ── Main Dashboard ── */
const WebinarsDashboard = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [webinars, setWebinars] = useState([
    {
      id: 'demo-webinar',
      title: 'Product Launch: StudioStage 2.0',
      startTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      duration: 90,
      description: 'Join us for an exclusive live walkthrough of our newest features.',
      hostName: user?.name || 'Host',
      registered: 142,
    }
  ]);
  const [form, setForm] = useState({ title: '', description: '', startTime: '', duration: 60 });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');

  const handleSchedule = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newWebinar = {
        id: Math.random().toString(36).substring(2, 9),
        title: form.title,
        description: form.description,
        startTime: form.startTime,
        duration: form.duration,
        hostName: user?.name,
        registered: 0,
      };
      setWebinars(prev => [newWebinar, ...prev]);
      setShowForm(false);
      setForm({ title: '', description: '', startTime: '', duration: 60 });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (id) => {
    navigator.clipboard.writeText(`${window.location.origin}/webinar/${id}`);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const startWebinar = (id) => {
    navigate(`/webinar/${id}`, { state: { role: 'host', name: user?.name } });
  };

  const joinAsAttendee = (id) => {
    setShowJoinModal(false);
    navigate(`/webinar/${id}`, { state: { role: 'attendee', name: user?.name } });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', paddingBottom: '4rem' }}>
      <Navbar />

      {/* Join Attendee Modal */}
      {showJoinModal && (
        <JoinAttendeeModal
          onClose={() => setShowJoinModal(false)}
          onJoin={joinAsAttendee}
        />
      )}

      <main className="container" style={{ paddingTop: '3rem' }}>

        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}>Webinars</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Host broadcast-style events for large audiences — Zoom-style.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Schedule Webinar
          </button>
        </div>

        {/* Quick Action Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', marginBottom: '3rem' }}>
          {[
            {
              icon: <Radio size={28} />,
              title: 'Start Instant Webinar',
              sub: 'Go live right now as host.',
              action: () => {
                const id = Math.random().toString(36).substring(2, 9);
                navigate(`/webinar/${id}`, { state: { role: 'host', name: user?.name } });
              },
              purple: true,
            },
            {
              icon: <Calendar size={28} />,
              title: 'Schedule Webinar',
              sub: 'Set a date and share invite link.',
              action: () => setShowForm(true),
              purple: false,
            },
            {
              icon: <Globe size={28} />,
              title: 'Join as Attendee',
              sub: 'Enter a webinar ID to join.',
              action: () => setShowJoinModal(true),   // ← opens custom modal now
              purple: false,
            },
          ].map((card, i) => (
            <button
              key={i}
              onClick={card.action}
              className={`dashboard-card ${card.purple ? 'purple-default' : ''}`}
            >
              <div className="dashboard-card-icon">
                {card.icon}
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: 'inherit' }}>{card.title}</h3>
              <p style={{ fontSize: '0.85rem', opacity: 0.75, color: 'inherit' }}>{card.sub}</p>
            </button>
          ))}
        </div>

        {/* Schedule Form */}
        {showForm && (
          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '2rem', border: '1px solid var(--border-color)', marginBottom: '2.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>Schedule New Webinar</h2>
            <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Webinar Title</label>
                <input type="text" placeholder="e.g. Q4 Product Launch Live" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea placeholder="What will attendees learn from this webinar?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Date &amp; Time</label>
                  <input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Duration (minutes)</label>
                  <input type="number" placeholder="60" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} required style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Scheduling...' : 'Schedule Webinar'}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Webinars List */}
        <h2 style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>Upcoming Webinars</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {webinars.map((w) => (
            <div key={w.id} style={{ backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '1.5rem 2rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <span style={{ backgroundColor: 'var(--card-purple-light)', color: 'var(--primary-purple)', padding: '0.15rem 0.6rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 700 }}>WEBINAR</span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{w.title}</h3>
                </div>
                {w.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>{w.description}</p>}
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={13} />{new Date(w.startTime).toLocaleString()}</span>
                  <span>·</span>
                  <span>{w.duration} min</span>
                  <span>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Users size={13} />{w.registered} registered</span>
                  <span>·</span>
                  <span>Host: {w.hostName}</span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                <button onClick={() => copyLink(w.id)} className="btn-secondary" style={{ padding: '0.6rem 1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Link size={14} />{copied === w.id ? 'Copied!' : 'Copy Link'}
                </button>
                <button onClick={() => startWebinar(w.id)} className="btn-primary" style={{ padding: '0.6rem 1.3rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Radio size={14} /> Start
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default WebinarsDashboard;
