import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { api } from '../api';

interface LoginViewProps {
  onLogin: (role: 'user' | 'admin') => void;
  onSignup: () => void;
}

export function LoginView({ onLogin, onSignup }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const auth = await api.login(username.trim(), password);
      onLogin(auth.role as 'user' | 'admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid username or password.');
    } finally {
      setLoading(false);
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
            autoComplete="username"
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
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="text-destructive text-sm px-1 mt-1 font-medium">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-success hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl px-4 py-4 mt-4 transition-colors shadow-lg active:scale-[0.98]"
        >
          {loading ? 'Connecting…' : 'Login'}
        </button>

        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          type="button"
          onClick={onSignup}
          className="w-full bg-card border border-border hover:border-primary text-foreground font-medium rounded-xl px-4 py-4 transition-colors active:scale-[0.98]"
        >
          Create Account
        </button>
      </form>
    </div>
  );
}
