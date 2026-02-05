import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { Layout } from './components/Layout';
import { Lists } from './pages/Lists';
import { Notes } from './pages/Notes';
import { Events } from './pages/Events';
import { Settings } from './pages/Settings';
import { Trash } from './pages/Trash';
import { Archive } from './pages/Archive';
import { SmartFAB } from './components/SmartFAB';

// Settings storage
interface Settings {
  theme: 'light' | 'dark' | 'system';
  pinHash: string | null;
  autoLockTimeout: number; // in minutes, 0 = never
}

interface FailedAttempts {
  count: number;
  lockedUntil: number | null;
}

function getSettings(): Settings {
  const data = localStorage.getItem('notes-app-settings');
  if (data) {
    return JSON.parse(data);
  }
  // Default: 5min for mobile, Never for desktop
  const isMobile = window.innerWidth < 1024 || 'ontouchstart' in window;
  return { 
    theme: 'system', 
    pinHash: null,
    autoLockTimeout: isMobile ? 5 : 0
  };
}

function saveSettings(settings: Settings): void {
  localStorage.setItem('notes-app-settings', JSON.stringify(settings));
}

function getFailedAttempts(): FailedAttempts {
  const data = localStorage.getItem('notes-app-failed-attempts');
  return data ? JSON.parse(data) : { count: 0, lockedUntil: null };
}

function saveFailedAttempts(attempts: FailedAttempts): void {
  localStorage.setItem('notes-app-failed-attempts', JSON.stringify(attempts));
}

// PIN hashing function
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Theme Context
interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  effectiveTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

// PIN Context
interface PinContextType {
  hasPin: boolean;
  isUnlocked: boolean;
  setPin: (pin: string) => Promise<void>;
  removePin: () => void;
  verifyPin: (pin: string) => Promise<boolean>;
  unlockApp: (pin: string) => Promise<{ success: boolean; error?: string }>;
  lockApp: () => void;
  failedAttempts: FailedAttempts;
}

const PinContext = createContext<PinContextType | null>(null);

export function usePin() {
  const context = useContext(PinContext);
  if (!context) throw new Error('usePin must be used within PinProvider');
  return context;
}

