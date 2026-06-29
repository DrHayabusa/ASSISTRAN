import { initials } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface AvatarProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
};

/** Circular avatar showing a person's initials over a brand-tinted gradient. */
export function Avatar({ name, color = '#3b82f6', size = 'md', online, className }: AvatarProps) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-semibold text-white shadow-inner',
          SIZES[size],
        )}
        style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
      >
        {initials(name)}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-ink-900',
            online ? 'bg-brandgreen' : 'bg-white/30',
          )}
        />
      )}
    </div>
  );
}
