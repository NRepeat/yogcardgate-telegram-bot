import { useEffect, useState } from 'react';

let showToastFn: (msg: string, type: 'success' | 'error') => void = () => {};

export function toast(msg: string, type: 'success' | 'error' = 'success') {
  showToastFn(msg, type);
}

export function ToastProvider() {
  const [msg, setMsg] = useState('');
  const [type, setType] = useState<'success' | 'error'>('success');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    showToastFn = (m, t) => {
      setMsg(m);
      setType(t);
      setVisible(true);
      setTimeout(() => setVisible(false), 3000);
    };
  }, []);

  if (!visible) return null;
  return <div className={`toast ${type}`}>{msg}</div>;
}