function App() {
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [lastPage, setLastPage] = useState('/');
  const [hasPin, setHasPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [failedAttempts, setFailedAttempts] = useState<FailedAttempts>({ count: 0, lockedUntil: null });

  useEffect(() => {
    const settings = getSettings();
    setThemeState(settings.theme);
    const pinExists = !!settings.pinHash;
    setHasPin(pinExists);
    setFailedAttempts(getFailedAttempts());
    
    // Apply saved font size on app load
    const savedFontSize = localStorage.getItem('notes-app-font-size');
    if (savedFontSize) {
      document.documentElement.setAttribute('data-font-size', savedFontSize);
    } else {
      // Set default to medium
      document.documentElement.setAttribute('data-font-size', 'medium');
    }
    
    // Check if already unlocked in this session
    if (pinExists) {
      const unlocked = sessionStorage.getItem('notes-app-unlocked') === 'true';
      console.log('PIN exists, checking session:', unlocked);
      setIsUnlocked(unlocked);
    } else {
      // No PIN set, so always unlocked
      console.log('No PIN set, auto-unlocked');
      setIsUnlocked(true);
    }

    // Sync on app open
    (async () => {
      const { getGitHubConfig, syncAll, isOnlineMode } = await import('./utils/github');
      const config = getGitHubConfig();
      
      // Only sync if online mode is enabled
      if (config && isOnlineMode()) {
        console.log('App opened, syncing...');
        await syncAll();
        
        // Check if backup is needed
        const { getBackupSettings, shouldBackup, createBackup } = await import('./utils/backup');
        const backupSettings = getBackupSettings();
        if (backupSettings.enabled && shouldBackup(backupSettings)) {
          console.log('Creating automatic backup...');
          await createBackup();
        }
      } else if (config && !isOnlineMode()) {
        console.log('App opened in offline mode - sync skipped');
      }
    })();
    
    // Automatic polling for updates from other devices
    // Checks GitHub metadata every 3 minutes (very lightweight)
    const pollInterval = setInterval(async () => {
      const { getGitHubConfig, isOnlineMode, checkForUpdates, syncAll } = await import('./utils/github');
      const config = getGitHubConfig();
      
      // Only poll if connected and online
      if (!config || !isOnlineMode()) return;
      
      // Only poll if app is visible (save battery)
      if (document.visibilityState !== 'visible') return;
      
      try {
        console.log('Checking for updates from other devices...');
        const hasUpdates = await checkForUpdates();
        
        if (hasUpdates) {
          console.log('Updates found! Auto-syncing...');
          await syncAll();
        } else {
          console.log('No updates found');
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3 * 60 * 1000); // Check every 3 minutes
    
    // Sync when app regains focus (user switches back to app)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const { getGitHubConfig, isOnlineMode, checkForUpdates, syncAll } = await import('./utils/github');
        const config = getGitHubConfig();
        
        if (!config || !isOnlineMode()) return;
        
        console.log('App became visible, checking for updates...');
        try {
          const hasUpdates = await checkForUpdates();
          if (hasUpdates) {
            console.log('Updates found! Auto-syncing...');
            await syncAll();
          }
        } catch (error) {
          console.error('Focus sync error:', error);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Inactivity timer - auto-lock after configured timeout
  useEffect(() => {
    if (!hasPin || !isUnlocked) return;

    const settings = getSettings();
    const timeoutMinutes = settings.autoLockTimeout;
    
    // If timeout is 0 (Never), don't run the timer
    if (timeoutMinutes === 0) {
      console.log('Auto-lock disabled (Never)');
      return;
    }

    const TIMEOUT_MS = timeoutMinutes * 60 * 1000;

    const checkInactivity = () => {
      const now = Date.now();
      const inactiveTime = now - lastActivity;

      if (inactiveTime >= TIMEOUT_MS) {
        console.log(`Auto-locking due to inactivity (${timeoutMinutes} min timeout)`);
        lockApp();
      }
    };

    // Check every 10 seconds
    const interval = setInterval(checkInactivity, 10000);

    return () => clearInterval(interval);
  }, [hasPin, isUnlocked, lastActivity]);

  // Handle tab visibility - pause timer when tab is hidden
  useEffect(() => {
    if (!hasPin || !isUnlocked) return;

    const settings = getSettings();
    const timeoutMinutes = settings.autoLockTimeout;
    
    // If timeout is 0 (Never), don't handle visibility
    if (timeoutMinutes === 0) return;

    const TIMEOUT_MS = timeoutMinutes * 60 * 1000;
    let hiddenTime: number | null = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - record the time
        hiddenTime = Date.now();
        console.log('Tab hidden, pausing timer');
      } else {
        // Tab is visible again
        if (hiddenTime) {
          const timeAway = Date.now() - hiddenTime;
          console.log(`Tab visible again, was away for ${Math.round(timeAway / 1000)} seconds`);
          
          // Check if away time exceeded timeout
          if (timeAway >= TIMEOUT_MS) {
            console.log(`Away time exceeded timeout (${timeoutMinutes} min), auto-locking`);
            lockApp();
          } else {
            // Update last activity to account for time away
            // This effectively pauses the timer while tab was hidden
            setLastActivity(prev => prev + timeAway);
          }
          
          hiddenTime = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasPin, isUnlocked]);

  // Track user activity
  useEffect(() => {
    if (!hasPin || !isUnlocked) return;

    const updateActivity = () => {
      setLastActivity(Date.now());
    };

    // Track various user activities
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [hasPin, isUnlocked]);

  useEffect(() => {
    const updateTheme = () => {
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setEffectiveTheme(isDark ? 'dark' : 'light');
      } else {
        setEffectiveTheme(theme);
      }
    };

    updateTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    }
  }, [theme]);

  useEffect(() => {
    if (effectiveTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [effectiveTheme]);

  const setTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme);
    const settings = getSettings();
    saveSettings({ ...settings, theme: newTheme });
  };

  const setPinFunc = async (pin: string) => {
    const hash = await hashPin(pin);
    const settings = getSettings();
    saveSettings({ ...settings, pinHash: hash });
    setHasPin(true);
    // Auto-unlock after setting PIN
    setIsUnlocked(true);
    sessionStorage.setItem('notes-app-unlocked', 'true');
  };

  const removePinFunc = () => {
    const settings = getSettings();
    saveSettings({ ...settings, pinHash: null });
    setHasPin(false);
    setIsUnlocked(true);
    sessionStorage.removeItem('notes-app-unlocked');
  };

  const verifyPinFunc = async (pin: string): Promise<boolean> => {
    const settings = getSettings();
    if (!settings.pinHash) return false;
    const hash = await hashPin(pin);
    return hash === settings.pinHash;
  };

  const unlockApp = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    const attempts = getFailedAttempts();
    
    // Check if locked due to failed attempts
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remainingSeconds = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      return { 
        success: false, 
        error: `Too many failed attempts. Try again in ${timeStr}` 
      };
    }
    
    const isValid = await verifyPinFunc(pin);
    if (isValid) {
      // Success - reset failed attempts
      saveFailedAttempts({ count: 0, lockedUntil: null });
      setFailedAttempts({ count: 0, lockedUntil: null });
      setIsUnlocked(true);
      sessionStorage.setItem('notes-app-unlocked', 'true');
      setLastActivity(Date.now());
      console.log('PIN correct, unlocked successfully');
      return { success: true };
    } else {
      // Failed attempt
      const newCount = attempts.count + 1;
      let lockedUntil = null;
      
      // Apply delays based on failed attempts
      if (newCount >= 5) {
        lockedUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
        console.log(`Failed attempt #${newCount}, locked for 5 minutes`);
      } else if (newCount >= 3) {
        lockedUntil = Date.now() + 30 * 1000; // 30 seconds
        console.log(`Failed attempt #${newCount}, locked for 30 seconds`);
      } else {
        console.log(`Failed attempt #${newCount}`);
      }
      
      const newAttempts = { count: newCount, lockedUntil };
      saveFailedAttempts(newAttempts);
      setFailedAttempts(newAttempts);
      
      if (lockedUntil) {
        const remainingSeconds = Math.ceil((lockedUntil - Date.now()) / 1000);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        return { 
          success: false, 
          error: `Too many failed attempts. Try again in ${timeStr}` 
        };
      }
      
      return { success: false, error: 'Incorrect PIN' };
    }
  };

  const lockApp = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('notes-app-unlocked');
    
    // If on Notes or Events page, redirect to Lists
    const currentPath = window.location.pathname;
    if (currentPath === '/notes' || currentPath === '/events') {
      window.location.href = '/';
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const openTrash = () => {
    // Save current page before opening trash
    const currentPath = window.location.pathname;
    setLastPage(currentPath);
    setShowTrash(true);
    setShowArchive(false);
    // Close sidebar on mobile when opening trash
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const closeTrash = () => {
    setShowTrash(false);
    
    // If returning to Notes or Events and they're locked, go to Lists instead
    if ((lastPage === '/notes' || lastPage === '/events') && hasPin && !isUnlocked) {
      window.location.href = '/';
    } else if (lastPage !== window.location.pathname) {
      window.location.href = lastPage;
    }
  };

  const openArchive = () => {
    // Save current page before opening archive
    const currentPath = window.location.pathname;
    setLastPage(currentPath);
    setShowArchive(true);
    setShowTrash(false);
    // Close sidebar on mobile when opening archive
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const closeArchive = () => {
    setShowArchive(false);
    
    // If returning to Notes or Events and they're locked, go to Lists instead
    if ((lastPage === '/notes' || lastPage === '/events') && hasPin && !isUnlocked) {
      window.location.href = '/';
    } else if (lastPage !== window.location.pathname) {
      window.location.href = lastPage;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
      <PinContext.Provider value={{ hasPin, isUnlocked, setPin: setPinFunc, removePin: removePinFunc, verifyPin: verifyPinFunc, unlockApp, lockApp, failedAttempts }}>
        <BrowserRouter>
          <AppContent 
            showTrash={showTrash}
            showArchive={showArchive}
            sidebarOpen={sidebarOpen}
            toggleSidebar={toggleSidebar}
            openTrash={openTrash}
            closeTrash={closeTrash}
            openArchive={openArchive}
            closeArchive={closeArchive}
          />
        </BrowserRouter>
      </PinContext.Provider>
    </ThemeContext.Provider>
  );
}

function AppContent({ showTrash, showArchive, sidebarOpen, toggleSidebar, openTrash, closeTrash, openArchive, closeArchive }: any) {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<'empty' | 'view' | 'edit'>('empty');
  
  // Listen for view mode changes from pages
  useEffect(() => {
    const handleViewModeChange = (e: CustomEvent) => {
      setViewMode(e.detail.mode);
    };
    
    window.addEventListener('viewmode-change' as any, handleViewModeChange);
    
    return () => {
      window.removeEventListener('viewmode-change' as any, handleViewModeChange);
    };
  }, []);
  
  // Reset view mode when route changes
  useEffect(() => {
    setViewMode('empty');
  }, [location.pathname]);
  
  // Determine current page
  const getCurrentPage = (): 'notes' | 'lists' | 'events' | undefined => {
    if (location.pathname === '/notes') return 'notes';
    if (location.pathname === '/') return 'lists';
    if (location.pathname === '/events') return 'events';
    return undefined;
  };

  // Create handlers that trigger the new action on each page
  const handleCreateNote = () => {
    navigate('/notes');
    // Trigger new note creation
    setTimeout(() => {
      const event = new CustomEvent('create-new-note');
      window.dispatchEvent(event);
    }, 100);
  };

  const handleCreateList = () => {
    navigate('/');
    // Trigger new list creation
    setTimeout(() => {
      const event = new CustomEvent('create-new-list');
      window.dispatchEvent(event);
    }, 100);
  };

  const handleCreateEvent = () => {
    navigate('/events');
    // Trigger new event creation
    setTimeout(() => {
      const event = new CustomEvent('create-new-event');
      window.dispatchEvent(event);
    }, 100);
  };

  const currentPage = getCurrentPage();
  const showFAB = !showTrash && !showArchive && location.pathname !== '/settings';
  const isFABVisible = showFAB && viewMode === 'empty';

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout onMenuClick={toggleSidebar} hideBottomNav={showTrash} showArchiveNav={showArchive}>{showTrash ? <Trash onClose={closeTrash} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} /> : showArchive ? <Archive onClose={closeArchive} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} /> : <Lists sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} onTrashClick={openTrash} onArchiveClick={openArchive} />}</Layout>} />
        <Route path="/notes" element={<Layout onMenuClick={toggleSidebar} hideBottomNav={showTrash} showArchiveNav={showArchive}>{showTrash ? <Trash onClose={closeTrash} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} /> : showArchive ? <Archive onClose={closeArchive} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} /> : <Notes sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} onTrashClick={openTrash} onArchiveClick={openArchive} />}</Layout>} />
        <Route path="/events" element={<Layout onMenuClick={toggleSidebar} hideBottomNav={showTrash} showArchiveNav={showArchive}>{showTrash ? <Trash onClose={closeTrash} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} /> : showArchive ? <Archive onClose={closeArchive} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} /> : <Events sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} onTrashClick={openTrash} onArchiveClick={openArchive} />}</Layout>} />
        <Route path="/settings" element={<Layout onMenuClick={toggleSidebar} hideBottomNav={showTrash} showArchiveNav={showArchive}>{showTrash ? <Trash onClose={closeTrash} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} /> : showArchive ? <Archive onClose={closeArchive} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} /> : <Settings />}</Layout>} />
      </Routes>
      
      {/* Smart FAB - Shows on all pages except Settings, Trash, and Archive, and hides in view/edit mode */}
      <SmartFAB
        onCreateNote={handleCreateNote}
        onCreateList={handleCreateList}
        onCreateEvent={handleCreateEvent}
        currentPage={currentPage}
        isVisible={isFABVisible}
      />
    </>
  );
}

export default App;
