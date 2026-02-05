import React from 'react';
import { Search, Plus, Pin, X, Trash2, CheckSquare, Square, Archive, Download, CheckCheck, XCircle } from 'lucide-react';
import { IconButton } from './IconButton';

interface SidebarItem {
  id: string;
  title: string;
  subtitle?: string;
  pinned?: boolean;
}

interface SidebarProps {
  title: string;
  items: SidebarItem[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onItemClick: (id: string) => void;
  onNewClick: () => void;
  isOpen: boolean;
  totalCount?: number;
  onTrashClick?: () => void;
  onArchiveClick?: () => void;
  onPinToggle?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onBulkPin?: (ids: string[], pin: boolean) => void;
  onBulkArchive?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  onExport?: (ids: string[]) => void;
  onMultiSelectChange?: (isActive: boolean, selectedIds: Set<string>) => void;
  externalSelectedIds?: Set<string>;
}

export function Sidebar({
  title,
  items,
  selectedId,
  searchQuery,
  onSearchChange,
  onItemClick,
  onNewClick,
  isOpen,
  totalCount,
  onTrashClick,
  onArchiveClick,
  onPinToggle,
  onArchive,
  onDelete,
  onBulkPin,
  onBulkArchive,
  onBulkDelete,
  onExport,
  onMultiSelectChange,
  externalSelectedIds,
}: SidebarProps) {
  const [multiSelectMode, setMultiSelectMode] = React.useState(false);
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(new Set());
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);

  // Sync external selection changes back to internal state
  React.useEffect(() => {
    if (externalSelectedIds && multiSelectMode) {
      const isDifferent = externalSelectedIds.size !== selectedItems.size || 
        Array.from(externalSelectedIds).some(id => !selectedItems.has(id));
      
      if (isDifferent) {
        setSelectedItems(externalSelectedIds);
      }
    }
  }, [externalSelectedIds, multiSelectMode]);

  // Notify parent when multi-select mode changes
  React.useEffect(() => {
    if (onMultiSelectChange) {
      onMultiSelectChange(multiSelectMode, selectedItems);
    }
  }, [multiSelectMode]);

