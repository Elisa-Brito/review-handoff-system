"use client"

import { useState } from "react"
import { ChevronRight, ExternalLink, GitBranch, User, Clock, Circle } from "lucide-react"

export type Environment = "production" | "preview" | "staging"
export type DeploymentStatus = "ready" | "building" | "error" | "canceled"

export interface Deployment {
  id: string
  version: string
  environment: Environment
  status: DeploymentStatus
  commitSha: string
  branch: string
  deployedBy: string
  deployedAt: Date
  url: string
}

interface VersionHistoryProps {
  deployments: Deployment[]
  currentDeploymentId?: string
  projectId: string
  onVersionSelect: (deploymentId: string) => void
}

const environmentConfig: Record<Environment, { label: string; className: string }> = {
  production: {
    label: "Production",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  preview: {
    label: "Preview",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  staging: {
    label: "Staging",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
}

const statusConfig: Record<DeploymentStatus, { label: string; className: string; dotClass: string }> = {
  ready: {
    label: "Ready",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  building: {
    label: "Building",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
    dotClass: "bg-blue-500 animate-pulse",
  },
  error: {
    label: "Error",
    className: "bg-red-50 text-red-700 border border-red-200",
    dotClass: "bg-red-500",
  },
  canceled: {
    label: "Canceled",
    className: "bg-zinc-50 text-zinc-500 border border-zinc-200",
    dotClass: "bg-zinc-400",
  },
}

const environmentLineColor: Record<Environment, string> = {
  production: "bg-emerald-400",
  preview: "bg-blue-400",
  staging: "bg-amber-400",
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function shortSha(sha: string): string {
  return sha.slice(0, 7)
}

const ALL_ENV = "all"

export default function VersionHistory({
  deployments,
  currentDeploymentId,
  projectId: _projectId,
  onVersionSelect,
}: VersionHistoryProps) {
  const [selectedEnv, setSelectedEnv] = useState<Environment | typeof ALL_ENV>(ALL_ENV)

  const environments: Array<Environment | typeof ALL_ENV> = [ALL_ENV, "production", "preview", "staging"]

  const filtered =
    selectedEnv === ALL_ENV ? deployments : deployments.filter((d) => d.environment === selectedEnv)

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">Version History</h2>
        <p className="text-xs text-zinc-400 mt-0.5">{deployments.length} deployment{deployments.length !== 1 ? "s" : ""}</p>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-3">
          {environments.map((env) => {
            const isActive = selectedEnv === env
            const envCfg = env !== ALL_ENV ? environmentConfig[env] : null
            return (
              <button
                key={env}
                onClick={() => setSelectedEnv(env)}
                className={[
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  isActive
                    ? env === ALL_ENV
                      ? "bg-zinc-900 text-white"
                      : envCfg?.className.replace("bg-", "bg-").replace("border", "ring-0 border-0") +
                        " font-semibold"
                    : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
              >
                {env === ALL_ENV ? "All" : environmentConfig[env].label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
              <Circle className="w-5 h-5 text-zinc-300" />
            </div>
            <p className="text-sm font-medium text-zinc-500">No deployments found</p>
            <p className="text-xs text-zinc-400 mt-1">
              {selectedEnv !== ALL_ENV
                ? `No ${environmentConfig[selectedEnv].label.toLowerCase()} deployments yet`
                : "No deployments for this project"}
            </p>
          </div>
        ) : (
          <ul className="py-2">
            {filtered.map((deployment, index) => {
              const isCurrent = deployment.id === currentDeploymentId
              const isLast = index === filtered.length - 1
              const envCfg = environmentConfig[deployment.environment]
              const statusCfg = statusConfig[deployment.status]
              const lineColor = environmentLineColor[deployment.environment]

              return (
                <li key={deployment.id} className="relative">
                  {/* Timeline vertical line */}
                  {!isLast && (
                    <div
                      className={`absolute left-[27px] top-10 bottom-0 w-0.5 ${lineColor} opacity-20`}
                    />
                  )}

                  <button
                    onClick={() => onVersionSelect(deployment.id)}
                    className={[
                      "w-full text-left px-4 py-3 flex items-start gap-3 transition-all group",
                      isCurrent
                        ? "bg-zinc-50 hover:bg-zinc-100"
                        : "hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    {/* Timeline dot */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <div
                        className={[
                          "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all",
                          isCurrent
                            ? "border-zinc-900 bg-zinc-900"
                            : deployment.environment === "production"
                            ? "border-emerald-400 bg-white group-hover:bg-emerald-50"
                            : deployment.environment === "preview"
                            ? "border-blue-400 bg-white group-hover:bg-blue-50"
                            : "border-amber-400 bg-white group-hover:bg-amber-50",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "w-2 h-2 rounded-full",
                            isCurrent
                              ? "bg-white"
                              : statusCfg.dotClass,
                          ].join(" ")}
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-zinc-900 truncate">
                            {deployment.version}
                          </span>
                          {isCurrent && (
                            <span className="flex-shrink-0 text-[10px] font-semibold bg-zinc-900 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                              Current
                            </span>
                          )}
                        </div>
                        <ChevronRight
                          className={[
                            "w-3.5 h-3.5 flex-shrink-0 transition-transform",
                            isCurrent
                              ? "text-zinc-900 translate-x-0"
                              : "text-zinc-300 group-hover:text-zinc-500 group-hover:translate-x-0.5",
                          ].join(" ")}
                        />
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <span
                          className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md ${envCfg.className}`}
                        >
                          {envCfg.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${statusCfg.className}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClass}`} />
                          {statusCfg.label}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                          <span className="flex items-center gap-1 font-mono">
                            <span className="text-zinc-300">#</span>
                            {shortSha(deployment.commitSha)}
                          </span>
                          <span className="flex items-center gap-1 min-w-0">
                            <GitBranch className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{deployment.branch}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {deployment.deployedBy}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getRelativeTime(deployment.deployedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Vercel URL */}
                      <a
                        href={deployment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-500 hover:text-blue-700 hover:underline transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">
                          {deployment.url.replace(/^https?:\/\//, "")}
                        </span>
                      </a>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
