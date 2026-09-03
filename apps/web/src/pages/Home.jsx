import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useChatStore } from '@/stores/chatStore'
import { TopNav } from '@/components/layout/TopNav'
import { LandingView } from '@/components/chat/LandingView'
import { ChatWorkspace } from '@/components/chat/ChatWorkspace'

/*
 * Home (/) — dual-mode shell, no navigation on mode change:
 *  landing → TopNav + hero composer + recent designs
 *  active  → conversations sidebar + chat thread + compact composer
 */
export const Home = () => {
  const mode = useChatStore((s) => s.mode)

  return (
    <AnimatePresence mode="wait">
      {mode === 'active' ? (
        <motion.div
          key="workspace"
          className="h-screen"
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <ChatWorkspace />
        </motion.div>
      ) : (
        <motion.div
          key="landing"
          className="h-screen relative overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <main className="h-full overflow-y-auto">
            <LandingView />
          </main>
          {/* Overlay nav so the hero topography passes behind the glass bar */}
          <TopNav className="absolute top-0 inset-x-0" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
