import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { TrantLogo } from '../components/TrantLogo';
import { api } from '../api';

interface LoginViewProps {
  onLogin: (username: string, role: string, userId: number | null) => void;
  onSignup: () => void;
}

export function LoginView({ onLogin, onSignup }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const auth = await api.login(username.trim(), password);
      onLogin(auth.username, auth.role, auth.user_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background px-6 pt-10 pb-8">
      {/* Brand mark */}
      <div className="flex flex-col items-center mb-6">
        <div className="flex items-center gap-2 mb-2">
          <TrantLogo size={32} />
          <span className="font-bold tracking-[0.14em] text-foreground text-2xl">TRANT</span>
        </div>
        <p className="text-muted text-sm">Enter credentials to access your wallet</p>
      </div>

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
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted px-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3.5 pr-12 text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="Password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors p-1"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-destructive text-sm px-1 font-medium">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-success hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-4 mt-2 transition-colors shadow-lg active:scale-[0.98]"
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
