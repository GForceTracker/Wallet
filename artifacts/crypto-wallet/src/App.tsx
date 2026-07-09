import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { LoginView } from './views/LoginView';
import { SignupView } from './views/SignupView';
import { UserWalletView } from './views/UserWalletView';
import { AdminView } from './views/AdminView';
import { AssetDetailsView } from './views/AssetDetailsView';
import { SendWithdrawView } from './views/SendWithdrawView';
import { SettingsView } from './views/SettingsView';
import { SplashScreen } from './components/SplashScreen';
import { useColorScheme } from './hooks/useColorScheme';
import { AssetType } from './store';
import { api, setCurrentUser, clearCurrentUser } from './api';

export type ViewState = 'login' | 'signup' | 'user-wallet' | 'admin' | 'asset-details' | 'send-withdraw' | 'settings';

export interface CurrentUser {
  username: string;
  role: string;
  userId: number | null;
}

export interface AppState {
  currentView: ViewState;
  selectedAsset: AssetType | null;
  currentUser: CurrentUser | null;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const colorScheme = useColorScheme();

  const [appState, setAppState] = useState<AppState>({
    currentView: 'login',
    selectedAsset: null,
    currentUser: null,
  });

  const navigate = (view: ViewState, asset?: AssetType) => {
    setAppState(prev => ({
      ...prev,
      currentView: view,
      selectedAsset: asset !== undefined ? asset : prev.selectedAsset,
    }));
  };

  const handleLogin = (username: string, role: string, userId: number | null) => {
    setCurrentUser(username);
    setAppState(prev => ({
      ...prev,
      currentUser: { username, role, userId },
      currentView: role === 'admin' ? 'admin' : 'user-wallet',
    }));
  };

  const handleLogout = () => {
    clearCurrentUser();
    setAppState({
      currentView: 'login',
      selectedAsset: null,
      currentUser: null,
    });
  };

  const renderView = () => {
    const username = appState.currentUser?.username ?? '';
    switch (appState.currentView) {
      case 'login':
        return (
          <LoginView
            onLogin={handleLogin}
            onSignup={() => navigate('signup')}
          />
        );
      case 'signup':
        return (
          <SignupView
            onSuccess={() => navigate('login')}
            onBack={() => navigate('login')}
          />
        );
      case 'user-wallet':
        return (
          <UserWalletView
            username={username}
            onNavigate={navigate}
            onLogout={handleLogout}
          />
        );
      case 'admin':
        return <AdminView onLogout={handleLogout} />;
      case 'asset-details':
        return <AssetDetailsView asset={appState.selectedAsset!} onNavigate={navigate} />;
      case 'send-withdraw':
        return <SendWithdrawView asset={appState.selectedAsset!} onNavigate={navigate} />;
      case 'settings':
        return (
          <SettingsView
            username={username}
            onBack={() => navigate('user-wallet')}
            onLogout={handleLogout}
          />
        );
      default:
        return (
          <LoginView
            onLogin={handleLogin}
            onSignup={() => navigate('signup')}
          />
        );
    }
  };

  return (
    <div className="min-h-[100svh] w-full bg-scheme sm:flex sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-[430px] min-h-[100svh] sm:min-h-0 sm:h-[100svh] bg-background sm:rounded-3xl sm:border border-border overflow-hidden relative shadow-2xl flex flex-col">
        <AnimatePresence>
          {showSplash && (
            <SplashScreen onComplete={() => setShowSplash(false)} />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={appState.currentView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </div>

      <Toaster theme={colorScheme} position="top-center" />
    </div>
  );
}

export default App;
