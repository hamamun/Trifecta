import { Octokit } from '@octokit/rest';
import { getGitHubConfig } from './github';

const REPO_NAME = 'my-notes-data';
const REPO_BRANCH = 'main';

export type BackupFrequency = 'daily' | 'weekly' | 'monthly' | 'disabled';

export interface BackupSettings {
  enabled: boolean;
  frequency: BackupFrequency;
  lastBackup: number | null;
}

export interface BackupFile {
  name: string;
  path: string;
  date: string;
  size: number;
  sha: string;
}

// Get backup settings
export function getBackupSettings(): BackupSettings {
  const data = localStorage.getItem('notes-app-backup-settings');
  return data ? JSON.parse(data) : { enabled: false, frequency: 'weekly', lastBackup: null };
}

// Save backup settings
export function saveBackupSettings(settings: BackupSettings): void {
  localStorage.setItem('notes-app-backup-settings', JSON.stringify(settings));
}

// Create Octokit instance
function createOctokit(token: string): Octokit {
  return new Octokit({ 
    auth: token,
    userAgent: 'notes-app v1.0.0',
  });
}

// Get backup folder path based on frequency
function getBackupFolder(frequency: BackupFrequency): string {
  return `backups/${frequency}`;
}

// Generate backup filename
function generateBackupFilename(frequency: BackupFrequency): string {
  const now = new Date();
  
  if (frequency === 'daily') {
    const date = now.toISOString().split('T')[0]; // 2026-01-26
    return `backup-${date}.json`;
  } else if (frequency === 'weekly') {
    const year = now.getFullYear();
    const week = getWeekNumber(now);
    return `backup-${year}-week-${week.toString().padStart(2, '0')}.json`;
  } else if (frequency === 'monthly') {
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `backup-${year}-${month}.json`;
  }
  
  return 'backup.json';
}

// Get week number
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Check if backup is needed
export function shouldBackup(settings: BackupSettings): boolean {
  if (!settings.enabled || settings.frequency === 'disabled') {
    return false;
  }
  
  if (!settings.lastBackup) {
    return true; // First backup
  }
  
  const now = Date.now();
  const lastBackup = settings.lastBackup;
  const timeDiff = now - lastBackup;
  
  if (settings.frequency === 'daily') {
    return timeDiff >= 24 * 60 * 60 * 1000; // 24 hours
  } else if (settings.frequency === 'weekly') {
    return timeDiff >= 7 * 24 * 60 * 60 * 1000; // 7 days
  } else if (settings.frequency === 'monthly') {
    return timeDiff >= 30 * 24 * 60 * 60 * 1000; // 30 days
  }
  
  return false;
}

// Create backup
export async function createBackup(frequency?: BackupFrequency): Promise<{ success: boolean; error?: string }> {
  const config = getGitHubConfig();
  if (!config) {
    return { success: false, error: 'Not signed in to GitHub' };
  }
  
  try {
    const settings = getBackupSettings();
    const backupFrequency = frequency || settings.frequency;
    
    if (backupFrequency === 'disabled') {
      return { success: false, error: 'Backup is disabled' };
    }
    
    const octokit = createOctokit(config.token);
    
    // Collect all data
    const lists = localStorage.getItem('notes-app-lists');
    const notes = localStorage.getItem('notes-app-notes');
    const events = localStorage.getItem('notes-app-events');
    
    const backupData = {
      lists: lists ? JSON.parse(lists) : [],
      notes: notes ? JSON.parse(notes) : [],
      events: events ? JSON.parse(events) : [],
      timestamp: Date.now(),
      version: '1.0.0',
    };
    
    // Generate filename and path
    const filename = generateBackupFilename(backupFrequency);
    const folder = getBackupFolder(backupFrequency);
    const path = `${folder}/${filename}`;
    
    // Check if file already exists
    let existingSha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner: config.username,
        repo: REPO_NAME,
        path,
        ref: REPO_BRANCH,
      });
      if ('sha' in data) {
        existingSha = data.sha;
      }
    } catch {
      // File doesn't exist, that's fine
    }
    
    // Upload backup
    await octokit.repos.createOrUpdateFileContents({
      owner: config.username,
      repo: REPO_NAME,
      path,
      message: `Backup - ${new Date().toISOString()}`,
      content: btoa(JSON.stringify(backupData, null, 2)),
      branch: REPO_BRANCH,
      ...(existingSha && { sha: existingSha }),
    });
    
    // Cleanup old backups (keep max 20)
    await cleanupOldBackups(octokit, config.username, folder);
    
    // Update last backup time
    settings.lastBackup = Date.now();
    saveBackupSettings(settings);
    
    console.log('Backup created successfully:', path);
    return { success: true };
  } catch (error: any) {
    console.error('Backup error:', error);
    return { success: false, error: error.message };
  }
}

