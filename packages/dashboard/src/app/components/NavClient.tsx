'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface Props { role: string; }

// SVG icon components — no emoji
const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9l-3 2v-2H3a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const IconReport = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="5" y1="9" x2="9"  y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconLeave = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M10 5l3 3-3 3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SkullSvg = () => (
  <svg width="28" height="28" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <circle cx="32" cy="28" r="22" fill="white" opacity="0.9"/>
    <ellipse cx="32" cy="46" rx="14" ry="8" fill="white" opacity="0.9"/>
    <rect x="22" y="46" width="6" height="8" rx="1" fill="var(--navy)"/>
    <rect x="30" y="46" width="4" height="8" rx="1" fill="var(--navy)"/>
    <rect x="36" y="46" width="6" height="8" rx="1" fill="var(--navy)"/>
    <ellipse cx="24" cy="28" rx="5" ry="6" fill="var(--navy)"/>
    <ellipse cx="40" cy="28" rx="5" ry="6" fill="var(--navy)"/>
  </svg>
);

export default function NavClient({ role }: Props) {
  const path   = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
    router.refresh();
  };

  const links = [
    { href: '/chat',  Icon: IconChat,   label: 'Chat' },
    ...(role === 'admin' ? [{ href: '/admin', Icon: IconReport, label: 'Admin Report' }] : []),
  ];

  return (
    <nav className="nav" aria-label="Main navigation">
      <div className="nav-logo">
        <SkullSvg />
        <div className="nav-logo-text">
          Bonekeeper
          <small>Skeleton Crew</small>
        </div>
      </div>

      <div className="nav-links">
        {links.map(({ href, Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-link${path.startsWith(href) ? ' active' : ''}`}
            aria-current={path.startsWith(href) ? 'page' : undefined}
          >
            <span className="icon"><Icon /></span>
            {label}
          </Link>
        ))}
      </div>

      <div className="nav-footer">
        <div className="role-chip">{role === 'admin' ? '[ Admin ]' : '[ Member ]'}</div>
        <button className="nav-link" onClick={logout} style={{ padding: '0.5rem 0' }}>
          <span className="icon"><IconLeave /></span>
          Leave
        </button>
      </div>
    </nav>
  );
}
