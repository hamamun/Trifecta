import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { type ConflictReport, resolveConflict } from '../utils/conflictDetector';

interface ConflictResolutionModalProps {
  report: ConflictReport;
  onClose: () => void;
  onResolved: () => void;
}

export function ConflictResolutionModal({ report, onClose, onResolved }: ConflictResolutionModalProps) {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');

  const handleResolve = async (choice: 'A' | 'B') => {
    setResolving(true);
    setError('');

    const result = await resolveConflict(report, choice);

    if (result.success) {
      onResolved();
      onClose();
    } else {
      setError(result.error || 'Failed to resolve conflict');
      setResolving(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
  };

  const getDeviceName = (deviceId: string) => {
    if (deviceId === 'auto-merged') return 'Auto-merged';
    return deviceId.replace('device_', 'Device ').substring(0, 20);
  };

  const renderField = (label: string, valueA: any, valueB: any, isConflict: boolean) => {
    const valueAStr = typeof valueA === 'object' ? JSON.stringify(valueA, null, 2) : String(valueA || '');
    const valueBStr = typeof valueB === 'object' ? JSON.stringify(valueB, null, 2) : String(valueB || '');
    
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</h4>
          {isConflict && (
            <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
              Conflict
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-3 rounded-lg border-2 ${isConflict ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Version A</p>
            <p className="text-sm whitespace-pre-wrap break-words">{valueAStr}</p>
          </div>
          <div className={`p-3 rounded-lg border-2 ${isConflict ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Version B</p>
            <p className="text-sm whitespace-pre-wrap break-words">{valueBStr}</p>
          </div>
        </div>
      </div>
    );
  };

  const conflictFields = new Set(report.conflicts.map(c => c.field));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="text-lg font-semibold">Conflict Detected</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {report.type === 'notes' ? 'Note' : report.type === 'lists' ? 'List' : 'Event'}: {report.itemId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Bar */}
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300">Version A</p>
              <p className="text-yellow-700 dark:text-yellow-400">
                {getDeviceName(report.versionA.deviceId)} • {formatTimestamp(report.versionA.timestamp)}
              </p>
            </div>
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300">Version B</p>
              <p className="text-yellow-700 dark:text-yellow-400">
                {getDeviceName(report.versionB.deviceId)} • {formatTimestamp(report.versionB.timestamp)}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Title */}
          {renderField(
            'Title',
            report.versionA.data.title,
            report.versionB.data.title,
            conflictFields.has('title')
          )}

          {/* Content */}
          {(report.versionA.data.content || report.versionB.data.content) && renderField(
            'Content',
            report.versionA.data.content,
            report.versionB.data.content,
            conflictFields.has('content')
          )}

          {/* Items (for lists) */}
          {(report.versionA.data.items || report.versionB.data.items) && renderField(
            'Items',
            report.versionA.data.items,
            report.versionB.data.items,
            conflictFields.has('items')
          )}

          {/* Entries (for events) */}
          {(report.versionA.data.entries || report.versionB.data.entries) && renderField(
            'Entries',
            report.versionA.data.entries,
            report.versionB.data.entries,
            conflictFields.has('entries')
          )}

          {/* Tags */}
          {(report.versionA.data.tags || report.versionB.data.tags) && renderField(
            'Tags',
            report.versionA.data.tags,
            report.versionB.data.tags,
            false
          )}

          {/* Other fields */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Note:</strong> Non-conflicting fields (tags, images, etc.) will be automatically merged.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={() => handleResolve('A')}
            disabled={resolving}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {resolving ? 'Resolving...' : 'Keep Version A'}
          </button>
          <button
            onClick={() => handleResolve('B')}
            disabled={resolving}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {resolving ? 'Resolving...' : 'Keep Version B'}
          </button>
        </div>
      </div>
    </div>
  );
}
