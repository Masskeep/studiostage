import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Radio, Clock, Calendar, HardDrive, Trash2, Download, Search, Filter } from 'lucide-react';
import Navbar from '../components/Navbar';

/* ── Helpers ── */
const formatDuration = (ms) => {
  if (!ms || ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

/* ── Empty State ── */
const EmptyState = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', textAlign: 'center' }}>
    <div style={{ width: 80, height: 80, backgroundColor: 'var(--card-purple-light)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
      <Video size={36} color="var(--primary-purple)" />
    </div>
    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No recordings yet</h2>
    <p style={{ color: 'var(--text-secondary)', maxWidth: '360px', lineHeight: 1.6 }}>
      Start recording during a meeting or webinar. Hit the <strong>Record</strong> button in the control bar — recordings appear here automatically.
    </p>
  </div>
);

/* ── Recording Card ── */
const RecordingCard = ({ rec, onDelete }) => {
  const isWebinar = rec.type === 'webinar';

  return (
    <div style={{
      backgroundColor: 'var(--card-bg)',
      borderRadius: '16px',
      border: '1px solid var(--border-color)',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s, transform 0.2s',
      display: 'flex',
      flexDirection: 'column',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Thumbnail strip */}
      <div style={{
        height: '120px',
        background: isWebinar
          ? 'linear-gradient(135deg, #1e0a3c 0%, #2d1256 100%)'
          : 'linear-gradient(135deg, #1A1A24 0%, #2A2A3A 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Radial glow */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 60%, ${isWebinar ? 'rgba(92,51,246,0.35)' : 'rgba(92,51,246,0.2)'} 0%, transparent 70%)` }} />

        {isWebinar
          ? <Radio size={40} color="rgba(255,255,255,0.5)" />
          : <Video size={40} color="rgba(255,255,255,0.5)" />
        }

        {/* Duration badge */}
        <div style={{ position: 'absolute', bottom: '0.6rem', right: '0.75rem', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(rec.durationMs)}
        </div>

        {/* Type pill */}
        <div style={{ position: 'absolute', top: '0.6rem', left: '0.75rem', backgroundColor: isWebinar ? 'rgba(92,51,246,0.85)' : 'rgba(0,0,0,0.65)', color: 'white', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em' }}>
          {isWebinar ? 'WEBINAR' : 'MEETING'}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '1rem 1.25rem', flex: 1 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rec.title || rec.filename}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {/* Date & Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Calendar size={13} style={{ flexShrink: 0, color: 'var(--primary-purple)' }} />
            <span>{formatDate(rec.recordedAt)}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <Clock size={13} style={{ flexShrink: 0, color: 'var(--primary-purple)' }} />
            <span>{formatTime(rec.recordedAt)}</span>
          </div>

          {/* Meeting ID */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--primary-purple)', fontSize: '0.7rem', fontWeight: 700 }}>ID</span>
            <code style={{ backgroundColor: 'var(--bg-color)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
              {rec.meetingId}
            </code>
          </div>

          {/* Duration + Size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Clock size={13} style={{ flexShrink: 0, color: 'var(--primary-purple)' }} />
            <span>{formatDuration(rec.durationMs)}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <HardDrive size={13} style={{ flexShrink: 0, color: 'var(--primary-purple)' }} />
            <span>{formatFileSize(rec.sizeBytes)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem' }}>
        <button
          title="Download recording"
          onClick={() => alert('To access this recording, check your Downloads folder — it was saved when you stopped recording.')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', backgroundColor: 'var(--card-purple-light)', color: 'var(--primary-purple)', borderRadius: '8px', padding: '0.6rem', fontSize: '0.82rem', fontWeight: 600, transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ddd6fe'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--card-purple-light)'}
        >
          <Download size={14} /> Download
        </button>
        <button
          title="Delete from history"
          onClick={() => onDelete(rec.id)}
          style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f2', color: '#e11d48', borderRadius: '8px', transition: 'background 0.15s', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffe4e6'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff1f2'}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

/* ── Main Page ── */
const RecordingsPage = () => {
  const [recordings, setRecordings] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'meeting' | 'webinar'

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('ss_recordings') || '[]');
    setRecordings(stored);
  }, []);

  const handleDelete = (id) => {
    if (!window.confirm('Remove this recording from history?')) return;
    const updated = recordings.filter(r => r.id !== id);
    setRecordings(updated);
    localStorage.setItem('ss_recordings', JSON.stringify(updated));
  };

  const filtered = recordings.filter(r => {
    const matchType = filter === 'all' || r.type === filter;
    const matchSearch = search === '' ||
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.meetingId?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  // Summary stats
  const totalDuration = recordings.reduce((sum, r) => sum + (r.durationMs || 0), 0);
  const totalSize = recordings.reduce((sum, r) => sum + (r.sizeBytes || 0), 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', paddingBottom: '4rem' }}>
      <Navbar />

      <main className="container" style={{ paddingTop: '3rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}>Recordings</h1>
            <p style={{ color: 'var(--text-secondary)' }}>All your meeting and webinar recordings — with time, ID, and length.</p>
          </div>
        </div>

        {/* Stats Row */}
        {recordings.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { label: 'Total Recordings', value: recordings.length, icon: <Video size={20} color="var(--primary-purple)" /> },
              { label: 'Total Duration', value: formatDuration(totalDuration), icon: <Clock size={20} color="var(--primary-purple)" /> },
              { label: 'Total Size', value: formatFileSize(totalSize), icon: <HardDrive size={20} color="var(--primary-purple)" /> },
            ].map((stat, i) => (
              <div key={i} style={{ backgroundColor: 'var(--card-bg)', borderRadius: '14px', padding: '1.25rem 1.5rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 42, height: 42, backgroundColor: 'var(--card-purple-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {stat.icon}
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{stat.label}</p>
                  <p style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search + Filter */}
        {recordings.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search by title or meeting ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', fontSize: '0.9rem', fontFamily: 'inherit' }}
              />
            </div>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', backgroundColor: 'var(--card-bg)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-color)', gap: '4px' }}>
              {['all', 'meeting', 'webinar'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                  backgroundColor: filter === f ? 'var(--primary-purple)' : 'transparent',
                  color: filter === f ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.15s', textTransform: 'capitalize',
                }}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid or Empty */}
        {recordings.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <Search size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <p style={{ fontSize: '1.1rem' }}>No recordings match your search.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {filtered.map(rec => (
              <RecordingCard key={rec.id} rec={rec} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default RecordingsPage;
