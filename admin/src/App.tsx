import { useState } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { getToken } from './lib/api';
import { ToastProvider } from './components/Toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Requests from './pages/Requests';
import Workers from './pages/Workers';
import Rates from './pages/Rates';
import Users from './pages/Users';
import Vendors from './pages/Vendors';
import './App.css';

function App() {
  const [authed, setAuthed] = useState(!!getToken());

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="app">
      <ToastProvider />
      <nav className="sidebar">
        <h2>Admin</h2>
        <NavLink to="/admin/dashboard">Dashboard</NavLink>
        <NavLink to="/admin/requests">Requests</NavLink>
        <NavLink to="/admin/workers">Workers</NavLink>
        <NavLink to="/admin/rates">Rates</NavLink>
        <NavLink to="/admin/users">Users</NavLink>
        <NavLink to="/admin/vendors">Vendors</NavLink>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/requests" element={<Requests />} />
          <Route path="/admin/workers" element={<Workers />} />
          <Route path="/admin/rates" element={<Rates />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/vendors" element={<Vendors />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
