import { Octokit } from '@octokit/rest';

const REPO_NAME = 'my-notes-data';

export interface GitHubConfig {
  token: string;
  username: string;
}

export interface SyncStatus {
  status: 'synced' | 'syncing' | 'error' | 'offline';
  lastSync: number | null;
  error?: string;
}

// Get GitHub config from localStorage
export function getGitHubConfig(): GitHubConfig | null {
  const data = localStorage.getItem('notes-app-github-config');
  return data ? JSON.parse(data) : null;
}

// Save GitHub config to localStorage
export function saveGitHubConfig(config: GitHubConfig | null): void {
  if (config) {
    localStorage.setItem('notes-app-github-config', JSON.stringify(config));
  } else {
    localStorage.removeItem('notes-app-github-config');
  }
}

// Get sync status
export function getSyncStatus(): SyncStatus {
  const data = localStorage.getItem('notes-app-sync-status');
  return data ? JSON.parse(data) : { status: 'offline', lastSync: null };
}

// Save sync status
export function saveSyncStatus(status: SyncStatus): void {
  localStorage.setItem('notes-app-sync-status', JSON.stringify(status));
}

// Get online mode status
export function isOnlineMode(): boolean {
  const saved = localStorage.getItem('notes-app-online-mode');
  return saved !== null ? JSON.parse(saved) : true;
}

// Create Octokit instance
function createOctokit(token: string): Octokit {
  return new Octokit({ 
    auth: token,
    userAgent: 'notes-app v2.0.0',
  });
}

// Get version number for a data type
export function getVersion(dataType: 'lists' | 'notes' | 'events'): number {
  const version = localStorage.getItem(`notes-app-${dataType}-version`);
  return version ? parseInt(version) : 0;
}

// Set version number for a data type
export function setVersion(dataType: 'lists' | 'notes' | 'events', version: number): void {
  localStorage.setItem(`notes-app-${dataType}-version`, version.toString());
}

// Increment version number
export function incrementVersion(dataType: 'lists' | 'notes' | 'events'): number {
  const currentVersion = getVersion(dataType);
  const newVersion = currentVersion + 1;
  setVersion(dataType, newVersion);
  return newVersion;
}

// Verify GitHub token and get username
export async function verifyGitHubToken(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const cleanToken = token.trim();
    const octokit = createOctokit(cleanToken);
    const response = await octokit.users.getAuthenticated();
    console.log('Token verified successfully for user:', response.data.login);
    return { valid: true, username: response.data.login };
  } catch (error: any) {
    console.error('Token verification error:', error);
    const errorMsg = error.response?.data?.message || error.message || 'Failed to verify token';
    if (error.status === 401) {
      return { valid: false, error: 'Invalid token. Please check your token and try again.' };
    }
    return { valid: false, error: errorMsg };
  }
}

