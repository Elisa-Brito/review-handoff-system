"use client"

import { useEffect, useRef, useState } from "react"
import TextareaAutosize from "react-textarea-autosize"

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "#22c55e" },
  { value: "normal", label: "Normal", color: "#3b82f6" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "critical", label: "Critical", color: "#ef4444" },
] as const

type Priority = (typeof PRIORITY_OPTIONS)[number]["value"]

const MAX_CHARS = 10_000
const MODAL_WIDTH = 280
const MODAL_APPROX_HEIGHT = 260
const ARROW_SIZE = 8
const VIEWPORT_PADDING = 12

interface CommentModalProps {
  position: { x: number; y: number }
  onSubmit: (content: string, priority: string) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function CommentModal({
  position,
  onSubmit,
  onCancel,
  isSubmitting,
}: CommentModalProps) {
  const [content, setContent] = useState("")
  const [priority, setPriority] = useState<Priority>("normal")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Compute clamped position so the modal stays within viewport
  const left = clamp(
    position.x - MODAL_WIDTH / 2,
    VIEWPORT_PADDING,
    window.innerWidth - MODAL_WIDTH - VIEWPORT_PADDING
  )
  const top = clamp(
    position.y + ARROW_SIZE + 4,
    VIEWPORT_PADDING,
    window.innerHeight - MODAL_APPROX_HEIGHT - VIEWPORT_PADDING
  )

  // Arrow horizontal offset relative to modal left edge
  const arrowLeft = clamp(
    position.x - left,
    ARROW_SIZE + 4,
    MODAL_WIDTH - ARROW_SIZE - 4
  )

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Keyboard handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onCancel])

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  async function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed || isSubmitting) return
    await onSubmit(trimmed, priority)
  }

  const remaining = MAX_CHARS - content.length
  const isOverLimit = remaining < 0
  const canSubmit = content.trim().length > 0 && !isOverLimit && !isSubmitting

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}
    >
      {/* Arrow */}
      <div
        style={{
          position: "absolute",
          left: left + arrowLeft - ARROW_SIZE,
          top: top - ARROW_SIZE * 2 + 2,
          width: 0,
          height: 0,
          borderLeft: `${ARROW_SIZE}px solid transparent`,
          borderRight: `${ARROW_SIZE}px solid transparent`,
          borderBottom: `${ARROW_SIZE * 2}px solid white`,
          filter: "drop-shadow(0 -1px 1px rgba(0,0,0,0.08))",
          pointerEvents: "none",
        }}
      />

      {/* Modal card */}
      <div
        ref={modalRef}
        style={{
          position: "absolute",
          left,
          top,
          width: MODAL_WIDTH,
          pointerEvents: "all",
        }}
        className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
      >
        {/* Priority selector */}
        <div className="flex items-center gap-1 px-3 pt-3 pb-2">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              disabled={isSubmitting}
              title={opt.label}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                background:
                  priority === opt.value
                    ? opt.color + "18"
                    : "transparent",
                color: priority === opt.value ? opt.color : "#6b7280",
                border: priority === opt.value
                  ? `1.5px solid ${opt.color}`
                  : "1.5px solid transparent",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: opt.color,
                  flexShrink: 0,
                }}
              />
              {opt.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 mx-3" />

        {/* Textarea */}
        <div className="px-3 pt-2 pb-1">
          <TextareaAutosize
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            disabled={isSubmitting}
            placeholder="Add a comment… (Enter to submit)"
            maxLength={MAX_CHARS + 1}
            minRows={3}
            maxRows={8}
            className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent leading-relaxed"
            style={{ fontFamily: "inherit" }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 pb-3">
          <span
            className="text-xs tabular-nums"
            style={{ color: isOverLimit ? "#ef4444" : "#9ca3af" }}
          >
            {isOverLimit
              ? `${Math.abs(remaining)} over limit`
              : remaining < 500
              ? `${remaining} left`
              : null}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-40"
              style={{
                background: canSubmit
                  ? PRIORITY_OPTIONS.find((o) => o.value === priority)!.color
                  : "#9ca3af",
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <svg
                    className="animate-spin"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Saving
                </span>
              ) : (
                "Comment"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
