'use client';
import { useState, useEffect, useCallback } from 'react';
import { AuditRecord, ModerationCategory } from '@/vendor/core/types';

interface UserRecord {
  id: string;
  name: string;
  role: string;
  warnings: number;
}

interface AuditData {
  audit: AuditRecord[];
  deleted: number;
  held: number;
  restored: number;
  fpRate: string;
  correctionsCount: number;
  users?: UserRecord[];
}

interface GroupConfig {
  strictness: string;
  description: string;
  dryRun: boolean;
  requireAdminApproval: boolean;
  deleteLinksFromNonAdmins: boolean;
  enableRepeatOffenderAction: boolean;
  pauseBots: boolean;
  allowlist: { users: string[]; domains: string[]; phrases?: string[] };
}

type Tab = 'report' | 'settings' | 'audit';

const CATEGORIES: ModerationCategory[] = ['spam', 'scam', 'off_topic', 'unnecessary', 'fine'];

function ConfBar({ value }: { value: number }) {
  return (
    <div className="conf-bar" style={{ minWidth: 60 }} title={`${Math.round(value * 100)}%`}>
      <div className={`conf-fill${value >= 0.8 ? ' high' : ''}`} style={{ width: `${value * 100}%` }} />
    </div>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="toggle-row">
      <div>
        <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{label}</div>
        <div className="toggle-desc">{desc}</div>
      </div>
      <label className="toggle" aria-label={label}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}

interface UndoItem {
  auditId: string;
  senderId?: string;
  prevMessageStatus: 'ok' | 'deleted' | 'held' | 'restored';
  prevReviewStatus: string;
  prevWarningCount?: number;
  prevCategory?: ModerationCategory;
  description: string;
}

export default function AdminReport() {
  const [data, setData] = useState<AuditData | null>(null);
  const [config, setConfig] = useState<GroupConfig | null>(null);
  const [tab, setTab] = useState<Tab>('report');
  const [filter, setFilter] = useState({ category: '', sender: '', action: '', status: '', date: '', search: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');
  const [undoStack, setUndoStack] = useState<UndoItem[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [diff, setDiff] = useState<Array<{ field: string; from: string; to: string }> | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([
        fetch('/api/admin/audit').then(r => r.json()),
        fetch('/api/admin/config').then(r => r.json()),
      ]);
      setData(a);
      setConfig(c);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 3s for live updates
  useEffect(() => {
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  };

  const doAction = async (action: string, auditId: string, extra?: { newCategory?: string; domain?: string; phrase?: string }) => {
    const record = data?.audit.find(r => r.id === auditId);
    if (!record) return;

    const userObj = data?.users?.find(u => u.id === record.senderId);
    const prevWarn = userObj?.warnings ?? 0;

    const undoInfo: UndoItem = {
      auditId,
      senderId: record.senderId,
      prevMessageStatus: (record.action === 'deleted' ? 'deleted' : record.action === 'held' ? 'held' : 'ok') as any,
      prevReviewStatus: record.reviewStatus || 'pending',
      prevWarningCount: prevWarn,
      prevCategory: record.category,
      description: action,
    };

    const res = await fetch('/api/admin/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, auditId, ...extra }),
    });

    if (res.ok) {
      setUndoStack(s => [...s, undoInfo]);
      let toastMsg = '✅ Action applied';
      if (action === 'restore') toastMsg = '✅ Message restored (counted as false positive)';
      else if (action === 'confirm') toastMsg = '✅ Decision confirmed';
      else if (action === 'allow_sender') toastMsg = `✅ Always allowing sender "${record.senderName}"`;
      else if (action === 'allow_domain') toastMsg = `✅ Domain added to allowlist`;
      else if (action === 'allow_phrase') toastMsg = `✅ Phrase added to allowlist`;
      else if (action === 'change_category') toastMsg = `✅ Category updated to ${extra?.newCategory}`;
      showToast(toastMsg);
      load();
    }
  };

  const doUndo = async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;

    await fetch('/api/admin/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'undo',
        auditId: last.auditId,
        prevState: {
          prevMessageStatus: last.prevMessageStatus,
          prevReviewStatus: last.prevReviewStatus,
          prevWarningCount: last.prevWarningCount,
          prevCategory: last.prevCategory,
        },
      }),
    });

    setUndoStack(s => s.slice(0, -1));
    showToast('↩ Action undone: previous message status & warning count restored');
    load();
  };

  const bulkAction = async (action: 'restore' | 'confirm') => {
    for (const id of selected) {
      await doAction(action, id);
    }
    setSelected(new Set());
  };

  const saveConfig = async (patch: Partial<GroupConfig>) => {
    const res = await fetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) { setConfig(await res.json()); showToast('✅ Settings saved'); }
  };

  const handleChat = () => {
    if (!chatInput.trim() || !config) return;
    const lower = chatInput.toLowerCase();
    const changes: Array<{ field: string; from: string; to: string }> = [];
    if (lower.includes('strict')) changes.push({ field: 'strictness', from: config.strictness, to: 'strict' });
    if (lower.includes('lenient') || lower.includes('relaxed')) changes.push({ field: 'strictness', from: config.strictness, to: 'lenient' });
    if (lower.includes('dry run') || lower.includes('séance')) changes.push({ field: 'dryRun', from: String(config.dryRun), to: 'true' });
    if (lower.includes('pause bot')) changes.push({ field: 'pauseBots', from: String(config.pauseBots), to: 'true' });
    if (changes.length === 0) changes.push({ field: 'description', from: config.description, to: chatInput.trim() });
    setDiff(changes);
    setChatInput('');
  };

  const applyDiff = async () => {
    if (!diff || !config) return;
    const patch: Partial<GroupConfig> = {};
    diff.forEach(({ field, to }) => {
      if (field === 'strictness') (patch as any).strictness = to;
      if (field === 'dryRun') (patch as any).dryRun = to === 'true';
      if (field === 'pauseBots') (patch as any).pauseBots = to === 'true';
      if (field === 'description') (patch as any).description = to;
    });
    await saveConfig(patch);
    setDiff(null);
  };

  const filteredAudit = (data?.audit || []).filter(r => {
    if (filter.category && r.category !== filter.category) return false;
    if (filter.sender && !r.senderName.toLowerCase().includes(filter.sender.toLowerCase())) return false;
    if (filter.action && r.action !== filter.action) return false;
    if (filter.status && (r.reviewStatus || 'pending') !== filter.status) return false;
    if (filter.search && !r.messageText.toLowerCase().includes(filter.search.toLowerCase())) return false;
    if (filter.date) {
      const recordDate = new Date(r.timestamp).toISOString().slice(0, 10);
      if (recordDate !== filter.date) return false;
    }
    return true;
  }).reverse(); // newest first

  if (!data || !config) {
    return <div className="page"><div className="empty-state"><span className="skull">💀</span>Loading...</div></div>;
  }

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <h1>💀 Admin Report</h1>
      <p className="page-subtitle">Review moderation decisions, correct mistakes, and teach the agent.</p>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><span className="stat-number red">{data.deleted}</span><span className="stat-label">Deleted</span></div>
        <div className="stat-card"><span className="stat-number amber">{data.held}</span><span className="stat-label">Held for Review</span></div>
        <div className="stat-card"><span className="stat-number green">{data.restored}</span><span className="stat-label">Restored (FP)</span></div>
        <div className="stat-card"><span className="stat-number">{data.fpRate}%</span><span className="stat-label">False-Positive Rate</span></div>
        <div className="stat-card"><span className="stat-number green">{data.correctionsCount}</span><span className="stat-label">Agent Corrections</span></div>
      </div>

      {data.correctionsCount > 0 && (
        <div className="card" style={{ background: '#F0FDF4', borderColor: '#86EFAC', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🧠</span>
          <span style={{ fontSize: '0.88rem' }}>Agent learned from <strong>{data.correctionsCount}</strong> correction{data.correctionsCount !== 1 ? 's' : ''} — future classifications will improve</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {(['report', 'settings', 'audit'] as Tab[]).map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {{ report: '📋 Report', settings: '⚙️ Settings', audit: '📜 Audit Log' }[t]}
          </button>
        ))}
      </div>

      {/* ── REPORT TAB ── */}
      {tab === 'report' && (
        <>
          {/* Bulk actions bar */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', background: '#F8FAFC', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selected.size} selected</span>
              <button className="btn btn-primary btn-sm" onClick={() => bulkAction('restore')}>✅ Bulk Restore</button>
              <button className="btn btn-ghost btn-sm" onClick={() => bulkAction('confirm')}>Bulk Confirm</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}

          {/* Filters */}
          <div className="filter-bar" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <input className="form-input" placeholder="Search text…" value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} aria-label="Search messages" style={{ flex: '1 1 180px' }} />
            <select className="form-select" value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} aria-label="Filter by category">
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="form-select" value={filter.action} onChange={e => setFilter(f => ({ ...f, action: e.target.value }))} aria-label="Filter by action">
              <option value="">All actions</option>
              <option value="deleted">Deleted</option>
              <option value="held">Held</option>
              <option value="quarantined">Quarantined</option>
            </select>
            <select className="form-select" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="restored">Restored</option>
            </select>
            <input className="form-input" placeholder="Sender…" value={filter.sender} onChange={e => setFilter(f => ({ ...f, sender: e.target.value }))} aria-label="Filter by sender" style={{ width: 140 }} />
            <input className="form-input" type="date" value={filter.date} onChange={e => setFilter(f => ({ ...f, date: e.target.value }))} aria-label="Filter by date" style={{ width: 150 }} />
            {(filter.search || filter.category || filter.action || filter.status || filter.sender || filter.date) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFilter({ category: '', sender: '', action: '', status: '', date: '', search: '' })}>Reset filters</button>
            )}
          </div>

          {filteredAudit.length === 0 ? (
            <div className="empty-state"><span className="skull">💀</span>Nothing lurking here.</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          checked={filteredAudit.length > 0 && selected.size === filteredAudit.length}
                          onChange={e => setSelected(e.target.checked ? new Set(filteredAudit.map(r => r.id)) : new Set())}
                        />
                      </th>
                      <th>Time</th>
                      <th>Platform</th>
                      <th>Sender</th>
                      <th>Message</th>
                      <th>Category</th>
                      <th>Confidence</th>
                      <th>AI Reason</th>
                      <th>Action</th>
                      <th>Status</th>
                      <th>Review Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map(r => {
                      const domainMatch = r.messageText.match(/https?:\/\/([^/\s]+)/i);
                      const extractedDomain = domainMatch ? domainMatch[1].toLowerCase() : null;

                      return (
                        <tr key={r.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.has(r.id)}
                              onChange={e => {
                                setSelected(prev => {
                                  const s = new Set(prev);
                                  e.target.checked ? s.add(r.id) : s.delete(r.id);
                                  return s;
                                });
                              }}
                              aria-label={`Select ${r.senderName}`}
                            />
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ fontSize: '0.75rem' }}>
                            <span className="badge" style={{ textTransform: 'capitalize' }}>{r.platform || 'web'}</span>
                          </td>
                          <td style={{ fontSize: '0.82rem', fontWeight: 500 }}>{r.senderName}</td>
                          <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }} title={r.messageText}>
                            {r.messageText}
                          </td>
                          <td><span className={`badge badge-${r.category}`}>{r.category.replace('_', ' ')}</span></td>
                          <td><ConfBar value={r.confidence} /></td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--muted)', maxWidth: 160 }}>{r.reason}</td>
                          <td>
                            <span className={`badge badge-${r.action === 'deleted' ? 'deleted' : r.action === 'held' ? 'held' : 'fine'}`}>
                              {r.action}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-${r.reviewStatus === 'restored' ? 'restored' : r.reviewStatus === 'confirmed' ? 'fine' : 'held'}`}>
                              {r.reviewStatus || 'pending'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              {r.reviewStatus !== 'restored' && (
                                <button className="btn btn-primary btn-sm" onClick={() => doAction('restore', r.id)} title="Restore message — marks as false positive and updates warning count">
                                  ✅ Restore
                                </button>
                              )}
                              {r.reviewStatus === 'pending' && (
                                <button className="btn btn-ghost btn-sm" onClick={() => doAction('confirm', r.id)} title="Confirm deletion">
                                  Confirm
                                </button>
                              )}

                              {/* Allow dropdown */}
                              <div style={{ display: 'inline-flex', gap: '0.2rem' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => doAction('allow_sender', r.id)} title={`Always allow sender "${r.senderName}"`}>
                                  👤 Allow Sender
                                </button>
                                {extractedDomain && (
                                  <button className="btn btn-ghost btn-sm" onClick={() => doAction('allow_domain', r.id, { domain: extractedDomain })} title={`Always allow domain "${extractedDomain}"`}>
                                    🌐 Allow Domain
                                  </button>
                                )}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => {
                                    const phrase = prompt('Allow phrase:', r.messageText.slice(0, 40));
                                    if (phrase) doAction('allow_phrase', r.id, { phrase });
                                  }}
                                  title="Always allow this phrase"
                                >
                                  💬 Allow Phrase
                                </button>
                              </div>

                              {/* Change category */}
                              <select
                                className="form-select"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem', width: 'auto' }}
                                defaultValue=""
                                onChange={e => {
                                  if (e.target.value) {
                                    doAction('change_category', r.id, { newCategory: e.target.value });
                                    e.target.value = '';
                                  }
                                }}
                                aria-label="Change category"
                              >
                                <option value="" disabled>Change category…</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div className="card">
          <h2>Group Settings</h2>
          <div className="form-group">
            <label className="form-label">Group Description (on-topic context for Gemini)</label>
            <textarea className="form-textarea" value={config.description} onChange={e => setConfig(c => c ? { ...c, description: e.target.value } : c)} />
          </div>
          <div className="form-group">
            <label className="form-label">Strictness</label>
            <select className="form-select" value={config.strictness} onChange={e => setConfig(c => c ? { ...c, strictness: e.target.value } : c)}>
              <option value="strict">Strict</option>
              <option value="balanced">Balanced (default)</option>
              <option value="lenient">Lenient</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Allowlisted User IDs / Names (comma-separated)</label>
            <input className="form-input" value={config.allowlist.users.join(', ')} onChange={e => setConfig(c => c ? { ...c, allowlist: { ...c.allowlist, users: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } } : c)} />
          </div>
          <div className="form-group">
            <label className="form-label">Allowlisted Domains (comma-separated)</label>
            <input className="form-input" value={config.allowlist.domains.join(', ')} onChange={e => setConfig(c => c ? { ...c, allowlist: { ...c.allowlist, domains: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } } : c)} />
          </div>
          <div className="form-group">
            <label className="form-label">Allowlisted Phrases (comma-separated)</label>
            <input className="form-input" value={(config.allowlist.phrases || []).join(', ')} onChange={e => setConfig(c => c ? { ...c, allowlist: { ...c.allowlist, phrases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } } : c)} />
          </div>
          <Toggle checked={config.dryRun} onChange={v => setConfig(c => c ? { ...c, dryRun: v } : c)} label="🕯️ Séance Mode (Dry Run)" desc="Log what would be deleted without acting" />
          <Toggle checked={config.requireAdminApproval} onChange={v => setConfig(c => c ? { ...c, requireAdminApproval: v } : c)} label="🛡 Require Admin Approval" desc="All deletes become holds until admin acts" />
          <div className="toggle-row">
            <div>
              <strong>🔗 Member link protection</strong>
              <div className="toggle-desc">Links posted by regular members are removed; greetings and normal text remain allowed.</div>
            </div>
            <span className="badge badge-fine">Always on</span>
          </div>
          <Toggle checked={config.enableRepeatOffenderAction} onChange={v => setConfig(c => c ? { ...c, enableRepeatOffenderAction: v } : c)} label="🔁 Repeat Offender Actions" desc="Warn then mute after 3 violations in 24h" />
          <Toggle checked={!!config.pauseBots} onChange={v => setConfig(c => c ? { ...c, pauseBots: v } : c)} label="⏸ Pause Bots" desc="Stop bots posting new messages" />

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={() => saveConfig(config)}>💾 Save Settings</button>
          </div>

          {/* Admin chat config */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <h2>🤖 Describe a Rule Change</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>Type a plain-language instruction — Bonekeeper converts it to a config diff.</p>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <textarea className="form-textarea" placeholder='e.g. "switch to strict mode" or "pause the bots"' value={chatInput} onChange={e => setChatInput(e.target.value)} style={{ flex: 1, minHeight: 50 }} />
              <button className="btn btn-primary" onClick={handleChat}>Send</button>
            </div>
            {diff && (
              <div style={{ marginTop: '1rem' }}>
                <h3>Proposed Changes</h3>
                <div className="diff-block">
                  {diff.map(d => (
                    <div key={d.field}>
                      <span style={{ opacity: 0.5 }}>  {d.field}:</span>{'\n'}
                      <span className="diff-remove">- {d.from}</span>{'\n'}
                      <span className="diff-add">+ {d.to}</span>{'\n'}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={applyDiff}>Apply</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDiff(null)}>Discard</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {tab === 'audit' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>📜 Agent Actions & Admin Overrides</h3>
            <small style={{ color: 'var(--muted)' }}>Complete audit trail of system classifications, automated actions, and human admin reviews.</small>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action Taken</th>
                  <th>Category</th>
                  <th>Target Sender</th>
                  <th>Message Snippet</th>
                  <th>Review Status</th>
                  <th>Reviewed By</th>
                </tr>
              </thead>
              <tbody>
                {[...(data.audit)].reverse().map(r => {
                  const actor = r.reviewedBy ? `${r.reviewedBy} (Admin Override)` : 'Bonekeeper AI';
                  return (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {new Date(r.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        <span className={`badge ${r.reviewedBy ? 'badge-admin' : 'badge-bot'}`}>{actor}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${r.action === 'deleted' ? 'deleted' : r.action === 'held' ? 'held' : 'fine'}`}>
                          {r.action}
                        </span>
                      </td>
                      <td><span className={`badge badge-${r.category}`}>{r.category}</span></td>
                      <td style={{ fontSize: '0.82rem' }}>{r.senderName}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }} title={r.messageText}>
                        {r.messageText}
                      </td>
                      <td>
                        <span className={`badge badge-${r.reviewStatus === 'restored' ? 'restored' : r.reviewStatus === 'confirmed' ? 'fine' : 'held'}`}>
                          {r.reviewStatus || 'pending'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                        {r.reviewedAt ? `${new Date(r.reviewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast with Undo */}
      {toast && (
        <div className="toast" role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>{toast}</span>
          {undoStack.length > 0 && (
            <button className="undo-btn" onClick={doUndo} style={{ background: '#F59E0B', color: '#000', fontWeight: 600, border: 'none', borderRadius: 4, padding: '0.2rem 0.6rem', cursor: 'pointer' }}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