// Check if repository exists
async function repoExists(octokit: Octokit, username: string): Promise<boolean> {
  try {
    await octokit.repos.get({
      owner: username,
      repo: REPO_NAME,
    });
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

// Create private repository
async function createRepo(octokit: Octokit): Promise<void> {
  try {
    console.log('Creating repository:', REPO_NAME);
    
    const response = await octokit.repos.createForAuthenticatedUser({
      name: REPO_NAME,
      private: true,
      description: 'Private storage for Notes App data (v2)',
      auto_init: true,
    });
    
    console.log('Repository created successfully:', response.data.html_url);
  } catch (error: any) {
    console.error('Create repo error:', error);
    
    // Check if repo already exists
    if (error.status === 422 && error.response?.data?.errors) {
      const errors = error.response.data.errors;
      if (errors.some((e: any) => e.message?.includes('already exists'))) {
        console.log('Repository already exists, continuing...');
        return;
      }
    }
    
    throw error;
  }
}

// Initialize GitHub sync (create repo if needed)
export async function initializeGitHubSync(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanToken = token.trim();
    const octokit = createOctokit(cleanToken);
    console.log('Getting authenticated user...');
    const userResponse = await octokit.users.getAuthenticated();
    const username = userResponse.data.login;
    console.log('Authenticated as:', username);

    console.log('Checking if repo exists...');
    const exists = await repoExists(octokit, username);
    console.log('Repo exists:', exists);
    
    if (!exists) {
      console.log('Creating repository...');
      await createRepo(octokit);
      console.log('Repository created, waiting for it to be ready...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('Repository already exists');
    }

    return { success: true };
  } catch (error: any) {
    console.error('Initialize sync error:', error);
    let errorMessage = 'Failed to initialize sync';
    
    if (error.status === 404) {
      errorMessage = 'GitHub API endpoint not found. Please ensure you created a "Personal access token (classic)" with the "repo" scope.';
    } else if (error.status === 401) {
      errorMessage = 'Authentication failed. Please check your token.';
    } else if (error.status === 403) {
      errorMessage = 'Permission denied. Please ensure your token has the "repo" scope.';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
}

// Disconnect GitHub
export function disconnectGitHub(): void {
  saveGitHubConfig(null);
  saveSyncStatus({ status: 'offline', lastSync: null });
}

// ============================================
// ITEM-BASED SYNC SYSTEM
// ============================================

// Synced state tracking
interface SyncedItemState {
  version: number;
  timestamp: number;
}

interface SyncedState {
  lists: { [id: string]: SyncedItemState };
  notes: { [id: string]: SyncedItemState };
  events: { [id: string]: SyncedItemState };
}

// Get synced state from localStorage
function getSyncedState(): SyncedState {
  const data = localStorage.getItem('notes-app-synced-state');
  if (data) {
    return JSON.parse(data);
  }
  return { lists: {}, notes: {}, events: {} };
}

// Save synced state to localStorage
function saveSyncedState(state: SyncedState): void {
  localStorage.setItem('notes-app-synced-state', JSON.stringify(state));
}

// Update synced state for a specific item
function updateSyncedStateForItem(dataType: 'lists' | 'notes' | 'events', item: SyncItem): void {
  const state = getSyncedState();
  state[dataType][item.id] = {
    version: item.version,
    timestamp: item.timestamp
  };
  saveSyncedState(state);
}

// Remove item from synced state (when deleted) - exported for future use
export function removeSyncedStateForItem(dataType: 'lists' | 'notes' | 'events', itemId: string): void {
  const state = getSyncedState();
  delete state[dataType][itemId];
  saveSyncedState(state);
}

// Sync queue system
interface SyncTask {
  id: string;
  dataType: 'lists' | 'notes' | 'events' | 'all';
  timestamp: number;
  resolve: (value: { success: boolean; error?: string }) => void;
  reject: (error: any) => void;
}

let syncQueue: SyncTask[] = [];
let isProcessingQueue = false;
let syncTaskIdCounter = 0;
let lastSyncTime: { [key: string]: number } = {};

// Add sync task to queue
function queueSync(dataType: 'lists' | 'notes' | 'events' | 'all'): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve, reject) => {
    const taskId = `sync-${++syncTaskIdCounter}-${Date.now()}`;
    const task: SyncTask = {
      id: taskId,
      dataType,
      timestamp: Date.now(),
      resolve,
      reject
    };
    
    syncQueue.push(task);
    console.log(`[Queue] Added ${dataType} sync (ID: ${taskId}), queue length: ${syncQueue.length}`);
    
    // Start processing if not already running
    if (!isProcessingQueue) {
      processQueue();
    }
  });
}

// Process sync queue one by one
async function processQueue() {
  if (isProcessingQueue) {
    console.log('[Queue] Already processing, skipping...');
    return;
  }
  
  if (syncQueue.length === 0) {
    console.log('[Queue] Empty, nothing to process');
    return;
  }
  
  isProcessingQueue = true;
  console.log(`[Queue] Starting to process ${syncQueue.length} tasks`);
  
  while (syncQueue.length > 0) {
    const task = syncQueue.shift()!;
    console.log(`[Queue] Processing task ${task.id} (${task.dataType}), ${syncQueue.length} remaining`);
    
    try {
      let result: { success: boolean; error?: string };
      
      if (task.dataType === 'all') {
        result = await syncAllInternal();
      } else {
        result = await syncDataTypeInternal(task.dataType);
      }
      
      task.resolve(result);
      console.log(`[Queue] Task ${task.id} completed successfully`);
    } catch (error: any) {
      console.error(`[Queue] Task ${task.id} failed:`, error);
      task.reject(error);
    }
    
    // Small delay between tasks to avoid rate limiting
    if (syncQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  isProcessingQueue = false;
  console.log('[Queue] All tasks processed');
}

// Item interface for sync
export interface SyncItem {
  id: string;
  version: number;
  timestamp: number;
  deviceId: string;
  data: any; // The actual item data (list, note, or event)
}

// Helper: Get file from GitHub
async function getFileFromGitHub(
  octokit: Octokit,
  username: string,
  path: string
): Promise<{ content: string; sha: string } | null> {
  try {
    const response = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path,
      ref: 'main',
    });

    const data: any = response.data;
    if (data && 'content' in data && data.content) {
      // Decode base64 to UTF-8
      const base64Content = data.content.replace(/\n/g, '');
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decodedContent = new TextDecoder().decode(bytes);
      
      return {
        content: decodedContent,
        sha: data.sha,
      };
    }
    return null;
  } catch (error: any) {
    if (error.status === 404) {
      return null; // File doesn't exist yet
    }
    throw error;
  }
}

// Helper: Put file to GitHub
async function putFileToGitHub(
  octokit: Octokit,
  username: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> {
  // Encode to UTF-8 then base64
  const utf8Bytes = new TextEncoder().encode(content);
  const bytes = new Uint8Array(utf8Bytes);
  const len = bytes.byteLength;
  let binary = '';
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  
  await octokit.repos.createOrUpdateFileContents({
    owner: username,
    repo: REPO_NAME,
    path,
    message,
    content: base64,
    branch: 'main',
    ...(sha && { sha }),
  });
}

// Get items from GitHub for a data type (one file per item)
async function getItemsFromGitHub(
  dataType: 'lists' | 'notes' | 'events'
): Promise<SyncItem[]> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error('Not signed in to GitHub');
  }

  const octokit = createOctokit(config.token);
  const folderPath = `v3/${dataType}`;
  
  try {
    // List all files in the folder
    const response = await octokit.repos.getContent({
      owner: config.username,
      repo: REPO_NAME,
      path: folderPath,
      ref: 'main',
    });
    
    // If folder doesn't exist or is empty
    if (!Array.isArray(response.data)) {
      return [];
    }
    
    // Fetch each file
    const items: SyncItem[] = [];
    for (const file of response.data) {
      if (file.type === 'file' && file.name.endsWith('.json')) {
        try {
          const fileData = await getFileFromGitHub(octokit, config.username, file.path);
          if (fileData) {
            const item: SyncItem = JSON.parse(fileData.content);
            items.push(item);
          }
        } catch (error) {
          console.warn(`Failed to fetch ${file.name}:`, error);
        }
      }
    }
    
    console.log(`Fetched ${items.length} items from GitHub ${folderPath}`);
    return items;
  } catch (error: any) {
    if (error.status === 404) {
      // Folder doesn't exist yet
      console.log(`Folder ${folderPath} doesn't exist yet, returning empty array`);
      return [];
    }
    throw error;
  }
}