  React.useEffect(() => {
    // Detect if device is mobile/touch
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onSearchChange('');
      e.currentTarget.blur();
    }
  };

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
    // Notify parent immediately
    if (onMultiSelectChange) {
      onMultiSelectChange(multiSelectMode, newSelected);
    }
  };

  const selectAll = () => {
    const newSelected = new Set(items.map(item => item.id));
    setSelectedItems(newSelected);
    // Notify parent immediately
    if (onMultiSelectChange) {
      onMultiSelectChange(multiSelectMode, newSelected);
    }
  };

  const deselectAll = () => {
    const newSelected = new Set<string>();
    setSelectedItems(newSelected);
    // Notify parent immediately
    if (onMultiSelectChange) {
      onMultiSelectChange(multiSelectMode, newSelected);
    }
  };

  const handleBulkPin = () => {
    if (onBulkPin && selectedItems.size > 0) {
      // Check if all selected items are pinned
      const allPinned = Array.from(selectedItems).every(id => 
        items.find(item => item.id === id)?.pinned
      );
      onBulkPin(Array.from(selectedItems), !allPinned);
      setSelectedItems(new Set());
    }
  };

  const handleBulkArchive = () => {
    if (onBulkArchive && selectedItems.size > 0) {
      if (confirm(`Archive ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''}?`)) {
        onBulkArchive(Array.from(selectedItems));
        setSelectedItems(new Set());
      }
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDelete && selectedItems.size > 0) {
      if (confirm(`Move ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} to trash?`)) {
        onBulkDelete(Array.from(selectedItems));
        setSelectedItems(new Set());
      }
    }
  };

  const handleExport = () => {
    if (onExport && selectedItems.size > 0) {
      onExport(Array.from(selectedItems));
    }
  };

  const allSelectedPinned = Array.from(selectedItems).every(id => 
    items.find(item => item.id === id)?.pinned
  );

  return (
    <div
      className={`w-48 glass-strong border-r border-gray-200/50 dark:border-gray-700/50 transform transition-all duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } flex flex-col overflow-hidden fixed lg:relative left-0 z-30 lg:h-full`}
      style={
        isOpen && window.innerWidth < 1024
          ? { top: '56px', bottom: '56px', height: 'auto' }
          : {}
      }
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold truncate">
            {title}
            {totalCount !== undefined && (
              <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                ({totalCount})
              </span>
            )}
          </h2>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onArchiveClick && (
              <IconButton
                icon={Archive}
                onClick={onArchiveClick}
                tooltip="Archive"
                variant="warning"
                size="sm"
              />
            )}
            {onTrashClick && (
              <IconButton
                icon={Trash2}
                onClick={onTrashClick}
                tooltip="Trash"
                variant="danger"
                size="sm"
              />
            )}
            <IconButton
              icon={Plus}
              onClick={onNewClick}
              tooltip="New"
              variant="primary"
              size="sm"
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-1.5 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all hover:scale-110"
              title="Clear search (Esc)"
              type="button"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="p-3 text-center text-gray-500 dark:text-gray-400 text-xs">
            {searchQuery ? 'No results found' : 'No items yet'}
          </div>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            onMouseEnter={() => !multiSelectMode && !isMobile && setHoveredItem(item.id)}
            onMouseLeave={() => !isMobile && setHoveredItem(null)}
            onClick={() => multiSelectMode ? toggleItemSelection(item.id) : onItemClick(item.id)}
            className={`p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative ${
              selectedId === item.id ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-600' : ''
            } ${
              selectedItems.has(item.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              {multiSelectMode && (
                <div className="flex-shrink-0 mt-0.5">
                  {selectedItems.has(item.id) ? (
                    <CheckSquare className="w-4 h-4 text-primary-600" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-xs truncate">{item.title}</h3>
                {item.subtitle && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">
                    {item.subtitle}
                  </p>
                )}
              </div>

              {/* Actions - Show on hover (desktop) or always (mobile) in normal mode only */}
              {!multiSelectMode && (isMobile || hoveredItem === item.id) && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {onPinToggle && (
                    <IconButton
                      icon={Pin}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinToggle(item.id);
                      }}
                      tooltip={item.pinned ? "Unpin" : "Pin"}
                      variant="primary"
                      size="sm"
                      active={item.pinned}
                      className={item.pinned ? 'fill-current' : ''}
                    />
                  )}
                  {onArchive && (
                    <IconButton
                      icon={Archive}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Archive this item?')) {
                          onArchive(item.id);
                        }
                      }}
                      tooltip="Archive"
                      variant="warning"
                      size="sm"
                    />
                  )}
                  {onDelete && (
                    <IconButton
                      icon={Trash2}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Move to trash?')) {
                          onDelete(item.id);
                        }
                      }}
                      tooltip="Delete"
                      variant="danger"
                      size="sm"
                    />
                  )}
                </div>
              )}

              {/* Pin indicator - Only show when pinned AND not hovering */}
              {!multiSelectMode && item.pinned && hoveredItem !== item.id && !isMobile && (
                <Pin className="w-3 h-3 text-primary-600 fill-current flex-shrink-0 mt-0.5" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Multiple Selection Toggle & Bulk Actions */}
      {items.length > 0 && (onBulkPin || onBulkArchive || onBulkDelete) && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex-shrink-0">
          {!multiSelectMode ? (
            <IconButton
              icon={CheckSquare}
              onClick={() => setMultiSelectMode(true)}
              tooltip="Multi-Select"
              variant="default"
              className="w-full py-2"
            />
          ) : (
            <div className="space-y-2">
              {selectedItems.size > 0 && (
                <div className="flex gap-1">
                  {onBulkPin && (
                    <IconButton
                      icon={Pin}
                      onClick={handleBulkPin}
                      tooltip={allSelectedPinned ? "Unpin All" : "Pin All"}
                      variant="primary"
                      className="flex-1 py-1.5"
                    />
                  )}
                  {onBulkArchive && (
                    <IconButton
                      icon={Archive}
                      onClick={handleBulkArchive}
                      tooltip="Archive selected"
                      variant="warning"
                      className="flex-1 py-1.5"
                    />
                  )}
                  {onExport && (
                    <IconButton
                      icon={Download}
                      onClick={handleExport}
                      tooltip="Export selected"
                      variant="success"
                      className="flex-1 py-1.5"
                    />
                  )}
                  {onBulkDelete && (
                    <IconButton
                      icon={Trash2}
                      onClick={handleBulkDelete}
                      tooltip="Delete selected"
                      variant="danger"
                      className="flex-1 py-1.5"
                    />
                  )}
                </div>
              )}
              <div className="flex gap-1">
                <IconButton
                  icon={CheckCheck}
                  onClick={selectAll}
                  tooltip="Select All"
                  variant="default"
                  className="flex-1 py-1.5"
                />
                <IconButton
                  icon={Square}
                  onClick={deselectAll}
                  tooltip="Deselect"
                  variant="default"
                  className="flex-1 py-1.5"
                />
              </div>
              <IconButton
                icon={XCircle}
                onClick={() => {
                  setMultiSelectMode(false);
                  setSelectedItems(new Set());
                }}
                tooltip="Cancel"
                variant="default"
                className="w-full py-1.5"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
