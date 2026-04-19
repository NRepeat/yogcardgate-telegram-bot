import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { RequestsResponse } from '../lib/types';

export default function Requests() {
  const [data, setData] = useState<RequestsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');

  const load = (p = page, s = status) => {
    api<RequestsResponse>(`/api/request/admin/list?page=${p}&limit=50&status=${s}`).then(setData);
  };

  useEffect(() => { load(); }, [page, status]);

  return (
    <div>
      <h1 className="page-title">Requests</h1>

      <div className="filter-bar">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
        {data && <span className="muted">{data.total} total</span>}
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th><th>Amount</th><th>Currency</th><th>Method</th>
            <th>Rate</th><th>Vendor</th><th>Worker</th><th>Status</th>
            <th>Created</th><th>Completed</th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((r) => (
            <tr key={r.id}>
              <td className="mono muted">{r.id.slice(-8)}</td>
              <td><strong>{r.amount}</strong></td>
              <td>{r.currency}</td>
              <td>{r.method}</td>
              <td>{r.rate || '-'}</td>
              <td>{r.vendor}</td>
              <td>{r.worker ? `@${r.worker}` : '-'}</td>
              <td><span className={`badge ${r.status}`}>{r.status}</span></td>
              <td className="muted">{new Date(r.createdAt).toLocaleString('ru')}</td>
              <td className="muted">{r.completedAt ? new Date(r.completedAt).toLocaleString('ru') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {data.page} / {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
