import { useState, useEffect } from 'react';
import { Tag, Edit2, Trash2, X, Check, Eye, EyeOff, ChevronDown } from 'lucide-react';

interface TagStats {
  name: string;
  count: number;
}

interface GroupedTags {
  [key: string]: TagStats[];
}

export function TagManagement() {
  const [allTags, setAllTags] = useState<TagStats[]>([]);
  const [groupedTags, setGroupedTags] = useState<GroupedTags>({});
  const [showTagsInCards, setShowTagsInCards] = useState(true);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [error, setError] = useState('');
  const [expandedLetter, setExpandedLetter] = useState<string | null>(null);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const allLetters = [...alphabet, '#']; // # for numbers and symbols

  useEffect(() => {
    loadTags();
    loadSettings();
  }, []);

  const loadSettings = () => {
    const settings = localStorage.getItem('notes-app-tag-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      setShowTagsInCards(parsed.showTagsInCards ?? true);
    }
  };

  const saveSettings = (showTags: boolean) => {
    localStorage.setItem('notes-app-tag-settings', JSON.stringify({
      showTagsInCards: showTags
    }));
  };

  const loadTags = () => {
    // Get all tags from notes, lists, and events
    const notes = JSON.parse(localStorage.getItem('notes-app-notes') || '[]');
    const lists = JSON.parse(localStorage.getItem('notes-app-lists') || '[]');
    const events = JSON.parse(localStorage.getItem('notes-app-events') || '[]');

    const tagCounts = new Map<string, number>();

    // Count tags from notes
    notes.forEach((note: any) => {
      if (note.tags && !note.deleted && !note.archived) {
        note.tags.forEach((tag: string) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    // Count tags from lists
    lists.forEach((list: any) => {
      if (list.tags && !list.deleted && !list.archived) {
        list.tags.forEach((tag: string) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    // Count tags from events
    events.forEach((event: any) => {
      if (event.tags && !event.deleted && !event.archived) {
        event.tags.forEach((tag: string) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    // Convert to array and sort alphabetically
    const tagStats: TagStats[] = Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    setAllTags(tagStats);

    // Group tags by first letter
    const grouped: GroupedTags = {};
    tagStats.forEach(tag => {
      const firstChar = tag.name[0].toUpperCase();
      const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!grouped[letter]) {
        grouped[letter] = [];
      }
      grouped[letter].push(tag);
    });

    setGroupedTags(grouped);
  };

  const handleToggleVisibility = () => {
    const newValue = !showTagsInCards;
    setShowTagsInCards(newValue);
    saveSettings(newValue);
    // Trigger a page reload to apply changes
    window.dispatchEvent(new Event('tag-visibility-changed'));
  };

  const handleToggleLetter = (letter: string) => {
    // If clicking the same letter, close it. Otherwise, open the new one (auto-closes previous)
    setExpandedLetter(expandedLetter === letter ? null : letter);
  };

  const handleStartEdit = (tagName: string) => {
    setEditingTag(tagName);
    setNewTagName(tagName);
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setNewTagName('');
    setError('');
  };

  const handleRenameTag = () => {
    if (!editingTag) return;

    const trimmedName = newTagName.trim();
    
    if (!trimmedName) {
      setError('Tag name cannot be empty');
      return;
    }

    if (trimmedName === editingTag) {
      handleCancelEdit();
      return;
    }

    // Check if new name already exists
    if (allTags.some(t => t.name.toLowerCase() === trimmedName.toLowerCase() && t.name !== editingTag)) {
      setError('A tag with this name already exists');
      return;
    }

    // Rename tag in all data sources
    renameTagInStorage('notes-app-notes', editingTag, trimmedName);
    renameTagInStorage('notes-app-lists', editingTag, trimmedName);
    renameTagInStorage('notes-app-events', editingTag, trimmedName);

    loadTags();
    handleCancelEdit();
  };

  const renameTagInStorage = (storageKey: string, oldName: string, newName: string) => {
    const data = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const updated = data.map((item: any) => {
      if (item.tags && item.tags.includes(oldName)) {
        return {
          ...item,
          tags: item.tags.map((tag: string) => tag === oldName ? newName : tag)
        };
      }
      return item;
    });
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleDeleteTag = (tagName: string) => {
    if (!confirm(`Delete tag "${tagName}"? This will remove it from all items.`)) {
      return;
    }

    // Remove tag from all data sources
    deleteTagFromStorage('notes-app-notes', tagName);
    deleteTagFromStorage('notes-app-lists', tagName);
    deleteTagFromStorage('notes-app-events', tagName);

    loadTags();
  };

  const deleteTagFromStorage = (storageKey: string, tagName: string) => {
    const data = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const updated = data.map((item: any) => {
      if (item.tags && item.tags.includes(tagName)) {
        return {
          ...item,
          tags: item.tags.filter((tag: string) => tag !== tagName)
        };
      }
      return item;
    });
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Tag Management</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage your tags across all sections
          </p>
        </div>
        <Tag className="w-6 h-6 text-primary-600" />
      </div>

      {/* Toggle Tag Visibility */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showTagsInCards ? (
              <Eye className="w-5 h-5 text-primary-600" />
            ) : (
              <EyeOff className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <p className="font-medium">Show Tags in Cards</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Display tag pills on notes, lists, and events
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleVisibility}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showTagsInCards ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showTagsInCards ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Alphabetical Index */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">
            All Tags ({allTags.length})
          </h4>
        </div>

        {allTags.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No tags yet. Add tags to your notes, lists, or events.</p>
          </div>
        ) : (
          <>
            {/* Alphabet Buttons */}
            <div className="flex flex-wrap gap-1 mb-4">
              {allLetters.map((letter) => {
                const hasTagsForLetter = groupedTags[letter] && groupedTags[letter].length > 0;
                return (
                  <button
                    key={letter}
                    onClick={() => hasTagsForLetter && handleToggleLetter(letter)}
                    disabled={!hasTagsForLetter}
                    className={`w-8 h-8 rounded text-sm font-medium transition-all ${
                      hasTagsForLetter
                        ? expandedLetter === letter
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {/* Expanded Letter Section */}
            {expandedLetter && groupedTags[expandedLetter] && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2 mb-3 text-primary-600 dark:text-primary-400">
                  <ChevronDown className="w-5 h-5" />
                  <h5 className="font-semibold text-lg">
                    {expandedLetter} ({groupedTags[expandedLetter].length} {groupedTags[expandedLetter].length === 1 ? 'tag' : 'tags'})
                  </h5>
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto pl-2">
                  {groupedTags[expandedLetter].map((tag) => (
                    <div
                      key={tag.name}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                    >
                      {editingTag === tag.name ? (
                        <>
                          <div className="flex-1 mr-3">
                            <input
                              type="text"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleRenameTag();
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              className="input-field w-full"
                              autoFocus
                            />
                            {error && (
                              <p className="text-xs text-red-600 mt-1">{error}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleRenameTag}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-2 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 flex-1">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium">
                              {tag.name}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {tag.count} {tag.count === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStartEdit(tag.name)}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Rename tag"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag.name)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete tag"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
