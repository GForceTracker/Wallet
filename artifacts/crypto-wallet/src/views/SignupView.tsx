import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { TrantLogo } from '../components/TrantLogo';
import { api } from '../api';

interface SignupViewProps {
  onSuccess: () => void;
  onBack: () => void;
}

export function SignupView({ onSuccess, onBack }: SignupViewProps) {
  const [username, setUsername] = useState('');
  const [walletName, setWalletName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username.trim().length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    if (!walletName.trim()) {
      setError('Please enter a name for your wallet.');
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
      await api.signup(username.trim(), password, walletName.trim());
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background px-6 pt-12 pb-10 overflow-y-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="p-2 -ml-2 text-muted hover:text-foreground transition-colors self-start mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Brand mark */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-2 mb-2">
          <TrantLogo size={28} />
          <span className="font-bold tracking-[0.14em] text-foreground text-xl">TRANT</span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-1">Create Account</h1>
        <p className="text-muted text-sm text-center">Set up your wallet to get started</p>
      </div>

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
          <label className="text-sm text-muted px-1">Wallet Name</label>
          <input
            type="text"
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
            placeholder="e.g. My Main Wallet"
            maxLength={40}
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
              placeholder="At least 6 characters"
              autoComplete="new-password"
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

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted px-1">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3.5 pr-12 text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors p-1"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-destructive text-sm px-1 font-medium">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-4 mt-2 transition-colors shadow-lg active:scale-[0.98]"
        >
          {loading ? 'Creating wallet…' : 'Create Wallet'}
        </button>

        <p className="text-center text-sm text-muted mt-1">
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
