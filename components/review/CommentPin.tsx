"use client"

import * as Tooltip from '@radix-ui/react-tooltip'
import { motion, AnimatePresence } from 'framer-motion'
import React from 'react'

export type ReviewPinStatus = 'open' | 'resolved' | 'reopened'
export type ReviewPinPriority = 'normal' | 'high' | 'critical'

export interface ReviewPin {
  id: string
  thread_id: string
  position_x: number
  position_y: number
  status: ReviewPinStatus
  priority: ReviewPinPriority
  comment_count: number
  root_comment_preview: string
}

interface CommentPinProps {
  pin: ReviewPin
  index: number
  isSelected: boolean
  onClick: (threadId: string) => void
}

function getPinColors(pin: ReviewPin): {
  bg: string
  ring: string
  pulse: boolean
} {
  if (pin.status === 'resolved') {
    return { bg: 'bg-emerald-500', ring: 'ring-emerald-300', pulse: false }
  }
  if (pin.status === 'reopened') {
    return { bg: 'bg-orange-500', ring: 'ring-orange-300', pulse: true }
  }
  // open — color by priority
  switch (pin.priority) {
    case 'critical':
      return { bg: 'bg-red-500', ring: 'ring-red-300', pulse: true }
    case 'high':
      return { bg: 'bg-amber-500', ring: 'ring-amber-300', pulse: true }
    default:
      return { bg: 'bg-blue-500', ring: 'ring-blue-300', pulse: true }
  }
}

export function CommentPin({ pin, index, isSelected, onClick }: CommentPinProps) {
  const { bg, ring, pulse } = getPinColors(pin)
  const preview =
    pin.root_comment_preview.length > 50
      ? pin.root_comment_preview.slice(0, 50) + '…'
      : pin.root_comment_preview

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <motion.button
            onClick={() => onClick(pin.thread_id)}
            style={{
              position: 'absolute',
              left: `${pin.position_x}%`,
              top: `${pin.position_y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: isSelected ? 50 : 10,
            }}
            animate={{
              width: isSelected ? 36 : 28,
              height: isSelected ? 36 : 28,
            }}
            whileHover={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={[
              'flex items-center justify-center rounded-full text-white font-semibold shadow-md select-none cursor-pointer border-2 border-white',
              bg,
              isSelected ? `ring-2 ring-offset-1 ${ring}` : '',
              pulse && !isSelected ? 'animate-pulse' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={`Comment thread ${index} — ${pin.status}`}
          >
            <motion.span
              animate={{ fontSize: isSelected ? '13px' : '11px' }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              style={{ lineHeight: 1, pointerEvents: 'none' }}
            >
              {index}
            </motion.span>

            <AnimatePresence>
              {pin.comment_count > 1 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: '16px',
                    padding: '0 3px',
                    pointerEvents: 'none',
                  }}
                  className="bg-white text-gray-800 border border-gray-200 shadow-sm flex items-center justify-center"
                >
                  {pin.comment_count}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </Tooltip.Trigger>

        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="max-w-[200px] rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg break-words z-[100]"
          >
            {preview || 'No comment text'}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
