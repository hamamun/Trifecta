import { useState, useEffect } from 'react';
import { X, RotateCcw, Trash2, CheckSquare, Square, ArrowLeft, Calendar as CalendarIcon, CheckCheck, XCircle } from 'lucide-react';
import { IconButton } from '../components/IconButton';

interface DeletedItem {
  id: string;
  title: string;
  type: 'list' | 'note' | 'event';
  deletedAt: string;
  subtitle?: string;
}

interface TrashProps {
  onClose: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function Trash({ onClose, sidebarOpen = false, onToggleSidebar }: TrashProps) {
  const [deletedLists, setDeletedLists] = useState<DeletedItem[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<DeletedItem[]>([]);
  const [deletedEvents, setDeletedEvents] = useState<DeletedItem[]>([]);
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

  useEffect(() => {
    loadDeletedItems();
    
    // Listen for sync completion to reload data
    const handleSyncComplete = () => {
      console.log('Sync completed, reloading trash...');
      loadDeletedItems();
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

  const loadDeletedItems = () => {
    // Load deleted lists
    const listsData = localStorage.getItem('notes-app-lists');
    if (listsData) {
      const lists = JSON.parse(listsData);
      const deleted = lists
        .filter((l: any) => l.deleted)
        .map((l: any) => ({
          id: l.id,
          title: l.title,
          type: 'list' as const,
          deletedAt: l.deletedAt,
          subtitle: `${l.items?.length || 0} items`,
        }));
      setDeletedLists(deleted);
    }

    // Load deleted notes
    const notesData = localStorage.getItem('notes-app-notes');
    if (notesData) {
      const notes = JSON.parse(notesData);
      const deleted = notes
        .filter((n: any) => n.deleted)
        .map((n: any) => ({
          id: n.id,
          title: n.title,
          type: 'note' as const,
          deletedAt: n.deletedAt,
          subtitle: n.content?.substring(0, 50),
        }));
      setDeletedNotes(deleted);
    }

    // Load deleted events
    const eventsData = localStorage.getItem('notes-app-events');
    if (eventsData) {
      const events = JSON.parse(eventsData);
      const deleted = events
        .filter((e: any) => e.deleted)
        .map((e: any) => ({
          id: e.id,
          title: e.title,
          type: 'event' as const,
          deletedAt: e.deletedAt,
          subtitle: `${e.entries?.length || 0} milestones`,
        }));
      setDeletedEvents(deleted);
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

  const viewItem = (item: DeletedItem) => {
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

    // Restore lists
    const listsData = localStorage.getItem('notes-app-lists');
    if (listsData) {
      const lists = JSON.parse(listsData);
      const updated = lists.map((l: any) => {
        if (selectedIds.has(l.id)) {
          const { deleted, deletedAt, ...rest } = l;
          return rest;
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
          const { deleted, deletedAt, ...rest } = n;
          return rest;
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
          const { deleted, deletedAt, ...rest } = e;
          return rest;
        }
        return e;
      });
      localStorage.setItem('notes-app-events', JSON.stringify(updated));
      localStorage.setItem('notes-app-events-timestamp', Date.now().toString());
    }

    // Queue sync for all types
    import('../utils/github').then(({ queueSync, getGitHubConfig }) => {
      const config = getGitHubConfig();
      if (config) {
        queueSync('lists');
        queueSync('notes');
        queueSync('events');
      }
    });

    setSelectedIds(new Set());
    loadDeletedItems();
  };

  const deleteForever = () => {
    if (selectedIds.size === 0) return;
    if (!confirm('Permanently delete selected items? This cannot be undone.')) return;

    // Delete from lists
    const listsData = localStorage.getItem('notes-app-lists');
    if (listsData) {
      const lists = JSON.parse(listsData);
      const filtered = lists.filter((l: any) => !selectedIds.has(l.id));
      localStorage.setItem('notes-app-lists', JSON.stringify(filtered));
      localStorage.setItem('notes-app-lists-timestamp', Date.now().toString());
    }

    // Delete from notes
    const notesData = localStorage.getItem('notes-app-notes');
    if (notesData) {
      const notes = JSON.parse(notesData);
      const filtered = notes.filter((n: any) => !selectedIds.has(n.id));
      localStorage.setItem('notes-app-notes', JSON.stringify(filtered));
      localStorage.setItem('notes-app-notes-timestamp', Date.now().toString());
    }

    // Delete from events
    const eventsData = localStorage.getItem('notes-app-events');
    if (eventsData) {
      const events = JSON.parse(eventsData);
      const filtered = events.filter((e: any) => !selectedIds.has(e.id));
      localStorage.setItem('notes-app-events', JSON.stringify(filtered));
      localStorage.setItem('notes-app-events-timestamp', Date.now().toString());
    }

    // Queue sync for all types
    import('../utils/github').then(({ queueSync, getGitHubConfig }) => {
      const config = getGitHubConfig();
      if (config) {
        queueSync('lists');
        queueSync('notes');
        queueSync('events');
      }
    });

    setSelectedIds(new Set());
    loadDeletedItems();
  };

  const emptyTrash = () => {
    if (!confirm('Empty trash? All items will be permanently deleted. This cannot be undone.')) return;

    // Remove all deleted items
    const listsData = localStorage.getItem('notes-app-lists');
    if (listsData) {
      const lists = JSON.parse(listsData);
      const filtered = lists.filter((l: any) => !l.deleted);
      localStorage.setItem('notes-app-lists', JSON.stringify(filtered));
      localStorage.setItem('notes-app-lists-timestamp', Date.now().toString());
    }

    const notesData = localStorage.getItem('notes-app-notes');
    if (notesData) {
      const notes = JSON.parse(notesData);
      const filtered = notes.filter((n: any) => !n.deleted);
      localStorage.setItem('notes-app-notes', JSON.stringify(filtered));
      localStorage.setItem('notes-app-notes-timestamp', Date.now().toString());
    }

    const eventsData = localStorage.getItem('notes-app-events');
    if (eventsData) {
      const events = JSON.parse(eventsData);
      const filtered = events.filter((e: any) => !e.deleted);
      localStorage.setItem('notes-app-events', JSON.stringify(filtered));
      localStorage.setItem('notes-app-events-timestamp', Date.now().toString());
    }

    // Queue sync for all types
    import('../utils/github').then(({ queueSync, getGitHubConfig }) => {
      const config = getGitHubConfig();
      if (config) {
        queueSync('lists');
        queueSync('notes');
        queueSync('events');
      }
    });

    loadDeletedItems();
  };

  const totalDeleted = deletedLists.length + deletedNotes.length + deletedEvents.length;

  const renderSection = (title: string, items: DeletedItem[]) => {
    if (items.length === 0) return null;

    // Sort items based on sortMode
    const sortedItems = [...items].sort((a, b) => {
      // Note: Trash items don't have pinned status, so we skip that check
      
      // Apply selected sort mode
      switch (sortMode) {
        case 'a-z':
          return a.title.localeCompare(b.title);
        case 'z-a':
          return b.title.localeCompare(a.title);
        case 'oldest':
          return new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
        case 'newest':
          return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
        case 'smart':
        default:
          return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
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
              <div className="col-span-4">Deleted</div>
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
              ? `card transition-all cursor-pointer hover:shadow-lg ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''} flex flex-row items-center gap-4 py-3`
              : gridViewMode === 'compact'
              ? `card transition-all cursor-pointer hover:shadow-lg ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''} p-3`
              : gridViewMode === 'masonry'
              ? `card transition-all cursor-pointer hover:shadow-lg ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''} break-inside-avoid mb-3`
              : gridViewMode === 'table'
              ? `card transition-all cursor-pointer hover:shadow-lg ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''} py-2 px-4 mb-1`
              : gridViewMode === 'magazine'
              ? `card transition-all cursor-pointer hover:shadow-lg ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''} ${isMagazineFeatured ? 'md:col-span-2 lg:col-span-3' : ''}`
              : `card transition-all cursor-pointer hover:shadow-lg ${selectedIds.has(item.id) ? 'ring-2 ring-primary-600 bg-primary-50 dark:bg-primary-900/20' : ''}`;
            
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
                        {new Date(item.deletedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                ) : gridViewMode === 'table' ? (
                  /* Table view layout */
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5 flex items-center gap-2">
                      {selectionMode && (
                        <div className="flex-shrink-0">
                          {selectedIds.has(item.id) ? (
                            <CheckSquare className="w-5 h-5 text-primary-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      )}
                      <h4 className="font-semibold text-sm truncate">{item.title}</h4>
                    </div>
                    <div className="col-span-3 hidden md:block">
                      {item.subtitle && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{item.subtitle}</p>
                      )}
                    </div>
                    <div className="col-span-4">
                      <span className="text-xs text-gray-500">
                        {new Date(item.deletedAt).toLocaleDateString()}
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
                      <h4 className={`font-semibold mb-1 ${gridViewMode === 'compact' ? 'text-sm' : isMagazineFeatured ? 'text-2xl' : 'text-lg'}`}>
                        {item.title}
                      </h4>
                      {item.subtitle && (
                        <p className={`text-gray-600 dark:text-gray-400 mb-2 ${gridViewMode === 'compact' ? 'text-xs line-clamp-1' : 'text-sm'}`}>
                          {item.subtitle}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Deleted {new Date(item.deletedAt).toLocaleDateString()}
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
    <div className="flex h-full" data-trash-view="true">
      {/* Left Sidebar - Hidden on mobile by default */}
      <div 
        className={`w-48 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden fixed lg:relative inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ height: 'calc(100vh - 7rem)' }}
      >
        {/* Header */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-bold">
            Trash
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              ({totalDeleted})
            </span>
          </h2>
        </div>

        {/* Summary - Scrollable */}
        <div className="flex-1 overflow-y-auto p-3">
          {totalDeleted === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 text-xs">
              Trash is empty
            </div>
          ) : (
            <div className="space-y-3">
              {deletedLists.length > 0 && (
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h3 className="text-xs font-semibold mb-1">Lists</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{deletedLists.length} item{deletedLists.length !== 1 ? 's' : ''}</p>
                </div>
              )}
              {deletedNotes.length > 0 && (
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h3 className="text-xs font-semibold mb-1">Notes</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{deletedNotes.length} item{deletedNotes.length !== 1 ? 's' : ''}</p>
                </div>
              )}
              {deletedEvents.length > 0 && (
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h3 className="text-xs font-semibold mb-1">Events</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{deletedEvents.length} item{deletedEvents.length !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Empty Trash Button - Fixed at bottom */}
        {totalDeleted > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <IconButton
              icon={Trash2}
              onClick={emptyTrash}
              tooltip="Empty Trash"
              variant="danger"
              className="w-full py-2"
            />
          </div>
        )}
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
              {totalDeleted > 0 && (
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
                          deletedLists.forEach(item => allIds.add(item.id));
                          deletedNotes.forEach(item => allIds.add(item.id));
                          deletedEvents.forEach(item => allIds.add(item.id));
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
                        onClick={deleteForever}
                        tooltip={`Delete Forever (${selectedIds.size})`}
                        variant="danger"
                      />
                    </>
                  )}
                </>
              )}

              <IconButton
                icon={X}
                onClick={onClose}
                tooltip="Close"
                variant="default"
              />
            </div>

            {/* Content */}
            {totalDeleted === 0 ? (
              <div className="text-center py-12">
                <Trash2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Trash is Empty
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Deleted items will appear here
                </p>
              </div>
            ) : (
              <>
                {renderSection('Lists', deletedLists)}
                {renderSection('Notes', deletedNotes)}
                {renderSection('Events', deletedEvents)}
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
                      
                      // Restore the item
                      if (itemType === 'list') {
                        const listsData = localStorage.getItem('notes-app-lists');
                        if (listsData) {
                          const lists = JSON.parse(listsData);
                          const updated = lists.map((l: any) => {
                            if (l.id === itemId) {
                              const { deleted, deletedAt, ...rest } = l;
                              return rest;
                            }
                            return l;
                          });
                          localStorage.setItem('notes-app-lists', JSON.stringify(updated));
                        }
                      } else if (itemType === 'note') {
                        const notesData = localStorage.getItem('notes-app-notes');
                        if (notesData) {
                          const notes = JSON.parse(notesData);
                          const updated = notes.map((n: any) => {
                            if (n.id === itemId) {
                              const { deleted, deletedAt, ...rest } = n;
                              return rest;
                            }
                            return n;
                          });
                          localStorage.setItem('notes-app-notes', JSON.stringify(updated));
                        }
                      } else if (itemType === 'event') {
                        const eventsData = localStorage.getItem('notes-app-events');
                        if (eventsData) {
                          const events = JSON.parse(eventsData);
                          const updated = events.map((e: any) => {
                            if (e.id === itemId) {
                              const { deleted, deletedAt, ...rest } = e;
                              return rest;
                            }
                            return e;
                          });
                          localStorage.setItem('notes-app-events', JSON.stringify(updated));
                        }
                      }
                      
                      // Reload and go back
                      loadDeletedItems();
                      backToList();
                    }
                  }}
                  tooltip="Restore"
                  variant="success"
                />
                <IconButton
                  icon={Trash2}
                  onClick={() => {
                    if (currentItem && confirm('Permanently delete this item? This cannot be undone.')) {
                      const itemId = currentItem.id;
                      const itemType = currentItem.type;
                      
                      // Delete the item permanently
                      if (itemType === 'list') {
                        const listsData = localStorage.getItem('notes-app-lists');
                        if (listsData) {
                          const lists = JSON.parse(listsData);
                          const filtered = lists.filter((l: any) => l.id !== itemId);
                          localStorage.setItem('notes-app-lists', JSON.stringify(filtered));
                        }
                      } else if (itemType === 'note') {
                        const notesData = localStorage.getItem('notes-app-notes');
                        if (notesData) {
                          const notes = JSON.parse(notesData);
                          const filtered = notes.filter((n: any) => n.id !== itemId);
                          localStorage.setItem('notes-app-notes', JSON.stringify(filtered));
                        }
                      } else if (itemType === 'event') {
                        const eventsData = localStorage.getItem('notes-app-events');
                        if (eventsData) {
                          const events = JSON.parse(eventsData);
                          const filtered = events.filter((e: any) => e.id !== itemId);
                          localStorage.setItem('notes-app-events', JSON.stringify(filtered));
                        }
                      }
                      
                      // Reload and go back
                      loadDeletedItems();
                      backToList();
                    }
                  }}
                  tooltip="Delete Forever"
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
                    Deleted: {new Date(currentItem.deletedAt).toLocaleString()}
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
                    Deleted: {new Date(currentItem.deletedAt).toLocaleDateString()}
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
                    {currentItem.entries?.length || 0} milestone{(currentItem.entries?.length || 0) !== 1 ? 's' : ''} • Deleted: {new Date(currentItem.deletedAt).toLocaleDateString()}
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
