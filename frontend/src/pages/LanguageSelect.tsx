import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { LANGUAGES } from '../lib/languages';
import { cn } from '../lib/utils';

/**
 * Preferred-language picker: circular flag cards laid out in two staggered
 * columns that flow down the screen. The selected card glows with a checkmark.
 */
export default function LanguageSelect() {
  const navigate = useNavigate();
  const { user, setPreferredLanguage } = useApp();
  const [selected, setSelected] = useState<string>(user?.preferredLanguage || '');

  const confirm = () => {
    if (!selected) return;
    setPreferredLanguage(selected);
    navigate('/home');
  };

  const selectedName = LANGUAGES.find((l) => l.id === selected)?.name;

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="shrink-0 px-6 pb-3 pt-8 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Choose your language</h1>
        <p className="mt-1.5 text-sm text-white/50">
          Pick the language you speak and understand. You can change it anytime.
        </p>
      </div>

      {/* Scrollable grid — all 11 languages, two columns. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 no-scrollbar">
        <div className="mx-auto grid max-w-sm grid-cols-2 gap-x-4 gap-y-4">
          {LANGUAGES.map((lang, i) => {
            const isSelected = selected === lang.id;
            // Gentle downward offset on the right column for a flowing path.
            const offset = i % 2 === 1 ? 'mt-5' : '';
            return (
              <motion.button
                key={lang.id}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04, type: 'spring', damping: 15 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setSelected(lang.id)}
                className={cn('flex flex-col items-center gap-1.5', offset)}
              >
                <div
                  className={cn(
                    'relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-2 bg-ink-700/70 text-3xl transition-all duration-300',
                    isSelected ? 'border-electric shadow-glow' : 'border-white/10 hover:border-white/30',
                  )}
                >
                  <span className="leading-none">{lang.flag}</span>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brandgreen shadow-glow-green"
                    >
                      <Check size={14} strokeWidth={3} />
                    </motion.span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-center text-[13px] font-medium leading-tight transition-colors',
                    isSelected ? 'text-white' : 'text-white/60',
                  )}
                >
                  {lang.name}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Confirm footer — always visible, never overlaps the cards. */}
      <div className="shrink-0 border-t border-white/10 bg-ink-900/80 px-5 pb-5 pt-3 backdrop-blur-xl">
        {selectedName && (
          <p className="mb-2 text-center text-xs text-white/50">
            Selected: <span className="font-semibold text-white">{selectedName}</span>
          </p>
        )}
        <button onClick={confirm} disabled={!selected} className="btn-primary w-full">
          Continue <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
