import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import NavClient from './components/NavClient';

export const metadata: Metadata = {
  title: 'Bonekeeper',
  description: 'AI-powered group chat moderator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const role = cookies().get('bk_role_display')?.value || '';
  const isLoggedIn = role === 'admin' || role === 'member';

  return (
    <html lang="en">
      <body>
        {isLoggedIn ? (
          <>
            <NavClient role={role} />
            <div className="main">{children}</div>
          </>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
