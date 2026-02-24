import { getGitHubConfig, isOnlineMode } from './github';
import { checkForConflicts } from './conflictDetector';

interface SyncStatus {
  lastSync: number;
  device: string;
  changedTypes: string;
  commit: string;
  timestamp: string;
}

let pollingInterval: number | null = null;
let lastKnownSync: number = 0;
let isPolling = false;
let isPaused = false;
let lastEditTime: number = 0;

const POLL_INTERVAL = 30000; // 30 seconds
const EDIT_PAUSE_DURATION = 60000; // 60 seconds after last edit

/**
 * Fetch sync status from GitHub
 */
async function fetchSyncStatus(): Promise<SyncStatus | null> {
  const config = getGitHubConfig();
  if (!config) return null;

  try {
    // Use raw.githubusercontent.com to fetch without authentication
    const url = `https://raw.githubusercontent.com/${config.username}/my-notes-data/main/sync-status.json`;
    
    // Add cache buster to avoid stale data
    const response = await fetch(`${url}?t=${Date.now()}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      // File might not exist yet (first time setup)
      if (response.status === 404) {
        console.log('[SyncPoller] sync-status.json not found (first time setup)');
        return null;
      }
      throw new Error(`Failed to fetch sync status: ${response.status}`);
    }

    const status: SyncStatus = await response.json();
    return status;
  } catch (error) {
    console.error('[SyncPoller] Error fetching sync status:', error);
    return null;
  }
}

/**
 * Check for updates and trigger sync if needed
 */
async function checkForUpdates(): Promise<void> {
  if (isPaused) {
    console.log('[SyncPoller] Paused during editing, skipping check');
    return;
  }

  if (!isOnlineMode()) {
    console.log('[SyncPoller] Offline mode, skipping check');
    return;
  }

  const config = getGitHubConfig();
  if (!config) {
    console.log('[SyncPoller] Not connected to GitHub, skipping check');
    return;
  }

  try {
    const status = await fetchSyncStatus();
    
    if (!status) {
      return;
    }

    // Initialize lastKnownSync on first check
    if (lastKnownSync === 0) {
      lastKnownSync = status.lastSync;
      console.log('[SyncPoller] Initialized with lastSync:', new Date(status.lastSync).toISOString());
      return;
    }

    // Check if there are new changes
    if (status.lastSync > lastKnownSync) {
      console.log('[SyncPoller] New changes detected!');
      console.log(`  Previous: ${new Date(lastKnownSync).toISOString()}`);
      console.log(`  Current:  ${new Date(status.lastSync).toISOString()}`);
      console.log(`  Device:   ${status.device}`);
      console.log(`  Types:    ${status.changedTypes}`);
      
      // Update last known sync time
      lastKnownSync = status.lastSync;
      
      // Trigger sync
      await triggerSync();
      
      // Check for conflicts after sync
      await checkForConflicts();
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('sync-detected', {
        detail: {
          device: status.device,
          changedTypes: status.changedTypes,
          timestamp: status.lastSync,
        },
      }));
    } else {
      console.log('[SyncPoller] No new changes');
    }
  } catch (error) {
    console.error('[SyncPoller] Error checking for updates:', error);
  }
}

/**
 * Trigger sync (import dynamically to avoid circular dependencies)
 */
async function triggerSync(): Promise<void> {
  try {
    const { syncAll } = await import('./github');
    console.log('[SyncPoller] Triggering sync...');
    await syncAll();
    console.log('[SyncPoller] Sync completed');
  } catch (error) {
    console.error('[SyncPoller] Sync failed:', error);
  }
}

/**
 * Start polling for sync status
 */
export function startSyncPolling(): void {
  if (isPolling) {
    console.log('[SyncPoller] Already polling');
    return;
  }

  const config = getGitHubConfig();
  if (!config) {
    console.log('[SyncPoller] Not connected to GitHub, cannot start polling');
    return;
  }

  console.log('[SyncPoller] Starting sync polling (every 30 seconds)');
  isPolling = true;
  
  // Initial check
  checkForUpdates();
  
  // Set up interval
  pollingInterval = setInterval(() => {
    checkForUpdates();
  }, POLL_INTERVAL);
}

/**
 * Stop polling for sync status
 */
export function stopSyncPolling(): void {
  if (!isPolling) {
    return;
  }

  console.log('[SyncPoller] Stopping sync polling');
  isPolling = false;
  
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  
  lastKnownSync = 0;
}

/**
 * Pause polling temporarily (e.g., during editing)
 */
export function pauseSyncPolling(): void {
  console.log('[SyncPoller] Pausing polling during edit');
  isPaused = true;
  lastEditTime = Date.now();
  
  // Auto-resume after EDIT_PAUSE_DURATION
  setTimeout(() => {
    const timeSinceLastEdit = Date.now() - lastEditTime;
    if (timeSinceLastEdit >= EDIT_PAUSE_DURATION) {
      resumeSyncPolling();
    }
  }, EDIT_PAUSE_DURATION);
}

/**
 * Resume polling after pause
 */
export function resumeSyncPolling(): void {
  if (!isPaused) {
    return;
  }
  
  console.log('[SyncPoller] Resuming polling');
  isPaused = false;
  
  // Immediate check after resume
  checkForUpdates();
}

/**
 * Notify that user is editing (extends pause)
 */
export function notifyEditing(): void {
  lastEditTime = Date.now();
  if (!isPaused) {
    pauseSyncPolling();
  }
}

/**
 * Check if polling is active
 */
export function isSyncPolling(): boolean {
  return isPolling;
}

/**
 * Get current sync status
 */
export async function getCurrentSyncStatus(): Promise<SyncStatus | null> {
  return fetchSyncStatus();
}
