import { Octokit } from '@octokit/rest';

const REPO_NAME = 'my-notes-data';
const REPO_BRANCH = 'main';

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

// Create Octokit instance
function createOctokit(token: string): Octokit {
  return new Octokit({ 
    auth: token,
    userAgent: 'notes-app v1.0.0',
  });
}

// Sync lock to prevent concurrent syncs
let isSyncing = false;

// Sync queue to track pending syncs
let pendingSyncTypes = new Set<'lists' | 'notes' | 'events'>();
let syncQueueTimer: ReturnType<typeof setTimeout> | null = null;

// Get pending sync types (for checking if sync needed)
export function getPendingSyncTypes(): Set<'lists' | 'notes' | 'events'> {
  return pendingSyncTypes;
}

// Check if GitHub has updates (lightweight metadata check)
export async function checkForUpdates(): Promise<boolean> {
  const config = getGitHubConfig();
  if (!config) return false;
  
  try {
    const octokit = createOctokit(config.token);
    
    // Get latest commit on main branch (just metadata, very lightweight)
    const { data } = await octokit.repos.getBranch({
      owner: config.username,
      repo: REPO_NAME,
      branch: REPO_BRANCH,
    });
    
    const authorDate = data.commit.commit.author?.date;
    if (!authorDate) {
      console.log('No commit author date found');
      return false;
    }
    
    const githubLastUpdate = new Date(authorDate).getTime();
    
    // Get our last sync time
    const syncStatus = getSyncStatus();
    const ourLastSync = syncStatus.lastSync || 0;
    
    // If GitHub is newer than our last sync, we need to pull updates
    if (githubLastUpdate > ourLastSync) {
      console.log('GitHub has updates:', {
        githubLastUpdate: new Date(githubLastUpdate).toISOString(),
        ourLastSync: new Date(ourLastSync).toISOString(),
      });
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.error('Check for updates error:', error);
    return false;
  }
}

// Get online mode status
export function isOnlineMode(): boolean {
  const saved = localStorage.getItem('notes-app-online-mode');
  return saved !== null ? JSON.parse(saved) : true;
}

// Queue a sync for a specific data type
export function queueSync(dataType: 'lists' | 'notes' | 'events'): void {
  // Always add to queue (even if offline)
  pendingSyncTypes.add(dataType);
  
  // Check if online mode is enabled
  if (!isOnlineMode()) {
    console.log(`Queued ${dataType} but offline - will sync when online. Pending:`, Array.from(pendingSyncTypes));
    return; // Don't start timer, but keep in queue
  }
  
  // Clear existing timer
  if (syncQueueTimer) {
    clearTimeout(syncQueueTimer);
  }
  
  // Debounce: wait 10 seconds after last change
  syncQueueTimer = setTimeout(async () => {
    await processSyncQueue();
  }, 10000);
  
  console.log(`Queued sync for ${dataType}. Pending:`, Array.from(pendingSyncTypes));
}

// Process all pending syncs
async function processSyncQueue(): Promise<void> {
  if (isSyncing || pendingSyncTypes.size === 0) {
    return;
  }
  
  const config = getGitHubConfig();
  if (!config) {
    pendingSyncTypes.clear();
    return;
  }
  
  console.log('Processing sync queue:', Array.from(pendingSyncTypes));
  
  // Copy pending types and clear the set
  const typesToSync = Array.from(pendingSyncTypes);
  pendingSyncTypes.clear();
  
  // Set sync lock
  isSyncing = true;
  saveSyncStatus({ status: 'syncing', lastSync: null });
  
  try {
    // Pull and merge for each pending type
    for (const dataType of typesToSync) {
      console.log(`Syncing ${dataType}...`);
      const pullResult = await pullFromGitHub(dataType);
      if (pullResult.success) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const pushResult = await pushToGitHub(dataType);
        if (!pushResult.success) {
          console.warn(`Push ${dataType} failed:`, pushResult.error);
        }
      } else {
        console.warn(`Pull ${dataType} failed:`, pullResult.error);
      }
    }
    
    saveSyncStatus({ status: 'synced', lastSync: Date.now() });
    console.log('Queue processed successfully!');
  } catch (error: any) {
    console.error('Queue processing error:', error);
    saveSyncStatus({ status: 'error', lastSync: null, error: error.message });
  } finally {
    isSyncing = false;
    
    // If new changes came in while syncing, process them
    if (pendingSyncTypes.size > 0) {
      console.log('New changes detected, reprocessing queue...');
      setTimeout(() => processSyncQueue(), 1000);
    }
  }
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
    console.log('Attempting to create repository:', REPO_NAME);
    
    // Use Octokit method since authentication works
    const response = await octokit.repos.createForAuthenticatedUser({
      name: REPO_NAME,
      private: true,
      description: 'Private storage for Notes App data',
      auto_init: true,
    });
    
    console.log('Repository created successfully:', response.data.html_url);
  } catch (error: any) {
    console.error('Create repo error details:', {
      status: error.status,
      message: error.response?.data?.message,
      errors: error.response?.data?.errors,
      documentation_url: error.response?.data?.documentation_url,
    });
    
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

// Get file from repository
async function getFile(octokit: Octokit, username: string, path: string): Promise<{ content: string; sha: string } | null> {
  try {
    const response = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path,
      ref: REPO_BRANCH,
    });

    const data: any = response.data;
    if (data && 'content' in data && data.content) {
      return {
        content: atob(data.content.replace(/\n/g, '')),
        sha: data.sha,
      };
    }
    return null;
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

// Create or update file in repository
async function putFile(
  octokit: Octokit,
  username: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> {
  await octokit.repos.createOrUpdateFileContents({
    owner: username,
    repo: REPO_NAME,
    path,
    message,
    content: btoa(content),
    branch: REPO_BRANCH,
    ...(sha && { sha }),
  });
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

    console.log('Checking if repo exists for user:', username);
    const exists = await repoExists(octokit, username);
    console.log('Repo exists:', exists);
    
    if (!exists) {
      console.log('Creating repository...');
      await createRepo(octokit);
      console.log('Repository created, waiting for it to be ready...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('Repository already exists, skipping creation');
    }

    return { success: true };
  } catch (error: any) {
    console.error('Initialize sync error:', error);
    let errorMessage = 'Failed to initialize sync';
    
    if (error.status === 404) {
      errorMessage = 'GitHub API endpoint not found. Please ensure you created a "Personal access token (classic)" with the "repo" scope, not a fine-grained token.';
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

// Push data to GitHub with separate folders for active, archived, and deleted
export async function pushToGitHub(dataType: 'lists' | 'notes' | 'events'): Promise<{ success: boolean; error?: string }> {
  const config = getGitHubConfig();
  if (!config) {
    return { success: false, error: 'Not signed in to GitHub' };
  }

  try {
    const octokit = createOctokit(config.token);
    
    // Get current data from localStorage
    const localData = localStorage.getItem(`notes-app-${dataType}`);
    if (!localData) {
      return { success: false, error: 'No local data found' };
    }

    const allItems = JSON.parse(localData);
    
    // Separate items into active, archived, and deleted
    const activeItems = allItems.filter((item: any) => !item.deleted && !item.archived);
    const archivedItems = allItems.filter((item: any) => item.archived && !item.deleted);
    const deletedItems = allItems.filter((item: any) => item.deleted);

    // Upload active items to data/ folder
    const activePath = `data/${dataType}.json`;
    const activeData = {
      data: activeItems,
      lastModified: Date.now(),
    };
    const activeFile = await getFile(octokit, config.username, activePath);
    await putFile(
      octokit,
      config.username,
      activePath,
      JSON.stringify(activeData, null, 2),
      `Update ${dataType} (active) - ${new Date().toISOString()}`,
      activeFile?.sha
    );

    // Upload archived items to archive/ folder
    if (archivedItems.length > 0) {
      const archivePath = `archive/${dataType}.json`;
      const archiveData = {
        data: archivedItems,
        lastModified: Date.now(),
      };
      const archiveFile = await getFile(octokit, config.username, archivePath);
      await putFile(
        octokit,
        config.username,
        archivePath,
        JSON.stringify(archiveData, null, 2),
        `Update ${dataType} (archived) - ${new Date().toISOString()}`,
        archiveFile?.sha
      );
    }

    // Upload deleted items to trash/ folder
    if (deletedItems.length > 0) {
      const trashPath = `trash/${dataType}.json`;
      const trashData = {
        data: deletedItems,
        lastModified: Date.now(),
      };
      const trashFile = await getFile(octokit, config.username, trashPath);
      await putFile(
        octokit,
        config.username,
        trashPath,
        JSON.stringify(trashData, null, 2),
        `Update ${dataType} (deleted) - ${new Date().toISOString()}`,
        trashFile?.sha
      );
    }

    return { success: true };
  } catch (error: any) {
    console.error('Push error:', error);
    return { success: false, error: error.message };
  }
}

// Pull data from GitHub and merge with local (from all folders)
export async function pullFromGitHub(dataType: 'lists' | 'notes' | 'events'): Promise<{ success: boolean; error?: string }> {
  const config = getGitHubConfig();
  if (!config) {
    return { success: false, error: 'Not signed in to GitHub' };
  }

  try {
    const octokit = createOctokit(config.token);

    // Pull from all three folders: data/, archive/, trash/
    const activePath = `data/${dataType}.json`;
    const archivePath = `archive/${dataType}.json`;
    const trashPath = `trash/${dataType}.json`;

    let allRemoteItems: any[] = [];

    // Get active items
    const activeFile = await getFile(octokit, config.username, activePath);
    if (activeFile) {
      const activeData = JSON.parse(activeFile.content);
      allRemoteItems = [...allRemoteItems, ...activeData.data];
    }

    // Get archived items
    const archiveFile = await getFile(octokit, config.username, archivePath);
    if (archiveFile) {
      const archiveData = JSON.parse(archiveFile.content);
      allRemoteItems = [...allRemoteItems, ...archiveData.data];
    }

    // Get deleted items
    const trashFile = await getFile(octokit, config.username, trashPath);
    if (trashFile) {
      const trashData = JSON.parse(trashFile.content);
      allRemoteItems = [...allRemoteItems, ...trashData.data];
    }

    // If no remote data at all, nothing to pull
    if (allRemoteItems.length === 0) {
      return { success: true };
    }

    // Get local data
    const localDataStr = localStorage.getItem(`notes-app-${dataType}`);
    
    if (!localDataStr) {
      // No local data, just use remote
      localStorage.setItem(`notes-app-${dataType}`, JSON.stringify(allRemoteItems));
      localStorage.setItem(`notes-app-${dataType}-timestamp`, Date.now().toString());
      return { success: true };
    }

    // MERGE LOGIC: Combine local and remote data intelligently
    const localData = JSON.parse(localDataStr);
    const mergedData = mergeData(localData, allRemoteItems);
    
    // Save merged data
    localStorage.setItem(`notes-app-${dataType}`, JSON.stringify(mergedData));
    localStorage.setItem(`notes-app-${dataType}-timestamp`, Date.now().toString());

    return { success: true };
  } catch (error: any) {
    console.error('Pull error:', error);
    return { success: false, error: error.message };
  }
}

// Merge local and remote data by ID
function mergeData(localData: any[], remoteData: any[]): any[] {
  // Create a map of all items by ID
  const itemsMap = new Map();
  
  // Add remote items first
  remoteData.forEach(item => {
    if (item.id) {
      itemsMap.set(item.id, { ...item, source: 'remote' });
    }
  });
  
  // Add or update with local items (local takes precedence if newer)
  localData.forEach(item => {
    if (item.id) {
      const existing = itemsMap.get(item.id);
      if (!existing) {
        // New local item
        itemsMap.set(item.id, { ...item, source: 'local' });
      } else {
        // Item exists in both - use the one with latest timestamp
        const localTime = new Date(item.updatedAt || item.createdAt).getTime();
        const remoteTime = new Date(existing.updatedAt || existing.createdAt).getTime();
        
        if (localTime >= remoteTime) {
          itemsMap.set(item.id, { ...item, source: 'local' });
        }
        // else keep remote version
      }
    }
  });
  
  // Convert map back to array and remove source marker
  return Array.from(itemsMap.values()).map(item => {
    const { source, ...cleanItem } = item;
    return cleanItem;
  });
}

// Full sync (pull, merge, then push) with lock
export async function syncAll(): Promise<{ success: boolean; error?: string }> {
  const config = getGitHubConfig();
  if (!config) {
    return { success: false, error: 'Not signed in to GitHub' };
  }

  // Check if already syncing
  if (isSyncing) {
    console.log('Sync already in progress, skipping...');
    return { success: true }; // Return success to avoid showing error
  }

  // Set sync lock
  isSyncing = true;

  // Update status to syncing
  saveSyncStatus({ status: 'syncing', lastSync: null });

  try {
    // STEP 1: Pull and merge all data types
    console.log('Step 1: Pulling and merging data from GitHub...');
    for (const dataType of ['lists', 'notes', 'events'] as const) {
      const pullResult = await pullFromGitHub(dataType);
      if (!pullResult.success) {
        throw new Error(`Pull ${dataType} failed: ${pullResult.error}`);
      }
    }

    // Small delay to ensure data is settled
    await new Promise(resolve => setTimeout(resolve, 500));

    // STEP 2: Push merged data back to GitHub
    console.log('Step 2: Pushing merged data to GitHub...');
    for (const dataType of ['lists', 'notes', 'events'] as const) {
      const pushResult = await pushToGitHub(dataType);
      if (!pushResult.success) {
        // Don't fail the whole sync if push fails, just log it
        console.warn(`Push ${dataType} warning: ${pushResult.error}`);
      }
    }

    // Update status to synced
    saveSyncStatus({ status: 'synced', lastSync: Date.now() });
    console.log('Sync completed successfully!');
    
    // Dispatch event to notify all components to reload data
    const event = new CustomEvent('sync-complete');
    window.dispatchEvent(event);
    
    return { success: true };
  } catch (error: any) {
    console.error('Sync error:', error);
    saveSyncStatus({ status: 'error', lastSync: null, error: error.message });
    return { success: false, error: error.message };
  } finally {
    // Release sync lock
    isSyncing = false;
  }
}

// Disconnect GitHub
export function disconnectGitHub(): void {
  saveGitHubConfig(null);
  saveSyncStatus({ status: 'offline', lastSync: null });
  // Reset sync lock
  isSyncing = false;
}
