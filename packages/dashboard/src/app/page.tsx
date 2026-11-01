'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { icon: '💬', title: 'Join the chat', desc: 'Enter a live group chat called Halloween Dev Club' },
  { icon: '🤖', title: 'Bots talk', desc: '7 bots post every ~4 seconds — some helpful, some spammy' },
  { icon: '⚔️', title: 'Bonekeeper judges', desc: 'Every message runs through the moderation pipeline in real time' },
  { icon: '🛡️', title: 'Admin fixes mistakes', desc: 'Review the report, restore false positives, teach the AI' },
];

const CAST = [
  { id: 'luna',        name: 'Luna',           role: 'Helpful dev',      color: '#7C3AED', kind: 'positive' },
  { id: 'pip',         name: 'Pip',            role: 'Friendly newbie',  color: '#0891B2', kind: 'positive' },
  { id: 'sage',        name: 'Sage',           role: 'Senior architect', color: '#0E7C6B', kind: 'positive' },
  { id: 'spambot_sam', name: 'SpamBot Sam',    role: 'Promo spam',       color: '#B45309', kind: 'negative' },
  { id: 'scamilla',    name: 'Scamilla',       role: 'Crypto scams',     color: '#B3202A', kind: 'negative' },
  { id: 'otto',        name: 'Off-Topic Otto', role: 'Topic drift',      color: '#6B7280', kind: 'negative' },
  { id: 'spike',       name: 'Spike',          role: 'CAPS flood',       color: '#DC2626', kind: 'negative' },
];

export default function WelcomePage() {
  const router = useRouter();
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const join = async (role: 'member' | 'admin', enteredPin?: string) => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, pin: enteredPin }),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/chat');
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed');
    }
  };

  return (
    <div className="welcome-page">
      {/* Hero */}
      <div className="welcome-hero">
        <h1>💀 Bonekeeper</h1>
        <p>An AI group-chat moderator that deletes spam and scams in real time, while letting admins fix any mistakes.</p>
      </div>

      {/* Steps */}
      <div className="welcome-steps">
        {STEPS.map((s, i) => (
          <div key={i} className="step-card">
            <div className="step-icon">{s.icon}</div>
            <div className="step-title">{i + 1}. {s.title}</div>
            <div className="step-desc">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Cast */}
      <div className="cast-section">
        <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Meet the cast</h2>
        <div className="cast-grid">
          {CAST.map(c => (
            <div key={c.id} className="cast-card">
              <div className="cast-avatar" style={{ background: c.color }}>
                {c.name[0]}
              </div>
              <div className="cast-name">{c.name}</div>
              <div className="cast-role">{c.role}</div>
              {c.kind === 'negative' && (
                <span className="badge badge-scam" style={{ marginTop: '0.3rem', fontSize: '0.6rem' }}>threat</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Join */}
      <div className="join-section">
        <h2>How do you want to join?</h2>

        {!showPin ? (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => join('member')}>
              👤 Join as Member
            </button>
            <button className="btn btn-primary" onClick={() => setShowPin(true)}>
              🛡️ Enter as Admin
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
              Enter the demo PIN (hint: 1234)
            </p>
            <input
              className="form-input pin-input"
              type="password"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && join('admin', pin)}
              placeholder="••••"
              autoFocus
              aria-label="Admin PIN"
            />
            {error && <p style={{ color: 'var(--blood-red)', fontSize: '0.82rem', marginTop: '0.5rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.75rem' }}>
              <button className="btn btn-primary" onClick={() => join('admin', pin)} disabled={loading}>
                {loading ? '...' : 'Enter'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowPin(false); setPin(''); setError(''); }}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
