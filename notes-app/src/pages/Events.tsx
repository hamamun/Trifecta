import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Calendar as CalendarIcon, ArrowLeft, Pin, CheckSquare, Square, Archive, Image as ImageIcon, Check } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { PinLock } from '../components/PinLock';
import { ExportModal } from '../components/ExportModal';
import { ImagePicker } from '../components/ImagePicker';
import { ImageGallery, type ImageData } from '../components/ImageGallery';
import { IconButton } from '../components/IconButton';
import { PullToRefresh } from '../components/PullToRefresh';
import { usePin } from '../App';
import { exportAsJSON, exportEventsAsPDF, exportAsCSV } from '../utils/export';
import { processImages, checkStorageWarning } from '../utils/imageUtils';

interface EventEntry {
  id: string;
  date: string;
  description: string;
  images?: ImageData[];
}

interface Event {
  id: string;
  title: string;
  entries: EventEntry[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  archived?: boolean;
  archivedAt?: string;
  color?: string;
  tags?: string[];
}

const STORAGE_KEY = 'notes-app-events';

const COLORS = [
  { name: 'Default', value: '', bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', accent: 'bg-gray-500' },
  { name: 'Red', value: 'red', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', accent: 'bg-red-500' },
  { name: 'Orange', value: 'orange', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', accent: 'bg-orange-500' },
  { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', accent: 'bg-yellow-500' },
  { name: 'Green', value: 'green', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', accent: 'bg-green-500' },
  { name: 'Teal', value: 'teal', bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-800', accent: 'bg-teal-500' },
  { name: 'Blue', value: 'blue', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', accent: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', accent: 'bg-purple-500' },
  { name: 'Pink', value: 'pink', bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-800', accent: 'bg-pink-500' },
];

function getEvents(): Event[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveEventsToStorage(events: Event[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  localStorage.setItem(`${STORAGE_KEY}-timestamp`, Date.now().toString());
}

interface EventsProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onTrashClick: () => void;
  onArchiveClick: () => void;
}

export function Events({ sidebarOpen, onToggleSidebar, onTrashClick, onArchiveClick }: EventsProps) {
  const { hasPin, isUnlocked } = usePin();
  const [events, setEvents] = useState<Event[]>([]);
  const [viewMode, setViewMode] = useState<'empty' | 'view' | 'edit'>('empty');
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [title, setTitle] = useState('');
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [newEntryDate, setNewEntryDate] = useState('');
  const [newEntryDescription, setNewEntryDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportIds, setExportIds] = useState<string[]>([]);
  const [multiSelectActive, setMultiSelectActive] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<ImageData[]>([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showTagsInCards, setShowTagsInCards] = useState(true);
  const [gridViewMode, setGridViewMode] = useState<'comfortable' | 'compact' | 'list' | 'masonry' | 'table' | 'magazine'>(() => {
    const saved = localStorage.getItem('notes-app-grid-view-mode');
    return (saved as 'comfortable' | 'compact' | 'list' | 'masonry' | 'table' | 'magazine') || 'comfortable';
  });
  const [sortMode, setSortMode] = useState<'smart' | 'a-z' | 'z-a' | 'newest' | 'oldest'>(() => {
    const saved = localStorage.getItem('notes-app-sort-mode');
    return (saved as 'smart' | 'a-z' | 'z-a' | 'newest' | 'oldest') || 'smart';
  });

  useEffect(() => {
    setEvents(getEvents());
    // Load tag visibility setting
    const tagSettings = localStorage.getItem('notes-app-tag-settings');
    if (tagSettings) {
      const parsed = JSON.parse(tagSettings);
      setShowTagsInCards(parsed.showTagsInCards ?? true);
    }

    // Listen for create new event from SmartFAB
    const handleCreateNew = () => {
      startNew();
    };
    window.addEventListener('create-new-event', handleCreateNew);

    // Listen for sync completion to reload data
    const handleSyncComplete = () => {
      console.log('Sync completed, reloading events...');
      setEvents(getEvents());
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
      window.removeEventListener('create-new-event', handleCreateNew);
      window.removeEventListener('sync-complete', handleSyncComplete);
      window.removeEventListener('grid-view-change', handleGridViewChange as EventListener);
      window.removeEventListener('sort-change', handleSortChange as EventListener);
    };
  }, []);

  // Dispatch viewMode changes to App
  useEffect(() => {
    const event = new CustomEvent('viewmode-change', { detail: { mode: viewMode } });
    window.dispatchEvent(event);
  }, [viewMode]);

  // Dispatch title changes to Layout
  useEffect(() => {
    let displayTitle = null;
    
    if (viewMode === 'view' && currentEvent) {
      displayTitle = currentEvent.title;
    } else if (viewMode === 'edit') {
      if (currentEvent) {
        // Editing existing event - show current title or what user is typing
        displayTitle = title.trim() || currentEvent.title || 'Untitled';
      } else {
        // Creating new event
        displayTitle = title.trim() || 'New Event';
      }
    }
    
    const event = new CustomEvent('viewmode-title-change', { detail: { title: displayTitle } });
    window.dispatchEvent(event);
  }, [viewMode, currentEvent, title]);

  // Show PIN lock if PIN is set and not unlocked
  if (hasPin && !isUnlocked) {
    return <PinLock onUnlock={() => window.location.reload()} />;
  }

  const updateEvents = (newEvents: Event[]) => {
    setEvents(newEvents);
    saveEventsToStorage(newEvents);
    
    // Queue sync for auto-sync
    import('../utils/github').then(({ queueSync, getGitHubConfig }) => {
      const config = getGitHubConfig();
      if (config) {
        queueSync('events');
      }
    });
  };

  const filteredEvents = events
    .filter(event => !event.deleted && !event.archived) // Exclude deleted and archived items
    .filter(event => 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.entries.some(entry => entry.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (event.tags && event.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
    )
    .filter(event => {
      // Filter by tags if any filter tags are selected
      if (filterTags.length === 0) return true;
      return filterTags.every(tag => event.tags?.includes(tag));
    })
    .sort((a, b) => {
      // Pinned items always first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      // Then apply selected sort mode
      switch (sortMode) {
        case 'a-z':
          return a.title.localeCompare(b.title);
        case 'z-a':
          return b.title.localeCompare(a.title);
        case 'oldest':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'newest':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'smart':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  // Get all unique tags from all events
  const allTags = Array.from(new Set(events.flatMap(event => event.tags || [])));

  const sidebarItems = filteredEvents.map(event => ({
    id: event.id,
    title: event.title,
    subtitle: `${event.entries?.length || 0} milestone${(event.entries?.length || 0) !== 1 ? 's' : ''}`,
    pinned: event.pinned,
  }));

  const startNew = () => {
    setCurrentEvent(null);
    setTitle('');
    setEntries([]);
    setSelectedColor('');
    setSelectedTags([]);
    setTagInput('');
    setViewMode('edit');
    // Close sidebar on mobile if it's open
    if (window.innerWidth < 1024 && sidebarOpen) {
      onToggleSidebar();
    }
  };

  const viewEvent = (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) {
      // Update the event's updatedAt to move it to top
      const now = new Date().toISOString();
      updateEvents(events.map(e => 
        e.id === id ? { ...e, updatedAt: now } : e
      ));
      
      setCurrentEvent({ ...event, updatedAt: now });
      setViewMode('view');
      // Close sidebar on mobile if it's open
      if (window.innerWidth < 1024 && sidebarOpen) {
        onToggleSidebar();
      }
    }
  };

  const selectEventFromSidebar = (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) {
      // Update the event's updatedAt to move it to top
      const now = new Date().toISOString();
      updateEvents(events.map(e => 
        e.id === id ? { ...e, updatedAt: now } : e
      ));
      
      setCurrentEvent({ ...event, updatedAt: now });
      setViewMode('view');
      // Close sidebar on mobile
      if (window.innerWidth < 1024) {
        onToggleSidebar();
      }
    }
  };

  const startEdit = () => {
    if (currentEvent) {
      setTitle(currentEvent.title);
      setEntries([...currentEvent.entries]);
      setSelectedColor(currentEvent.color || '');
      setSelectedTags(currentEvent.tags || []);
      setTagInput('');
      setViewMode('edit');
    }
  };

  const togglePin = () => {
    if (!currentEvent) return;
    
    const updatedEvent = {
      ...currentEvent,
      pinned: !currentEvent.pinned,
      updatedAt: new Date().toISOString(),
    };
    
    updateEvents(events.map(e => e.id === currentEvent.id ? updatedEvent : e));
    setCurrentEvent(updatedEvent);
  };

  const addEntry = () => {
    if (newEntryDate && newEntryDescription.trim()) {
      const newEntry: EventEntry = {
        id: Date.now().toString(),
        date: newEntryDate,
        description: newEntryDescription.trim(),
        images: [],
      };
      const updatedEntries = [...entries, newEntry].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setEntries(updatedEntries);
      setNewEntryDate('');
      setNewEntryDescription('');
    }
  };

  const handleImageSelect = async (files: File[]) => {
    if (!editingEntryId) return;
    
    checkStorageWarning();
    const newImages = await processImages(files);
    
    setEntries(entries.map(entry =>
      entry.id === editingEntryId 
        ? { ...entry, images: [...(entry.images || []), ...newImages] }
        : entry
    ));
    setEditingEntryId(null);
  };

  const handleDeleteEntryImage = (entryId: string, imageId: string) => {
    setEntries(entries.map(entry =>
      entry.id === entryId 
        ? { ...entry, images: (entry.images || []).filter(img => img.id !== imageId) }
        : entry
    ));
  };

  const openGallery = (images: ImageData[], startIndex: number = 0) => {
    setGalleryImages(images);
    setGalleryStartIndex(startIndex);
    setShowImageGallery(true);
  };

  const deleteEntryInEdit = (id: string) => {
    setEntries(entries.filter(entry => entry.id !== id));
  };

  const save = () => {
    if (!title.trim() || entries.length === 0) {
      alert('Please add a title and at least one entry');
      return;
    }

    const now = new Date().toISOString();
    
    if (currentEvent) {
      const updated = { ...currentEvent, title: title.trim(), entries, updatedAt: now, color: selectedColor, tags: selectedTags };
      updateEvents(events.map(e => e.id === currentEvent.id ? updated : e));
    } else {
      const newEvent: Event = {
        id: Date.now().toString(),
        title: title.trim(),
        entries,
        createdAt: now,
        updatedAt: now,
        color: selectedColor,
        tags: selectedTags
      };
      updateEvents([newEvent, ...events]);
    }
    
    // Return to main view after saving
    backToEmpty();
  };

  const backToEmpty = () => {
    setViewMode('empty');
    setCurrentEvent(null);
    setTitle('');
    setEntries([]);
    setNewEntryDate('');
    setNewEntryDescription('');
    setSelectedColor('');
    setSelectedTags([]);
    setTagInput('');
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const toggleFilterTag = (tag: string) => {
    if (filterTags.includes(tag)) {
      setFilterTags(filterTags.filter(t => t !== tag));
    } else {
      setFilterTags([...filterTags, tag]);
    }
  };

  const archiveEvent = (id: string) => {
    const now = new Date().toISOString();
    updateEvents(events.map(e => 
      e.id === id ? { ...e, archived: true, archivedAt: now } : e
    ));
  };

  const bulkArchiveEvents = (ids: string[]) => {
    const now = new Date().toISOString();
    updateEvents(events.map(e => 
      ids.includes(e.id) ? { ...e, archived: true, archivedAt: now } : e
    ));
  };

  const deleteEvent = (id: string) => {
    const now = new Date().toISOString();
    updateEvents(events.map(e => 
      e.id === id ? { ...e, deleted: true, deletedAt: now } : e
    ));
  };

  const toggleEventPin = (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) {
      updateEvents(events.map(e => 
        e.id === id ? { ...e, pinned: !e.pinned, updatedAt: new Date().toISOString() } : e
      ));
    }
  };

  const bulkPinEvents = (ids: string[], pin: boolean) => {
    const now = new Date().toISOString();
    updateEvents(events.map(e => 
      ids.includes(e.id) ? { ...e, pinned: pin, updatedAt: now } : e
    ));
  };

  const bulkDeleteEvents = (ids: string[]) => {
    const now = new Date().toISOString();
    updateEvents(events.map(e => 
      ids.includes(e.id) ? { ...e, deleted: true, deletedAt: now } : e
    ));
  };

  const handleExport = (ids: string[]) => {
    setExportIds(ids);
    setShowExportModal(true);
  };

  const handleExportFormat = (format: 'json' | 'pdf' | 'csv') => {
    const selectedEvents = events.filter(e => exportIds.includes(e.id));
    
    if (format === 'json') {
      exportAsJSON(selectedEvents, 'events');
    } else if (format === 'pdf') {
      exportEventsAsPDF(selectedEvents);
    } else if (format === 'csv') {
      exportAsCSV(selectedEvents, 'events');
    }
    
    setShowExportModal(false);
    setExportIds([]);
  };

  const handleMultiSelectChange = (isActive: boolean, selectedIds: Set<string>) => {
    setMultiSelectActive(isActive);
    setMultiSelectedIds(selectedIds);
  };

  const toggleGridItemSelection = (id: string) => {
    const newSelected = new Set(multiSelectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setMultiSelectedIds(newSelected);
  };

  const handlePullToRefresh = async () => {
    console.log('Pull-to-refresh triggered in Events');
    const { getGitHubConfig, isOnlineMode, checkForUpdates, syncAll } = await import('../utils/github');
    const config = getGitHubConfig();
    
    if (!config || !isOnlineMode()) {
      console.log('Not connected or offline, skipping refresh');
      return;
    }
    
    const hasUpdates = await checkForUpdates();
    if (hasUpdates) {
      console.log('Updates found, syncing...');
      await syncAll();
    } else {
      console.log('No updates found');
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <Sidebar
        title="Events"
        items={sidebarItems}
        selectedId={currentEvent?.id || null}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemClick={selectEventFromSidebar}
        onNewClick={startNew}
        isOpen={sidebarOpen}
        totalCount={events.filter(e => !e.deleted && !e.archived).length}
        onTrashClick={onTrashClick}
        onArchiveClick={onArchiveClick}
        onPinToggle={toggleEventPin}
        onArchive={archiveEvent}
        onDelete={deleteEvent}
        onBulkPin={bulkPinEvents}
        onBulkArchive={bulkArchiveEvents}
        onBulkDelete={bulkDeleteEvents}
        onExport={handleExport}
        onMultiSelectChange={handleMultiSelectChange}
        externalSelectedIds={multiSelectedIds}
      />

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onToggleSidebar}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {viewMode === 'empty' && (
          <PullToRefresh onRefresh={handlePullToRefresh} enabled={true}>
            <div className="max-w-4xl mx-auto p-4">
            {/* Active Tag Filters */}
            {filterTags.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Filtered by:</span>
                {filterTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-primary-600 text-white"
                  >
                    {tag}
                    <button
                      onClick={() => toggleFilterTag(tag)}
                      className="hover:text-primary-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setFilterTags([])}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 underline"
                >
                  Clear all
                </button>
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
              {filteredEvents.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p className="text-lg mb-2">No timelines yet. Create your first one!</p>
                </div>
              )}

              {/* Table View Header */}
              {gridViewMode === 'table' && filteredEvents.length > 0 && (
                <div className="card mb-2 py-2 px-4 bg-gray-50 dark:bg-gray-800/50">
                  <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    <div className="col-span-5">Title</div>
                    <div className="col-span-3 hidden md:block">Milestones</div>
                    <div className="col-span-2 hidden sm:block">Tags</div>
                    <div className="col-span-2">Latest</div>
                  </div>
                </div>
              )}

              {filteredEvents.map((event, index) => {
                const isSelected = multiSelectedIds.has(event.id);
                const colorConfig = COLORS.find(c => c.value === event.color) || COLORS[0];
                
                // Magazine view: First item is large, others are normal
                const isMagazineFeatured = gridViewMode === 'magazine' && index === 0;
                
                // Different card styles based on view mode
                const cardClass = gridViewMode === 'list' 
                  ? `card hover:shadow-lg transition-shadow cursor-pointer relative ${colorConfig.bg} border-l-4 ${colorConfig.border} ${isSelected && multiSelectActive ? 'ring-2 ring-primary-500' : ''} flex flex-row items-center gap-4 py-3`
                  : gridViewMode === 'compact'
                  ? `card hover:shadow-lg transition-shadow cursor-pointer relative ${colorConfig.bg} border-l-4 ${colorConfig.border} ${isSelected && multiSelectActive ? 'ring-2 ring-primary-500' : ''} p-3`
                  : gridViewMode === 'masonry'
                  ? `card hover:shadow-lg transition-shadow cursor-pointer relative ${colorConfig.bg} border-l-4 ${colorConfig.border} ${isSelected && multiSelectActive ? 'ring-2 ring-primary-500' : ''} break-inside-avoid mb-3`
                  : gridViewMode === 'table'
                  ? `card hover:shadow-lg transition-shadow cursor-pointer relative ${colorConfig.bg} border-l-4 ${colorConfig.border} ${isSelected && multiSelectActive ? 'ring-2 ring-primary-500' : ''} py-2 px-4 mb-1`
                  : gridViewMode === 'magazine'
                  ? `card hover:shadow-lg transition-shadow cursor-pointer relative ${colorConfig.bg} border-l-4 ${colorConfig.border} ${isSelected && multiSelectActive ? 'ring-2 ring-primary-500' : ''} ${isMagazineFeatured ? 'md:col-span-2 lg:col-span-3' : ''}`
                  : `card hover:shadow-lg transition-shadow cursor-pointer relative ${colorConfig.bg} border-l-4 ${colorConfig.border} ${isSelected && multiSelectActive ? 'ring-2 ring-primary-500' : ''}`;
                
                return (
                  <div
                    key={event.id}
                    className={cardClass}
                    onClick={() => multiSelectActive ? toggleGridItemSelection(event.id) : viewEvent(event.id)}
                  >
                    {multiSelectActive && (
                      <div className={`absolute ${gridViewMode === 'list' ? 'top-4 left-4' : 'top-3 left-3'} z-10`}>
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-primary-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    )}
                    {event.pinned && (
                      <div className={`absolute ${gridViewMode === 'list' ? 'top-4 right-4' : 'top-3 right-3'}`}>
                        <Pin className="w-4 h-4 text-primary-600 fill-current" />
                      </div>
                    )}
                    
                    {/* List view layout */}
                    {gridViewMode === 'list' ? (
                      <>
                        <div className={`flex-1 flex items-center gap-3 ${multiSelectActive ? 'ml-8' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <h3 className="content-title font-semibold truncate">{event.title}</h3>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {event.entries?.length || 0} milestone{(event.entries?.length || 0) !== 1 ? 's' : ''}
                            </span>
                            {showTagsInCards && event.tags && event.tags.length > 0 && (
                              <span className="text-xs text-gray-500">
                                {event.tags.length} {event.tags.length === 1 ? 'tag' : 'tags'}
                              </span>
                            )}
                            {event.entries && event.entries.length > 0 && (
                              <span className="text-xs text-gray-500">
                                {new Date(event.entries[event.entries.length - 1].date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : gridViewMode === 'table' ? (
                      /* Table view layout */
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className={`col-span-5 flex items-center gap-2 ${multiSelectActive ? 'ml-8' : ''}`}>
                          <h3 className="content-title font-semibold truncate text-sm">{event.title}</h3>
                        </div>
                        <div className="col-span-3 hidden md:block">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {event.entries?.length || 0} milestone{(event.entries?.length || 0) !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="col-span-2 hidden sm:block">
                          {showTagsInCards && event.tags && event.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {event.tags.slice(0, 1).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                >
                                  {tag}
                                </span>
                              ))}
                              {event.tags.length > 1 && (
                                <span className="text-xs text-gray-500">+{event.tags.length - 1}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2">
                          {event.entries && event.entries.length > 0 && (
                            <span className="text-xs text-gray-500">
                              {new Date(event.entries[event.entries.length - 1].date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Grid view layout (comfortable, compact, masonry, magazine) */
                      <div className={`flex items-start justify-between gap-3 ${multiSelectActive ? 'ml-8' : ''}`}>
                        <div className="flex-1">
                          <h3 className={`content-title font-semibold mb-1 ${gridViewMode === 'compact' ? 'text-sm' : isMagazineFeatured ? 'text-2xl' : ''}`}>
                            {event.title}
                          </h3>
                          <p className={`content-text text-gray-600 dark:text-gray-400 ${gridViewMode === 'compact' ? 'text-xs' : ''}`}>
                            {event.entries?.length || 0} milestone{(event.entries?.length || 0) !== 1 ? 's' : ''}
                          </p>
                          {showTagsInCards && event.tags && event.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {event.tags.slice(0, gridViewMode === 'compact' ? 2 : isMagazineFeatured ? 5 : 3).map((tag) => (
                                <span
                                  key={tag}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFilterTag(tag);
                                  }}
                                  className={`text-xs px-2 py-1 rounded-full cursor-pointer transition-colors ${
                                    filterTags.includes(tag)
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  {tag}
                                </span>
                              ))}
                              {gridViewMode === 'compact' && event.tags.length > 2 && (
                                <span className="text-xs text-gray-500">+{event.tags.length - 2}</span>
                              )}
                            </div>
                          )}
                          {event.entries && event.entries.length > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                              Latest: {new Date(event.entries[event.entries.length - 1].date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </PullToRefresh>
        )}

        {viewMode === 'view' && currentEvent && (
          <div className="max-w-4xl mx-auto p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <IconButton
                icon={ArrowLeft}
                onClick={backToEmpty}
                tooltip="Back to grid"
                variant="default"
              />
              <div className="flex-1"></div>
              <div className="flex gap-1">
                <IconButton
                  icon={Pin}
                  onClick={togglePin}
                  tooltip={currentEvent.pinned ? "Unpin" : "Pin"}
                  variant="primary"
                  active={currentEvent.pinned}
                />
                <IconButton
                  icon={Archive}
                  onClick={() => {
                    if (confirm('Archive this event?')) {
                      archiveEvent(currentEvent.id);
                      backToEmpty();
                    }
                  }}
                  tooltip="Archive"
                  variant="warning"
                />
                <IconButton
                  icon={Edit2}
                  onClick={startEdit}
                  tooltip="Edit"
                  variant="default"
                />
                <IconButton
                  icon={Trash2}
                  onClick={() => deleteEvent(currentEvent.id)}
                  tooltip="Delete"
                  variant="danger"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <h1 className="content-title text-2xl font-bold mb-1">{currentEvent.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {currentEvent.entries.length} milestone{currentEvent.entries.length !== 1 ? 's' : ''}
              </p>

              {/* Timeline */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary-200 dark:bg-primary-800"></div>
                
                <div className="space-y-6">
                  {currentEvent.entries.map((entry) => (
                    <div key={entry.id} className="relative pl-12">
                      {/* Timeline dot */}
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
                        <p className="content-text text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">
                          {entry.description}
                        </p>
                        
                        {/* Images */}
                        {entry.images && entry.images.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                            {entry.images.map((image, index) => (
                              <div
                                key={image.id}
                                onClick={() => openGallery(entry.images!, index)}
                                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
                              >
                                <img
                                  src={image.data}
                                  alt={image.name}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                                  <ImageIcon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'edit' && (
          <div className="max-w-4xl mx-auto p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{currentEvent ? 'Edit Timeline' : 'New Timeline'}</h2>
              <div className="flex gap-1">
                <IconButton
                  icon={X}
                  onClick={backToEmpty}
                  tooltip="Cancel"
                  variant="default"
                />
                <IconButton
                  icon={Check}
                  onClick={save}
                  tooltip="Save"
                  variant="success"
                />
              </div>
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Timeline title (e.g., My Daughter's Milestones)"
              className="content-title input-field mb-4 font-semibold"
              autoFocus
            />

            {/* Color Picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className={`relative w-10 h-10 rounded-full ${color.accent} transition-all hover:scale-110 ${
                      selectedColor === color.value ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 scale-110' : ''
                    }`}
                    title={color.name}
                  >
                    {selectedColor === color.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <label className="block text-sm font-medium">Add Entry</label>
              <input
                type="date"
                value={newEntryDate}
                onChange={(e) => setNewEntryDate(e.target.value)}
                className="input-field"
              />
              <textarea
                value={newEntryDescription}
                onChange={(e) => setNewEntryDescription(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    addEntry();
                  }
                }}
                placeholder="What happened on this day?"
                className="content-text input-field h-20 resize-none"
              />
              <IconButton
                icon={Plus}
                onClick={addEntry}
                tooltip="Add Entry"
                variant="primary"
                className="w-full"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Entries ({entries.length})
              </h3>
              
              {entries.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No entries yet. Add your first milestone above.</p>
                </div>
              )}

              <div className="space-y-2">
                {entries.map((entry) => (
                  <div key={entry.id} className="card">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CalendarIcon className="w-4 h-4 text-primary-600" />
                          <span className="text-sm font-medium text-primary-600">
                            {new Date(entry.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <p className="content-text text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {entry.description}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteEntryInEdit(entry.id)}
                        className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Images */}
                    <div className="flex flex-wrap gap-2">
                      {entry.images && entry.images.map((image, index) => (
                        <div key={image.id} className="relative w-16 h-16 rounded overflow-hidden group">
                          <img 
                            src={image.data} 
                            alt="" 
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => openGallery(entry.images!, index)}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Delete this image?')) {
                                handleDeleteEntryImage(entry.id, image.id);
                              }
                            }}
                            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ))}
                      
                      {/* Add Image Button */}
                      <button
                        onClick={() => setEditingEntryId(entry.id)}
                        className="w-16 h-16 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 flex items-center justify-center transition-colors"
                        title="Add images"
                      >
                        <ImageIcon className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Image Picker Modal */}
            {editingEntryId && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
                  <h3 className="text-lg font-semibold mb-4">Add Images to Entry</h3>
                  <ImagePicker onImageSelect={handleImageSelect} multiple={true} />
                  <button
                    onClick={() => setEditingEntryId(null)}
                    className="mt-4 w-full btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Tags Input - At the bottom */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
              
              {/* Selected Tags */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-primary-900 dark:hover:text-primary-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Tag Input with Suggestions */}
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add tag..."
                    className="input-field flex-1"
                    list="event-tag-suggestions"
                  />
                  <IconButton
                    icon={Plus}
                    onClick={addTag}
                    tooltip="Add Tag"
                    variant="primary"
                  />
                </div>
                
                {/* Tag Suggestions */}
                {tagInput && (
                  <datalist id="event-tag-suggestions">
                    {allTags
                      .filter(tag => 
                        tag.toLowerCase().includes(tagInput.toLowerCase()) && 
                        !selectedTags.includes(tag)
                      )
                      .map(tag => (
                        <option key={tag} value={tag} />
                      ))}
                  </datalist>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportFormat}
        itemCount={exportIds.length}
        itemType="events"
      />
      
      {/* Image Gallery */}
      {showImageGallery && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryStartIndex}
          onClose={() => setShowImageGallery(false)}
        />
      )}
    </div>
  );
}
