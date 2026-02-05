import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { usePin } from '../App';

interface PinLockProps {
  onUnlock: () => void;
}

export function PinLock({ onUnlock }: PinLockProps) {
  const { unlockApp, failedAttempts } = usePin();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPin, setShowPin] = useState(false);

  // Update countdown timer
  useEffect(() => {
    if (failedAttempts.lockedUntil && Date.now() < failedAttempts.lockedUntil) {
      setIsLocked(true);
      const remaining = Math.ceil((failedAttempts.lockedUntil - Date.now()) / 1000);
      setCountdown(remaining);

      const interval = setInterval(() => {
        const newRemaining = Math.ceil((failedAttempts.lockedUntil! - Date.now()) / 1000);
        if (newRemaining <= 0) {
          setIsLocked(false);
          setCountdown(0);
          setError('');
          clearInterval(interval);
        } else {
          setCountdown(newRemaining);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setIsLocked(false);
      setCountdown(0);
    }
  }, [failedAttempts]);

  const handlePinInput = (value: string) => {
    // Only allow digits and max 6 characters
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setPin(cleaned);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLocked) {
      const minutes = Math.floor(countdown / 60);
      const seconds = countdown % 60;
      const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      setError(`Too many failed attempts. Try again in ${timeStr}`);
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    const result = await unlockApp(pin);
    if (result.success) {
      onUnlock();
    } else {
      setError(result.error || 'Incorrect PIN');
      setPin('');
    }
  };

  const formatCountdown = () => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  // Convert PIN to dots
  const displayValue = showPin ? pin : '•'.repeat(pin.length);

  return (
    <div className="flex items-center justify-center min-h-full p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4">
              <Lock className={`w-8 h-8 ${isLocked ? 'text-red-600' : 'text-primary-600'}`} />
            </div>
            <h2 className="text-2xl font-bold">Enter PIN</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
              {isLocked ? 'Too many failed attempts' : 'This section is PIN protected'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={(e) => {
                  // Extract actual digits from the input
                  const actualValue = showPin ? e.target.value : pin + e.target.value.slice(pin.length);
                  handlePinInput(actualValue);
                }}
                placeholder="Enter your PIN"
                maxLength={6}
                className="input-field text-center text-3xl tracking-widest pr-12"
                autoFocus
                disabled={isLocked}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                disabled={isLocked}
                title={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? (
                  <EyeOff className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            </div>
            
            {error && (
              <div className="text-sm text-red-600 text-center">
                <p>{error}</p>
                {isLocked && (
                  <p className="mt-2 text-lg font-bold">{formatCountdown()}</p>
                )}
              </div>
            )}

            {failedAttempts.count > 0 && !isLocked && (
              <p className="text-sm text-orange-600 dark:text-orange-400 text-center">
                Failed attempts: {failedAttempts.count}/5
              </p>
            )}

            <button 
              type="submit" 
              className="btn-primary w-full"
              disabled={isLocked}
            >
              {isLocked ? `Wait ${formatCountdown()}` : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
