import { useState } from 'react';
import { Moon, Sun, Monitor, Lock, Unlock, Clock, Eye, EyeOff } from 'lucide-react';
import { useTheme, usePin } from '../App';
import { GitHubSync } from '../components/GitHubSync';
import { BackupSettings } from '../components/BackupSettings';
import { TagManagement } from '../components/TagManagement';
import { FontSizeControl } from '../components/FontSizeControl';

// Settings storage helper
function getSettings() {
  const data = localStorage.getItem('notes-app-settings');
  if (data) {
    return JSON.parse(data);
  }
  const isMobile = window.innerWidth < 1024 || 'ontouchstart' in window;
  return { theme: 'system', pinHash: null, autoLockTimeout: isMobile ? 5 : 0 };
}

function saveSettings(settings: any) {
  localStorage.setItem('notes-app-settings', JSON.stringify(settings));
}

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { hasPin, setPin, removePin, verifyPin } = usePin();
  const [showPinForm, setShowPinForm] = useState(false);
  const [step, setStep] = useState<'verify' | 'new'>('verify');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [autoLockTimeout, setAutoLockTimeoutState] = useState(getSettings().autoLockTimeout || 5);
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  const timeoutOptions = [
    { value: 0, label: 'Never' },
    { value: 1, label: '1 minute' },
    { value: 5, label: '5 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
  ];

  const handleTimeoutChange = (minutes: number) => {
    const settings = getSettings();
    saveSettings({ ...settings, autoLockTimeout: minutes });
    setAutoLockTimeoutState(minutes);
  };

  const handlePinInput = (value: string, setter: (val: string) => void) => {
    // Only allow digits and max 6 characters
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setter(cleaned);
  };

  const handleVerifyCurrentPin = async () => {
    setError('');
    const isValid = await verifyPin(currentPin);
    if (!isValid) {
      setError('Incorrect current PIN');
      setCurrentPin('');
      return;
    }
    // Move to new PIN step
    setStep('new');
    setCurrentPin('');
  };

  const handleSetPin = async () => {
    setError('');
    
    // Validate PIN is numeric
    if (!/^\d+$/.test(newPin)) {
      setError('PIN must contain only numbers');
      return;
    }
    
    // Validate PIN length (4-6 digits)
    if (newPin.length < 4 || newPin.length > 6) {
      setError('PIN must be 4-6 digits');
      return;
    }
    
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    await setPin(newPin);
    handleCancel();
  };

  const handleRemovePin = () => {
    removePin();
    handleCancel();
  };

  const handleCancel = () => {
    setShowPinForm(false);
    setStep('verify');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
  };

  const handleOpenPinForm = () => {
    setShowPinForm(true);
    // If no PIN set, skip to new PIN step
    if (!hasPin) {
      setStep('new');
    } else {
      setStep('verify');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Font Size Settings */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Font Size</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Adjust text size in notes, lists, and events
              </p>
            </div>
            <span className="text-2xl">Aa</span>
          </div>

          <FontSizeControl />
        </div>

        {/* Theme Settings */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Appearance</h3>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  theme === value
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* PIN Protection */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">PIN Protection</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Protect Notes and Events with a 4-6 digit PIN
              </p>
            </div>
            {hasPin ? (
              <Lock className="w-6 h-6 text-green-600" />
            ) : (
              <Unlock className="w-6 h-6 text-gray-400" />
            )}
          </div>

          {!showPinForm ? (
            <button
              onClick={handleOpenPinForm}
              className="btn-primary w-full"
            >
              {hasPin ? 'Change PIN' : 'Set PIN'}
            </button>
          ) : (
            <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
              {/* Step 1: Verify current PIN (only if PIN exists) */}
              {hasPin && step === 'verify' && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    Enter your current PIN to continue
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={showCurrentPin ? currentPin : '•'.repeat(currentPin.length)}
                      onChange={(e) => {
                        const actualValue = showCurrentPin ? e.target.value : currentPin + e.target.value.slice(currentPin.length);
                        handlePinInput(actualValue, setCurrentPin);
                      }}
                      placeholder="Current PIN"
                      maxLength={6}
                      className="input-field text-center text-2xl tracking-widest pr-12"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPin(!showCurrentPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title={showCurrentPin ? 'Hide PIN' : 'Show PIN'}
                    >
                      {showCurrentPin ? (
                        <EyeOff className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 text-center">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyCurrentPin}
                      className="btn-primary flex-1"
                      disabled={currentPin.length < 4}
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Set new PIN */}
              {step === 'new' && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    {hasPin ? 'Enter your new PIN' : 'Create a 4-6 digit PIN'}
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={showNewPin ? newPin : '•'.repeat(newPin.length)}
                      onChange={(e) => {
                        const actualValue = showNewPin ? e.target.value : newPin + e.target.value.slice(newPin.length);
                        handlePinInput(actualValue, setNewPin);
                      }}
                      placeholder="Enter 4-6 digit PIN"
                      maxLength={6}
                      className="input-field text-center text-2xl tracking-widest pr-12"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPin(!showNewPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title={showNewPin ? 'Hide PIN' : 'Show PIN'}
                    >
                      {showNewPin ? (
                        <EyeOff className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={showConfirmPin ? confirmPin : '•'.repeat(confirmPin.length)}
                      onChange={(e) => {
                        const actualValue = showConfirmPin ? e.target.value : confirmPin + e.target.value.slice(confirmPin.length);
                        handlePinInput(actualValue, setConfirmPin);
                      }}
                      placeholder="Confirm PIN"
                      maxLength={6}
                      className="input-field text-center text-2xl tracking-widest pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPin(!showConfirmPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title={showConfirmPin ? 'Hide PIN' : 'Show PIN'}
                    >
                      {showConfirmPin ? (
                        <EyeOff className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 text-center">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSetPin}
                      className="btn-primary flex-1"
                      disabled={newPin.length < 4 || confirmPin.length < 4}
                    >
                      Save PIN
                    </button>
                  </div>

                  {/* Remove PIN option - only show when changing existing PIN */}
                  {hasPin && (
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={handleRemovePin}
                        className="w-full py-2 px-4 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors"
                      >
                        Remove PIN Protection
                      </button>
                    </div>
                  )}
                </>
              )}
            </form>
          )}
        </div>

        {/* Auto-lock Timeout - only show when PIN is set */}
        {hasPin && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Auto-lock Timeout</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically lock after inactivity
                </p>
              </div>
              <Clock className="w-6 h-6 text-primary-600" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {timeoutOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleTimeoutChange(value)}
                  className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    autoLockTimeout === value
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GitHub Sync */}
        <GitHubSync />

        {/* Backup Settings */}
        <BackupSettings />

        {/* Tag Management */}
        <TagManagement />

        {/* App Info */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">About</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Trifecta v1.0.0
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Your all-in-one secure app for Notes, Lists, and Events
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Offline-first with cloud sync capabilities
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-4 opacity-30 italic">
            Created by HAM
          </p>
        </div>
      </div>
    </div>
  );
}
