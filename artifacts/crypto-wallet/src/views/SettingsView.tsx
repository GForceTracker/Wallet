import React from 'react';
import { ArrowLeft, LogOut, User, Wallet, Shield, Info } from 'lucide-react';
import { TrantLogo } from '../components/TrantLogo';

interface SettingsViewProps {
  username: string;
  onBack: () => void;
  onLogout: () => void;
}

export function SettingsView({ username, onBack, onLogout }: SettingsViewProps) {
  const walletName = username ? `${username} Wallet 1` : 'My Wallet';

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

      <div className="flex-1 px-6 flex flex-col gap-3 overflow-y-auto">

        {/* Account */}
        <SectionLabel label="Account" />
        <SettingsRow
          icon={<User className="w-5 h-5 text-primary" />}
          title="Username"
          value={username}
        />
        <SettingsRow
          icon={<Wallet className="w-5 h-5 text-primary" />}
          title="Wallet Name"
          value={walletName}
        />

        {/* Security */}
        <SectionLabel label="Security" />
        <SettingsRow
          icon={<Shield className="w-5 h-5 text-primary" />}
          title="Authentication"
          value="Username & Password"
        />

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