// Put a single item to GitHub (one file per item)
async function putItemToGitHub(
  dataType: 'lists' | 'notes' | 'events',
  item: SyncItem,
  retryCount = 0
): Promise<void> {
  const MAX_RETRIES = 3;
  const config = getGitHubConfig();
  if (!config) {
    throw new Error('Not signed in to GitHub');
  }

  const octokit = createOctokit(config.token);
  const filePath = `v3/${dataType}/${item.id}.json`;
  
  try {
    // Get current SHA if file exists (always fetch fresh SHA on retry)
    const existingFile = await getFileFromGitHub(octokit, config.username, filePath);
    
    // If file exists, check if we need to update it
    if (existingFile) {
      const existingItem: SyncItem = JSON.parse(existingFile.content);
      
      // Compare versions - only push if our version is newer
      if (existingItem.version > item.version) {
        console.log(`  ⊘ Skipping ${item.id} - GitHub has newer version (${existingItem.version} > ${item.version})`);
        return;
      } else if (existingItem.version === item.version && existingItem.timestamp >= item.timestamp) {
        console.log(`  ⊘ Skipping ${item.id} - GitHub has same or newer timestamp`);
        return;
      }
    }
    
    const content = JSON.stringify(item, null, 2);
    
    // Create descriptive commit message with device info
    const deviceName = item.deviceId.replace('device_', 'Device-');
    const commitMessage = `Update ${item.id} from ${deviceName} - v${item.version}`;
    
    await putFileToGitHub(
      octokit,
      config.username,
      filePath,
      content,
      commitMessage,
      existingFile?.sha
    );
    
    console.log(`  ✓ Pushed ${item.id} to GitHub`);
  } catch (error: any) {
    // Handle 409 Conflict - file was modified by another process
    if (error.status === 409 && retryCount < MAX_RETRIES) {
      console.warn(`  409 Conflict on ${item.id}, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      
      // Wait a bit before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      
      // Retry with incremented count - will fetch fresh SHA
      return putItemToGitHub(dataType, item, retryCount + 1);
    }
    
    // If max retries reached or different error, throw it
    throw error;
  }
}

// ============================================
// DELETED ITEMS TRACKING
// ============================================

interface DeletedItemsMap {
  [itemId: string]: number; // itemId -> timestamp when deleted
}

// Get deleted items list from GitHub
async function getDeletedItemsList(): Promise<DeletedItemsMap> {
  const config = getGitHubConfig();
  if (!config) {
    return {};
  }

  const octokit = createOctokit(config.token);
  const filePath = 'v3/deleted-items.json';
  
  try {
    const fileData = await getFileFromGitHub(octokit, config.username, filePath);
    if (fileData) {
      return JSON.parse(fileData.content);
    }
    return {};
  } catch (error: any) {
    if (error.status === 404) {
      return {}; // File doesn't exist yet
    }
    console.error('Error reading deleted items list:', error);
    return {};
  }
}

// Save deleted items list to GitHub
async function saveDeletedItemsList(deletedItems: DeletedItemsMap, retryCount = 0): Promise<void> {
  const MAX_RETRIES = 3;
  const config = getGitHubConfig();
  if (!config) {
    throw new Error('Not signed in to GitHub');
  }

  const octokit = createOctokit(config.token);
  const filePath = 'v3/deleted-items.json';
  
  try {
    // Get current SHA if file exists
    const existingFile = await getFileFromGitHub(octokit, config.username, filePath);
    
    const content = JSON.stringify(deletedItems, null, 2);
    
    await putFileToGitHub(
      octokit,
      config.username,
      filePath,
      content,
      'Update deleted items list',
      existingFile?.sha
    );
    
    console.log('  ✓ Updated deleted items list on GitHub');
  } catch (error: any) {
    // Handle 409 Conflict - file was modified by another process
    if (error.status === 409 && retryCount < MAX_RETRIES) {
      console.warn(`  409 Conflict on deleted-items.json, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      
      // Wait a bit before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      
      // Retry: fetch latest, merge our changes, and save again
      const latestDeletedItems = await getDeletedItemsList();
      const mergedItems = { ...latestDeletedItems, ...deletedItems };
      
      return saveDeletedItemsList(mergedItems, retryCount + 1);
    }
    
    console.error('Error saving deleted items list:', error);
    throw error;
  }
}

// Add item to deleted items list
export async function addToDeletedItemsList(itemId: string): Promise<void> {
  console.log(`Adding ${itemId} to deleted items list...`);
  
  const deletedItems = await getDeletedItemsList();
  deletedItems[itemId] = Date.now();
  
  await saveDeletedItemsList(deletedItems);
}

// Clean up old deleted items (older than 7 days)
async function cleanupOldDeletedItems(): Promise<void> {
  const deletedItems = await getDeletedItemsList();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  let needsUpdate = false;
  const cleaned: DeletedItemsMap = {};
  
  for (const [itemId, timestamp] of Object.entries(deletedItems)) {
    if (timestamp > sevenDaysAgo) {
      cleaned[itemId] = timestamp;
    } else {
      console.log(`  Cleaning up old deleted item: ${itemId}`);
      needsUpdate = true;
    }
  }
  
  if (needsUpdate) {
    await saveDeletedItemsList(cleaned);
    console.log('  ✓ Cleaned up old deleted items');
  }
}

// Process deleted items - remove from local storage
async function processDeletedItems(): Promise<void> {
  console.log('Processing deleted items list...');
  
  const deletedItems = await getDeletedItemsList();
  const deletedIds = Object.keys(deletedItems);
  
  if (deletedIds.length === 0) {
    console.log('  No deleted items to process');
    return;
  }
  
  console.log(`  Found ${deletedIds.length} deleted items`);
  
  // Process each data type
  for (const dataType of ['lists', 'notes', 'events'] as const) {
    const data = localStorage.getItem(`notes-app-${dataType}`);
    if (!data) continue;
    
    const items = JSON.parse(data);
    const originalLength = items.length;
    
    // Filter out deleted items
    const filtered = items.filter((item: any) => !deletedIds.includes(item.id));
    
    if (filtered.length < originalLength) {
      const removedCount = originalLength - filtered.length;
      console.log(`  Removed ${removedCount} deleted ${dataType} from local storage`);
      localStorage.setItem(`notes-app-${dataType}`, JSON.stringify(filtered));
      localStorage.setItem(`notes-app-${dataType}-timestamp`, Date.now().toString());
    }
  }
  
  console.log('  ✓ Deleted items processed');
}

// Permanently delete items (called from Trash page)
export async function permanentlyDeleteItems(items: Array<{ type: 'lists' | 'notes' | 'events'; id: string }>): Promise<void> {
  console.log(`Permanently deleting ${items.length} items...`);
  
  // Batch add all items to deleted items list (single update to avoid SHA conflicts)
  const deletedItems = await getDeletedItemsList();
  const timestamp = Date.now();
  
  for (const item of items) {
    console.log(`Adding ${item.id} to deleted items list...`);
    deletedItems[item.id] = timestamp;
  }
  
  // Save all at once
  await saveDeletedItemsList(deletedItems);
  
  // Delete item files from GitHub
  for (const item of items) {
    try {
      await deleteItemFromGitHub(item.type, item.id);
    } catch (error) {
      console.error(`Failed to delete ${item.id} from GitHub:`, error);
    }
  }
  
  console.log('  ✓ Items permanently deleted');
}

// Delete a single item from GitHub (exported for future use)
export async function deleteItemFromGitHub(
  dataType: 'lists' | 'notes' | 'events',
  itemId: string
): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error('Not signed in to GitHub');
  }

  const octokit = createOctokit(config.token);
  const filePath = `v3/${dataType}/${itemId}.json`;
  
  try {
    // Get current SHA
    const existingFile = await getFileFromGitHub(octokit, config.username, filePath);
    
    if (!existingFile) {
      console.log(`  File ${itemId}.json doesn't exist, skipping delete`);
      return;
    }
    
    // Delete the file
    await octokit.repos.deleteFile({
      owner: config.username,
      repo: REPO_NAME,
      path: filePath,
      message: `Delete ${itemId}`,
      sha: existingFile.sha,
      branch: 'main',
    });
    
    console.log(`  ✓ Deleted ${itemId} from GitHub`);
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`  File ${itemId}.json not found, already deleted`);
      return;
    }
    throw error;
  }
}

