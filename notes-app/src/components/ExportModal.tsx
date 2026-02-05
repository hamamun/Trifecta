import { X, FileJson, FileText, Table } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'json' | 'pdf' | 'csv') => void;
  itemCount: number;
  itemType: 'lists' | 'notes' | 'events';
}

export function ExportModal({ isOpen, onClose, onExport, itemCount, itemType }: ExportModalProps) {
  if (!isOpen) return null;

  const formats = [
    {
      id: 'json' as const,
      name: 'JSON',
      description: 'Full data backup (recommended)',
      icon: FileJson,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      id: 'pdf' as const,
      name: 'PDF',
      description: 'Formatted document for viewing/printing',
      icon: FileText,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      id: 'csv' as const,
      name: 'CSV/Excel',
      description: 'Spreadsheet format for data analysis',
      icon: Table,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold">Export {itemType}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {itemCount} {itemCount === 1 ? 'item' : 'items'} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Options */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Choose export format:
          </p>
          
          {formats.map((format) => (
            <button
              key={format.id}
              onClick={() => onExport(format.id)}
              className="w-full flex items-start gap-3 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-all text-left"
            >
              <div className={`p-2 rounded-lg ${format.bgColor}`}>
                <format.icon className={`w-6 h-6 ${format.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{format.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {format.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="btn-secondary w-full"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
