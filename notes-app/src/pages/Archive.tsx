import { useState, useEffect } from 'react';
import { X, RotateCcw, Trash2, CheckSquare, Square, ArrowLeft, Calendar as CalendarIcon, CheckCheck, XCircle } from 'lucide-react';
import { IconButton } from '../components/IconButton';

interface ArchivedItem {
  id: string;
  title: string;
  type: 'list' | 'note' | 'event';
  archivedAt: string;
  subtitle?: string;
}

interface ArchiveProps {
  onClose: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

// Helper function to get device ID
function getDeviceId(): string {
  let deviceId = localStorage.getItem('notes-app-device-id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('notes-app-device-id', deviceId);
  }
  return deviceId;
}

export function Archive({ onClose, sidebarOpen = false, onToggleSidebar }: ArchiveProps) {
  const [archivedLists, setArchivedLists] = useState<ArchivedItem[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<ArchivedItem[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<ArchivedItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'view'>('list');
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [gridViewMode, setGridViewMode] = useState<'comfortable' | 'compact' | 'list' | 'masonry' | 'table' | 'magazine'>(() => {
    const saved = localStorage.getItem('notes-app-grid-view-mode');
    return (saved as 'comfortable' | 'compact' | 'list' | 'masonry' | 'table' | 'magazine') || 'comfortable';
  });
  const [sortMode, setSortMode] = useState<'smart' | 'a-z' | 'z-a' | 'newest' | 'oldest'>(() => {
    const saved = localStorage.getItem('notes-app-sort-mode');
    return (saved as 'smart' | 'a-z' | 'z-a' | 'newest' | 'oldest') || 'smart';
  });

  // Close handler
  const handleClose = () => {
    // Sync in background on exit (no await)
    (async () => {
      const { syncAll, isOnlineMode, getGitHubConfig } = await import('../utils/github');
      if (isOnlineMode() && getGitHubConfig()) {
        console.log('Exiting Archive - syncing all data...');
        syncAll();  // No await - background sync
      }
    })();
    
    onClose();  // Close immediately, don't wait for sync
  };

  useEffect(() => {
    // Load items IMMEDIATELY from localStorage
    loadArchivedItems();
    
    // Sync in background (no await)
    (async () => {
      const { syncAll, isOnlineMode, getGitHubConfig } = await import('../utils/github');
      if (isOnlineMode() && getGitHubConfig()) {
        console.log('Entering Archive - syncing all data...');
        syncAll();  // No await - background sync
      }
    })();
    
    // Listen for sync-complete to reload items
    const handleSyncComplete = () => {
      console.log('Sync complete - reloading archived items');
      loadArchivedItems();
    };
    window.addEventListener('sync-complete', handleSyncComplete);
    
    // Listen for grid view mode changes
    const handleGridViewChange = (e: CustomEvent) => {
      console.log('Grid view change event received:', e.detail.mode);
      setGridViewMode(e.detail.mode);
    };
    window.addEventListener('grid-view-change', handleGridViewChange as EventListener);
    
    // Listen for sort mode changes
    const handleSortChange = (e: CustomEvent) => {
      console.log('Sort change event received:', e.detail.mode);
      setSortMode(e.detail.mode);
    };
    window.addEventListener('sort-change', handleSortChange as EventListener);
    
    return () => {
      window.removeEventListener('sync-complete', handleSyncComplete);
      window.removeEventListener('grid-view-change', handleGridViewChange as EventListener);
      window.removeEventListener('sort-change', handleSortChange as EventListener);
    };
  }, []);

  const loadArchivedItems = () => {
    // Load archived lists
    const listsData = localStorage.getItem('notes-app-lists');
    if (listsData) {
      const lists = JSON.parse(listsData);
      const archived = lists
        .filter((l: any) => l.archived && !l.deleted)
        .map((l: any) => ({
          id: l.id,
          title: l.title,
          type: 'list' as const,
          archivedAt: l.archivedAt,
          subtitle: `${l.items?.length || 0} items`,
        }));
      setArchivedLists(archived);
    }

    // Load archived notes
    const notesData = localStorage.getItem('notes-app-notes');
    if (notesData) {
      const notes = JSON.parse(notesData);
      const archived = notes
        .filter((n: any) => n.archived && !n.deleted)
        .map((n: any) => ({
          id: n.id,
          title: n.title,
          type: 'note' as const,
          archivedAt: n.archivedAt,
          subtitle: n.content?.substring(0, 50),
        }));
      setArchivedNotes(archived);
    }

    // Load archived events
    const eventsData = localStorage.getItem('notes-app-events');
    if (eventsData) {
      const events = JSON.parse(eventsData);
      const archived = events
        .filter((e: any) => e.archived && !e.deleted)
        .map((e: any) => ({
          id: e.id,
          title: e.title,
          type: 'event' as const,
          archivedAt: e.archivedAt,
          subtitle: `${e.entries?.length || 0} milestones`,
        }));
      setArchivedEvents(archived);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const viewItem = (item: ArchivedItem) => {
    // Load full item data
    let fullItem = null;
    if (item.type === 'list') {
      const data = localStorage.getItem('notes-app-lists');
      if (data) {
        const lists = JSON.parse(data);
        fullItem = lists.find((l: any) => l.id === item.id);
      }
    } else if (item.type === 'note') {
      const data = localStorage.getItem('notes-app-notes');
      if (data) {
        const notes = JSON.parse(data);
        fullItem = notes.find((n: any) => n.id === item.id);
      }
    } else if (item.type === 'event') {
      const data = localStorage.getItem('notes-app-events');
      if (data) {
        const events = JSON.parse(data);
        fullItem = events.find((e: any) => e.id === item.id);
      }
    }
    
    if (fullItem) {
      setCurrentItem({ ...fullItem, type: item.type });
      setViewMode('view');
    }
  };

  const backToList = () => {
    setViewMode('list');
    setCurrentItem(null);
  };

  const restoreItems = () => {
    if (selectedIds.size === 0) return;

    const now = Date.now();
    const deviceId = getDeviceId();

    // Restore lists
    const listsData = localStorage.getItem('notes-app-lists');
    if (listsData) {
      const lists = JSON.parse(listsData);
      const updated = lists.map((l: any) => {
        if (selectedIds.has(l.id)) {
          const { archived, archivedAt, ...rest } = l;
          return {
            ...rest,
            version: (rest.version || 0) + 1,
            timestamp: now,
            deviceId
          };
        }
        return l;
      });
      localStorage.setItem('notes-app-lists', JSON.stringify(updated));
      localStorage.setItem('notes-app-lists-timestamp', Date.now().toString());
    }

    // Restore notes
    const notesData = localStorage.getItem('notes-app-notes');
    if (notesData) {
      const notes = JSON.parse(notesData);
      const updated = notes.map((n: any) => {
        if (selectedIds.has(n.id)) {
          const { archived, archivedAt, ...rest } = n;
          return {
            ...rest,
            version: (rest.version || 0) + 1,
            timestamp: now,
            deviceId
          };
        }
        return n;
      });
      localStorage.setItem('notes-app-notes', JSON.stringify(updated));
      localStorage.setItem('notes-app-notes-timestamp', Date.now().toString());
    }

    // Restore events
    const eventsData = localStorage.getItem('notes-app-events');
    if (eventsData) {
      const events = JSON.parse(eventsData);
      const updated = events.map((e: any) => {
        if (selectedIds.has(e.id)) {
          const { archived, archivedAt, ...rest } = e;
          return {
            ...rest,
            version: (rest.version || 0) + 1,
            timestamp: now,
            deviceId
          };
        }
        return e;
      });
      localStorage.setItem('notes-app-events', JSON.stringify(updated));
      localStorage.setItem('notes-app-events-timestamp', Date.now().toString());
    }

    setSelectedIds(new Set());
    loadArchivedItems();
  };

  const deleteItems = () => {
    if (selectedIds.size === 0) return;
    if (!confirm('Move selected items to trash?')) return;

    const now = new Date().toISOString();
    const timestamp = Date.now();
    const deviceId = getDeviceId();

    // Delete lists (move to trash)
    const listsData = localStorage.getItem('notes-app-lists');
    if (listsData) {
      const lists = JSON.parse(listsData);
      const updated = lists.map((l: any) => {
        if (selectedIds.has(l.id)) {
          const { archived, archivedAt, ...rest } = l;
          return { 
            ...rest, 
            deleted: true, 
            deletedAt: now,
            version: (rest.version || 0) + 1,
            timestamp,
            deviceId
          };
        }
        return l;
      });
      localStorage.setItem('notes-app-lists', JSON.stringify(updated));
      localStorage.setItem('notes-app-lists-timestamp', Date.now().toString());
    }

    // Delete notes (move to trash)
    const notesData = localStorage.getItem('notes-app-notes');
    if (notesData) {
      const notes = JSON.parse(notesData);
      const updated = notes.map((n: any) => {
        if (selectedIds.has(n.id)) {
          const { archived, archivedAt, ...rest } = n;
          return { 
            ...rest, 
            deleted: true, 
            deletedAt: now,
            version: (rest.version || 0) + 1,
            timestamp,
            deviceId
          };
        }
        return n;
      });
      localStorage.setItem('notes-app-notes', JSON.stringify(updated));
      localStorage.setItem('notes-app-notes-timestamp', Date.now().toString());
    }

    // Delete events (move to trash)
    const eventsData = localStorage.getItem('notes-app-events');
    if (eventsData) {
      const events = JSON.parse(eventsData);
      const updated = events.map((e: any) => {
        if (selectedIds.has(e.id)) {
          const { archived, archivedAt, ...rest } = e;
          return { 
            ...rest, 
            deleted: true, 
            deletedAt: now,
            version: (rest.version || 0) + 1,
            timestamp,
            deviceId
          };
        }
        return e;
      });
      localStorage.setItem('notes-app-events', JSON.stringify(updated));
      localStorage.setItem('notes-app-events-timestamp', Date.now().toString());
    }

    setSelectedIds(new Set());
    loadArchivedItems();
    
    // Sync after moving to trash
    (async () => {
      const { syncDataType, isOnlineMode, getGitHubConfig } = await import('../utils/github');
      if (isOnlineMode() && getGitHubConfig()) {
        console.log('Items moved to trash from archive - syncing...');
        await Promise.all([
          syncDataType('lists'),
          syncDataType('notes'),
          syncDataType('events')
        ]);
      }
    })();
  };

  const totalArchived = archivedLists.length + archivedNotes.length + archivedEvents.length;

  const renderSection = (title: string, items: ArchivedItem[]) => {
    if (items.length === 0) return null;

    // Sort items based on sortMode
    const sortedItems = [...items].sort((a, b) => {
      // Note: Archive items don't have pinned status, so we skip that check
      
      // Apply selected sort mode
      switch (sortMode) {
        case 'a-z':
          return a.title.localeCompare(b.title);
        case 'z-a':
          return b.title.localeCompare(a.title);
        case 'oldest':
          return new Date(a.archivedAt).getTime() - new Date(b.archivedAt).getTime();
        case 'newest':
          return new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime();
        case 'smart':
        default:
          return new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime();
      }
    });

    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
          {title} ({items.length})
        </h3>
        
        {/* Table View Header */}
        {gridViewMode === 'table' && (
          <div className="card mb-2 py-2 px-4 bg-gray-50 dark:bg-gray-800/50">
            <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
              <div className="col-span-5">Title</div>
              <div className="col-span-3 hidden md:block">Details</div>
              <div className="col-span-4">Archived</div>
            </div>
          </div>
        )}
        
        <div className={
          gridViewMode === 'comfortable' ? 'space-y-3' :
          gridViewMode === 'compact' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2' :
          gridViewMode === 'list' ? 'space-y-2' :
          gridViewMode === 'masonry' ? 'columns-1 sm:columns-2 lg:columns-3 gap-3 space-y-3' :
          gridViewMode === 'table' ? 'space-y-0' :
          gridViewMode === 'magazine' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' :
          'space-y-3'
        }>
          {sortedItems.map((item, index) => {
            const isMagazineFeatured = gridViewMode === 'magazine' && index === 0;
            
            const cardClass = gridViewMode === 'list' 
              ? `card transition-all cursor-pointer hover:shadow-lg overflow-hidden ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''} flex flex-row items-center gap-4 py-3`
              : gridViewMode === 'compact'
              ? `card transition-all cursor-pointer hover:shadow-lg overflow-hidden ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''} p-3`
              : gridViewMode === 'masonry'
              ? `card transition-all cursor-pointer hover:shadow-lg overflow-hidden ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''} break-inside-avoid mb-3`
              : gridViewMode === 'table'
              ? `card transition-all cursor-pointer hover:shadow-lg overflow-hidden ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''} py-2 px-4 mb-1`
              : gridViewMode === 'magazine'
              ? `card transition-all cursor-pointer hover:shadow-lg overflow-hidden ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''} ${isMagazineFeatured ? 'md:col-span-2 lg:col-span-3' : ''}`
              : `card transition-all cursor-pointer hover:shadow-lg overflow-hidden ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''}`;
            
            return (
              <div
                key={item.id}
                onClick={() => selectionMode ? toggleSelection(item.id) : viewItem(item)}
                className={cardClass}
              >
                {/* List view layout */}
                {gridViewMode === 'list' ? (
                  <>
                    {selectionMode && (
                      <div className="flex-shrink-0">
                        {selectedIds.has(item.id) ? (
                          <CheckSquare className="w-5 h-5 text-primary-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg truncate">{item.title}</h4>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {item.subtitle && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">{item.subtitle}</span>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(item.archivedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                ) : gridViewMode === 'table' ? (
                  /* Table view layout */
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5 flex items-center gap-2 min-w-0">
                      {selectionMode && (
                        <div className="flex-shrink-0">
                          {selectedIds.has(item.id) ? (
                            <CheckSquare className="w-5 h-5 text-primary-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      )}
                      <h4 className="font-semibold text-sm truncate min-w-0">{item.title}</h4>
                    </div>
                    <div className="col-span-3 hidden md:block min-w-0">
                      {item.subtitle && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{item.subtitle}</p>
                      )}
                    </div>
                    <div className="col-span-4">
                      <span className="text-xs text-gray-500">
                        {new Date(item.archivedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Grid view layout (comfortable, compact, masonry, magazine) */
                  <div className="flex items-start gap-3">
                    {selectionMode && (
                      <div className="flex-shrink-0 mt-1">
                        {selectedIds.has(item.id) ? (
                          <CheckSquare className="w-5 h-5 text-primary-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-semibold mb-1 truncate ${gridViewMode === 'compact' ? 'text-sm' : isMagazineFeatured ? 'text-2xl' : 'text-lg'}`}>
                        {item.title}
                      </h4>
                      {item.subtitle && (
                        <p className={`text-gray-600 dark:text-gray-400 mb-2 break-words ${gridViewMode === 'compact' ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'}`}>
                          {item.subtitle}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Archived {new Date(item.archivedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full" data-archive-view="true">
      {/* Left Sidebar */}
      <div 
        className={`w-48 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden fixed lg:relative inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ height: 'calc(100vh - 7rem)' }}
      >
        {/* Header */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-bold">
            Archive
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              ({totalArchived})
            </span>
          </h2>
        </div>

        {/* Summary - Scrollable */}
        <div className="flex-1 overflow-y-auto p-3">
          {totalArchived === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 text-xs">
              Archive is empty
            </div>
          ) : (
            <div className="space-y-3">
              {archivedLists.length > 0 && (
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h3 className="text-xs font-semibold mb-1">Lists</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{archivedLists.length} item{archivedLists.length !== 1 ? 's' : ''}</p>
                </div>
              )}
              {archivedNotes.length > 0 && (
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h3 className="text-xs font-semibold mb-1">Notes</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{archivedNotes.length} item{archivedNotes.length !== 1 ? 's' : ''}</p>
                </div>
              )}
              {archivedEvents.length > 0 && (
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h3 className="text-xs font-semibold mb-1">Events</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{archivedEvents.length} item{archivedEvents.length !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && onToggleSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onToggleSidebar}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {viewMode === 'list' ? (
          <div className="max-w-4xl mx-auto p-4">
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-1 mb-6">
              {totalArchived > 0 && (
                <>
                  <IconButton
                    icon={selectionMode ? XCircle : CheckSquare}
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      setSelectedIds(new Set());
                    }}
                    tooltip={selectionMode ? 'Cancel' : 'Select'}
                    variant={selectionMode ? 'default' : 'primary'}
                  />

                  {selectionMode && (
                    <>
                      <IconButton
                        icon={CheckCheck}
                        onClick={() => {
                          const allIds = new Set<string>();
                          archivedLists.forEach(item => allIds.add(item.id));
                          archivedNotes.forEach(item => allIds.add(item.id));
                          archivedEvents.forEach(item => allIds.add(item.id));
                          setSelectedIds(allIds);
                        }}
                        tooltip="Select All"
                        variant="primary"
                      />
                      <IconButton
                        icon={Square}
                        onClick={() => setSelectedIds(new Set())}
                        tooltip="Deselect All"
                        variant="default"
                      />
                    </>
                  )}

                  {selectionMode && selectedIds.size > 0 && (
                    <>
                      <IconButton
                        icon={RotateCcw}
                        onClick={restoreItems}
                        tooltip={`Restore (${selectedIds.size})`}
                        variant="success"
                      />

                      <IconButton
                        icon={Trash2}
                        onClick={deleteItems}
                        tooltip={`Delete (${selectedIds.size})`}
                        variant="danger"
                      />
                    </>
                  )}
                </>
              )}

              <IconButton
                icon={X}
                onClick={handleClose}
                tooltip="Close"
                variant="default"
              />
            </div>

            {/* Content */}
            {totalArchived === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Archive is Empty
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Archived items will appear here
                </p>
              </div>
            ) : (
              <>
                {renderSection('Lists', archivedLists)}
                {renderSection('Notes', archivedNotes)}
                {renderSection('Events', archivedEvents)}
              </>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto p-4 h-full flex flex-col">
            {/* View Mode Header */}
            <div className="flex items-center justify-between mb-4">
              <IconButton
                icon={ArrowLeft}
                onClick={backToList}
                tooltip="Back"
                variant="default"
              />
              <div className="flex gap-1">
                <IconButton
                  icon={RotateCcw}
                  onClick={() => {
                    if (currentItem) {
                      const itemId = currentItem.id;
                      const itemType = currentItem.type;
                      const now = Date.now();
                      const deviceId = getDeviceId();
                      
                      // Restore the item
                      if (itemType === 'list') {
                        const listsData = localStorage.getItem('notes-app-lists');
                        if (listsData) {
                          const lists = JSON.parse(listsData);
                          const updated = lists.map((l: any) => {
                            if (l.id === itemId) {
                              const { archived, archivedAt, ...rest } = l;
                              return {
                                ...rest,
                                version: (rest.version || 0) + 1,
                                timestamp: now,
                                deviceId
                              };
                            }
                            return l;
                          });
                          localStorage.setItem('notes-app-lists', JSON.stringify(updated));
                          localStorage.setItem('notes-app-lists-timestamp', Date.now().toString());
                        }
                      } else if (itemType === 'note') {
                        const notesData = localStorage.getItem('notes-app-notes');
                        if (notesData) {
                          const notes = JSON.parse(notesData);
                          const updated = notes.map((n: any) => {
                            if (n.id === itemId) {
                              const { archived, archivedAt, ...rest } = n;
                              return {
                                ...rest,
                                version: (rest.version || 0) + 1,
                                timestamp: now,
                                deviceId
                              };
                            }
                            return n;
                          });
                          localStorage.setItem('notes-app-notes', JSON.stringify(updated));
                          localStorage.setItem('notes-app-notes-timestamp', Date.now().toString());
                        }
                      } else if (itemType === 'event') {
                        const eventsData = localStorage.getItem('notes-app-events');
                        if (eventsData) {
                          const events = JSON.parse(eventsData);
                          const updated = events.map((e: any) => {
                            if (e.id === itemId) {
                              const { archived, archivedAt, ...rest } = e;
                              return {
                                ...rest,
                                version: (rest.version || 0) + 1,
                                timestamp: now,
                                deviceId
                              };
                            }
                            return e;
                          });
                          localStorage.setItem('notes-app-events', JSON.stringify(updated));
                          localStorage.setItem('notes-app-events-timestamp', Date.now().toString());
                        }
                      }
                      
                      // Reload and go back
                      loadArchivedItems();
                      backToList();
                    }
                  }}
                  tooltip="Restore"
                  variant="success"
                />
                <IconButton
                  icon={Trash2}
                  onClick={() => {
                    if (currentItem && confirm('Move this item to trash?')) {
                      const itemId = currentItem.id;
                      const itemType = currentItem.type;
                      const now = new Date().toISOString();
                      const timestamp = Date.now();
                      const deviceId = getDeviceId();
                      
                      // Delete the item (move to trash)
                      if (itemType === 'list') {
                        const listsData = localStorage.getItem('notes-app-lists');
                        if (listsData) {
                          const lists = JSON.parse(listsData);
                          const updated = lists.map((l: any) => {
                            if (l.id === itemId) {
                              const { archived, archivedAt, ...rest } = l;
                              return { 
                                ...rest, 
                                deleted: true, 
                                deletedAt: now,
                                version: (rest.version || 0) + 1,
                                timestamp,
                                deviceId
                              };
                            }
                            return l;
                          });
                          localStorage.setItem('notes-app-lists', JSON.stringify(updated));
                          localStorage.setItem('notes-app-lists-timestamp', Date.now().toString());
                        }
                      } else if (itemType === 'note') {
                        const notesData = localStorage.getItem('notes-app-notes');
                        if (notesData) {
                          const notes = JSON.parse(notesData);
                          const updated = notes.map((n: any) => {
                            if (n.id === itemId) {
                              const { archived, archivedAt, ...rest } = n;
                              return { 
                                ...rest, 
                                deleted: true, 
                                deletedAt: now,
                                version: (rest.version || 0) + 1,
                                timestamp,
                                deviceId
                              };
                            }
                            return n;
                          });
                          localStorage.setItem('notes-app-notes', JSON.stringify(updated));
                          localStorage.setItem('notes-app-notes-timestamp', Date.now().toString());
                        }
                      } else if (itemType === 'event') {
                        const eventsData = localStorage.getItem('notes-app-events');
                        if (eventsData) {
                          const events = JSON.parse(eventsData);
                          const updated = events.map((e: any) => {
                            if (e.id === itemId) {
                              const { archived, archivedAt, ...rest } = e;
                              return { 
                                ...rest, 
                                deleted: true, 
                                deletedAt: now,
                                version: (rest.version || 0) + 1,
                                timestamp,
                                deviceId
                              };
                            }
                            return e;
                          });
                          localStorage.setItem('notes-app-events', JSON.stringify(updated));
                          localStorage.setItem('notes-app-events-timestamp', Date.now().toString());
                        }
                      }
                      
                      // Reload and go back
                      loadArchivedItems();
                      backToList();
                      
                      // Sync after moving to trash
                      (async () => {
                        const { syncDataType, isOnlineMode, getGitHubConfig } = await import('../utils/github');
                        if (isOnlineMode() && getGitHubConfig()) {
                          console.log('Item moved to trash from archive - syncing...');
                          if (itemType === 'list') {
                            await syncDataType('lists');
                          } else if (itemType === 'note') {
                            await syncDataType('notes');
                          } else if (itemType === 'event') {
                            await syncDataType('events');
                          }
                        }
                      })();
                    }
                  }}
                  tooltip="Delete"
                  variant="danger"
                />
              </div>
            </div>

            {/* View Content */}
            <div className="flex-1 overflow-y-auto">
              {currentItem && currentItem.type === 'note' && (
                <>
                  <h1 className="text-3xl font-bold mb-4">{currentItem.title}</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Archived: {new Date(currentItem.archivedAt).toLocaleString()}
                  </p>
                  <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                    {currentItem.content}
                  </div>
                </>
              )}

              {currentItem && currentItem.type === 'list' && (
                <>
                  <h1 className="text-2xl font-bold mb-1">{currentItem.title}</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {currentItem.items?.filter((i: any) => i.completed).length} of {currentItem.items?.length} completed
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Archived: {new Date(currentItem.archivedAt).toLocaleDateString()}
                  </p>
                  <div className="space-y-1">
                    {currentItem.items?.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 py-2 px-3 rounded bg-gray-100 dark:bg-gray-800">
                        <span className={`flex-1 ${item.completed ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {currentItem && currentItem.type === 'event' && (
                <>
                  <h1 className="text-2xl font-bold mb-1">{currentItem.title}</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {currentItem.entries?.length || 0} milestone{(currentItem.entries?.length || 0) !== 1 ? 's' : ''} • Archived: {new Date(currentItem.archivedAt).toLocaleDateString()}
                  </p>

                  {/* Timeline */}
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary-200 dark:bg-primary-800"></div>
                    <div className="space-y-6">
                      {currentItem.entries?.map((entry: any) => (
                        <div key={entry.id} className="relative pl-12">
                          <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-primary-600 border-2 border-white dark:border-gray-900"></div>
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2 mb-2">
                              <CalendarIcon className="w-4 h-4 text-primary-600" />
                              <span className="text-sm font-semibold text-primary-600">
                                {new Date(entry.date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                              {entry.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