// Cleanup old backups (keep max 20)
async function cleanupOldBackups(octokit: Octokit, username: string, folder: string): Promise<void> {
  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path: folder,
      ref: REPO_BRANCH,
    });
    
    if (Array.isArray(data)) {
      const files = data.filter(item => item.type === 'file' && item.name.endsWith('.json'));
      
      if (files.length > 20) {
        files.sort((a, b) => a.name.localeCompare(b.name));
        const filesToDelete = files.slice(0, files.length - 20);
        
        for (const file of filesToDelete) {
          await octokit.repos.deleteFile({
            owner: username,
            repo: REPO_NAME,
            path: file.path,
            message: `Cleanup old backup: ${file.name}`,
            sha: file.sha,
            branch: REPO_BRANCH,
          });
        }
      }
    }
  } catch (error) {
    console.warn('Cleanup error:', error);
  }
}

// List available backups
export async function listBackups(frequency: BackupFrequency): Promise<{ success: boolean; backups?: BackupFile[]; error?: string }> {
  const config = getGitHubConfig();
  if (!config) {
    return { success: false, error: 'Not signed in to GitHub' };
  }
  
  try {
    const octokit = createOctokit(config.token);
    const folder = getBackupFolder(frequency);
    
    const { data } = await octokit.repos.getContent({
      owner: config.username,
      repo: REPO_NAME,
      path: folder,
      ref: REPO_BRANCH,
    });
    
    if (Array.isArray(data)) {
      const backups: BackupFile[] = data
        .filter(item => item.type === 'file' && item.name.endsWith('.json'))
        .map(item => ({
          name: item.name,
          path: item.path,
          date: extractDateFromFilename(item.name),
          size: item.size,
          sha: item.sha,
        }))
        .sort((a, b) => b.name.localeCompare(a.name)); // Newest first
      
      return { success: true, backups };
    }
    
    return { success: true, backups: [] };
  } catch (error: any) {
    if (error.status === 404) {
      return { success: true, backups: [] }; // Folder doesn't exist yet
    }
    console.error('List backups error:', error);
    return { success: false, error: error.message };
  }
}

// Extract date from filename for display
function extractDateFromFilename(filename: string): string {
  const match = filename.match(/backup-(.+)\.json/);
  if (match) {
    return match[1];
  }
  return filename;
}

// Delete specific backup
export async function deleteBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
  const config = getGitHubConfig();
  if (!config) {
    return { success: false, error: 'Not signed in to GitHub' };
  }
  
  try {
    const octokit = createOctokit(config.token);
    
    // Get file SHA first
    const { data } = await octokit.repos.getContent({
      owner: config.username,
      repo: REPO_NAME,
      path: backupPath,
      ref: REPO_BRANCH,
    });
    
    if ('sha' in data) {
      // Delete the file
      await octokit.repos.deleteFile({
        owner: config.username,
        repo: REPO_NAME,
        path: backupPath,
        message: `Delete backup: ${backupPath}`,
        sha: data.sha,
        branch: REPO_BRANCH,
      });
      
      console.log('Backup deleted successfully:', backupPath);
      return { success: true };
    }
    
    return { success: false, error: 'Backup file not found' };
  } catch (error: any) {
    console.error('Delete backup error:', error);
    return { success: false, error: error.message };
  }
}

// Delete multiple backups
export async function deleteMultipleBackups(backupPaths: string[]): Promise<{ success: boolean; deleted: number; error?: string }> {
  let deleted = 0;
  
  for (const path of backupPaths) {
    const result = await deleteBackup(path);
    if (result.success) {
      deleted++;
    }
  }
  
  if (deleted === backupPaths.length) {
    return { success: true, deleted };
  } else if (deleted > 0) {
    return { success: true, deleted, error: `${backupPaths.length - deleted} backups failed to delete` };
  } else {
    return { success: false, deleted: 0, error: 'Failed to delete backups' };
  }
}

// Restore from backup
export async function restoreFromBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
  const config = getGitHubConfig();
  if (!config) {
    return { success: false, error: 'Not signed in to GitHub' };
  }
  
  try {
    const octokit = createOctokit(config.token);
    
    // Get backup file
    const { data } = await octokit.repos.getContent({
      owner: config.username,
      repo: REPO_NAME,
      path: backupPath,
      ref: REPO_BRANCH,
    });
    
    if ('content' in data && data.content) {
      const content = atob(data.content.replace(/\n/g, ''));
      const backupData = JSON.parse(content);
      
      // Restore data to localStorage
      localStorage.setItem('notes-app-lists', JSON.stringify(backupData.lists));
      localStorage.setItem('notes-app-notes', JSON.stringify(backupData.notes));
      localStorage.setItem('notes-app-events', JSON.stringify(backupData.events));
      
      // Update timestamps
      localStorage.setItem('notes-app-lists-timestamp', Date.now().toString());
      localStorage.setItem('notes-app-notes-timestamp', Date.now().toString());
      localStorage.setItem('notes-app-events-timestamp', Date.now().toString());
      
      console.log('Backup restored successfully');
      return { success: true };
    }
    
    return { success: false, error: 'Invalid backup file' };
  } catch (error: any) {
    console.error('Restore error:', error);
    return { success: false, error: error.message };
  }
}