// Get device ID
function getDeviceId(): string {
  let deviceId = localStorage.getItem('notes-app-device-id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('notes-app-device-id', deviceId);
  }
  return deviceId;
}

// Migrate old items to add sync metadata
function migrateItemIfNeeded(item: any): any {
  // If item already has sync metadata, return as-is
  if (item.version !== undefined && item.timestamp !== undefined && item.deviceId !== undefined) {
    return item;
  }
  
  // Add sync metadata to old items
  const now = Date.now();
  const deviceId = getDeviceId();
  
  console.log(`[Migration] Adding sync metadata to item ${item.id}`);
  
  return {
    ...item,
    version: item.version || 1,
    timestamp: item.timestamp || now,
    deviceId: item.deviceId || deviceId
  };
}

// Get local items for a data type
function getLocalItems(dataType: 'lists' | 'notes' | 'events'): SyncItem[] {
  const data = localStorage.getItem(`notes-app-${dataType}`);
  if (!data) return [];
  
  const items = JSON.parse(data);
  
  // Migrate items if needed and check if any were migrated
  let needsSave = false;
  const migratedItems = items.map((item: any) => {
    const migrated = migrateItemIfNeeded(item);
    if (migrated !== item) {
      needsSave = true;
    }
    return migrated;
  });
  
  // Save back to localStorage if any items were migrated
  if (needsSave) {
    console.log(`[Migration] Saving ${migratedItems.length} migrated items to localStorage`);
    localStorage.setItem(`notes-app-${dataType}`, JSON.stringify(migratedItems));
  }
  
  // Items in localStorage now have all sync metadata (id, version, timestamp, deviceId)
  // Just wrap them in SyncItem format - data IS the full item
  const syncItems = migratedItems.map((item: any) => ({
    id: item.id,
    version: item.version,
    timestamp: item.timestamp,
    deviceId: item.deviceId,
    data: item  // The full item with all its properties
  }));
  
  // Debug: Log first item to verify timestamps are preserved
  if (syncItems.length > 0) {
    console.log(`[getLocalItems] ${dataType} - First item:`, {
      id: syncItems[0].id,
      version: syncItems[0].version,
      timestamp: syncItems[0].timestamp,
      deviceId: syncItems[0].deviceId
    });
  }
  
  return syncItems;
}

