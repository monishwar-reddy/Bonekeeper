'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface Props { role: string; }

export default function NavClient({ role }: Props) {
  const path = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
    router.refresh();
  };

  const links = [
    { href: '/chat',  icon: '💬', label: 'Chat' },
    ...(role === 'admin' ? [{ href: '/admin', icon: '💀', label: 'Admin Report' }] : []),
  ];

  return (
    <nav className="nav" aria-label="Main navigation">
      <div className="nav-logo">
        <span className="nav-logo-skull">💀</span>
        <div className="nav-logo-text">
          Bonekeeper
          <small>Skeleton Crew</small>
        </div>
      </div>

      <div className="nav-links">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link${path.startsWith(l.href) ? ' active' : ''}`}
            aria-current={path.startsWith(l.href) ? 'page' : undefined}
          >
            <span className="icon">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </div>

      <div className="nav-footer">
        <div className="role-chip">{role === 'admin' ? '🛡 Admin' : '👤 Member'}</div>
        <button className="nav-link" onClick={logout} style={{ padding: '0.5rem 0' }}>
          <span className="icon">🚪</span> Leave
        </button>
      </div>
    </nav>
  );
}
