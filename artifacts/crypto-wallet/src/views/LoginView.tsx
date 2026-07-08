import React, { useState } from 'react';
import { Lock } from 'lucide-react';

interface LoginViewProps {
  onLogin: (role: 'user' | 'admin') => void;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username === 'Miachen' && password === 'GJE8AT2021$') {
      onLogin('user');
    } else if (username === 'Admin' && password === 'Admin123') {
      onLogin('admin');
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="flex flex-col h-full p-6 bg-background items-center justify-center">
      <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-6 border border-border shadow-lg">
        <Lock className="w-8 h-8 text-primary" />
      </div>
      
      <h1 className="text-2xl font-semibold text-foreground mb-2">Secured Access</h1>
      <p className="text-muted text-sm mb-10 text-center">Enter credentials to access your wallet</p>

      <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted px-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
            placeholder="Username"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted px-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
            placeholder="Password"
          />
        </div>

        {error && (
          <div className="text-destructive text-sm px-1 mt-1 font-medium">{error}</div>
        )}

        <button
          type="submit"
          className="w-full bg-success hover:bg-success/90 text-white font-medium rounded-xl px-4 py-4 mt-6 transition-colors shadow-lg active:scale-[0.98]"
        >
          Connect
        </button>
      </form>
    </div>
  );
}