// Save local items for a data type
function saveLocalItems(dataType: 'lists' | 'notes' | 'events', items: SyncItem[]): void {
  // Extract the data (full items) and save to localStorage
  // This preserves all sync metadata because data IS the full item
  const dataItems = items.map(item => item.data);
  localStorage.setItem(`notes-app-${dataType}`, JSON.stringify(dataItems));
  localStorage.setItem(`notes-app-${dataType}-timestamp`, Date.now().toString());
}

// Sync a single item (compare and decide push/pull)
async function syncSingleItem(
  localItem: SyncItem | null,
  githubItem: SyncItem | null
): Promise<{ action: 'push' | 'pull' | 'skip'; item: SyncItem | null }> {
  
  // Case 1: Item only exists locally - PUSH to GitHub
  if (localItem && !githubItem) {
    console.log(`  ${localItem.id}: Local only → PUSH`);
    return { action: 'push', item: localItem };
  }
  
  // Case 2: Item only exists on GitHub - PULL to local
  if (!localItem && githubItem) {
    console.log(`  ${githubItem.id}: GitHub only → PULL`);
    return { action: 'pull', item: githubItem };
  }
  
  // Case 3: Item exists in both - compare VERSION first, then timestamp
  if (localItem && githubItem) {
    console.log(`  [DEBUG] ${localItem.id}: Local(v${localItem.version},t${localItem.timestamp}), GitHub(v${githubItem.version},t${githubItem.timestamp})`);
    
    // Compare VERSION first (most important!)
    if (localItem.version > githubItem.version) {
      console.log(`  ${localItem.id}: Local version newer (${localItem.version} > ${githubItem.version}) → PUSH`);
      return { action: 'push', item: localItem };
    } else if (githubItem.version > localItem.version) {
      console.log(`  ${githubItem.id}: GitHub version newer (${githubItem.version} > ${localItem.version}) → PULL`);
      return { action: 'pull', item: githubItem };
    }
    
    // Same version - compare TIMESTAMP as tiebreaker
    if (localItem.timestamp > githubItem.timestamp) {
      console.log(`  ${localItem.id}: Same version, local timestamp newer (${localItem.timestamp} > ${githubItem.timestamp}) → PUSH`);
      return { action: 'push', item: localItem };
    } else if (githubItem.timestamp > localItem.timestamp) {
      console.log(`  ${githubItem.id}: Same version, GitHub timestamp newer (${githubItem.timestamp} > ${localItem.timestamp}) → PULL`);
      return { action: 'pull', item: githubItem };
    } else {
      console.log(`  ${localItem.id}: Same version and timestamp → SKIP`);
      return { action: 'skip', item: null };
    }
  }
  
  return { action: 'skip', item: null };
}

