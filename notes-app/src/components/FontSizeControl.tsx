import { useState, useEffect } from 'react';
import { Type } from 'lucide-react';

const FONT_SIZES = [
  { value: 'small', label: 'Small', size: '0.75rem', example: 'text-xs' },
  { value: 'medium', label: 'Medium', size: '0.875rem', example: 'text-sm' },
  { value: 'large', label: 'Large', size: '1rem', example: 'text-base' },
];

export function FontSizeControl() {
  const [selectedSize, setSelectedSize] = useState('medium');

  useEffect(() => {
    // Load saved font size
    const saved = localStorage.getItem('notes-app-font-size');
    if (saved) {
      setSelectedSize(saved);
      applyFontSize(saved);
    }
  }, []);

  const applyFontSize = (size: string) => {
    // Apply font size class to document root
    document.documentElement.setAttribute('data-font-size', size);
  };

  const handleSizeChange = (size: string) => {
    setSelectedSize(size);
    localStorage.setItem('notes-app-font-size', size);
    applyFontSize(size);
  };

  const currentIndex = FONT_SIZES.findIndex(s => s.value === selectedSize);

  return (
    <div className="space-y-6">
      {/* Interactive Slider */}
      <div className="relative px-2">
        {/* Labels */}
        <div className="flex justify-between mb-2">
          {FONT_SIZES.map((size) => (
            <button
              key={size.value}
              onClick={() => handleSizeChange(size.value)}
              className={`text-xs font-medium transition-colors ${
                selectedSize === size.value
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>

        {/* Slider Track */}
        <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
          {/* Active Track */}
          <div
            className="absolute h-2 bg-primary-600 rounded-full transition-all duration-300"
            style={{
              width: `${(currentIndex / (FONT_SIZES.length - 1)) * 100}%`,
            }}
          />
          
          {/* Slider Dots */}
          <div className="absolute inset-0 flex justify-between items-center px-0">
            {FONT_SIZES.map((size) => (
              <button
                key={size.value}
                onClick={() => handleSizeChange(size.value)}
                className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${
                  selectedSize === size.value
                    ? 'bg-primary-600 border-primary-600 scale-125 shadow-lg'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:scale-110'
                }`}
                style={{
                  transform: selectedSize === size.value ? 'scale(1.25)' : 'scale(1)',
                }}
              >
                {selectedSize === size.value && (
                  <div className="w-2 h-2 bg-white rounded-full mx-auto" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Size Icons */}
        <div className="flex justify-between mt-3">
          <Type className="w-3 h-3 text-gray-400" />
          <Type className="w-4 h-4 text-gray-400" />
          <Type className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Live Preview */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Live Preview
          </span>
        </div>
        
        <div className={`space-y-2 ${
          selectedSize === 'small' ? 'text-xs' :
          selectedSize === 'large' ? 'text-base' :
          'text-sm'
        }`}>
          <h4 className="font-semibold">Sample Note Title</h4>
          <p className="text-gray-600 dark:text-gray-400">
            This is how your notes, lists, and events will appear with the selected font size. 
            The quick brown fox jumps over the lazy dog.
          </p>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              Sample Tag
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="w-1 h-1 rounded-full bg-blue-600 mt-1.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Font size applies to content in Notes, Lists, and Events. Sidebar and navigation remain unchanged.
        </p>
      </div>
    </div>
  );
}
