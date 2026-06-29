import type { ReactNode } from 'react';

/**
 * Centers the app in a phone-sized frame so it looks like a real mobile app
 * when opened on a desktop browser, while filling the screen on actual phones.
 */
export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-[100dvh] w-full justify-center sm:py-5">
      <div
        className="relative flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-ink-900/70
          sm:min-h-0 sm:h-[calc(100dvh-2.5rem)] sm:rounded-[2.5rem] sm:border sm:border-white/10 sm:shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}
