'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { sym: '&#9755;', title: 'Join the chat',      desc: 'Enter a live Halloween Dev Club group chat as a member or admin.' },
  { sym: '&#9874;', title: 'Bots are active',    desc: '7 automated bots post every few seconds — 3 helpful devs and 4 threat actors.' },
  { sym: '&#9760;', title: 'Bonekeeper judges',  desc: 'Every message runs through a 6-step AI moderation pipeline in real time.' },
  { sym: '&#9878;', title: 'Admin corrects',     desc: 'Review the report, restore false positives, and teach the agent to improve.' },
];

// Cast — two groups, described in a table
const ALLIES = [
  { name: 'Luna',  role: 'Senior dev',       behaviour: 'Posts TypeScript tips, answers questions, keeps the chat on-topic.', color: '#7C3AED' },
  { name: 'Pip',   role: 'Newcomer',         behaviour: 'Asks beginner questions, reacts enthusiastically to advice.', color: '#0891B2' },
  { name: 'Sage',  role: 'Architect',        behaviour: 'Gives calm, opinionated senior-level takes on design and tooling.', color: '#0E7C6B' },
];
const THREATS = [
  { name: 'SpamBot Sam',    role: 'Promo spammer',  behaviour: 'Posts repetitive ads with bit.ly shortlinks — caught by cheap rules.', color: '#B45309' },
  { name: 'Scamilla',       role: 'Crypto scammer', behaviour: 'Fake airdrops, fake giveaways, .xyz domains — caught by LLM classifier.', color: '#B3202A' },
  { name: 'Off-Topic Otto', role: 'Topic drifter',  behaviour: 'Cricket scores, food reviews, movie opinions — off-topic for a dev group.', color: '#6B7280' },
  { name: 'Spike',          role: 'Flood bot',      behaviour: 'Rapid ALL-CAPS repetition — caught by the flood and repeat-message rules.', color: '#DC2626' },
];

