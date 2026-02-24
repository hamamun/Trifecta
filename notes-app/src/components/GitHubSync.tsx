import { useState, useEffect } from 'react';
import { Github, RefreshCw, XCircle, CloudOff, Loader, Cloud, AlertTriangle } from 'lucide-react';
import {
  getGitHubConfig,
  saveGitHubConfig,
  getSyncStatus,
  verifyGitHubToken,
  initializeGitHubSync,
  disconnectGitHub,
  type SyncStatus,
} from '../utils/github';
import { startSyncPolling, stopSyncPolling } from '../utils/syncPoller';
import { fetchConflictReports, type ConflictReport } from '../utils/conflictDetector';
import { ConflictResolutionModal } from './ConflictResolutionModal';

export function GitHubSync() {
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: 'offline', lastSync: null });
  const [syncing, setSyncing] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictReport[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<ConflictReport | null>(null);
  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem('notes-app-online-mode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    const config = getGitHubConfig();
    if (config) {
      setIsConnected(true);
      setUsername(config.username);
      
      // Check for conflicts on mount
      fetchConflictReports().then(setConflicts);
    }
    setSyncStatus(getSyncStatus());
    
    // Listen for sync-complete events from automatic syncs
    const handleSyncComplete = () => {
      const newStatus = getSyncStatus();
      setSyncStatus(newStatus);
      console.log('Sync completed, status updated');
    };
    
    // Listen for conflicts-detected events
    const handleConflictsDetected = (e: CustomEvent) => {
      setConflicts(e.detail.reports);
    };
    
    window.addEventListener('sync-complete', handleSyncComplete);
    window.addEventListener('conflicts-detected' as any, handleConflictsDetected);
    
    return () => {
      window.removeEventListener('sync-complete', handleSyncComplete);
      window.removeEventListener('conflicts-detected' as any, handleConflictsDetected);
    };
  }, []);

  // Listen for online mode changes
  useEffect(() => {
    const handleOnlineModeChange = (e: CustomEvent) => {
      setIsOnline(e.detail.isOnline);
      // Clear error when going back online
      if (e.detail.isOnline) {
        setError('');
      }
    };
    
    window.addEventListener('online-mode-change' as any, handleOnlineModeChange);
    
    return () => {
      window.removeEventListener('online-mode-change' as any, handleOnlineModeChange);
    };
  }, []);

  // Sync on app open (only once)
  useEffect(() => {
    if (!isConnected) return;

    // Start sync polling when connected
    console.log('App opened with GitHub connected - starting sync polling');
    startSyncPolling();
    
    // Cleanup on unmount or disconnect
    return () => {
      stopSyncPolling();
    };
  }, [isConnected]);

  const handleConnect = async () => {
    setError('');
    setLoading(true);

    try {
      // Verify token
      const result = await verifyGitHubToken(token);
      if (!result.valid) {
        setError(result.error || 'Invalid token');
        setLoading(false);
        return;
      }

      // Initialize sync (create repo if needed)
      const initResult = await initializeGitHubSync(token);
      if (!initResult.success) {
        setError(initResult.error || 'Failed to initialize sync');
        setLoading(false);
        return;
      }

      // Save config
      saveGitHubConfig({
        token,
        username: result.username!,
      });

      setIsConnected(true);
      setUsername(result.username!);
      setShowTokenInput(false);
      setToken('');

      // Initial sync
      setTimeout(() => {
        handleSync();
      }, 500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!isOnline) {
      setError('Cannot sync in offline mode');
      return;
    }
    
    setError('');
    setSyncing(true);
    setSyncStatus({ status: 'syncing', lastSync: syncStatus.lastSync });

    try {
      const { syncAll } = await import('../utils/github');
      const result = await syncAll();
      
      if (result.success) {
        const newStatus = getSyncStatus();
        setSyncStatus(newStatus);
        console.log('Manual sync completed successfully');
      } else {
        setError(result.error || 'Sync failed');
        setSyncStatus({ status: 'error', lastSync: syncStatus.lastSync, error: result.error });
      }
    } catch (err: any) {
      console.error('Manual sync error:', err);
      setError(err.message || 'Sync failed');
      setSyncStatus({ status: 'error', lastSync: syncStatus.lastSync, error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Disconnect from GitHub? Your local data will remain, but sync will stop.')) {
      setError(''); // Clear any errors
      stopSyncPolling(); // Stop polling
      disconnectGitHub();
      setIsConnected(false);
      setUsername('');
      setSyncStatus({ status: 'offline', lastSync: null });
      setSyncing(false); // Reset syncing state
    }
  };

  const getSyncStatusIcon = () => {
    // Show offline cloud icon if in offline mode
    if (!isOnline) {
      return <CloudOff className="w-5 h-5 text-gray-400" />;
    }
    
    if (syncing) {
      return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
    }
    
    switch (syncStatus.status) {
      case 'synced':
        return <Cloud className="w-5 h-5 text-blue-600" />;
      case 'syncing':
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'offline':
        return <CloudOff className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSyncStatusText = () => {
    // Show offline message if in offline mode
    if (!isOnline) {
      return 'Offline mode - Sync disabled';
    }
    
    if (syncing) return 'Syncing...';
    
    switch (syncStatus.status) {
      case 'synced':
        return syncStatus.lastSync
          ? `Last synced: ${new Date(syncStatus.lastSync).toLocaleString()}`
          : 'Cloud synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return `Error: ${syncStatus.error || 'Unknown error'}`;
      case 'offline':
        return 'Not connected';
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">GitHub Sync</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sync your data across devices using GitHub
          </p>
        </div>
        <Github className="w-6 h-6 text-gray-700 dark:text-gray-300" />
      </div>

      {!isConnected ? (
        <>
          {!showTokenInput ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect your GitHub account to sync data across all your devices.
                Your data will be stored in a private repository.
              </p>
              <button
                onClick={() => setShowTokenInput(true)}
                className="btn-primary w-full"
              >
                Connect GitHub
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">
                  GitHub Personal Access Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="input-field"
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Create a token at{' '}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    github.com/settings/tokens
                  </a>
                  {' '}with 'repo' scope
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowTokenInput(false);
                    setToken('');
                    setError('');
                  }}
                  className="btn-secondary flex-1"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  className="btn-primary flex-1"
                  disabled={!token || loading}
                >
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="text-sm font-medium">Connected as @{username}</p>
              <div className="flex items-center gap-2 mt-1">
                {getSyncStatusIcon()}
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {getSyncStatusText()}
                </p>
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing || !isOnline}
              className={`p-2 rounded-lg transition-colors ${
                !isOnline 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title={!isOnline ? 'Sync disabled in offline mode' : 'Sync now'}
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Conflict Badge */}
          {conflicts.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500">
                      Multiple devices edited the same item
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCurrentConflict(conflicts[0]);
                    setShowConflictModal(true);
                  }}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Resolve
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Auto-sync: When data changes (10 second delay)
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manual sync: Click the refresh button anytime
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Repository: <span className="font-mono">my-notes-data</span> (private)
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-mono">
              Debug: {localStorage.getItem('notes-app-notes') ? JSON.parse(localStorage.getItem('notes-app-notes')!).filter((n: any) => !n.deleted && !n.archived).length : 0} notes in localStorage
            </p>
          </div>

          <button
            onClick={() => {
              if (confirm('Force refresh the app? This will reload the page and clear any cached data.')) {
                // Clear service worker cache and reload
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => registration.unregister());
                  });
                }
                // Clear all caches
                if ('caches' in window) {
                  caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                  });
                }
                // Navigate to root first to avoid 404 on GitHub Pages, then reload
                setTimeout(() => {
                  window.location.href = import.meta.env.BASE_URL;
                  setTimeout(() => {
                    window.location.reload();
                  }, 100);
                }, 500);
              }
            }}
            className="w-full py-2 px-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            Force Refresh App (Clear Cache)
          </button>

          <button
            onClick={handleDisconnect}
            className="w-full py-2 px-4 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Disconnect GitHub
          </button>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {showConflictModal && currentConflict && (
        <ConflictResolutionModal
          report={currentConflict}
          onClose={() => {
            setShowConflictModal(false);
            setCurrentConflict(null);
          }}
          onResolved={async () => {
            // Refresh conflicts list
            const updatedConflicts = await fetchConflictReports();
            setConflicts(updatedConflicts);
            
            // Trigger sync to get resolved data
            await handleSync();
          }}
        />
      )}
    </div>
  );
}