// Main sync function for a data type (internal - called by queue)
async function syncDataTypeInternal(dataType: 'lists' | 'notes' | 'events'): Promise<{ success: boolean; error?: string }> {
  console.log(`\n=== Syncing ${dataType} ===`);
  console.log(`[SYNC START] Time: ${new Date().toISOString()}`);
  
  try {
    // Get deleted items list to avoid pulling deleted items
    const deletedItemsMap = await getDeletedItemsList();
    const deletedIds = new Set(Object.keys(deletedItemsMap));
    console.log(`Deleted items to skip: ${deletedIds.size}`);
    
    // Get items from both sources
    const localItems = getLocalItems(dataType);
    const githubItems = await getItemsFromGitHub(dataType);
    
    console.log(`Local: ${localItems.length} items, GitHub: ${githubItems.length} items`);
    
    // Create maps for easy lookup
    const localMap = new Map(localItems.map(item => [item.id, item]));
    const githubMap = new Map(githubItems.map(item => [item.id, item]));
    
    // Get all unique IDs (excluding deleted items)
    const allIds = new Set([...localMap.keys(), ...githubMap.keys()].filter(id => !deletedIds.has(id)));
    
    console.log(`Total unique items (excluding deleted): ${allIds.size}`);
    
    // Track changes
    let pullCount = 0;
    let pushCount = 0;
    let skipCount = 0;
    let deletedSkipCount = 0;
    
    // Process each item one by one - ALWAYS compare with GitHub (no early skip)
    for (const id of allIds) {
      const localItem = localMap.get(id) || null;
      const githubItem = githubMap.get(id) || null;
      
      // Always compare local vs GitHub
      const result = await syncSingleItem(localItem, githubItem);
      
      if (result.action === 'push' && result.item) {
        // Push this item to GitHub
        await putItemToGitHub(dataType, result.item);
        // Mark done: Update synced state
        updateSyncedStateForItem(dataType, result.item);
        pushCount++;
      } else if (result.action === 'pull' && result.item) {
        // Pull this item from GitHub
        localMap.set(result.item.id, result.item);
        // Mark done: Update synced state
        updateSyncedStateForItem(dataType, result.item);
        pullCount++;
      } else {
        // Skip: timestamps are same
        // Still mark done: Update synced state with current item
        if (localItem) {
          updateSyncedStateForItem(dataType, localItem);
        } else if (githubItem) {
          updateSyncedStateForItem(dataType, githubItem);
        }
        skipCount++;
      }
    }
    
    // Count deleted items that were skipped
    for (const id of deletedIds) {
      if (githubMap.has(id) || localMap.has(id)) {
        deletedSkipCount++;
      }
    }
    
    // Save updated local items if any were pulled
    if (pullCount > 0) {
      const updatedLocalItems = Array.from(localMap.values());
      saveLocalItems(dataType, updatedLocalItems);
      console.log(`✓ Pulled ${pullCount} items from GitHub`);
    }
    
    if (pushCount > 0) {
      console.log(`✓ Pushed ${pushCount} items to GitHub`);
    }
    
    if (skipCount > 0) {
      console.log(`✓ Skipped ${skipCount} items (same timestamp)`);
    }
    
    if (deletedSkipCount > 0) {
      console.log(`✓ Skipped ${deletedSkipCount} deleted items`);
    }
    
    console.log(`✓ ${dataType} sync complete`);
    console.log(`[SYNC END] Time: ${new Date().toISOString()}`);
    
    // Update last sync time for debouncing
    lastSyncTime[dataType] = Date.now();
    
    return { success: true };
    
  } catch (error: any) {
    console.error(`Sync error for ${dataType}:`, error);
    return { success: false, error: error.message };
  }
}

