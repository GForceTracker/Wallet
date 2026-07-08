import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { LoginView } from './views/LoginView';
import { UserWalletView } from './views/UserWalletView';
import { AdminView } from './views/AdminView';
import { AssetDetailsView } from './views/AssetDetailsView';
import { SendWithdrawView } from './views/SendWithdrawView';
import { AssetType } from './store';

export type ViewState = 'login' | 'user-wallet' | 'admin' | 'asset-details' | 'send-withdraw';

export interface AppState {
  currentView: ViewState;
  selectedAsset: AssetType | null;
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    currentView: 'login',
    selectedAsset: null,
  });

  const navigate = (view: ViewState, asset?: AssetType) => {
    setAppState(prev => ({
      currentView: view,
      selectedAsset: asset !== undefined ? asset : prev.selectedAsset
    }));
  };

  const renderView = () => {
    switch (appState.currentView) {
      case 'login':
        return <LoginView onLogin={(role) => navigate(role === 'admin' ? 'admin' : 'user-wallet')} />;
      case 'user-wallet':
        return <UserWalletView onNavigate={navigate} onLogout={() => navigate('login')} />;
      case 'admin':
        return <AdminView onLogout={() => navigate('login')} />;
      case 'asset-details':
        return <AssetDetailsView asset={appState.selectedAsset!} onNavigate={navigate} />;
      case 'send-withdraw':
        return <SendWithdrawView asset={appState.selectedAsset!} onNavigate={navigate} />;
      default:
        return <LoginView onLogin={(role) => navigate(role === 'admin' ? 'admin' : 'user-wallet')} />;
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-black sm:bg-black/90">
      <div className="w-full max-w-[400px] h-[100dvh] sm:h-[850px] sm:max-h-[100dvh] bg-background sm:rounded-3xl sm:border border-border overflow-hidden relative shadow-2xl flex flex-col">
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
      <Toaster theme="dark" position="top-center" />
    </div>
  );
}

export default App;
