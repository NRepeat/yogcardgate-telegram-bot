import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { WorkerStats } from '../lib/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
} from 'recharts';

const COLORS = ['#58a6ff', '#3fb950', '#bc8cff', '#d29922', '#f0883e', '#f85149'];
const MEDALS = ['🥇', '🥈', '🥉'];

type SortKey = 'completed' | 'completedToday' | 'completedWeek' | 'completedMonth' | 'totalAmount' | 'successRate' | 'avgCompletionMin' | 'streak';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'completed', label: 'All Time' },
  { key: 'completedToday', label: 'Today' },
  { key: 'completedWeek', label: 'This Week' },
  { key: 'completedMonth', label: 'This Month' },
  { key: 'totalAmount', label: 'Volume' },
  { key: 'successRate', label: 'Success Rate' },
  { key: 'avgCompletionMin', label: 'Speed' },
  { key: 'streak', label: 'Streak' },
];

export default function Workers() {
  const [workers, setWorkers] = useState<WorkerStats[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('completed');

  useEffect(() => {
    api<WorkerStats[]>('/api/users/stats').then(setWorkers);
  }, []);

  const sorted = [...workers].sort((a, b) => {
    if (sortBy === 'avgCompletionMin') {
      // Lower is better for speed — but 0 means no data, push to bottom
      const aVal = a.stats.avgCompletionMin || Infinity;
      const bVal = b.stats.avgCompletionMin || Infinity;
      return aVal - bVal;
    }
    return (b.stats[sortBy] as number) - (a.stats[sortBy] as number);
  });

  const chartData = sorted.map((w) => ({
    name: `@${w.username}`,
    value: sortBy === 'avgCompletionMin' ? w.stats.avgCompletionMin : w.stats[sortBy] as number,
  }));

  // Build 7-day sparkline data labels
  const dayLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayLabels.push(d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' }));
  }

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortBy)?.label || '';
  const sortUnit = sortBy === 'avgCompletionMin' ? ' min' : sortBy === 'successRate' ? '%' : '';

  return (
    <div>
      <h1 className="page-title">Workers</h1>

      {/* Leaderboard */}
      <div className="chart-card full" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Leaderboard — {sortLabel}</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                className={sortBy === opt.key ? 'btn' : 'toggle-btn on'}
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setSortBy(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 55)}>
            <BarChart data={chartData} layout="vertical" barSize={28}>
              <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#e1e4e8', fontSize: 13 }}
                width={120}
                tickFormatter={(name, i) => `${MEDALS[i] || `#${i + 1}`} ${name}`}
              />
              <Tooltip
                contentStyle={{ background: '#1c1f26', border: '1px solid #333', borderRadius: 8, color: '#e1e4e8' }}
                formatter={(v: any) => [`${v}${sortUnit}`, sortLabel]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : COLORS[(i - 3) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Ranking table */}
      <div className="chart-card full" style={{ marginBottom: 24 }}>
        <h3>Ranking Overview</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Worker</th>
              <th>Status</th>
              <th>Today</th>
              <th>Week</th>
              <th>Month</th>
              <th>All Time</th>
              <th>Volume</th>
              <th>Success</th>
              <th>Avg Time</th>
              <th>Fastest</th>
              <th>Streak</th>
              <th>7d Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((w, i) => {
              const s = w.stats;
              const sparkData = s.dailyCompleted.map((c, j) => ({ day: dayLabels[j], val: c }));
              return (
                <tr key={w.id}>
                  <td style={{ fontSize: 18 }}>{MEDALS[i] || i + 1}</td>
                  <td><strong>@{w.username}</strong></td>
                  <td>
                    <span className={`worker-badge ${w.onPause ? 'paused' : 'active'}`}>
                      {w.onPause ? 'PAUSED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--green)' }}>{s.completedToday}</td>
                  <td>{s.completedWeek}</td>
                  <td>{s.completedMonth}</td>
                  <td style={{ color: 'var(--blue)' }}>{s.completed}</td>
                  <td>{s.totalAmount.toLocaleString()}</td>
                  <td style={{ color: s.successRate >= 90 ? 'var(--green)' : s.successRate >= 70 ? 'var(--yellow)' : 'var(--red)' }}>
                    {s.successRate}%
                  </td>
                  <td>{s.avgCompletionMin ? `${s.avgCompletionMin}m` : '-'}</td>
                  <td style={{ color: 'var(--purple)' }}>{s.fastestMin ? `${s.fastestMin}m` : '-'}</td>
                  <td>{s.streak > 0 ? `${s.streak} 🔥` : '0'}</td>
                  <td style={{ width: 120 }}>
                    <ResponsiveContainer width={110} height={30}>
                      <LineChart data={sparkData}>
                        <Line type="monotone" dataKey="val" stroke="#58a6ff" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Individual worker cards */}
      {sorted.map((w, i) => {
        const s = w.stats;
        const sparkData = s.dailyCompleted.map((c, j) => ({ day: dayLabels[j], val: c }));

        return (
          <div key={w.id} className="worker-card">
            <h3>
              {MEDALS[i] || `#${i + 1}`} @{w.username}
              <span className={`worker-badge ${w.onPause ? 'paused' : 'active'}`}>
                {w.onPause ? 'PAUSED' : 'ACTIVE'}
              </span>
              {s.streak > 0 && <span style={{ marginLeft: 8, fontSize: 13 }}>{s.streak} 🔥 streak</span>}
            </h3>

            <div className="worker-stats">
              <Stat val={s.completedToday} lbl="Today" color="var(--green)" />
              <Stat val={s.completedWeek} lbl="Week" color="var(--blue)" />
              <Stat val={s.completedMonth} lbl="Month" color="var(--blue)" />
              <Stat val={s.completed} lbl="All Time" color="var(--blue)" />
              <Stat val={s.failed} lbl="Failed" color="var(--red)" />
              <Stat val={s.active} lbl="Active" color="var(--yellow)" />
              <Stat val={`${s.successRate}%`} lbl="Success Rate" color={s.successRate >= 90 ? 'var(--green)' : s.successRate >= 70 ? 'var(--yellow)' : 'var(--red)'} />
              <Stat val={s.avgCompletionMin ? `${s.avgCompletionMin}m` : '-'} lbl="Avg Time" color="var(--purple)" />
              <Stat val={s.fastestMin ? `${s.fastestMin}m` : '-'} lbl="Fastest" color="var(--purple)" />
              <Stat val={s.todayAmount.toLocaleString()} lbl="Today Volume" />
              <Stat val={s.weekAmount.toLocaleString()} lbl="Week Volume" />
              <Stat val={s.totalAmount.toLocaleString()} lbl="Total Volume" />
            </div>

            {/* 7-day activity sparkline */}
            <div style={{ marginTop: 16 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Last 7 days</div>
              <ResponsiveContainer width="100%" height={60}>
                <BarChart data={sparkData}>
                  <XAxis dataKey="day" tick={{ fill: '#8b949e', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1c1f26', border: '1px solid #333', borderRadius: 8, color: '#e1e4e8' }} />
                  <Bar dataKey="val" fill="#58a6ff" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}

      {workers.length === 0 && <p className="muted">No workers found</p>}
    </div>
  );
}

function Stat({ val, lbl, color }: { val: string | number; lbl: string; color?: string }) {
  return (
    <div className="worker-stat">
      <div className="val" style={color ? { color } : undefined}>{val}</div>
      <div className="lbl">{lbl}</div>
    </div>
  );
}
