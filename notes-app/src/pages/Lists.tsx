import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Check, ArrowLeft, Pin, CheckSquare, Square, Archive, Image as ImageIcon } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ExportModal } from '../components/ExportModal';
import { ImagePicker } from '../components/ImagePicker';
import { ImageGallery, type ImageData } from '../components/ImageGallery';
import { IconButton } from '../components/IconButton';
import { PullToRefresh } from '../components/PullToRefresh';
import { exportAsJSON, exportListsAsPDF, exportAsCSV } from '../utils/export';
import { processImages, checkStorageWarning } from '../utils/imageUtils';

interface ListItem {
  id: string;
  text: string;
  completed: boolean;
  image?: ImageData;
}

interface List {
  id: string;
  title: string;
  items: ListItem[];
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

const STORAGE_KEY = 'notes-app-lists';

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

function getLists(): List[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveLists(lists: List[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  localStorage.setItem(`${STORAGE_KEY}-timestamp`, Date.now().toString());
}

interface ListsProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onTrashClick: () => void;
  onArchiveClick: () => void;
}

export function Lists({ sidebarOpen, onToggleSidebar, onTrashClick, onArchiveClick }: ListsProps) {
  const [lists, setLists] = useState<List[]>([]);
  const [viewMode, setViewMode] = useState<'empty' | 'view' | 'edit'>('empty');
  const [currentList, setCurrentList] = useState<List | null>(null);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<ListItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportIds, setExportIds] = useState<string[]>([]);
  const [multiSelectActive, setMultiSelectActive] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<ImageData[]>([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
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
    setLists(getLists());
    // Load tag visibility setting
    const tagSettings = localStorage.getItem('notes-app-tag-settings');
    if (tagSettings) {
      const parsed = JSON.parse(tagSettings);
      setShowTagsInCards(parsed.showTagsInCards ?? true);
    }

    // Listen for create new list event from SmartFAB
    const handleCreateNew = () => {
      startNew();
    };
    window.addEventListener('create-new-list', handleCreateNew);

    // Listen for sync completion to reload data
    const handleSyncComplete = () => {
      console.log('Sync completed, reloading lists...');
      setLists(getLists());
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
      window.removeEventListener('create-new-list', handleCreateNew);
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
    
    if (viewMode === 'view' && currentList) {
      displayTitle = currentList.title;
    } else if (viewMode === 'edit') {
      if (currentList) {
        // Editing existing list - show current title or what user is typing
        displayTitle = title.trim() || currentList.title || 'Untitled';
      } else {
        // Creating new list
        displayTitle = title.trim() || 'New List';
      }
    }
    
    const event = new CustomEvent('viewmode-title-change', { detail: { title: displayTitle } });
    window.dispatchEvent(event);
  }, [viewMode, currentList, title]);

  const updateLists = (newLists: List[]) => {
    setLists(newLists);
    saveLists(newLists);
    
    // Queue sync for auto-sync
    import('../utils/github').then(({ queueSync, getGitHubConfig }) => {
      const config = getGitHubConfig();
      if (config) {
        queueSync('lists');
      }
    });
  };

  const filteredLists = lists
    .filter(list => !list.deleted && !list.archived) // Exclude deleted and archived items
    .filter(list => 
      list.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      list.items.some(item => item.text.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (list.tags && list.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
    )
    .filter(list => {
      // Filter by tags if any filter tags are selected
      if (filterTags.length === 0) return true;
      return filterTags.every(tag => list.tags?.includes(tag));
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

  // Get all unique tags from all lists
  const allTags = Array.from(new Set(lists.flatMap(list => list.tags || [])));

  const sidebarItems = filteredLists.map(list => ({
    id: list.id,
    title: list.title,
    subtitle: `${list.items.filter(i => i.completed).length} of ${list.items.length} completed`,
    pinned: list.pinned,
  }));

  const startNew = () => {
    setCurrentList(null);
    setTitle('');
    setItems([]);
    setSelectedColor('');
    setSelectedTags([]);
    setTagInput('');
    setViewMode('edit');
    // Close sidebar on mobile if it's open
    if (window.innerWidth < 1024 && sidebarOpen) {
      onToggleSidebar();
    }
  };

  const viewList = (id: string) => {
    const list = lists.find(l => l.id === id);
    if (list) {
      // Update the list's updatedAt to move it to top
      const now = new Date().toISOString();
      updateLists(lists.map(l => 
        l.id === id ? { ...l, updatedAt: now } : l
      ));
      
      setCurrentList({ ...list, updatedAt: now });
      setShowCheckboxes(false);
      setViewMode('view');
      // Close sidebar on mobile if it's open
      if (window.innerWidth < 1024 && sidebarOpen) {
        onToggleSidebar();
      }
    }
  };

  const selectListFromSidebar = (id: string) => {
    // Open the list in view mode when clicked from sidebar
    const list = lists.find(l => l.id === id);
    if (list) {
      // Update the list's updatedAt to move it to top
      const now = new Date().toISOString();
      updateLists(lists.map(l => 
        l.id === id ? { ...l, updatedAt: now } : l
      ));
      
      setCurrentList({ ...list, updatedAt: now });
      setShowCheckboxes(false);
      setViewMode('view');
      // Close sidebar on mobile
      if (window.innerWidth < 1024) {
        onToggleSidebar();
      }
    }
  };

  const startEdit = () => {
    if (currentList) {
      setTitle(currentList.title);
      setItems([...currentList.items]);
      setSelectedColor(currentList.color || '');
      setSelectedTags(currentList.tags || []);
      setTagInput('');
      setViewMode('edit');
    }
  };

  const addItem = () => {
    if (newItemText.trim()) {
      const newItem: ListItem = {
        id: Date.now().toString(),
        text: newItemText.trim(),
        completed: false,
      };
      setItems([...items, newItem]);
      setNewItemText('');
    }
  };

  const handleImageSelect = async (files: File[]) => {
    if (!editingItemId) return;
    
    checkStorageWarning();
    const newImages = await processImages(files);
    
    if (newImages.length > 0) {
      setItems(items.map(item =>
        item.id === editingItemId ? { ...item, image: newImages[0] } : item
      ));
      setEditingItemId(null);
    }
  };

  const handleDeleteItemImage = (itemId: string) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, image: undefined } : item
    ));
  };

  const openGallery = (images: ImageData[], startIndex: number = 0) => {
    setGalleryImages(images);
    setGalleryStartIndex(startIndex);
    setShowImageGallery(true);
  };

  const toggleItemInEdit = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const deleteItemInEdit = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const save = () => {
    if (!title.trim() || items.length === 0) {
      alert('Please add a title and at least one item');
      return;
    }

    const now = new Date().toISOString();
    
    if (currentList) {
      updateLists(lists.map(l => 
        l.id === currentList.id 
          ? { ...l, title: title.trim(), items, updatedAt: now, color: selectedColor, tags: selectedTags }
          : l
      ));
    } else {
      const newList: List = {
        id: Date.now().toString(),
        title: title.trim(),
        items,
        createdAt: now,
        updatedAt: now,
        color: selectedColor,
        tags: selectedTags
      };
      updateLists([newList, ...lists]);
    }
    
    // Return to main view after saving
    backToEmpty();
  };

  const backToEmpty = () => {
    setViewMode('empty');
    setCurrentList(null);
    setTitle('');
    setItems([]);
    setNewItemText('');
    setShowCheckboxes(false);
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

  const archiveList = (id: string) => {
    const now = new Date().toISOString();
    updateLists(lists.map(l => 
      l.id === id ? { ...l, archived: true, archivedAt: now } : l
    ));
  };

  const bulkArchiveLists = (ids: string[]) => {
    const now = new Date().toISOString();
    updateLists(lists.map(l => 
      ids.includes(l.id) ? { ...l, archived: true, archivedAt: now } : l
    ));
  };

  const deleteList = (id: string) => {
    const now = new Date().toISOString();
    updateLists(lists.map(l => 
      l.id === id ? { ...l, deleted: true, deletedAt: now } : l
    ));
  };

  const toggleListPin = (id: string) => {
    const list = lists.find(l => l.id === id);
    if (list) {
      updateLists(lists.map(l => 
        l.id === id ? { ...l, pinned: !l.pinned, updatedAt: new Date().toISOString() } : l
      ));
    }
  };

  const bulkPinLists = (ids: string[], pin: boolean) => {
    const now = new Date().toISOString();
    updateLists(lists.map(l => 
      ids.includes(l.id) ? { ...l, pinned: pin, updatedAt: now } : l
    ));
  };

  const bulkDeleteLists = (ids: string[]) => {
    const now = new Date().toISOString();
    updateLists(lists.map(l => 
      ids.includes(l.id) ? { ...l, deleted: true, deletedAt: now } : l
    ));
  };

  const handleExport = (ids: string[]) => {
    setExportIds(ids);
    setShowExportModal(true);
  };

  const handleExportFormat = (format: 'json' | 'pdf' | 'csv') => {
    const selectedLists = lists.filter(l => exportIds.includes(l.id));
    
    if (format === 'json') {
      exportAsJSON(selectedLists, 'lists');
    } else if (format === 'pdf') {
      exportListsAsPDF(selectedLists);
    } else if (format === 'csv') {
      exportAsCSV(selectedLists, 'lists');
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

  const toggleItemInView = (itemId: string) => {
    if (!currentList) return;
    
    const updatedList = {
      ...currentList,
      items: currentList.items.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ),
      updatedAt: new Date().toISOString(),
    };
    
    updateLists(lists.map(l => l.id === currentList.id ? updatedList : l));
    setCurrentList(updatedList);
  };

  const togglePin = () => {
    if (!currentList) return;
    
    const updatedList = {
      ...currentList,
      pinned: !currentList.pinned,
      updatedAt: new Date().toISOString(),
    };
    
    updateLists(lists.map(l => l.id === currentList.id ? updatedList : l));
    setCurrentList(updatedList);
  };

  const toggleAllItems = () => {
    if (!currentList) return;
    
    const allCompleted = currentList.items.every(item => item.completed);
    const updatedList = {
      ...currentList,
      items: currentList.items.map(item => ({ ...item, completed: !allCompleted })),
      updatedAt: new Date().toISOString(),
    };
    
    updateLists(lists.map(l => l.id === currentList.id ? updatedList : l));
    setCurrentList(updatedList);
  };

  const handlePullToRefresh = async () => {
    console.log('Pull-to-refresh triggered in Lists');
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
        title="Lists"
        items={sidebarItems}
        selectedId={currentList?.id || null}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onItemClick={selectListFromSidebar}
        onNewClick={startNew}
        isOpen={sidebarOpen}
        totalCount={lists.filter(l => !l.deleted && !l.archived).length}
        onTrashClick={onTrashClick}
        onArchiveClick={onArchiveClick}
        onPinToggle={toggleListPin}
        onArchive={archiveList}
        onDelete={deleteList}
        onBulkPin={bulkPinLists}
        onBulkArchive={bulkArchiveLists}
        onBulkDelete={bulkDeleteLists}
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
              {filteredLists.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p className="text-lg mb-2">No lists yet. Create your first list!</p>
                </div>
              )}

              {/* Table View Header */}
              {gridViewMode === 'table' && filteredLists.length > 0 && (
                <div className="card mb-2 py-2 px-4 bg-gray-50 dark:bg-gray-800/50">
                  <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    <div className="col-span-5">Title</div>
                    <div className="col-span-3 hidden md:block">Progress</div>
                    <div className="col-span-2 hidden sm:block">Tags</div>
                    <div className="col-span-2">Date</div>
                  </div>
                </div>
              )}

              {filteredLists.map((list, index) => {
                const completedCount = list.items.filter(item => item.completed).length;
                const totalCount = list.items.length;
                const isSelected = multiSelectedIds.has(list.id);
                const colorConfig = COLORS.find(c => c.value === list.color) || COLORS[0];
                
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
                    key={list.id}
                    id={`list-${list.id}`}
                    className={cardClass}
                    onClick={() => multiSelectActive ? toggleGridItemSelection(list.id) : viewList(list.id)}
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
                    {list.pinned && (
                      <div className={`absolute ${gridViewMode === 'list' ? 'top-4 right-4' : 'top-3 right-3'}`}>
                        <Pin className="w-4 h-4 text-primary-600 fill-current" />
                      </div>
                    )}
                    
                    {/* List view layout */}
                    {gridViewMode === 'list' ? (
                      <>
                        <div className={`flex-1 flex items-center gap-3 ${multiSelectActive ? 'ml-8' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <h3 className="content-title font-semibold truncate">{list.title}</h3>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {completedCount}/{totalCount}
                            </span>
                            {showTagsInCards && list.tags && list.tags.length > 0 && (
                              <span className="text-xs text-gray-500">
                                {list.tags.length} {list.tags.length === 1 ? 'tag' : 'tags'}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(list.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : gridViewMode === 'table' ? (
                      /* Table view layout */
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className={`col-span-5 flex items-center gap-2 ${multiSelectActive ? 'ml-8' : ''}`}>
                          <h3 className="content-title font-semibold truncate text-sm">{list.title}</h3>
                        </div>
                        <div className="col-span-3 hidden md:block">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {completedCount} of {totalCount} completed
                          </p>
                        </div>
                        <div className="col-span-2 hidden sm:block">
                          {showTagsInCards && list.tags && list.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {list.tags.slice(0, 1).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                >
                                  {tag}
                                </span>
                              ))}
                              {list.tags.length > 1 && (
                                <span className="text-xs text-gray-500">+{list.tags.length - 1}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-gray-500">{new Date(list.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ) : (
                      /* Grid view layout (comfortable, compact, masonry, magazine) */
                      <div className={`flex items-start justify-between gap-3 ${multiSelectActive ? 'ml-8' : ''}`}>
                        <div className="flex-1">
                          <h3 className={`content-title font-semibold mb-1 ${gridViewMode === 'compact' ? 'text-sm' : isMagazineFeatured ? 'text-2xl' : ''}`}>
                            {list.title}
                          </h3>
                          <p className={`content-text text-gray-600 dark:text-gray-400 ${gridViewMode === 'compact' ? 'text-xs' : ''}`}>
                            {completedCount} of {totalCount} completed
                          </p>
                          {showTagsInCards && list.tags && list.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {list.tags.slice(0, gridViewMode === 'compact' ? 2 : isMagazineFeatured ? 5 : 3).map((tag) => (
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
                              {gridViewMode === 'compact' && list.tags.length > 2 && (
                                <span className="text-xs text-gray-500">+{list.tags.length - 2}</span>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(list.updatedAt).toLocaleDateString()}
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

        {viewMode === 'view' && currentList && (
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
                  tooltip={currentList.pinned ? "Unpin" : "Pin"}
                  variant="primary"
                  active={currentList.pinned}
                />
                <IconButton
                  icon={Archive}
                  onClick={() => {
                    if (confirm('Archive this list?')) {
                      archiveList(currentList.id);
                      backToEmpty();
                    }
                  }}
                  tooltip="Archive"
                  variant="warning"
                />
                <IconButton
                  icon={showCheckboxes ? CheckSquare : Square}
                  onClick={() => setShowCheckboxes(!showCheckboxes)}
                  tooltip={showCheckboxes ? "Hide checkboxes" : "Show checkboxes"}
                  variant="info"
                  active={showCheckboxes}
                />
                <IconButton
                  icon={Check}
                  onClick={toggleAllItems}
                  disabled={!showCheckboxes}
                  tooltip={!showCheckboxes ? "Show checkboxes first" : (currentList.items.every(i => i.completed) ? "Uncheck All" : "Check All")}
                  variant="success"
                />
                <IconButton
                  icon={Edit2}
                  onClick={startEdit}
                  tooltip="Edit"
                  variant="default"
                />
                <IconButton
                  icon={Trash2}
                  onClick={() => deleteList(currentList.id)}
                  tooltip="Delete"
                  variant="danger"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <h1 className="content-title text-2xl font-bold mb-1">{currentList.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {currentList.items.filter(i => i.completed).length} of {currentList.items.length} completed
              </p>

              <div className="space-y-1">
                {currentList.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {showCheckboxes && (
                      <button
                        onClick={() => toggleItemInView(item.id)}
                        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          item.completed
                            ? 'bg-primary-600 border-primary-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {item.completed && <Check className="w-3 h-3 text-white" />}
                      </button>
                    )}
                    
                    {item.image && (
                      <div 
                        className="flex-shrink-0 w-12 h-12 rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => openGallery([item.image!], 0)}
                      >
                        <img src={item.image.data} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    
                    <span className={`content-text flex-1 ${item.completed && showCheckboxes ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'edit' && (
          <div className="max-w-4xl mx-auto p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{currentList ? 'Edit List' : 'New List'}</h2>
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
              placeholder="List title (e.g., Monthly Medicine)"
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

            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addItem()}
                  placeholder="Add item..."
                  className="input-field"
                />
                <IconButton
                  icon={Plus}
                  onClick={addItem}
                  tooltip="Add Item"
                  variant="primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Items ({items.length})
              </h3>
              
              {items.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No items yet. Add items above.</p>
                </div>
              )}

              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="card flex items-center gap-3">
                    <button
                      onClick={() => toggleItemInEdit(item.id)}
                      className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        item.completed
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {item.completed && <Check className="w-4 h-4 text-white" />}
                    </button>
                    
                    {item.image ? (
                      <div className="relative flex-shrink-0 w-12 h-12 rounded overflow-hidden group">
                        <img 
                          src={item.image.data} 
                          alt="" 
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => openGallery([item.image!], 0)}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this image?')) {
                              handleDeleteItemImage(item.id);
                            }
                          }}
                          className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingItemId(item.id)}
                        className="flex-shrink-0 w-12 h-12 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 flex items-center justify-center transition-colors"
                        title="Add image"
                      >
                        <ImageIcon className="w-5 h-5 text-gray-400" />
                      </button>
                    )}
                    
                    <span className={`content-text flex-1 ${item.completed ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}>
                      {item.text}
                    </span>
                    
                    <button
                      onClick={() => deleteItemInEdit(item.id)}
                      className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
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
                    list="list-tag-suggestions"
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
                  <datalist id="list-tag-suggestions">
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
            
            {/* Image Picker Modal */}
            {editingItemId && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
                  <h3 className="text-lg font-semibold mb-4">Add Image to Item</h3>
                  <ImagePicker onImageSelect={handleImageSelect} multiple={false} />
                  <button
                    onClick={() => setEditingItemId(null)}
                    className="mt-4 w-full btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportFormat}
        itemCount={exportIds.length}
        itemType="lists"
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
