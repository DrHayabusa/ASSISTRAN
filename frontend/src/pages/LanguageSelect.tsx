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

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pb-4 pt-10 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Choose your language</h1>
        <p className="mt-2 text-sm text-white/50">
          Pick the language you speak and understand. You can change it anytime.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8">
          {LANGUAGES.map((lang, i) => {
            const isSelected = selected === lang.id;
            // Offset the right column downward to create a flowing, staggered path.
            const offset = i % 2 === 1 ? 'mt-8' : '';
            return (
              <motion.button
                key={lang.id}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', damping: 14 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setSelected(lang.id)}
                className={cn('flex flex-col items-center gap-2', offset)}
              >
                <div
                  className={cn(
                    'relative flex h-24 w-24 items-center justify-center rounded-full border-2 bg-ink-700/70 text-4xl transition-all duration-300',
                    isSelected
                      ? 'border-electric shadow-glow'
                      : 'border-white/10 hover:border-white/30',
                  )}
                >
                  <span className="leading-none">{lang.flag}</span>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-brandgreen shadow-glow-green"
                    >
                      <Check size={16} strokeWidth={3} />
                    </motion.span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-center text-sm font-medium transition-colors',
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

      {/* Sticky confirm button */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900 via-ink-900/90 to-transparent p-6 pt-10">
        <button onClick={confirm} disabled={!selected} className="btn-primary w-full">
          Continue <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
