import { useState } from 'react';
import { setToken, api } from '../lib/api';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setToken(value);
    try {
      await api('/api/users/roles');
      onLogin();
    } catch {
      setError('Invalid token');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-box">
        <h1>Admin Panel</h1>
        <input
          type="password"
          placeholder="API Token"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {error && <p style={{ color: 'var(--red)', marginBottom: 12, fontSize: 14 }}>{error}</p>}
        <button onClick={submit}>Login</button>
      </div>
    </div>
  );
}
