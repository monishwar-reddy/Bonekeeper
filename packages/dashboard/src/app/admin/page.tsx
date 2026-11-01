import { cookies } from 'next/headers';
import { verify } from '@/lib/auth';
import AdminReport from './AdminReport';

export default function AdminPage() {
  const signed = cookies().get('bk_role')?.value || '';
  const role   = verify(signed);
  if (role !== 'admin') {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒 Admins only</h1>
        <p style={{ color: 'var(--muted)' }}>You do not have permission to view this page.</p>
      </div>
    );
  }
  return <AdminReport />;
}
