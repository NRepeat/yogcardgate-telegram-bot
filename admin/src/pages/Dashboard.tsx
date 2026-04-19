import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { DashboardStats } from '../lib/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#58a6ff', '#3fb950', '#f85149', '#d29922', '#bc8cff', '#f0883e', '#8b949e'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api<DashboardStats>('/api/request/admin/dashboard').then(setData);
  }, []);

  if (!data) return <p className="muted">Loading...</p>;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div className="stat-grid">
        <div className="stat-card blue">
          <div className="value">{data.totalRequests}</div>
          <div className="label">Total Requests</div>
        </div>
        <div className="stat-card green">
          <div className="value">{data.completedRequests}</div>
          <div className="label">Completed</div>
        </div>
        <div className="stat-card red">
          <div className="value">{data.failedRequests}</div>
          <div className="label">Failed</div>
        </div>
        <div className="stat-card yellow">
          <div className="value">{data.pendingRequests}</div>
          <div className="label">Pending</div>
        </div>
        <div className="stat-card green">
          <div className="value">{data.successRate}%</div>
          <div className="label">Success Rate</div>
        </div>
        <div className="stat-card purple">
          <div className="value">{data.avgCompletionMinutes}m</div>
          <div className="label">Avg Completion</div>
        </div>
        <div className="stat-card blue">
          <div className="value">{data.todayRequests}</div>
          <div className="label">Today Requests</div>
        </div>
        <div className="stat-card green">
          <div className="value">{data.todayVolume.toLocaleString()}</div>
          <div className="label">Today Volume</div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card full">
          <h3>Requests per Day (30 days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.dailyData}>
              <XAxis dataKey="date" tick={{ fill: '#8b949e', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1c1f26', border: '1px solid #333', borderRadius: 8, color: '#e1e4e8' }} />
              <Bar dataKey="count" fill="#58a6ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card full">
          <h3>Volume per Day (30 days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.dailyData}>
              <XAxis dataKey="date" tick={{ fill: '#8b949e', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1c1f26', border: '1px solid #333', borderRadius: 8, color: '#e1e4e8' }} />
              <Bar dataKey="volume" fill="#3fb950" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>By Currency</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.byCurrency} dataKey="count" nameKey="currency" cx="50%" cy="50%" outerRadius={90} label={(props: any) => `${props.currency}: ${props.count}`}>
                {data.byCurrency.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1c1f26', border: '1px solid #333', borderRadius: 8, color: '#e1e4e8' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>By Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={(props: any) => `${props.status}: ${props.count}`}>
                {data.byStatus.map((entry, i) => {
                  const color = entry.status === 'COMPLETED' ? '#3fb950' : entry.status === 'FAILED' ? '#f85149' : entry.status === 'PENDING' ? '#d29922' : '#58a6ff';
                  return <Cell key={i} fill={color} />;
                })}
              </Pie>
              <Tooltip contentStyle={{ background: '#1c1f26', border: '1px solid #333', borderRadius: 8, color: '#e1e4e8' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
