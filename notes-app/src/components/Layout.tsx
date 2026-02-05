import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { List, FileText, Calendar, Settings, Menu, Lock, Unlock, Trash2, Archive as ArchiveIcon, Cloud, CloudOff, RefreshCw, LayoutGrid, LayoutList, Grid3x3, Columns, Table, Newspaper, ArrowUpDown, ArrowUpAZ, ArrowDownZA, CalendarArrowDown, CalendarArrowUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePin } from '../App';

interface LayoutProps {
  children: ReactNode;
  onMenuClick?: () => void;
  hideBottomNav?: boolean;
  showArchiveNav?: boolean;
  viewModeTitle?: string | null;
}

export function Layout({ children, onMenuClick, hideBottomNav = false, showArchiveNav = false }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pinContext = usePin();
  const { hasPin, isUnlocked, lockApp } = pinContext || { hasPin: false, isUnlocked: true, lockApp: () => {} };
  const [, forceUpdate] = useState({});
  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem('notes-app-online-mode');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [gridViewMode, setGridViewMode] = useState<'comfortable' | 'compact' | 'list' | 'masonry' | 'table' | 'magazine'>(() => {
    const saved = localStorage.getItem('notes-app-grid-view-mode');
    return (saved as 'comfortable' | 'compact' | 'list' | 'masonry' | 'table' | 'magazine') || 'comfortable';
  });
  const [showViewMenu, setShowViewMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  
  const [sortMode, setSortMode] = useState<'smart' | 'a-z' | 'z-a' | 'newest' | 'oldest'>(() => {
    const saved = localStorage.getItem('notes-app-sort-mode');
    return (saved as 'smart' | 'a-z' | 'z-a' | 'newest' | 'oldest') || 'smart';
  });
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const [sortDropdownPosition, setSortDropdownPosition] = useState({ top: 0, right: 0 });
  const [viewModeTitle, setViewModeTitle] = useState<string | null>(null);

  // Listen for view mode title changes
  useEffect(() => {
    const handleViewModeTitle = (e: CustomEvent) => {
      setViewModeTitle(e.detail.title);
    };
    window.addEventListener('viewmode-title-change', handleViewModeTitle as EventListener);
    
    return () => {
      window.removeEventListener('viewmode-title-change', handleViewModeTitle as EventListener);
    };
  }, []);

  // Check if GitHub is connected
  useEffect(() => {
    const checkGitHubConnection = () => {
      const config = localStorage.getItem('notes-app-github-config');
      setIsGitHubConnected(!!config);
    };

    checkGitHubConnection();

    // Check periodically in case connection changes
    const interval = setInterval(checkGitHubConnection, 1000);

    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowViewMenu(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node) &&
          sortButtonRef.current && !sortButtonRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };

    if (showViewMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      
      // Calculate dropdown position
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right
        });
      }
    }

    if (showSortMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      
      // Calculate dropdown position
      if (sortButtonRef.current) {
        const rect = sortButtonRef.current.getBoundingClientRect();
        setSortDropdownPosition({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right
        });
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showViewMenu, showSortMenu]);

  // Listen for sync status changes
  useEffect(() => {
    const checkSyncStatus = () => {
      const syncStatus = localStorage.getItem('notes-app-sync-status');
      if (syncStatus) {
        const status = JSON.parse(syncStatus);
        setIsSyncing(status.status === 'syncing');
      }
    };

    // Check initially
    checkSyncStatus();

    // Check periodically
    const interval = setInterval(checkSyncStatus, 500);

    return () => clearInterval(interval);
  }, []);

  const toggleOnlineMode = () => {
    const newMode = !isOnline;
    setIsOnline(newMode);
    localStorage.setItem('notes-app-online-mode', JSON.stringify(newMode));
    
    // Dispatch event for other components to listen
    const event = new CustomEvent('online-mode-change', { detail: { isOnline: newMode } });
    window.dispatchEvent(event);
    
    // If going online and there are pending changes, sync immediately
    if (newMode === true) {
      (async () => {
        const { getPendingSyncTypes, syncAll, getGitHubConfig } = await import('../utils/github');
        const config = getGitHubConfig();
        const pendingTypes = getPendingSyncTypes();
        
        if (config && pendingTypes.size > 0) {
          console.log('Going online with pending changes - syncing now...', Array.from(pendingTypes));
          await syncAll();
        }
      })();
    }
  };

  const changeGridViewMode = (mode: 'comfortable' | 'compact' | 'list' | 'masonry' | 'table' | 'magazine') => {
    console.log('Changing grid view mode to:', mode);
    setGridViewMode(mode);
    localStorage.setItem('notes-app-grid-view-mode', mode);
    setShowViewMenu(false);
    
    // Dispatch event for pages to listen
    const event = new CustomEvent('grid-view-change', { detail: { mode } });
    window.dispatchEvent(event);
    console.log('Grid view change event dispatched:', mode);
  };

  const changeSortMode = (mode: 'smart' | 'a-z' | 'z-a' | 'newest' | 'oldest') => {
    console.log('Changing sort mode to:', mode);
    setSortMode(mode);
    localStorage.setItem('notes-app-sort-mode', mode);
    setShowSortMenu(false);
    
    // Dispatch event for pages to listen
    const event = new CustomEvent('sort-change', { detail: { mode } });
    window.dispatchEvent(event);
    console.log('Sort change event dispatched:', mode);
  };

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return;

    try {
      const { syncAll } = await import('../utils/github');
      await syncAll();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  const handleLockClick = () => {
    lockApp();
    // If on Notes or Events page, redirect to Lists
    if (location.pathname === '/notes' || location.pathname === '/events') {
      navigate('/');
    }
  };

  // Force re-render when trash view changes
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  // Get current page title
  const getPageTitle = () => {
    // If in view/edit mode, show the item title
    if (viewModeTitle) return viewModeTitle;
    
    // Check if we're in trash or archive mode
    const isTrash = window.location.pathname.includes('trash') || document.querySelector('[data-trash-view]');
    const isArchive = document.querySelector('[data-archive-view]');
    if (isTrash) return 'Trash';
    if (isArchive) return 'Archive';
    if (location.pathname === '/') return 'Lists';
    if (location.pathname === '/notes') return 'Notes';
    if (location.pathname === '/events') return 'Events';
    if (location.pathname === '/settings') return 'Settings';
    return 'Trifecta';
  };

  // Get count for current page
  const getPageCount = () => {
    // Don't show count when in view/edit mode
    if (viewModeTitle) return null;
    
    try {
      // Check if we're in trash or archive mode
      const isTrash = window.location.pathname.includes('trash') || document.querySelector('[data-trash-view]');
      const isArchive = document.querySelector('[data-archive-view]');
      
      if (isTrash) {
        let count = 0;
        const listsData = localStorage.getItem('notes-app-lists');
        if (listsData) count += JSON.parse(listsData).filter((l: any) => l.deleted).length;
        const notesData = localStorage.getItem('notes-app-notes');
        if (notesData) count += JSON.parse(notesData).filter((n: any) => n.deleted).length;
        const eventsData = localStorage.getItem('notes-app-events');
        if (eventsData) count += JSON.parse(eventsData).filter((e: any) => e.deleted).length;
        return count;
      }
      
      if (isArchive) {
        let count = 0;
        const listsData = localStorage.getItem('notes-app-lists');
        if (listsData) count += JSON.parse(listsData).filter((l: any) => l.archived && !l.deleted).length;
        const notesData = localStorage.getItem('notes-app-notes');
        if (notesData) count += JSON.parse(notesData).filter((n: any) => n.archived && !n.deleted).length;
        const eventsData = localStorage.getItem('notes-app-events');
        if (eventsData) count += JSON.parse(eventsData).filter((e: any) => e.archived && !e.deleted).length;
        return count;
      }
      
      if (location.pathname === '/') {
        const data = localStorage.getItem('notes-app-lists');
        return data ? JSON.parse(data).filter((l: any) => !l.deleted && !l.archived).length : 0;
      }
      if (location.pathname === '/notes') {
        const data = localStorage.getItem('notes-app-notes');
        return data ? JSON.parse(data).filter((n: any) => !n.deleted && !n.archived).length : 0;
      }
      if (location.pathname === '/events') {
        const data = localStorage.getItem('notes-app-events');
        return data ? JSON.parse(data).filter((e: any) => !e.deleted && !e.archived).length : 0;
      }
    } catch {
      return 0;
    }
    return null;
  };

  const pageCount = getPageCount();

  const navItems = [
    { path: '/', icon: List, label: 'Lists' },
    { path: '/notes', icon: FileText, label: 'Notes' },
    { path: '/events', icon: Calendar, label: 'Events' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: '100%', width: '100%' }}>
      {/* Header - Fixed height with glassmorphism */}
      <header className="flex-shrink-0 glass-strong border-b border-gray-200/50 dark:border-gray-700/50 px-4 flex items-center justify-between" style={{ height: '56px', minHeight: '56px' }}>
        <div className="flex items-center gap-3">
          {onMenuClick && location.pathname !== '/settings' && (
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-300 glow-on-hover"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
            {getPageTitle()}
            {pageCount !== null && (
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({pageCount})
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Sort Toggle - only show on Notes, Lists, Events pages in grid view */}
          {!viewModeTitle && (location.pathname === '/' || location.pathname === '/notes' || location.pathname === '/events') && (
            <>
              <button
                ref={sortButtonRef}
                type="button"
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="p-2 rounded-xl transition-all duration-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400 glow-on-hover"
                title="Change sort order"
              >
                {sortMode === 'smart' && <ArrowUpDown className="w-5 h-5" />}
                {sortMode === 'a-z' && <ArrowUpAZ className="w-5 h-5" />}
                {sortMode === 'z-a' && <ArrowDownZA className="w-5 h-5" />}
                {sortMode === 'newest' && <CalendarArrowDown className="w-5 h-5" />}
                {sortMode === 'oldest' && <CalendarArrowUp className="w-5 h-5" />}
              </button>
              
              {showSortMenu && createPortal(
                <div 
                  ref={sortDropdownRef}
                  className="fixed w-44 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 overflow-hidden"
                  style={{ 
                    top: `${sortDropdownPosition.top}px`, 
                    right: `${sortDropdownPosition.right}px`,
                    zIndex: 10000
                  }}
                >
                  <button
                    type="button"
                    onClick={() => changeSortMode('smart')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      sortMode === 'smart'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    <span className="text-sm font-medium">Smart Sort</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeSortMode('a-z')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      sortMode === 'a-z'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ArrowUpAZ className="w-4 h-4" />
                    <span className="text-sm font-medium">A-Z</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeSortMode('z-a')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      sortMode === 'z-a'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ArrowDownZA className="w-4 h-4" />
                    <span className="text-sm font-medium">Z-A</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeSortMode('newest')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      sortMode === 'newest'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <CalendarArrowDown className="w-4 h-4" />
                    <span className="text-sm font-medium">Newest First</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeSortMode('oldest')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      sortMode === 'oldest'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <CalendarArrowUp className="w-4 h-4" />
                    <span className="text-sm font-medium">Oldest First</span>
                  </button>
                </div>,
                document.body
              )}
            </>
          )}
          
          {/* View Mode Toggle - only show on Notes, Lists, Events pages in grid view */}
          {!viewModeTitle && (location.pathname === '/' || location.pathname === '/notes' || location.pathname === '/events') && (
            <>
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setShowViewMenu(!showViewMenu)}
                className="p-2 rounded-xl transition-all duration-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400 glow-on-hover"
                title="Change view mode"
              >
                {gridViewMode === 'comfortable' && <LayoutGrid className="w-5 h-5" />}
                {gridViewMode === 'compact' && <Grid3x3 className="w-5 h-5" />}
                {gridViewMode === 'list' && <LayoutList className="w-5 h-5" />}
                {gridViewMode === 'masonry' && <Columns className="w-5 h-5" />}
                {gridViewMode === 'table' && <Table className="w-5 h-5" />}
                {gridViewMode === 'magazine' && <Newspaper className="w-5 h-5" />}
              </button>
              
              {showViewMenu && createPortal(
                <div 
                  ref={dropdownRef}
                  className="fixed w-44 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 overflow-hidden"
                  style={{ 
                    top: `${dropdownPosition.top}px`, 
                    right: `${dropdownPosition.right}px`,
                    zIndex: 10000
                  }}
                >
                  <button
                    type="button"
                    onClick={() => changeGridViewMode('comfortable')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      gridViewMode === 'comfortable'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="text-sm font-medium">Comfortable</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeGridViewMode('compact')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      gridViewMode === 'compact'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Grid3x3 className="w-4 h-4" />
                    <span className="text-sm font-medium">Compact</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeGridViewMode('list')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      gridViewMode === 'list'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <LayoutList className="w-4 h-4" />
                    <span className="text-sm font-medium">List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeGridViewMode('masonry')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      gridViewMode === 'masonry'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Columns className="w-4 h-4" />
                    <span className="text-sm font-medium">Masonry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeGridViewMode('table')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      gridViewMode === 'table'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Table className="w-4 h-4" />
                    <span className="text-sm font-medium">Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeGridViewMode('magazine')}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      gridViewMode === 'magazine'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Newspaper className="w-4 h-4" />
                    <span className="text-sm font-medium">Magazine</span>
                  </button>
                </div>,
                document.body
              )}
            </>
          )}
          
          {/* Manual Sync Button - only show when GitHub is connected and online */}
          {isGitHubConnected && isOnline && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`p-2 rounded-xl transition-all duration-300 ${
                isSyncing
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 glow-on-hover'
              }`}
              title="Sync now"
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          )}
          
          {/* Online/Offline Toggle */}
          <button
            onClick={toggleOnlineMode}
            className={`p-2 rounded-xl transition-all duration-300 ${
              isOnline
                ? 'hover:bg-blue-50/50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 animate-glow-pulse'
                : 'hover:bg-gray-100/50 dark:hover:bg-gray-700/50 text-gray-400 dark:text-gray-500'
            }`}
            title={isOnline ? 'Cloud Sync Online - Click to go offline' : 'Cloud Sync Offline - Click to go online'}
          >
            {isOnline ? (
              <Cloud className="w-5 h-5" />
            ) : (
              <CloudOff className="w-5 h-5" />
            )}
          </button>
          
          {/* Lock icon - only show on Notes/Events pages when PIN is set */}
          {hasPin && (location.pathname === '/notes' || location.pathname === '/events') && (
            <button
              onClick={handleLockClick}
              className="p-2 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-300 glow-on-hover"
              title={isUnlocked ? 'Lock App' : 'Locked'}
            >
              {isUnlocked ? <Unlock className="w-5 h-5 text-green-600" /> : <Lock className="w-5 h-5 text-red-600" />}
            </button>
          )}
        </div>
      </header>

      {/* Main Content - Fills remaining space, scrollable */}
      <main className="overflow-y-auto overflow-x-hidden" style={{ flex: '1 1 0', minHeight: 0 }}>
        {children}
      </main>

      {/* Bottom Navigation - Fixed height with safe area and glassmorphism */}
      <nav className="flex-shrink-0 glass-strong border-t border-gray-200/50 dark:border-gray-700/50 px-2" style={{ 
        height: 'calc(56px + env(safe-area-inset-bottom))',
        minHeight: 'calc(56px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        <div className="flex justify-between items-center max-w-full mx-auto">
          {/* Trifecta Branding - Left Corner */}
          <div className="flex items-center pl-2">
            <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-purple-600 dark:from-primary-400 dark:to-purple-400 bg-clip-text text-transparent tracking-tight"
              style={{
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1), 0 -1px 1px rgba(255, 255, 255, 0.1)',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
              }}>
              Trifecta
            </span>
          </div>
          
          {/* Navigation Items - Center */}
          <div className="flex justify-center items-center gap-1 flex-1">
          {hideBottomNav ? (
            // Show only Trash icon when in trash view
            <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20 backdrop-blur-sm">
              <Trash2 className="w-6 h-6" />
              <span className="text-xs font-semibold">Trash</span>
            </div>
          ) : showArchiveNav ? (
            // Show only Archive icon when in archive view
            <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20 backdrop-blur-sm">
              <ArchiveIcon className="w-6 h-6" />
              <span className="text-xs font-semibold">Archive</span>
            </div>
          ) : (
            // Show normal navigation
            navItems.map(({ path, icon: Icon, label }) => {
              const active = isActive(path);
              
              return (
                <Link
                  key={path}
                  to={path}
                  className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300 overflow-hidden ${
                    active
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20 backdrop-blur-sm shadow-lg shadow-primary-500/30 animate-glow-pulse'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 hover:backdrop-blur-sm hover:shadow-md'
                  }`}
                  onClick={(e) => {
                    // Create ripple effect
                    const button = e.currentTarget;
                    const ripple = document.createElement('span');
                    const rect = button.getBoundingClientRect();
                    const size = Math.max(rect.width, rect.height);
                    const x = e.clientX - rect.left - size / 2;
                    const y = e.clientY - rect.top - size / 2;
                    
                    ripple.style.width = ripple.style.height = `${size}px`;
                    ripple.style.left = `${x}px`;
                    ripple.style.top = `${y}px`;
                    ripple.classList.add('ripple');
                    
                    button.appendChild(ripple);
                    
                    setTimeout(() => ripple.remove(), 600);
                  }}
                >
                  <Icon className={`w-6 h-6 transition-transform duration-300 ${active ? 'scale-110' : ''}`} />
                  <span className="text-xs font-semibold">{label}</span>
                </Link>
              );
            })
          )}
          </div>
        </div>
      </nav>
    </div>
  );
}
