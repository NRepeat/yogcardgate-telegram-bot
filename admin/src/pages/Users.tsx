import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { User, Role } from '../lib/types';
import { toast } from '../components/Toast';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const load = () => {
    api<User[]>('/api/users').then(setUsers);
    api<Role[]>('/api/users/roles').then(setRoles);
  };
  useEffect(() => { load(); }, []);

  const toggleRole = async (userId: string, roleName: string, add: boolean) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    let newRoles = [...user.roles];
    if (add && !newRoles.includes(roleName)) newRoles.push(roleName);
    if (!add) newRoles = newRoles.filter((r) => r !== roleName);
    try {
      const updated = await api<{ username: string; roles: string[] }>(`/api/users/${userId}/roles`, { method: 'PUT', body: JSON.stringify({ roles: newRoles }) });
      toast(`@${updated.username}: ${updated.roles.join(', ')}`, 'success');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const togglePause = async (userId: string, pause: boolean) => {
    try {
      const updated = await api<{ username: string; onPause: boolean }>(`/api/users/${userId}/pause`, { method: 'PUT', body: JSON.stringify({ onPause: pause }) });
      toast(`@${updated.username} ${updated.onPause ? 'paused' : 'active'}`, 'success');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <h1 className="page-title">Users</h1>
      <table>
        <thead>
          <tr><th>User</th><th>Telegram ID</th><th>Roles</th><th>Status</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><strong>@{u.username}</strong></td>
              <td className="mono muted">{u.telegramId}</td>
              <td>
                {roles.map((r) => {
                  const active = u.roles.includes(r.name);
                  return (
                    <button key={r.id} className={`role-btn ${r.name} ${active ? 'active' : ''}`} onClick={() => toggleRole(u.id, r.name, !active)}>
                      {r.name}
                    </button>
                  );
                })}
              </td>
              <td>
                <button className={`toggle-btn ${u.onPause ? 'off' : 'on'}`} onClick={() => togglePause(u.id, !u.onPause)}>
                  {u.onPause ? 'Paused' : 'Active'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
