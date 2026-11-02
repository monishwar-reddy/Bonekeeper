'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChatMessage } from '@/lib/store';

const PERSONA_COLORS: Record<string, string> = {
  luna: '#7C3AED', pip: '#0891B2', sage: '#0E7C6B',
  spambot_sam: '#B45309', scamilla: '#B3202A', otto: '#6B7280', spike: '#DC2626',
  system: '#0E7C6B', human: '#0E7C6B',
};

function initials(name: string) { return name.slice(0, 1).toUpperCase(); }
function formatTime(ts: Date | string) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function formatDate(ts: Date | string) { return new Date(ts).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }); }

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [lastId,   setLastId]       = useState('');
  const [input,    setInput]        = useState('');
  const [role,     setRole]         = useState<'member' | 'admin'>('member');
  const [adminPin, setAdminPin]     = useState('');
  const [adminPinOpen, setAdminPinOpen] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [typing,   setTyping]       = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [atBottom, setAtBottom]     = useState(true);
  const [newCount, setNewCount]     = useState(0);
  const bodyRef   = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Read role from display cookie
  useEffect(() => {
    const val = document.cookie.split(';').find(c => c.trim().startsWith('bk_role_display='))?.split('=')[1];
    if (val === 'admin') setRole('admin');
  }, []);

  // Load the shared demo session. Role changes and navigation must not reset it.
  useEffect(() => {
    let active = true;
    (async () => {
      const response = await fetch('/api/messages');
      if (!response.ok) throw new Error('Unable to load chat session');
      const msgs: ChatMessage[] = await response.json();
      if (!active) return;
      setMessages(msgs);
      if (msgs.length) setLastId(msgs[msgs.length - 1].id);
    })().catch(error => console.error('[chat] initial load failed:', error));
    return () => { active = false; };
  }, []);

  const changeRole = async (nextRole: 'member' | 'admin') => {
    if (nextRole === 'admin') {
      setAdminPinOpen(true);
      setAdminError('');
      return;
    }
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    });
    if (!response.ok) {
      window.alert('Unable to switch to member mode.');
      return;
    }
    setRole(nextRole);
    router.refresh();
  };

  const confirmAdminRole = async () => {
    const pin = adminPin.trim();
    if (!pin) {
      setAdminError('Enter the admin PIN.');
      return;
    }
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', pin }),
    });
    if (!response.ok) {
      setAdminError('That admin PIN is not valid.');
      return;
    }
    setAdminPin('');
    setAdminPinOpen(false);
    setAdminError('');
    setRole('admin');
    router.refresh();
  };

  // Poll for new messages every 2s (pause when tab hidden)
  useEffect(() => {
    let t: ReturnType<typeof setInterval>;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res  = await fetch(`/api/messages?after=${lastId}`);
        const news: ChatMessage[] = await res.json();
        if (news.length) {
          setMessages(prev => {
            // merge: update existing by id, append new
            const map = new Map(prev.map(m => [m.id, m]));
            news.forEach(m => map.set(m.id, m));
            return [...map.values()];
          });
          setLastId(news[news.length - 1].id);
          if (!atBottom) setNewCount(n => n + news.filter(m => !m.warningChip).length);
        }
      } catch { /* ignore */ }
    };
    t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [lastId, atBottom]);

  // Bot tick every ~4s
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        setTyping(true);
        await fetch('/api/bot-tick', { method: 'POST' });
      } catch { /* ignore */ } finally {
        setTyping(false);
      }
    }, 4200);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const check = () => setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
    el.addEventListener('scroll', check);
    return () => el.removeEventListener('scroll', check);
  }, []);

  useEffect(() => {
    if (atBottom) {
      bodyRef.current?.scrollTo({ top: 9_999_999, behavior: 'smooth' });
      setNewCount(0);
    }
  }, [messages, atBottom]);

  const scrollToBottom = () => {
    bodyRef.current?.scrollTo({ top: 9_999_999, behavior: 'smooth' });
    setAtBottom(true); setNewCount(0);
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');

    // Optimistic: show message immediately
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      platform: 'simulated',
      groupId: 'halloween-dev-club',
      sender: { id: 'human', name: role === 'admin' ? 'Admin' : 'You', role: role as any, joinedAt: new Date() },
      text,
      links: [],
      isForwarded: false,
      timestamp: new Date(),
      status: 'ok',
    };
    setMessages(prev => [...prev, optimistic]);
    setLastId(optimisticId);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, role }),
      });
      const data = await res.json();
      // Replace optimistic with real message id from server
      setMessages(prev => prev.map(m =>
        m.id === optimisticId ? { ...m, id: data.id, status: data.action === 'delete' ? 'deleted' : data.action === 'quarantine' ? 'held' : 'ok' } : m
      ));
      if (data.id) setLastId(data.id);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Group by date
  const grouped: Array<{ date: string; items: ChatMessage[] }> = [];
  messages.forEach(msg => {
    const d = formatDate(msg.timestamp);
    const last = grouped[grouped.length - 1];
    if (last?.date === d) last.items.push(msg);
    else grouped.push({ date: d, items: [msg] });
  });

  const isOwn    = (m: ChatMessage) => m.sender.id === 'human';
  const isAdmin  = (m: ChatMessage) => ['admin','owner','moderator'].includes(m.sender.role);
  const isSystem = (m: ChatMessage) => m.sender.id === 'system';

  return (
    <div className="chat-page" style={{ marginLeft: 0 }}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-avatar">🎃</div>
        <div className="chat-header-info">
          <h2>Halloween Dev Club</h2>
          <small>7 bots + you • moderated by Bonekeeper</small>
        </div>
        <div className="chat-header-actions">
          {typing && <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>bot is typing…</span>}
          {role === 'admin' && <Link className="btn btn-ghost" href="/admin">Open report</Link>}
          <button className="members-toggle" onClick={() => setShowMembers(v => !v)} aria-label="Toggle members">
            👥 Members
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Body */}
        <div ref={bodyRef} className="chat-body" style={{ flex: 1, position: 'relative' }}>
          {grouped.map(group => (
            <div key={group.date}>
              <div className="date-divider"><span>{group.date}</span></div>
              {group.items.map(msg => {
                if (msg.warningChip) {
                  const isMute = msg.warningChip.startsWith('muted:');
                  return (
                    <div key={msg.id} className={isMute ? 'mute-chip-row' : 'warning-chip-row'}>
                      <span className={isMute ? 'mute-chip' : 'warning-chip'}>{msg.text}</span>
                    </div>
                  );
                }
                const own   = isOwn(msg);
                const color = PERSONA_COLORS[msg.sender.id] || '#6B7280';
                const adminBadge = isAdmin(msg) && !isSystem(msg);

                return (
                  <div key={msg.id} className={`msg-row${own ? ' own' : ''}`}>
                    {!own && (
                      <div className="msg-avatar" style={{ background: color }} aria-hidden>
                        {initials(msg.sender.name)}
                      </div>
                    )}
                    <div>
                      {!own && (
                        <div className="bubble-sender" style={{ color }}>
                          {msg.sender.name}
                          {adminBadge && <span className="badge badge-admin" style={{ marginLeft: '0.4rem', fontSize: '0.6rem' }}>admin</span>}
                          {msg.sender.isBot && <span className="badge badge-bot" style={{ marginLeft: '0.4rem', fontSize: '0.6rem' }}>bot</span>}
                        </div>
                      )}
                      <div className={`bubble ${own ? 'own' : 'other'} ${msg.status === 'deleted' ? 'deleted' : ''} ${msg.status === 'held' ? 'held' : ''}`}>
                        {msg.status === 'deleted' ? 'This message was removed by Bonekeeper'
                          : msg.status === 'held' ? 'Message under review'
                          : msg.text}
                        <div className="bubble-meta">
                          <span>{formatTime(msg.timestamp)}</span>
                          {own && <span className="bubble-ticks" aria-label="delivered">✓✓</span>}
                          {msg.status === 'restored' && <span style={{ color: 'var(--teal)', fontSize: '0.65rem' }}>↩ restored</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {messages.length === 0 && (
            <div className="empty-state"><span className="skull">💀</span>Waiting for the first message…</div>
          )}

          {!atBottom && newCount > 0 && (
            <button className="new-msg-btn" onClick={scrollToBottom}>
              ↓ {newCount} new message{newCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Members panel */}
        {showMembers && (
          <div className="members-panel" role="complementary" aria-label="Members">
            <h3 style={{ marginBottom: '0.75rem' }}>Members</h3>
            {[
              { id: 'human',       name: role === 'admin' ? 'Admin (you)' : 'You',  color: '#0E7C6B' },
              { id: 'luna',        name: 'Luna',           color: '#7C3AED' },
              { id: 'pip',         name: 'Pip',            color: '#0891B2' },
              { id: 'sage',        name: 'Sage',           color: '#0E7C6B' },
              { id: 'spambot_sam', name: 'SpamBot Sam',    color: '#B45309' },
              { id: 'scamilla',    name: 'Scamilla',       color: '#B3202A' },
              { id: 'otto',        name: 'Off-Topic Otto', color: '#6B7280' },
              { id: 'spike',       name: 'Spike',          color: '#DC2626' },
            ].map(m => {
              const warns = messages.filter(msg => msg.warningChip?.toLowerCase().includes(m.name.toLowerCase())).length;
              return (
                <div key={m.id} className="member-item">
                  <div className="member-dot" style={{ background: m.color }} />
                  <span style={{ fontSize: '0.82rem' }}>{m.name}</span>
                  {warns > 0 && <span className="member-warnings">⚠️{warns}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="chat-footer">
        <div className="role-switch">
          <label htmlFor="role-sel">Post as:</label>
          <select id="role-sel" value={adminPinOpen ? 'admin' : role} onChange={e => changeRole(e.target.value as 'member' | 'admin')}>
            <option value="member">Member (moderated)</option>
            <option value="admin">Admin (never deleted)</option>
          </select>
          {adminPinOpen && (
            <>
              <input
                className="form-input"
                style={{ width: '7rem', marginLeft: '0.5rem' }}
                type="password"
                value={adminPin}
                onChange={e => setAdminPin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmAdminRole()}
                placeholder="Admin PIN"
                aria-label="Admin PIN"
              />
              <button className="btn btn-primary" onClick={confirmAdminRole}>Unlock</button>
              <button className="btn btn-ghost" onClick={() => { setAdminPinOpen(false); setAdminPin(''); setAdminError(''); }}>Cancel</button>
              {adminError && <span style={{ color: 'var(--blood-red)', fontSize: '0.72rem' }}>{adminError}</span>}
            </>
          )}
          {role === 'admin' && <span style={{ marginLeft: '0.5rem', opacity: 0.6, fontSize: '0.78rem' }}>🛡 bypass moderation</span>}
        </div>
        <div className="composer">
          <textarea
            ref={inputRef}
            className="composer-input"
            placeholder="Type a message…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            aria-label="Message input"
          />
          <button id="composer-send-btn" className="composer-send" onClick={send} aria-label="Send" disabled={!input.trim()} title="Send message (Enter)">➤</button>
        </div>
      </div>
    </div>
  );
}
