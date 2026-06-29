import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Where the back button goes. Defaults to browser back. */
  backTo?: string;
  right?: ReactNode;
}

/** Sticky top bar with a back button used by every inner page. */
export function PageHeader({ title, subtitle, backTo, right }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-ink-900/80 px-4 py-3 backdrop-blur-xl">
      <button
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        className="rounded-full p-2 text-white/80 transition hover:bg-white/10"
        aria-label="Back"
      >
        <ChevronLeft size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
        {subtitle && <p className="truncate text-xs text-white/50">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
