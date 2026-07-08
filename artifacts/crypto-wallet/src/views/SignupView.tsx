import React, { useState } from 'react';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { api } from '../api';

interface SignupViewProps {
  onSuccess: () => void; // redirect to login after signup
  onBack: () => void;
}

export function SignupView({ onSuccess, onBack }: SignupViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username.trim().length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.signup(username.trim(), password);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 bg-background items-center justify-center">
      {/* Back button */}
      <div className="w-full flex items-start mb-4 -mt-4">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-6 border border-border shadow-lg">
        <UserPlus className="w-8 h-8 text-primary" />
      </div>

      <h1 className="text-2xl font-semibold text-foreground mb-2">Create Account</h1>
      <p className="text-muted text-sm mb-10 text-center">Sign up to access your wallet</p>

      <form onSubmit={handleSignup} className="w-full flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted px-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
            placeholder="Choose a username"
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
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted px-1">Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
            placeholder="Repeat your password"
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div className="text-destructive text-sm px-1 mt-1 font-medium">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl px-4 py-4 mt-4 transition-colors shadow-lg active:scale-[0.98]"
        >
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>

        <p className="text-center text-sm text-muted mt-2">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onBack}
            className="text-primary hover:underline font-medium"
          >
            Login
          </button>
        </p>
      </form>
    </div>
  );
}
