import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import type { Rate } from '../lib/types';
import { toast } from '../components/Toast';

export default function Rates() {
  const [rates, setRates] = useState<Rate[]>([]);
  const changedRef = useRef<Map<string, Record<string, number>>>(new Map());

  const load = () => api<Rate[]>('/api/rates').then(setRates);
  useEffect(() => { load(); }, []);

  const groups = new Map<string, Rate[]>();
  for (const r of rates) {
    const key = `${r.currency}:${r.method}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const saveRate = async (id: string) => {
    const body = changedRef.current.get(id) || {};
    try {
      const updated = await api<Rate>(`/api/rates/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast(`${updated.currency}:${updated.method} updated`, 'success');
      changedRef.current.delete(id);
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const toggleRate = async (id: string, enabled: boolean) => {
    try {
      await api(`/api/rates/${id}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
      toast(enabled ? 'Enabled' : 'Disabled', 'success');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const toggleGroup = async (key: string, enable: boolean) => {
    const group = rates.filter((r) => `${r.currency}:${r.method}` === key);
    for (const r of group) {
      await api(`/api/rates/${r.id}`, { method: 'PUT', body: JSON.stringify({ enabled: enable }) });
    }
    toast(`${key} ${enable ? 'enabled' : 'disabled'}`, 'success');
    load();
  };

  const onChange = (id: string, field: string, value: string) => {
    const val = parseFloat(value);
    if (isNaN(val)) return;
    const entry = changedRef.current.get(id) || {};
    entry[field] = val;
    changedRef.current.set(id, entry);
  };

  return (
    <div>
      <h1 className="page-title">Rates</h1>
      <table>
        <thead>
          <tr><th>Currency</th><th>Method</th><th>Range</th><th>Rate</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {[...groups.entries()].map(([key, items]) => {
            items.sort((a, b) => b.minAmount - a.minAmount);
            const allOff = items.every((r) => !r.enabled);
            return [
              <tr key={`h-${key}`} className="group-header">
                <td colSpan={6}>
                  {key} {items[0].xml && <span className="mono muted"> {items[0].xml}</span>}
                  <button className={`toggle-btn ${allOff ? 'off' : 'on'}`} style={{ marginLeft: 10, fontSize: 11 }} onClick={() => toggleGroup(key, allOff)}>
                    {allOff ? 'ALL OFF' : 'ALL ON'}
                  </button>
                </td>
              </tr>,
              ...items.map((r) => (
                <tr key={r.id} className={r.enabled ? '' : 'disabled'}>
                  <td>{r.currency}</td>
                  <td>{r.method}</td>
                  <td>
                    <input className="rate-input" style={{ width: 70 }} defaultValue={r.minAmount} onChange={(e) => onChange(r.id, 'minAmount', e.target.value)} />
                    {' - '}
                    <input className="rate-input" style={{ width: 70 }} defaultValue={r.maxAmount} onChange={(e) => onChange(r.id, 'maxAmount', e.target.value)} />
                  </td>
                  <td><input className="rate-input" defaultValue={r.rate} onChange={(e) => onChange(r.id, 'rate', e.target.value)} /></td>
                  <td><button className={`toggle-btn ${r.enabled ? 'on' : 'off'}`} onClick={() => toggleRate(r.id, !r.enabled)}>{r.enabled ? 'ON' : 'OFF'}</button></td>
                  <td><button className="btn" onClick={() => saveRate(r.id)}>Save</button></td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