export default function WelcomePage() {
  const router = useRouter();
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin]         = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const join = async (role: 'member' | 'admin', enteredPin?: string) => {
    setLoading(true); setError('');
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, pin: enteredPin }),
    });
    setLoading(false);
    if (res.ok) { router.push('/chat'); router.refresh(); }
    else { const d = await res.json(); setError(d.error || 'Failed'); }
  };

  return (
    <div className="welcome-page">

      {/* ── HERO ── */}
      <div className="welcome-hero">
        {/* SVG Halloween decoration — bats drawn with paths, no emoji */}
        <svg className="hero-bats" aria-hidden="true" viewBox="0 0 800 120" xmlns="http://www.w3.org/2000/svg">
          {/* bat 1 */}
          <g transform="translate(80,30) scale(0.7)">
            <path d="M0,0 C-30,-20 -60,10 -80,0 C-60,-15 -30,-5 0,0Z" fill="rgba(255,255,255,0.12)"/>
            <path d="M0,0 C30,-20 60,10 80,0 C60,-15 30,-5 0,0Z"  fill="rgba(255,255,255,0.12)"/>
            <ellipse cx="0" cy="2" rx="6" ry="5" fill="rgba(255,255,255,0.18)"/>
          </g>
          {/* bat 2 */}
          <g transform="translate(700,50) scale(0.5)">
            <path d="M0,0 C-30,-20 -60,10 -80,0 C-60,-15 -30,-5 0,0Z" fill="rgba(255,255,255,0.10)"/>
            <path d="M0,0 C30,-20 60,10 80,0 C60,-15 30,-5 0,0Z"  fill="rgba(255,255,255,0.10)"/>
            <ellipse cx="0" cy="2" rx="6" ry="5" fill="rgba(255,255,255,0.15)"/>
          </g>
          {/* bat 3 */}
          <g transform="translate(400,20) scale(0.4)">
            <path d="M0,0 C-30,-20 -60,10 -80,0 C-60,-15 -30,-5 0,0Z" fill="rgba(255,255,255,0.08)"/>
            <path d="M0,0 C30,-20 60,10 80,0 C60,-15 30,-5 0,0Z"  fill="rgba(255,255,255,0.08)"/>
            <ellipse cx="0" cy="2" rx="6" ry="5" fill="rgba(255,255,255,0.12)"/>
          </g>
        </svg>

        <div className="hero-skull" aria-hidden="true">
          {/* SVG skull — no emoji */}
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="28" r="22" fill="white" opacity="0.95"/>
            <ellipse cx="32" cy="46" rx="14" ry="8" fill="white" opacity="0.95"/>
            <rect x="22" y="46" width="6" height="8" rx="1" fill="var(--navy)"/>
            <rect x="30" y="46" width="4" height="8" rx="1" fill="var(--navy)"/>
            <rect x="36" y="46" width="6" height="8" rx="1" fill="var(--navy)"/>
            <ellipse cx="24" cy="28" rx="5" ry="6" fill="var(--navy)"/>
            <ellipse cx="40" cy="28" rx="5" ry="6" fill="var(--navy)"/>
            <path d="M29 36 Q32 39 35 36" stroke="var(--navy)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </div>

        <div className="hero-kicker">SKELETON CREW <span aria-hidden="true">/</span> LIVE MODERATION LAB</div>
        <h1>Bonekeeper</h1>
        <p className="hero-sub">A professional AI moderation control room for communities that need calm, transparent protection from spam and scams.</p>

        {/* Decorative crossbones */}
        <div className="hero-deco" aria-hidden="true">
          <svg width="120" height="24" viewBox="0 0 120 24">
            <line x1="0" y1="12" x2="120" y2="12" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
            <circle cx="8"   cy="12" r="4" fill="rgba(255,255,255,0.2)"/>
            <circle cx="112" cy="12" r="4" fill="rgba(255,255,255,0.2)"/>
            <circle cx="60"  cy="12" r="3" fill="rgba(255,255,255,0.25)"/>
          </svg>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section className="welcome-section">
        <h2 className="section-title">How it works</h2>
        <div className="welcome-steps">
          {STEPS.map((s, i) => (
            <div key={i} className="step-card">
              <div className="step-sym" dangerouslySetInnerHTML={{ __html: s.sym }} />
              <div className="step-title">{i + 1}. {s.title}</div>
              <div className="step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CAST ── */}
      <section className="welcome-section cast-section">
        <h2 className="section-title">The cast</h2>
        <p className="section-sub">
          The chat is populated by 7 automated bots. Three are friendly developers keeping the conversation on-topic.
          Four are threat actors designed to trigger Bonekeeper's moderation rules &mdash; so you can watch the AI work in real time.
        </p>

        <div className="cast-tables">
          {/* Allies */}
          <div className="cast-group">
            <div className="cast-group-header ally">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Friendly bots (safe &mdash; never flagged)
            </div>
            <table className="cast-table">
              <thead>
                <tr><th>Name</th><th>Role</th><th>What they post</th></tr>
              </thead>
              <tbody>
                {ALLIES.map(c => (
                  <tr key={c.name}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <span className="cast-dot" style={{ background: c.color }} />
                        <strong>{c.name}</strong>
                      </div>
                    </td>
                    <td><span className="badge badge-fine">{c.role}</span></td>
                    <td style={{ fontSize:'0.82rem', color:'var(--muted)' }}>{c.behaviour}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Threats */}
          <div className="cast-group">
            <div className="cast-group-header threat">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M7 1L13 13H1L7 1Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <line x1="7" y1="5" x2="7" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="7" cy="11" r="0.75" fill="currentColor"/>
              </svg>
              Threat bots (should be caught by Bonekeeper)
            </div>
            <table className="cast-table">
              <thead>
                <tr><th>Name</th><th>Threat type</th><th>How Bonekeeper catches it</th></tr>
              </thead>
              <tbody>
                {THREATS.map(c => (
                  <tr key={c.name}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <span className="cast-dot" style={{ background: c.color }} />
                        <strong>{c.name}</strong>
                      </div>
                    </td>
                    <td><span className="badge badge-deleted">{c.role}</span></td>
                    <td style={{ fontSize:'0.82rem', color:'var(--muted)' }}>{c.behaviour}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── JOIN ── */}
      <section className="join-section" aria-label="Join the demo">
        <div className="join-card">
          <h2>Choose your role</h2>
          <p style={{ fontSize:'0.85rem', color:'var(--muted)', marginBottom:'1.5rem' }}>
            Members see the chat and trigger moderation. Admins also get the full report, row actions, and settings.
          </p>

          {!showPin ? (
            <div className="join-btns">
              <button className="btn btn-ghost join-btn" onClick={() => join('member')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Join as Member
              </button>
              <button className="btn btn-primary join-btn" onClick={() => setShowPin(true)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Enter as Admin
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize:'0.85rem', color:'var(--muted)', marginBottom:'0.75rem' }}>
                Demo PIN &mdash; hint: 1234
              </p>
              <input
                className="form-input pin-input"
                type="password"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && join('admin', pin)}
                placeholder="&bull;&bull;&bull;&bull;"
                autoFocus
                aria-label="Admin PIN"
              />
              {error && <p style={{ color:'var(--blood-red)', fontSize:'0.82rem', marginTop:'0.5rem' }}>{error}</p>}
              <div className="join-btns" style={{ marginTop:'0.75rem' }}>
                <button className="btn btn-primary" onClick={() => join('admin', pin)} disabled={loading}>
                  {loading ? 'Checking...' : 'Enter'}
                </button>
                <button className="btn btn-ghost" onClick={() => { setShowPin(false); setPin(''); setError(''); }}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER DECORATION ── */}
      <div className="welcome-footer-deco" aria-hidden="true">
        <svg viewBox="0 0 1200 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,30 Q100,0 200,30 Q300,60 400,30 Q500,0 600,30 Q700,60 800,30 Q900,0 1000,30 Q1100,60 1200,30 L1200,60 L0,60Z"
            fill="var(--navy)" opacity="0.06"/>
        </svg>
      </div>

    </div>
  );
}
