import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { LANGUAGES, getLanguage } from '../../lib/languages';
import { cn } from '../../lib/utils';

interface LanguageDropdownProps {
  value: string;
  onChange: (langId: string) => void;
  /** Visual size of the trigger. */
  compact?: boolean;
  className?: string;
}

/** A flag + language picker used across home, settings, translate and meetings. */
export function LanguageDropdown({ value, onChange, compact, className }: LanguageDropdownProps) {
  const [open, setOpen] = useState(false);
  const current = getLanguage(value);

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 rounded-full border border-white/10 bg-ink-700/70 transition active:scale-95',
          compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5',
        )}
      >
        <span className="text-lg leading-none">{current.flag}</span>
        <span className="font-medium">{current.short}</span>
        <ChevronDown size={16} className={cn('text-white/50 transition', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.ul
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="glass absolute right-0 z-40 mt-2 max-h-72 w-56 overflow-y-auto rounded-2xl p-1.5 no-scrollbar"
            >
              {LANGUAGES.map((lang) => {
                const selected = lang.id === value;
                return (
                  <li key={lang.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(lang.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10',
                        selected && 'bg-white/10',
                      )}
                    >
                      <span className="text-xl leading-none">{lang.flag}</span>
                      <span className="flex-1 text-sm font-medium">{lang.name}</span>
                      {selected && <Check size={16} className="text-brandgreen" />}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
