import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, ArrowLeft, Pin, CheckSquare, Square, Archive, Image as ImageIcon, Check } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { PinLock } from '../components/PinLock';
import { ExportModal } from '../components/ExportModal';
import { ImagePicker } from '../components/ImagePicker';
import { ImageGallery, type ImageData } from '../components/ImageGallery';
import { IconButton } from '../components/IconButton';
import { PullToRefresh } from '../components/PullToRefresh';
import { usePin } from '../App';
import { exportAsJSON, exportNotesAsPDF, exportAsCSV } from '../utils/export';
import { processImages, checkStorageWarning } from '../utils/imageUtils';

interface Note {
  id: string;
  title: string;
  content: string;
  images?: ImageData[];
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

const STORAGE_KEY = 'notes-app-notes';

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

function getNotes(): Note[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  localStorage.setItem(`${STORAGE_KEY}-timestamp`, Date.now().toString());
}

interface NotesProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onTrashClick: () => void;
  onArchiveClick: () => void;
}

export function Notes({ sidebarOpen, onToggleSidebar, onTrashClick, onArchiveClick }: NotesProps) {
  const { hasPin, isUnlocked } = usePin();
  const [notes, setNotes] = useState<Note[]>([]);
  const [viewMode, setViewMode] = useState<'empty' | 'view' | 'edit'>('empty');
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportIds, setExportIds] = useState<string[]>([]);
  const [multiSelectActive, setMultiSelectActive] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<ImageData[]>([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
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
    setNotes(getNotes());
    // Load tag visibility setting
    const tagSettings = localStorage.getItem('notes-app-tag-settings');
    if (tagSettings) {
      const parsed = JSON.parse(tagSettings);
      setShowTagsInCards(parsed.showTagsInCards ?? true);
    }

    // Listen for create new note event from SmartFAB
    const handleCreateNew = () => {
      startNew();
    };
    window.addEventListener('create-new-note', handleCreateNew);
    
    // Listen for sync completion to reload data
    const handleSyncComplete = () => {
      console.log('Sync completed, reloading notes...');
      setNotes(getNotes());
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
      window.removeEventListener('create-new-note', handleCreateNew);
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
    
    if (viewMode === 'view' && currentNote) {
      displayTitle = currentNote.title;
    } else if (viewMode === 'edit') {
      if (currentNote) {
        // Editing existing note - show current title or what user is typing
        displayTitle = title.trim() || currentNote.title || 'Untitled';
      } else {
        // Creating new note
        displayTitle = title.trim() || 'New Note';
      }
    }
    
    const event = new CustomEvent('viewmode-title-change', { detail: { title: displayTitle } });
    window.dispatchEvent(event);
  }, [viewMode, currentNote, title]);

  const updateNotes = (newNotes: Note[]) => {
    setNotes(newNotes);
    saveNotes(newNotes);
    
    // Queue sync for auto-sync
    import('../utils/github').then(({ queueSync, getGitHubConfig }) => {
      const config = getGitHubConfig();
      if (config) {
        queueSync('notes');
      }
    });
  };

  // Show PIN lock if PIN is set and not unlocked
  if (hasPin && !isUnlocked) {
    return <PinLock onUnlock={() => window.location.reload()} />;
  }

  const filteredNotes = notes
    .filter(note => !note.deleted && !note.archived) // Exclude deleted and archived items
    .filter(note => 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
    )
    .filter(note => {
      // Filter by tags if any filter tags are selected
      if (filterTags.length === 0) return true;
      return filterTags.every(tag => note.tags?.includes(tag));
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
          // Smart sort: newest first (same as newest)
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  // Get all unique tags from all notes
  const allTags = Array.from(new Set(notes.flatMap(note => note.tags || [])));

  const sidebarItems = filteredNotes.map(note => ({
    id: note.id,
    title: note.title,
    subtitle: note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''),
    pinned: note.pinned,
  }));

  const startNew = () => {
    setCurrentNote(null);
    setTitle('');
    setContent('');
    setSelectedColor('');
    setSelectedTags([]);
    setTagInput('');
    setViewMode('edit');
    // Close sidebar on mobile if it's open
    if (window.innerWidth < 1024 && sidebarOpen) {
      onToggleSidebar();
    }
  };

  const startEdit = () => {
    if (currentNote) {
      setTitle(currentNote.title);
      setContent(currentNote.content);
      setSelectedColor(currentNote.color || '');
      setSelectedTags(currentNote.tags || []);
      setTagInput('');
      setViewMode('edit');
    }
  };

  const viewNote = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      // Update the note's updatedAt to move it to top
      const now = new Date().toISOString();
      updateNotes(notes.map(n => 
        n.id === id ? { ...n, updatedAt: now } : n
      ));
      
      setCurrentNote({ ...note, updatedAt: now });
      setViewMode('view');
      // Close sidebar on mobile if it's open
      if (window.innerWidth < 1024 && sidebarOpen) {
        onToggleSidebar();
      }
    }
  };

  const selectNoteFromSidebar = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      // Update the note's updatedAt to move it to top
      const now = new Date().toISOString();
      updateNotes(notes.map(n => 
        n.id === id ? { ...n, updatedAt: now } : n
      ));
      
      setCurrentNote({ ...note, updatedAt: now });
      setViewMode('view');
      // Close sidebar on mobile
      if (window.innerWidth < 1024) {
        onToggleSidebar();
      }
    }
  };

  const handleImageSelect = async (files: File[]) => {
    checkStorageWarning();
    const newImages = await processImages(files);
    
    if (viewMode === 'edit') {
      if (currentNote) {
        const updatedNote = {
          ...currentNote,
          images: [...(currentNote.images || []), ...newImages],
        };
        setCurrentNote(updatedNote);
      } else {
        // Creating new note - create temporary note to hold images
        const tempNote: Note = {
          id: Date.now().toString(),
          title: '',
          content: '',
          images: newImages,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setCurrentNote(tempNote);
      }
    }
  };

  const handleDeleteImage = (imageId: string) => {
    if (currentNote) {
      const updatedNote = {
        ...currentNote,
        images: (currentNote.images || []).filter(img => img.id !== imageId),
      };
      setCurrentNote(updatedNote);
    }
  };

  const openGallery = (images: ImageData[], startIndex: number = 0) => {
    setGalleryImages(images);
    setGalleryStartIndex(startIndex);
    setShowImageGallery(true);
  };

  const togglePin = () => {
    if (!currentNote) return;
    
    const updatedNote = {
      ...currentNote,
      pinned: !currentNote.pinned,
      updatedAt: new Date().toISOString(),
    };
    
    updateNotes(notes.map(n => n.id === currentNote.id ? updatedNote : n));
    setCurrentNote(updatedNote);
  };

  const save = () => {
    if (!title.trim() && !content.trim()) return;

    const now = new Date().toISOString();
    
    if (currentNote) {
      // Check if this is an existing note or a new note with images
      const existingNote = notes.find(n => n.id === currentNote.id);
      
      if (existingNote) {
        // Update existing note
        const updated = { 
          ...currentNote, 
          title: title.trim() || 'Untitled', 
          content: content.trim(), 
          updatedAt: now,
          images: currentNote.images || [],
          color: selectedColor,
          tags: selectedTags
        };
        updateNotes(notes.map(n => n.id === currentNote.id ? updated : n));
      } else {
        // New note with images (created by handleImageSelect)
        const newNote: Note = {
          ...currentNote,
          title: title.trim() || 'Untitled',
          content: content.trim(),
          updatedAt: now,
          color: selectedColor,
          tags: selectedTags
        };
        updateNotes([newNote, ...notes]);
      }
    } else {
      // New note without images
      const newNote: Note = {
        id: Date.now().toString(),
        title: title.trim() || 'Untitled',
        content: content.trim(),
        images: [],
        createdAt: now,
        updatedAt: now,
        color: selectedColor,
        tags: selectedTags
      };
      updateNotes([newNote, ...notes]);
    }
    
    // Return to main view after saving
    backToEmpty();
  };

  const backToEmpty = () => {
    setViewMode('empty');
    setCurrentNote(null);
    setTitle('');
    setContent('');
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

  const handlePullToRefresh = async () => {
    console.log('Pull-to-refresh triggered in Notes');
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

  const archiveNote = (id: string) => {
    const now = new Date().toISOString();
    updateNotes(notes.map(n => 
      n.id === id ? { ...n, archived: true, archivedAt: now } : n
    ));
  };

  const bulkArchiveNotes = (ids: string[]) => {
    const now = new Date().toISOString();
    updateNotes(notes.map(n => 
      ids.includes(n.id) ? { ...n, archived: true, archivedAt: now } : n
    ));
  };

  const deleteNote = (id: string) => {
    const now = new Date().toISOString();
    updateNotes(notes.map(n => 
      n.id === id ? { ...n, deleted: true, deletedAt: now } : n
    ));
  };

  const toggleNotePin = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      updateNotes(notes.map(n => 
        n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n
      ));
    }
  };

  const bulkPinNotes = (ids: string[], pin: boolean) => {
    const now = new Date().toISOString();
    updateNotes(notes.map(n => 
      ids.includes(n.id) ? { ...n, pinned: pin, updatedAt: now } : n
    ));
  };

  const bulkDeleteNotes = (ids: string[]) => {
    const now = new Date().toISOString();
    updateNotes(notes.map(n => 
      ids.includes(n.id) ? { ...n, deleted: true, deletedAt: now } : n
    ));
  };

  const handleExport = (ids: string[]) => {
    setExportIds(ids);
    setShowExportModal(true);
  };

  const handleExportFormat = (format: 'json' | 'pdf' | 'csv') => {
    const selectedNotes = notes.filter(n => exportIds.includes(n.id));
    
    if (format === 'json') {
      exportAsJSON(selectedNotes, 'notes');
    } else if (format === 'pdf') {
      exportNotesAsPDF(selectedNotes);
    } else if (format === 'csv') {
      exportAsCSV(selectedNotes, 'notes');
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

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <Sidebar
        title="Notes"
        items={sidebarItems}
        selectedId={currentNote?.id || null}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemClick={selectNoteFromSidebar}
        onNewClick={startNew}
        isOpen={sidebarOpen}
        totalCount={notes.filter(n => !n.deleted && !n.archived).length}
        onTrashClick={onTrashClick}
        onArchiveClick={onArchiveClick}
        onPinToggle={toggleNotePin}
        onArchive={archiveNote}
        onDelete={deleteNote}
        onBulkPin={bulkPinNotes}
        onBulkArchive={bulkArchiveNotes}
        onBulkDelete={bulkDeleteNotes}
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
            {/* Debug: Show current grid view mode */}
            <div className="mb-2 text-xs text-gray-500">
              Current view: {gridViewMode}
            </div>
            
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
              {filteredNotes.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p className="text-lg mb-2">No notes yet. Create your first note!</p>
                </div>
              )}

              {/* Table View Header */}
              {gridViewMode === 'table' && filteredNotes.length > 0 && (
                <div className="card mb-2 py-2 px-4 bg-gray-50 dark:bg-gray-800/50">
                  <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    <div className="col-span-5">Title</div>
                    <div className="col-span-3 hidden md:block">Content</div>
                    <div className="col-span-2 hidden sm:block">Tags</div>
                    <div className="col-span-2">Date</div>
                  </div>
                </div>
              )}

              {filteredNotes.map((note, index) => {
                const isSelected = multiSelectedIds.has(note.id);
                const hasImages = note.images && note.images.length > 0;
                const colorConfig = COLORS.find(c => c.value === note.color) || COLORS[0];
                
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
                    key={note.id}
                    className={cardClass}
                    onClick={() => multiSelectActive ? toggleGridItemSelection(note.id) : viewNote(note.id)}
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
                    {note.pinned && (
                      <div className={`absolute ${gridViewMode === 'list' ? 'top-4 right-4' : 'top-3 right-3'}`}>
                        <Pin className="w-4 h-4 text-primary-600 fill-current" />
                      </div>
                    )}
                    {hasImages && !note.pinned && (
                      <div className={`absolute ${gridViewMode === 'list' ? 'top-4 right-4' : 'top-3 right-3'}`}>
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                    
                    {/* List view layout */}
                    {gridViewMode === 'list' ? (
                      <>
                        <div className={`flex-1 flex items-center gap-3 ${multiSelectActive ? 'ml-8' : ''}`}>
                          {hasImages && note.images && note.images.length > 0 && (
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden">
                              <img src={note.images[0].data} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="content-title font-semibold truncate">{note.title}</h3>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {showTagsInCards && note.tags && note.tags.length > 0 && (
                              <span className="text-xs text-gray-500">
                                {note.tags.length} {note.tags.length === 1 ? 'tag' : 'tags'}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(note.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : gridViewMode === 'table' ? (
                      /* Table view layout */
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className={`col-span-5 flex items-center gap-2 ${multiSelectActive ? 'ml-8' : ''}`}>
                          {hasImages && note.images && note.images.length > 0 && (
                            <div className="flex-shrink-0 w-8 h-8 rounded overflow-hidden">
                              <img src={note.images[0].data} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <h3 className="content-title font-semibold truncate text-sm">{note.title}</h3>
                        </div>
                        <div className="col-span-3 hidden md:block">
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{note.content}</p>
                        </div>
                        <div className="col-span-2 hidden sm:block">
                          {showTagsInCards && note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {note.tags.slice(0, 1).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                >
                                  {tag}
                                </span>
                              ))}
                              {note.tags.length > 1 && (
                                <span className="text-xs text-gray-500">+{note.tags.length - 1}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-gray-500">{new Date(note.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ) : (
                      /* Grid view layout (comfortable, compact, masonry, magazine) */
                      <div className={`flex items-start justify-between gap-3 ${multiSelectActive ? 'ml-8' : ''}`}>
                        <div className="flex-1">
                          <h3 className={`content-title font-semibold mb-1 ${gridViewMode === 'compact' ? 'text-sm' : isMagazineFeatured ? 'text-2xl' : ''}`}>
                            {note.title}
                          </h3>
                          {hasImages && (gridViewMode === 'comfortable' || gridViewMode === 'masonry' || isMagazineFeatured) && (
                            <div className="flex gap-1 mb-2">
                              {note.images!.slice(0, isMagazineFeatured ? 4 : 3).map((img) => (
                                <div key={img.id} className={`${isMagazineFeatured ? 'w-20 h-20' : 'w-12 h-12'} rounded overflow-hidden`}>
                                  <img src={img.data} alt="" className="w-full h-full object-cover" />
                                </div>
                              ))}
                              {note.images!.length > (isMagazineFeatured ? 4 : 3) && (
                                <div className={`${isMagazineFeatured ? 'w-20 h-20' : 'w-12 h-12'} rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium`}>
                                  +{note.images!.length - (isMagazineFeatured ? 4 : 3)}
                                </div>
                              )}
                            </div>
                          )}
                          <p className={`content-text text-gray-600 dark:text-gray-400 ${
                            gridViewMode === 'compact' ? 'line-clamp-1 text-xs' : 
                            isMagazineFeatured ? 'line-clamp-4' :
                            gridViewMode === 'masonry' ? 'line-clamp-none' :
                            'line-clamp-2'
                          }`}>
                            {note.content}
                          </p>
                          {showTagsInCards && note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {note.tags.slice(0, gridViewMode === 'compact' ? 2 : isMagazineFeatured ? 5 : 3).map((tag) => (
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
                              {gridViewMode === 'compact' && note.tags.length > 2 && (
                                <span className="text-xs text-gray-500">+{note.tags.length - 2}</span>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(note.updatedAt).toLocaleDateString()}
                          </p>
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

        {viewMode === 'view' && currentNote && (
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
                  tooltip={currentNote.pinned ? "Unpin" : "Pin"}
                  variant="primary"
                  active={currentNote.pinned}
                />
                <IconButton
                  icon={Archive}
                  onClick={() => {
                    if (confirm('Archive this note?')) {
                      archiveNote(currentNote.id);
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
                  onClick={() => deleteNote(currentNote.id)}
                  tooltip="Delete"
                  variant="danger"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <h1 className="content-title text-3xl font-bold mb-4">{currentNote.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Last updated: {new Date(currentNote.updatedAt).toLocaleString()}
              </p>
              
              {/* Images */}
              {currentNote.images && currentNote.images.length > 0 && (
                <div className="mb-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {currentNote.images.map((image, index) => (
                      <div
                        key={image.id}
                        onClick={() => openGallery(currentNote.images!, index)}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
                      >
                        <img
                          src={image.data}
                          alt={image.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="content-text whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                {currentNote.content}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'edit' && (
          <div className="max-w-4xl mx-auto p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{currentNote ? 'Edit Note' : 'New Note'}</h2>
              <div className="flex gap-1">
                <ImagePicker onImageSelect={handleImageSelect} multiple={true} />
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
              placeholder="Note title..."
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

            {/* Image Thumbnails */}
            {currentNote && currentNote.images && currentNote.images.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Images ({currentNote.images.length})
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {currentNote.images.map((image, index) => (
                    <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden group">
                      <img
                        src={image.data}
                        alt={image.name}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => openGallery(currentNote.images!, index)}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this image?')) {
                            handleDeleteImage(image.id);
                          }
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start typing..."
              className="content-text input-field flex-1 resize-none"
            />

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
                    list="tag-suggestions"
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
                  <datalist id="tag-suggestions">
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

      {/* Image Gallery */}
      {showImageGallery && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryStartIndex}
          onClose={() => setShowImageGallery(false)}
          onDelete={viewMode === 'edit' ? handleDeleteImage : undefined}
          showDelete={viewMode === 'edit'}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportFormat}
        itemCount={exportIds.length}
        itemType="notes"
      />
    </div>
  );
}
