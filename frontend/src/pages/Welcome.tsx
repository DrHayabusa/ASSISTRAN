import { motion } from 'framer-motion';
import { ArrowRight, Languages } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

/** Splash / welcome screen with an animated logo reveal and tagline. */
export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useApp();

  // Where "Continue" (and the auto-advance) should go.
  const next = () => {
    if (user) navigate(user.preferredLanguage ? '/home' : '/language');
    else navigate('/onboarding');
  };

  // Auto-advance after a few seconds.
  useEffect(() => {
    const t = setTimeout(next, 3800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
      <motion.div
        className="absolute -z-0 h-72 w-72 rounded-full bg-electric/20 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 12, stiffness: 120, delay: 0.1 }}
        className="relative mb-7 flex h-24 w-24 items-center justify-center rounded-[1.8rem] bg-brand-gradient shadow-glow"
      >
        <Languages size={48} className="text-white" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="bg-gradient-to-r from-white via-white to-electric-light bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
      >
        ASSISTRAN
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="mt-3 text-base font-medium text-white/60"
      >
        Speak. Translate. Connect.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.5 }}
        onClick={next}
        className="btn-primary absolute bottom-12 w-[calc(100%-4rem)]"
      >
        Continue <ArrowRight size={18} />
      </motion.button>
    </div>
  );
}
