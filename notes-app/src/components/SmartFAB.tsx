import { useState } from 'react';
import { Plus, FileText, CheckSquare, Calendar, X } from 'lucide-react';

interface SmartFABProps {
  onCreateNote: () => void;
  onCreateList: () => void;
  onCreateEvent: () => void;
  currentPage?: 'notes' | 'lists' | 'events';
  isVisible?: boolean;
}

export function SmartFAB({ onCreateNote, onCreateList, onCreateEvent, currentPage, isVisible = true }: SmartFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleFAB = () => {
    setIsOpen(!isOpen);
  };

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 right-6 lg:bottom-6 lg:right-6 z-50">
      {/* Mini FABs - Appear when expanded */}
      <div className={`absolute bottom-16 right-0 flex flex-col gap-3 transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        {/* Notes Button */}
        <div className="flex items-center gap-3 group">
          <span className={`px-3 py-1.5 text-white text-sm font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap backdrop-blur-lg bg-transparent border border-white/30 ${
            currentPage === 'notes' ? 'opacity-100' : ''
          }`}
          style={{
            boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 10px 30px rgba(0, 0, 0, 0.3)'
          }}>
            New Note
          </span>
          <button
            onClick={() => handleAction(onCreateNote)}
            className={`w-12 h-12 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center backdrop-blur-lg bg-transparent border border-white/30 ${
              currentPage === 'notes'
                ? 'hover:bg-blue-500/20 scale-110 ring-2 ring-blue-400/60'
                : 'hover:bg-blue-500/20'
            } ${isOpen ? 'scale-100' : 'scale-0'}`}
            style={{ 
              transitionDelay: isOpen ? '50ms' : '0ms',
              boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 10px 30px rgba(59, 130, 246, 0.5)'
            }}
          >
            <FileText className="w-5 h-5 text-blue-400 drop-shadow-[0_2px_8px_rgba(59,130,246,0.8)]" />
          </button>
        </div>

        {/* Lists Button */}
        <div className="flex items-center gap-3 group">
          <span className={`px-3 py-1.5 text-white text-sm font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap backdrop-blur-lg bg-transparent border border-white/30 ${
            currentPage === 'lists' ? 'opacity-100' : ''
          }`}
          style={{
            boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 10px 30px rgba(0, 0, 0, 0.3)'
          }}>
            New List
          </span>
          <button
            onClick={() => handleAction(onCreateList)}
            className={`w-12 h-12 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center backdrop-blur-lg bg-transparent border border-white/30 ${
              currentPage === 'lists'
                ? 'hover:bg-purple-500/20 scale-110 ring-2 ring-purple-400/60'
                : 'hover:bg-purple-500/20'
            } ${isOpen ? 'scale-100' : 'scale-0'}`}
            style={{ 
              transitionDelay: isOpen ? '100ms' : '0ms',
              boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 10px 30px rgba(168, 85, 247, 0.5)'
            }}
          >
            <CheckSquare className="w-5 h-5 text-purple-400 drop-shadow-[0_2px_8px_rgba(168,85,247,0.8)]" />
          </button>
        </div>

        {/* Events Button */}
        <div className="flex items-center gap-3 group">
          <span className={`px-3 py-1.5 text-white text-sm font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap backdrop-blur-lg bg-transparent border border-white/30 ${
            currentPage === 'events' ? 'opacity-100' : ''
          }`}
          style={{
            boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 10px 30px rgba(0, 0, 0, 0.3)'
          }}>
            New Timeline
          </span>
          <button
            onClick={() => handleAction(onCreateEvent)}
            className={`w-12 h-12 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center backdrop-blur-lg bg-transparent border border-white/30 ${
              currentPage === 'events'
                ? 'hover:bg-green-500/20 scale-110 ring-2 ring-green-400/60'
                : 'hover:bg-green-500/20'
            } ${isOpen ? 'scale-100' : 'scale-0'}`}
            style={{ 
              transitionDelay: isOpen ? '150ms' : '0ms',
              boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 10px 30px rgba(34, 197, 94, 0.5)'
            }}
          >
            <Calendar className="w-5 h-5 text-green-400 drop-shadow-[0_2px_8px_rgba(34,197,94,0.8)]" />
          </button>
        </div>
      </div>

      {/* Main FAB */}
      <button
        onClick={toggleFAB}
        className={`w-14 h-14 rounded-full backdrop-blur-lg bg-transparent hover:bg-primary-500/20 shadow-2xl transition-all duration-300 flex items-center justify-center group border border-white/30 ${
          isOpen ? 'rotate-45 scale-110' : 'rotate-0 scale-100'
        }`}
        style={{
          boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 15px 40px rgba(59, 130, 246, 0.6)'
        }}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-primary-400 transition-transform duration-300 drop-shadow-[0_2px_10px_rgba(59,130,246,0.9)]" />
        ) : (
          <Plus className="w-6 h-6 text-primary-400 transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_2px_10px_rgba(59,130,246,0.9)]" />
        )}
      </button>

      {/* Backdrop overlay when open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
