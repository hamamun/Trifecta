import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  tooltip?: string;
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

const variantStyles = {
  default: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 hover:backdrop-blur-sm',
  primary: 'text-blue-500 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 hover:backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/20',
  success: 'text-green-500 dark:text-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/20 hover:backdrop-blur-sm hover:shadow-lg hover:shadow-green-500/20',
  danger: 'text-red-500 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 hover:backdrop-blur-sm hover:shadow-lg hover:shadow-red-500/20',
  warning: 'text-amber-500 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 hover:backdrop-blur-sm hover:shadow-lg hover:shadow-amber-500/20',
  info: 'text-purple-500 dark:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 hover:backdrop-blur-sm hover:shadow-lg hover:shadow-purple-500/20',
};

const sizeStyles = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-3',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function IconButton({
  icon: Icon,
  tooltip,
  variant = 'default',
  size = 'md',
  active = false,
  className = '',
  ...props
}: IconButtonProps) {
  const isFullWidth = className.includes('w-full');
  
  return (
    <button
      className={`
        relative rounded-xl transition-all duration-300 glow-on-hover
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${active ? 'bg-gray-100/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-lg' : ''}
        ${isFullWidth ? 'flex items-center justify-center gap-2' : ''}
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title={tooltip}
      {...props}
    >
      <Icon className={iconSizes[size]} />
      {tooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-semibold text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 shadow-xl">
          {tooltip}
        </span>
      )}
    </button>
  );
}
