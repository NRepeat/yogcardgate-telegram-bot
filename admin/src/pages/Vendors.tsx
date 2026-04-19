import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Vendor } from '../lib/types';
import { toast } from '../components/Toast';

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const load = () => api<Vendor[]>('/api/vendors').then(setVendors);
  useEffect(() => { load(); }, []);

  const toggleWork = async (id: string, work: boolean) => {
    try {
      const updated = await api<{ title: string; work: boolean }>(`/api/vendors/${id}/work`, { method: 'PUT', body: JSON.stringify({ work }) });
      toast(`${updated.title} work: ${updated.work ? 'ON' : 'OFF'}`, 'success');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const toggleReceipt = async (id: string, show: boolean) => {
    try {
      const updated = await api<{ title: string; showReceipt: boolean }>(`/api/vendors/${id}/receipt`, { method: 'PUT', body: JSON.stringify({ showReceipt: show }) });
      toast(`${updated.title} receipt: ${updated.showReceipt ? 'ON' : 'OFF'}`, 'success');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <h1 className="page-title">Vendors</h1>
      <table>
        <thead>
          <tr><th>Vendor</th><th>Chat ID</th><th>Token</th><th>Work</th><th>Receipt</th></tr>
        </thead>
        <tbody>
          {vendors.map((v) => (
            <tr key={v.id}>
              <td><strong>{v.title}</strong></td>
              <td className="mono muted">{v.chatId}</td>
              <td className="mono muted">{v.token || '-'}</td>
              <td><button className={`toggle-btn ${v.work ? 'on' : 'off'}`} onClick={() => toggleWork(v.id, !v.work)}>{v.work ? 'ON' : 'OFF'}</button></td>
              <td><button className={`toggle-btn ${v.showReceipt ? 'on' : 'off'}`} onClick={() => toggleReceipt(v.id, !v.showReceipt)}>{v.showReceipt ? 'ON' : 'OFF'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