// Public sync function for a data type (adds to queue)
export async function syncDataType(dataType: 'lists' | 'notes' | 'events'): Promise<{ success: boolean; error?: string }> {
  return queueSync(dataType);
}

// Sync all data types (internal - called by queue)
async function syncAllInternal(): Promise<{ success: boolean; error?: string }> {
  console.log('\n=== SYNC ALL STARTED ===');
  
  if (!isOnlineMode()) {
    console.log('Offline mode - sync skipped');
    return { success: false, error: 'Offline mode' };
  }
  
  const config = getGitHubConfig();
  if (!config) {
    return { success: false, error: 'Not signed in to GitHub' };
  }
  
  saveSyncStatus({ status: 'syncing', lastSync: null });
  
  try {
    // First: Process deleted items (remove from local if they're in the deleted list)
    await processDeletedItems();
    
    // Second: Clean up old deleted items (7+ days old)
    await cleanupOldDeletedItems();
    
    // Third: Sync each data type one by one
    for (const dataType of ['lists', 'notes', 'events'] as const) {
      const result = await syncDataTypeInternal(dataType);
      if (!result.success) {
        console.warn(`Warning: ${dataType} sync failed:`, result.error);
      }
    }
    
    saveSyncStatus({ status: 'synced', lastSync: Date.now() });
    console.log('=== SYNC ALL COMPLETED ===\n');
    
    // Update last sync time for debouncing
    lastSyncTime['all'] = Date.now();
    
    // Dispatch event to notify components
    const event = new CustomEvent('sync-complete');
    window.dispatchEvent(event);
    
    return { success: true };
  } catch (error: any) {
    console.error('Sync all error:', error);
    saveSyncStatus({ status: 'error', lastSync: null, error: error.message });
    return { success: false, error: error.message };
  }
}

// Public sync all function (adds to queue)
export async function syncAll(): Promise<{ success: boolean; error?: string }> {
  return queueSync('all');
}
