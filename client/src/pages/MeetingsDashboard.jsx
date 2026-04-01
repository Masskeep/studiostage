import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Video, Calendar, Clock, Link, Plus, ChevronRight, LogIn } from 'lucide-react';
import Navbar from '../components/Navbar';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

const MeetingsDashboard = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleData, setScheduleData] = useState({ title: '', startTime: '', duration: 60 });
  const [scheduledMeetings, setScheduledMeetings] = useState([]);
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinId, setJoinId] = useState('');

  const startInstantMeeting = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/meetings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.meetingId) {
        navigate(`/room/${data.meetingId}/lobby`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [joinError, setJoinError] = useState('');

  const handleJoinById = async () => {
    if (!joinId.trim()) return;
    setLoading(true);
    setJoinError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/meetings/${joinId.trim()}`);
      if (!res.ok) {
        setJoinError('Meeting does not exist');
        setTimeout(() => setJoinError(''), 750);
      } else {
        navigate(`/room/${joinId.trim()}/lobby`);
      }
    } catch (err) {
      setJoinError('Error validating meeting');
      setTimeout(() => setJoinError(''), 750);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/meetings/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...scheduleData, host: user?.id }),
      });
      const data = await res.json();
      setScheduledMeetings(prev => [data, ...prev]);
      setShowScheduleForm(false);
      setScheduleData({ title: '', startTime: '', duration: 60 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (meetingId) => {
    const link = `${window.location.origin}/room/${meetingId}/lobby`;
    navigator.clipboard.writeText(link);
    setCopied(meetingId);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', paddingBottom: '4rem' }}>
      <Navbar />
      <main className="container" style={{ paddingTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Good day, {user?.name?.split(' ')[0]} 👋</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Manage your meetings and schedule new ones below.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowScheduleForm(!showScheduleForm)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Schedule Meeting
          </button>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '3rem' }}>
          <button
            onClick={startInstantMeeting}
            style={{
              backgroundColor: 'var(--primary-purple)',
              color: 'white',
              borderRadius: '20px',
              padding: '2.5rem',
              textAlign: 'left',
              boxShadow: '0 12px 32px rgba(92,51,246,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(92,51,246,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(92,51,246,0.3)'; }}
          >
            <Video size={40} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>Start Instant Meeting</h2>
            <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>Jump straight into a new meeting room right now.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', opacity: 0.9, fontWeight: 600 }}>
              Start Now <ChevronRight size={18} />
            </div>
          </button>

          {/* Join Meeting by ID */}
          <div
            style={{
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)',
              borderRadius: '20px',
              padding: '2.5rem',
              textAlign: 'left',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <LogIn size={40} style={{ marginBottom: '1rem', color: '#10B981' }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>Join a Meeting</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Enter a meeting ID to join an existing room.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
              <input
                type="text"
                placeholder="Enter Meeting ID"
                value={joinId}
                onChange={e => { setJoinId(e.target.value); setJoinError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && joinId.trim()) handleJoinById(); }}
                style={{
                  flex: 1,
                  padding: '0.8rem 1rem',
                  borderRadius: '10px',
                  border: `1px solid ${joinError ? 'var(--error-color)' : 'var(--border-color)'}`,
                  backgroundColor: 'var(--bg-color)',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                className="btn-primary"
                onClick={handleJoinById}
                disabled={!joinId.trim() || loading}
                style={{ padding: '0.8rem 1.5rem', fontSize: '0.95rem', opacity: joinId.trim() ? 1 : 0.5 }}
              >
                {loading ? '...' : 'Join'}
              </button>
            </div>
            {joinError && <div style={{ color: 'var(--error-color)', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>{joinError}</div>}
          </div>

          <button
            onClick={() => setShowScheduleForm(true)}
            className="dashboard-card"
          >
            <div className="dashboard-card-icon">
              <Calendar size={40} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontFamily: 'var(--font-display)', color: 'inherit' }}>Schedule a Meeting</h2>
            <p style={{ color: 'inherit', fontSize: '0.9rem', opacity: 0.8 }}>Pick a date and time. Share the link with participants.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', fontWeight: 600, color: 'inherit', opacity: 0.9 }}>
              Schedule <ChevronRight size={18} />
            </div>
          </button>
        </div>

        {/* Schedule Form */}
        {showScheduleForm && (
          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '20px', padding: '2rem', border: '1px solid var(--border-color)', marginBottom: '3rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>Schedule New Meeting</h2>
            <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Meeting Title</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Design Sync"
                  value={scheduleData.title}
                  onChange={e => setScheduleData({ ...scheduleData, title: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduleData.startTime}
                    onChange={e => setScheduleData({ ...scheduleData, startTime: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Duration (minutes)</label>
                  <input
                    type="number"
                    placeholder="60"
                    value={scheduleData.duration}
                    onChange={e => setScheduleData({ ...scheduleData, duration: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Scheduling...' : 'Schedule Meeting'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowScheduleForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Scheduled Meetings List */}
        {scheduledMeetings.length > 0 && (
          <div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>Scheduled Meetings</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {scheduledMeetings.map((meeting) => (
                <div key={meeting.meetingId} style={{ backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '1.5rem 2rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{meeting.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Clock size={14} /> {new Date(meeting.startTime).toLocaleString()}
                      &nbsp;•&nbsp; {meeting.duration} min &nbsp;•&nbsp; ID: {meeting.meetingId}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => copyLink(meeting.meetingId)}
                      className="btn-secondary"
                      style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <Link size={16} />
                      {copied === meeting.meetingId ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => navigate(`/room/${meeting.meetingId}/lobby`)}
                      className="btn-primary"
                      style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle = {
  width: '100%',
  padding: '0.9rem 1rem',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-color)',
  fontSize: '1rem',
  fontFamily: 'inherit',
};

export default MeetingsDashboard;
