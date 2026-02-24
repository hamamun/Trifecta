const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get changed files in recent commits (last 3 commits to catch concurrent pushes)
function getChangedFiles() {
  try {
    const output = execSync('git diff --name-only HEAD~2 HEAD', { encoding: 'utf-8' });
    return output
      .split('\n')
      .filter(f => f.match(/^v3\/(lists|notes|events)\/.*\.json$/))
      .filter(f => f.length > 0);
  } catch (error) {
    console.log('Could not get changed files (might be first commit)');
    return [];
  }
}

// Get file content from a specific commit
function getFileAtCommit(filePath, commit) {
  try {
    const content = execSync(`git show ${commit}:${filePath}`, { encoding: 'utf-8' });
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Check if two versions conflict (same version, different content)
function isConflict(itemA, itemB) {
  if (!itemA || !itemB) return false;
  
  // Must have same ID
  if (itemA.id !== itemB.id) return false;
  
  // Must have same version number
  if (itemA.version !== itemB.version) return false;
  
  // Must have different timestamps (different edits)
  if (itemA.timestamp === itemB.timestamp) return false;
  
  // Must have different device IDs (from different devices)
  if (itemA.deviceId === itemB.deviceId) return false;
  
  return true;
}

// Auto-merge two conflicting items
function autoMerge(itemA, itemB) {
  console.log(`  Attempting auto-merge for ${itemA.id}...`);
  
  const conflicts = [];
  const merged = { ...itemA };
  
  // Use latest timestamp
  merged.timestamp = Math.max(itemA.timestamp, itemB.timestamp);
  
  // Increment version
  merged.version = itemA.version + 1;
  
  // Set device to "auto-merged"
  merged.deviceId = 'auto-merged';
  
  // Merge tags (union)
  if (itemA.tags && itemB.tags) {
    merged.tags = [...new Set([...itemA.tags, ...itemB.tags])];
  }
  
  // Merge images (union)
  if (itemA.images && itemB.images) {
    merged.images = [...new Set([...itemA.images, ...itemB.images])];
  }
  
  // Check for content conflicts
  if (itemA.title !== itemB.title) {
    conflicts.push({ field: 'title', valueA: itemA.title, valueB: itemB.title });
  }
  
  if (itemA.content !== itemB.content) {
    conflicts.push({ field: 'content', valueA: itemA.content, valueB: itemB.content });
  }
  
  // For lists, check items
  if (itemA.items && itemB.items) {
    const itemsA = JSON.stringify(itemA.items);
    const itemsB = JSON.stringify(itemB.items);
    if (itemsA !== itemsB) {
      conflicts.push({ field: 'items', valueA: itemA.items, valueB: itemB.items });
    }
  }
  
  // For events, check entries
  if (itemA.entries && itemB.entries) {
    const entriesA = JSON.stringify(itemA.entries);
    const entriesB = JSON.stringify(itemB.entries);
    if (entriesA !== entriesB) {
      conflicts.push({ field: 'entries', valueA: itemA.entries, valueB: itemB.entries });
    }
  }
  
  // If there are content conflicts, can't auto-merge
  if (conflicts.length > 0) {
    console.log(`  ✗ Cannot auto-merge (${conflicts.length} conflicts)`);
    return { success: false, conflicts, itemA, itemB };
  }
  
  // Add merge metadata
  merged.mergeInfo = {
    mergedFrom: [itemA.deviceId, itemB.deviceId],
    mergedAt: Date.now(),
    strategy: 'auto',
    originalVersions: [
      { version: itemA.version, timestamp: itemA.timestamp, device: itemA.deviceId },
      { version: itemB.version, timestamp: itemB.timestamp, device: itemB.deviceId }
    ]
  };
  
  console.log(`  ✓ Auto-merge successful → v${merged.version}`);
  return { success: true, merged };
}

// Create conflict report
function createConflictReport(itemA, itemB, conflicts, dataType) {
  const reportId = `${itemA.id}_conflict_${Date.now()}`;
  const reportPath = `conflicts/${reportId}.json`;
  
  const report = {
    itemId: itemA.id,
    type: dataType,
    detectedAt: Date.now(),
    versionA: {
      version: itemA.version,
      timestamp: itemA.timestamp,
      deviceId: itemA.deviceId,
      data: itemA
    },
    versionB: {
      version: itemB.version,
      timestamp: itemB.timestamp,
      deviceId: itemB.deviceId,
      data: itemB
    },
    conflicts: conflicts.map(c => ({
      field: c.field,
      reason: 'Different values'
    })),
    status: 'pending'
  };
  
  // Ensure conflicts directory exists
  if (!fs.existsSync('conflicts')) {
    fs.mkdirSync('conflicts', { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  ✓ Created conflict report: ${reportPath}`);
  
  return reportPath;
}

// Main conflict detection logic
function detectConflicts() {
  console.log('=== Conflict Detection Started ===\n');
  
  const changedFiles = getChangedFiles();
  
  if (changedFiles.length === 0) {
    console.log('No changed files to check');
    return;
  }
  
  console.log(`Checking ${changedFiles.length} changed files...\n`);
  
  const processedFiles = new Set();
  
  for (const filePath of changedFiles) {
    if (processedFiles.has(filePath)) continue;
    processedFiles.add(filePath);
    
    console.log(`Checking: ${filePath}`);
    
    // Get current version (HEAD)
    const current = getFileAtCommit(filePath, 'HEAD');
    
    // Get previous version (HEAD~1)
    const previous = getFileAtCommit(filePath, 'HEAD~1');
    
    if (!current) {
      console.log('  → New file, no conflict possible\n');
      continue;
    }
    
    if (!previous) {
      console.log('  → No previous version, no conflict possible\n');
      continue;
    }
    
    // Check for conflict
    if (isConflict(previous, current)) {
      console.log(`  ⚠️  CONFLICT DETECTED!`);
      console.log(`     Version: ${current.version}`);
      console.log(`     Device A: ${previous.deviceId} (t:${previous.timestamp})`);
      console.log(`     Device B: ${current.deviceId} (t:${current.timestamp})`);
      
      // Try auto-merge
      const mergeResult = autoMerge(previous, current);
      
      if (mergeResult.success) {
        // Write merged version back to file
        const dataType = filePath.split('/')[1]; // lists, notes, or events
        const itemFilePath = filePath;
        
        // Update the item file with merged version
        const syncItem = {
          id: mergeResult.merged.id,
          version: mergeResult.merged.version,
          timestamp: mergeResult.merged.timestamp,
          deviceId: mergeResult.merged.deviceId,
          data: mergeResult.merged
        };
        
        fs.writeFileSync(itemFilePath, JSON.stringify(syncItem, null, 2));
        console.log(`  ✓ Merged version written to ${itemFilePath}\n`);
      } else {
        // Create conflict report
        const dataType = filePath.split('/')[1];
        createConflictReport(previous, current, mergeResult.conflicts, dataType);
        console.log('');
      }
    } else {
      console.log('  ✓ No conflict\n');
    }
  }
  
  console.log('=== Conflict Detection Complete ===');
}

// Run conflict detection
try {
  detectConflicts();
} catch (error) {
  console.error('Error during conflict detection:', error);
  process.exit(1);
}
