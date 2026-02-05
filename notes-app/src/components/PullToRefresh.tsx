import { useState, useEffect, useRef, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  enabled: boolean;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, enabled, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const PULL_THRESHOLD = 80; // Distance to trigger refresh
  const MAX_PULL = 120; // Maximum pull distance

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    let touchStartY = 0;
    let scrollTop = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;
      
      scrollTop = container.scrollTop;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY;

      // Only trigger if at top of scroll and pulling down
      if (scrollTop <= 0 && diff > 0) {
        e.preventDefault();
        const distance = Math.min(diff * 0.5, MAX_PULL); // Damping effect
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (isRefreshing) return;

      if (pullDistance >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(PULL_THRESHOLD);
        
        try {
          await onRefresh();
        } catch (error) {
          console.error('Refresh error:', error);
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 500);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, isRefreshing, pullDistance, onRefresh]);

  const rotation = (pullDistance / PULL_THRESHOLD) * 360;
  const opacity = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto">
      {/* Pull indicator */}
      {enabled && pullDistance > 0 && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
          style={{
            height: `${pullDistance}px`,
            opacity: opacity,
            transition: isRefreshing ? 'all 0.3s ease' : 'none',
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg">
            <RefreshCw
              className={`w-6 h-6 text-primary-600 ${isRefreshing ? 'animate-spin' : ''}`}
              style={{
                transform: isRefreshing ? 'none' : `rotate(${rotation}deg)`,
                transition: isRefreshing ? 'none' : 'transform 0.1s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.3s ease' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
