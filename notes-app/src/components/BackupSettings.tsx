import { useState, useEffect } from 'react';
import { Database, Download, Upload, CheckCircle, Trash2 } from 'lucide-react';
import {
  getBackupSettings,
  saveBackupSettings,
  createBackup,
  listBackups,
  restoreFromBackup,
  deleteMultipleBackups,
  type BackupFrequency,
  type BackupFile,
} from '../utils/backup';
import { getGitHubConfig } from '../utils/github';

export function BackupSettings() {
  const [isConnected, setIsConnected] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<BackupFrequency>('weekly');
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  // Check connection status on mount and periodically
  useEffect(() => {
    const checkConnection = () => {
      const config = getGitHubConfig();
      const connected = !!config;
      setIsConnected(connected);
      
      if (connected) {
        const settings = getBackupSettings();
        setEnabled(settings.enabled);
        setFrequency(settings.frequency);
        setLastBackup(settings.lastBackup);
      } else {
        setEnabled(false);
      }
    };

    checkConnection();

    // Check connection every 2 seconds to detect reconnection
    const interval = setInterval(checkConnection, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleToggle = (value: boolean) => {
    if (!isConnected) return; // Prevent toggle if not connected
    
    setEnabled(value);
    const settings = getBackupSettings();
    saveBackupSettings({ ...settings, enabled: value });
  };

  const handleFrequencyChange = (value: BackupFrequency) => {
    setFrequency(value);
    const settings = getBackupSettings();
    saveBackupSettings({ ...settings, frequency: value });
  };

  const handleBackupNow = async () => {
    setBacking(true);
    setMessage('');
    
    const result = await createBackup(frequency);
    
    if (result.success) {
      setMessage('Backup created successfully!');
      setLastBackup(Date.now());
    } else {
      setMessage(`Error: ${result.error}`);
    }
    
    setBacking(false);
  };

  const handleViewBackups = async () => {
    setShowBackups(true);
    setShowCleanup(false);
    setBackups([]); // Clear old backups first
    setMessage('Loading backups...');
    
    // Force fresh fetch from GitHub
    const result = await listBackups(frequency);
    
    if (result.success && result.backups) {
      setBackups(result.backups);
      setMessage(result.backups.length === 0 ? 'No backups found' : '');
    } else {
      setMessage(`Error: ${result.error}`);
    }
  };

  const handleCleanupBackups = async () => {
    setShowCleanup(true);
    setShowBackups(false);
    setSelectedForDelete(new Set());
    setBackups([]); // Clear old backups first
    setMessage('Loading backups...');
    
    // Force fresh fetch from GitHub
    const result = await listBackups(frequency);
    
    if (result.success && result.backups) {
      setBackups(result.backups);
      setMessage(result.backups.length === 0 ? 'No backups found' : '');
    } else {
      setMessage(`Error: ${result.error}`);
    }
  };

  const toggleSelectForDelete = (path: string) => {
    const newSelected = new Set(selectedForDelete);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedForDelete(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedForDelete.size === 0) return;
    
    if (!confirm(`Delete ${selectedForDelete.size} backup(s)? This cannot be undone.`)) {
      return;
    }
    
    setDeleting(true);
    setMessage('Deleting backups...');
    
    const result = await deleteMultipleBackups(Array.from(selectedForDelete));
    
    if (result.success) {
      setMessage(`Successfully deleted ${result.deleted} backup(s)`);
      setSelectedForDelete(new Set());
      
      // Refresh backup list
      const listResult = await listBackups(frequency);
      if (listResult.success && listResult.backups) {
        setBackups(listResult.backups);
        
        // Close modal after successful deletion
        setTimeout(() => {
          setShowCleanup(false);
          setMessage('');
        }, 1500);
      }
    } else {
      setMessage(`Error: ${result.error}`);
    }
    
    setDeleting(false);
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    
    if (!confirm(`Restore from backup "${selectedBackup.name}"? This will replace all current data.`)) {
      return;
    }
    
    setRestoring(true);
    setMessage('');
    
    const result = await restoreFromBackup(selectedBackup.path);
    
    if (result.success) {
      setMessage('Backup restored successfully! Reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      setMessage(`Error: ${result.error}`);
    }
    
    setRestoring(false);
  };

  if (!isConnected) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Automatic Backup</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Backup your data to GitHub automatically
            </p>
          </div>
          <Database className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Connect to GitHub to enable automatic backups
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Automatic Backup</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Backup your data to GitHub automatically
          </p>
        </div>
        <Database className="w-6 h-6 text-primary-600" />
      </div>

      {/* Enable/Disable */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <span className="text-sm font-medium">Enable Automatic Backup</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
        </label>
      </div>

      {enabled && (
        <>
          {/* Frequency Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Backup Frequency</label>
            <div className="grid grid-cols-3 gap-3">
              {(['daily', 'weekly', 'monthly'] as BackupFrequency[]).map((freq) => (
                <button
                  key={freq}
                  onClick={() => handleFrequencyChange(freq)}
                  className={`p-3 rounded-lg border-2 transition-all text-sm font-medium capitalize ${
                    frequency === freq
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>

          {/* Last Backup Info */}
          {lastBackup && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-700 dark:text-green-400">
                Last backup: {new Date(lastBackup).toLocaleString()}
              </span>
            </div>
          )}

          {/* Backup Info */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Backup includes:</strong> All lists, notes, events, and deleted items
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              <strong>Storage:</strong> GitHub repository (backups/{frequency}/)
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              <strong>Retention:</strong> Last 20 backups
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleBackupNow}
              disabled={backing}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              {backing ? 'Creating Backup...' : 'Backup Now'}
            </button>

            <button
              onClick={handleViewBackups}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Restore from Backup
            </button>

            <button
              onClick={handleCleanupBackups}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Clean Up Backups
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`mt-4 p-3 rounded-lg ${
              message.includes('Error') 
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
            }`}>
              <p className="text-sm">{message}</p>
            </div>
          )}

          {/* Backup List Modal (Restore) */}
          {showBackups && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold">Restore from Backup ({frequency})</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {backups.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No backups found</p>
                  ) : (
                    <div className="space-y-2">
                      {backups.map((backup) => (
                        <button
                          key={backup.path}
                          onClick={() => setSelectedBackup(backup)}
                          className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                            selectedBackup?.path === backup.path
                              ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{backup.name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {backup.date}
                              </p>
                            </div>
                            <div className="text-sm text-gray-500">
                              {(backup.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                  <button
                    onClick={() => {
                      setShowBackups(false);
                      setSelectedBackup(null);
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRestore}
                    disabled={!selectedBackup || restoring}
                    className="btn-primary flex-1"
                  >
                    {restoring ? 'Restoring...' : 'Restore Selected'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cleanup Modal (Delete) */}
          {showCleanup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold">Clean Up Backups ({frequency})</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Select backups to delete
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {backups.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No backups found</p>
                  ) : (
                    <div className="space-y-2">
                      {backups.map((backup) => (
                        <div
                          key={backup.path}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            selectedForDelete.has(backup.path)
                              ? 'border-red-600 bg-red-50 dark:bg-red-900/20'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedForDelete.has(backup.path)}
                              onChange={() => toggleSelectForDelete(backup.path)}
                              className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                            <div className="flex-1">
                              <p className="font-medium">{backup.name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {backup.date} • {(backup.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  {selectedForDelete.size > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {selectedForDelete.size} backup(s) selected
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowCleanup(false);
                        setSelectedForDelete(new Set());
                      }}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={selectedForDelete.size === 0 || deleting}
                      className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {deleting ? 'Deleting...' : `Delete ${selectedForDelete.size > 0 ? `(${selectedForDelete.size})` : ''}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
