"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Filter, History, MessageSquare, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export type ProjectRole = "owner" | "editor" | "viewer"

interface ReviewToolbarProps {
  projectId: string
  screenId: string
  openCount: number
  onToggle: () => void
  isActive: boolean
  userRole: ProjectRole
}

export function ReviewToolbar({
  projectId,
  screenId,
  openCount,
  onToggle,
  isActive,
  userRole,
}: ReviewToolbarProps) {
  const canComment = userRole !== "viewer"

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="expanded-actions"
            initial={{ opacity: 0, x: 16, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 16, scale: 0.92 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center gap-1 rounded-full bg-white px-2 py-1.5 shadow-lg ring-1 ring-black/5"
          >
            {canComment && (
              <motion.button
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04, duration: 0.14, ease: "easeOut" }}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
                aria-label="Add comment"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Comment
              </motion.button>
            )}

            <motion.button
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: canComment ? 0.08 : 0.04, duration: 0.14, ease: "easeOut" }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
              aria-label="Filter comments"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: canComment ? 0.12 : 0.08, duration: 0.14, ease: "easeOut" }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
              aria-label="View history"
            >
              <History className="h-3.5 w-3.5" />
              History
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={onToggle}
        whileTap={{ scale: 0.93 }}
        transition={{ duration: 0.1 }}
        aria-pressed={isActive}
        aria-label={isActive ? "Deactivate review mode" : "Activate review mode"}
        className={cn(
          "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          isActive
            ? "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500"
            : "bg-white text-neutral-700 ring-1 ring-black/5 hover:bg-neutral-50 focus-visible:ring-blue-400"
        )}
      >
        <MessageSquare
          className={cn(
            "h-4 w-4 transition-colors duration-150",
            isActive ? "text-white" : "text-neutral-500"
          )}
        />
        Review
        <AnimatePresence>
          {openCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className={cn(
                "absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                isActive
                  ? "bg-white text-blue-600"
                  : "bg-blue-600 text-white"
              )}
            >
              {openCount > 99 ? "99+" : openCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
