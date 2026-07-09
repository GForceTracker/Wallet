import React, { useState } from 'react';
import { ArrowLeft, LogOut, User, Shield, Info, KeyRound, Edit2, Eye, EyeOff, Check, X } from 'lucide-react';
import { TrantLogo } from '../components/TrantLogo';
import { api } from '../api';
import { toast } from 'sonner';

interface SettingsViewProps {
  username: string;
  onBack: () => void;
  onLogout: () => void;
  onUpdateUsername: (newUsername: string) => void;
}

export function SettingsView({ username, onBack, onLogout, onUpdateUsername }: SettingsViewProps) {
  const walletName = username ? `${username} Wallet 1` : 'My Wallet';

  // Change username state
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernamePassword, setUsernamePassword] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const handleChangeUsername = async () => {
    if (!newUsername.trim()) {
      toast.error('Please enter a new username');
      return;
    }
    if (!usernamePassword) {
      toast.error('Please enter your password to confirm');
      return;
    }
    setSavingUsername(true);
    try {
      const res = await api.changeUsername(newUsername.trim(), usernamePassword);
      onUpdateUsername(res.username);
      toast.success('Username updated successfully');
      setShowUsernameForm(false);
      setNewUsername('');
      setUsernamePassword('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update username');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const cancelUsername = () => {
    setShowUsernameForm(false);
    setNewUsername('');
    setUsernamePassword('');
  };

  const cancelPassword = () => {
    setShowPasswordForm(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center p-6 pt-8 relative">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-muted hover:text-foreground transition-colors absolute left-6"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="font-semibold text-foreground w-full text-center">Settings</div>
      </div>

      {/* Wallet identity card */}
      <div className="mx-6 mt-2 mb-6 bg-card border border-border rounded-2xl p-5 flex flex-col items-center gap-3">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
          <TrantLogo size={32} />
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-foreground tracking-wide">{walletName}</div>
          <div className="text-xs text-muted mt-0.5 tracking-widest uppercase">TRANT Wallet</div>
        </div>
      </div>

      <div className="flex-1 px-6 flex flex-col gap-3 overflow-y-auto pb-4">

        {/* Account */}
        <SectionLabel label="Account" />

        {/* Username row */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted">Username</div>
              <div className="text-sm font-medium text-foreground truncate">{username}</div>
            </div>
            <button
              onClick={() => { setShowUsernameForm(v => !v); cancelPassword(); }}
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>

          {showUsernameForm && (
            <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-3 bg-background/40">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted font-medium">New Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  placeholder="Enter new username"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted font-medium">Confirm with Password</label>
                <input
                  type="password"
                  value={usernamePassword}
                  onChange={e => setUsernamePassword(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  placeholder="Your current password"
                  onKeyDown={e => e.key === 'Enter' && handleChangeUsername()}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cancelUsername}
                  className="flex-1 border border-border text-muted rounded-xl py-2.5 text-sm font-medium hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleChangeUsername}
                  disabled={savingUsername}
                  className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-background rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {savingUsername ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security */}
        <SectionLabel label="Security" />

        {/* Change password row */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted">Authentication</div>
              <div className="text-sm font-medium text-foreground">Username & Password</div>
            </div>
            <button
              onClick={() => { setShowPasswordForm(v => !v); cancelUsername(); }}
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
            </button>
          </div>

          {showPasswordForm && (
            <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-3 bg-background/40">
              <PasswordInput
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                show={showCurrentPw}
                onToggle={() => setShowCurrentPw(v => !v)}
                placeholder="Enter current password"
                autoFocus
              />
              <PasswordInput
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNewPw}
                onToggle={() => setShowNewPw(v => !v)}
                placeholder="At least 6 characters"
              />
              <PasswordInput
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showConfirmPw}
                onToggle={() => setShowConfirmPw(v => !v)}
                placeholder="Repeat new password"
                onEnter={handleChangePassword}
              />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={cancelPassword}
                  className="flex-1 border border-border text-muted rounded-xl py-2.5 text-sm font-medium hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={savingPassword}
                  className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-background rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {savingPassword ? 'Saving…' : 'Change'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* About */}
        <SectionLabel label="About" />
        <SettingsRow
          icon={<Info className="w-5 h-5 text-primary" />}
          title="App Name"
          value="TRANT Wallet"
        />
        <SettingsRow
          icon={<Info className="w-5 h-5 text-primary" />}
          title="Version"
          value="1.0.0"
        />
      </div>

      <div className="px-6 pt-4 pb-8 mt-auto">
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full py-3.5 text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors rounded-xl active:scale-95 font-medium"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
}

function PasswordInput({
  label, value, onChange, show, onToggle, placeholder, autoFocus, onEnter,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder?: string;
  autoFocus?: boolean; onEnter?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted font-medium">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 pr-11 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
          placeholder={placeholder}
          autoFocus={autoFocus}
          onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="pt-2 pb-1">
      <span className="text-xs font-semibold uppercase tracking-widest text-primary">{label}</span>
    </div>
  );
}

function SettingsRow({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3.5">
      <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted">{title}</div>
        <div className="text-sm font-medium text-foreground truncate">{value}</div>
      </div>
    </div>
  );
}
