import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { LoginView } from './views/LoginView';
import { SignupView } from './views/SignupView';
import { UserWalletView } from './views/UserWalletView';
import { AdminView } from './views/AdminView';
import { AssetDetailsView } from './views/AssetDetailsView';
import { SendWithdrawView } from './views/SendWithdrawView';
import { SplashScreen } from './components/SplashScreen';
import { useColorScheme } from './hooks/useColorScheme';
import { AssetType } from './store';

export type ViewState = 'login' | 'signup' | 'user-wallet' | 'admin' | 'asset-details' | 'send-withdraw';

export interface AppState {
  currentView: ViewState;
  selectedAsset: AssetType | null;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const colorScheme = useColorScheme();

  const [appState, setAppState] = useState<AppState>({
    currentView: 'login',
    selectedAsset: null,
  });

  const navigate = (view: ViewState, asset?: AssetType) => {
    setAppState(prev => ({
      currentView: view,
      selectedAsset: asset !== undefined ? asset : prev.selectedAsset,
    }));
  };

  const renderView = () => {
    switch (appState.currentView) {
      case 'login':
        return (
          <LoginView
            onLogin={(role) => navigate(role === 'admin' ? 'admin' : 'user-wallet')}
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
        return <UserWalletView onNavigate={navigate} onLogout={() => navigate('login')} />;
      case 'admin':
        return <AdminView onLogout={() => navigate('login')} />;
      case 'asset-details':
        return <AssetDetailsView asset={appState.selectedAsset!} onNavigate={navigate} />;
      case 'send-withdraw':
        return <SendWithdrawView asset={appState.selectedAsset!} onNavigate={navigate} />;
      default:
        return (
          <LoginView
            onLogin={(role) => navigate(role === 'admin' ? 'admin' : 'user-wallet')}
            onSignup={() => navigate('signup')}
          />
        );
    }
  };

  return (
    // Outer shell: bg-scheme adapts to light/dark; phone card centred on wide screens
    <div className="min-h-[100svh] w-full bg-scheme sm:flex sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-[430px] min-h-[100svh] sm:min-h-0 sm:h-[100svh] bg-background sm:rounded-3xl sm:border border-border overflow-hidden relative shadow-2xl flex flex-col">

        {/* ── Splash overlay ────────────────────────────────────────────── */}
        <AnimatePresence>
          {showSplash && (
            <SplashScreen onComplete={() => setShowSplash(false)} />
          )}
        </AnimatePresence>

        {/* ── App views ─────────────────────────────────────────────────── */}
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

      {/* Toast notifications – follows system colour scheme */}
      <Toaster theme={colorScheme} position="top-center" />
    </div>
  );
}

export default App;
