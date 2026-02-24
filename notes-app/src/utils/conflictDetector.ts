import { getGitHubConfig } from './github';

export interface ConflictReport {
  itemId: string;
  type: 'lists' | 'notes' | 'events';
  detectedAt: number;
  versionA: {
    version: number;
    timestamp: number;
    deviceId: string;
    data: any;
  };
  versionB: {
    version: number;
    timestamp: number;
    deviceId: string;
    data: any;
  };
  conflicts: Array<{
    field: string;
    reason: string;
  }>;
  status: 'pending' | 'resolved';
}

/**
 * Fetch all conflict reports from GitHub
 */
export async function fetchConflictReports(): Promise<ConflictReport[]> {
  const config = getGitHubConfig();
  if (!config) return [];

  try {
    // Fetch list of files in conflicts/ folder
    const url = `https://api.github.com/repos/${config.username}/my-notes-data/contents/conflicts`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Conflicts folder doesn't exist yet
        return [];
      }
      throw new Error(`Failed to fetch conflicts: ${response.status}`);
    }

    const files = await response.json();
    
    if (!Array.isArray(files)) {
      return [];
    }

    // Fetch each conflict report
    const reports: ConflictReport[] = [];
    
    for (const file of files) {
      if (file.type === 'file' && file.name.endsWith('.json')) {
        try {
          const reportResponse = await fetch(file.download_url);
          const report: ConflictReport = await reportResponse.json();
          
          // Only include pending conflicts
          if (report.status === 'pending') {
            reports.push(report);
          }
        } catch (error) {
          console.error(`Failed to fetch conflict report ${file.name}:`, error);
        }
      }
    }

    return reports;
  } catch (error) {
    console.error('Error fetching conflict reports:', error);
    return [];
  }
}

/**
 * Resolve a conflict by choosing a version
 */
export async function resolveConflict(
  report: ConflictReport,
  choice: 'A' | 'B' | 'merged',
  mergedData?: any
): Promise<{ success: boolean; error?: string }> {
  const config = getGitHubConfig();
  if (!config) {
    return { success: false, error: 'Not connected to GitHub' };
  }

  try {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: config.token });

    // Determine which version to use
    let resolvedData;
    if (choice === 'A') {
      resolvedData = report.versionA.data;
    } else if (choice === 'B') {
      resolvedData = report.versionB.data;
    } else {
      resolvedData = mergedData;
    }

    // Increment version
    resolvedData.version = Math.max(report.versionA.version, report.versionB.version) + 1;
    resolvedData.timestamp = Date.now();
    resolvedData.deviceId = getDeviceId();

    // Create sync item
    const syncItem = {
      id: resolvedData.id,
      version: resolvedData.version,
      timestamp: resolvedData.timestamp,
      deviceId: resolvedData.deviceId,
      data: resolvedData
    };

    // Update the item file
    const itemPath = `v3/${report.type}/${report.itemId}.json`;
    const itemContent = JSON.stringify(syncItem, null, 2);
    
    // Get current SHA
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner: config.username,
        repo: 'my-notes-data',
        path: itemPath,
        ref: 'main',
      });
      if ('sha' in data) {
        sha = data.sha;
      }
    } catch (error) {
      // File might not exist
    }

    // Encode content to base64
    const utf8Bytes = new TextEncoder().encode(itemContent);
    const bytes = new Uint8Array(utf8Bytes);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Content = btoa(binary);

    // Update file
    await octokit.repos.createOrUpdateFileContents({
      owner: config.username,
      repo: 'my-notes-data',
      path: itemPath,
      message: `Resolve conflict for ${report.itemId} - chose ${choice}`,
      content: base64Content,
      branch: 'main',
      ...(sha && { sha }),
    });

    // Mark conflict as resolved
    const conflictFileName = `${report.itemId}_conflict_${report.detectedAt}.json`;
    const conflictPath = `conflicts/${conflictFileName}`;
    
    // Get conflict file SHA
    const { data: conflictFile } = await octokit.repos.getContent({
      owner: config.username,
      repo: 'my-notes-data',
      path: conflictPath,
      ref: 'main',
    });

    if ('sha' in conflictFile) {
      // Delete conflict report
      await octokit.repos.deleteFile({
        owner: config.username,
        repo: 'my-notes-data',
        path: conflictPath,
        message: `Resolve conflict for ${report.itemId}`,
        sha: conflictFile.sha,
        branch: 'main',
      });
    }

    // Update local storage
    updateLocalStorage(report.type, resolvedData);

    return { success: true };
  } catch (error: any) {
    console.error('Error resolving conflict:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update local storage with resolved data
 */
function updateLocalStorage(dataType: 'lists' | 'notes' | 'events', data: any): void {
  const storageKey = `notes-app-${dataType}`;
  const stored = localStorage.getItem(storageKey);
  
  if (!stored) return;

  const items = JSON.parse(stored);
  const index = items.findIndex((item: any) => item.id === data.id);

  if (index >= 0) {
    items[index] = data;
  } else {
    items.push(data);
  }

  localStorage.setItem(storageKey, JSON.stringify(items));
  localStorage.setItem(`${storageKey}-timestamp`, Date.now().toString());
}

/**
 * Get device ID
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('notes-app-device-id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('notes-app-device-id', deviceId);
  }
  return deviceId;
}

/**
 * Check for new conflicts (called by polling)
 */
export async function checkForConflicts(): Promise<ConflictReport[]> {
  const reports = await fetchConflictReports();
  
  if (reports.length > 0) {
    console.log(`[ConflictDetector] Found ${reports.length} pending conflict(s)`);
    
    // Dispatch event for UI
    window.dispatchEvent(new CustomEvent('conflicts-detected', {
      detail: { count: reports.length, reports }
    }));
  }
  
  return reports;
}
