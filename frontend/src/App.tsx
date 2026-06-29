import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useApp } from './context/AppContext';
import { MobileShell } from './components/ui/MobileShell';

import Welcome from './pages/Welcome';
import Onboarding from './pages/Onboarding';
import LanguageSelect from './pages/LanguageSelect';
import Home from './pages/Home';
import Translate from './pages/Translate';
import History from './pages/History';
import Settings from './pages/Settings';
import ChatsList from './pages/chats/ChatsList';
import ChatScreen from './pages/chats/ChatScreen';
import PreMeeting from './pages/meeting/PreMeeting';
import MeetingRoom from './pages/meeting/MeetingRoom';

/** Wraps a page with a subtle enter/exit transition. */
function Transition({ children }: { children: ReactElement }) {
  return (
    <motion.div
      className="flex min-h-full flex-1 flex-col"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Redirects to onboarding when signed out, and to language select when no language chosen. */
function RequireUser({ children, needLanguage = true }: { children: ReactElement; needLanguage?: boolean }) {
  const { user, ready } = useApp();
  if (!ready) return null;
  if (!user) return <Navigate to="/onboarding" replace />;
  if (needLanguage && !user.preferredLanguage) return <Navigate to="/language" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const { ready } = useApp();

  if (!ready) {
    return (
      <MobileShell>
        <div className="flex flex-1 items-center justify-center">
          <span className="bg-brand-gradient bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
            ASSISTRAN
          </span>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Transition><Welcome /></Transition>} />
          <Route path="/onboarding" element={<Transition><Onboarding /></Transition>} />
          <Route
            path="/language"
            element={
              <RequireUser needLanguage={false}>
                <Transition><LanguageSelect /></Transition>
              </RequireUser>
            }
          />
          <Route path="/home" element={<RequireUser><Transition><Home /></Transition></RequireUser>} />
          <Route path="/translate" element={<RequireUser><Transition><Translate /></Transition></RequireUser>} />
          <Route path="/history" element={<RequireUser><Transition><History /></Transition></RequireUser>} />
          <Route path="/settings" element={<RequireUser><Transition><Settings /></Transition></RequireUser>} />
          <Route path="/chats" element={<RequireUser><Transition><ChatsList /></Transition></RequireUser>} />
          <Route path="/chats/:username" element={<RequireUser><Transition><ChatScreen /></Transition></RequireUser>} />
          <Route path="/meeting/:code/setup" element={<RequireUser><Transition><PreMeeting /></Transition></RequireUser>} />
          <Route path="/meeting/:code/room" element={<RequireUser><Transition><MeetingRoom /></Transition></RequireUser>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </MobileShell>
  );
}
