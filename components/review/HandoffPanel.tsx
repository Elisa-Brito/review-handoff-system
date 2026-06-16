"use client"

import React, { useState, useCallback, useId } from 'react'
import * as Tabs from '@radix-ui/react-tabs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectRole = 'owner' | 'editor' | 'viewer' | 'stakeholder'

interface UserStory {
  id: string
  asA: string
  iWantTo: string
  soThat: string
}

interface AcceptanceCriterion {
  id: string
  text: string
  status: 'pending' | 'in-progress' | 'done'
}

interface EdgeCase {
  id: string
  scenario: string
  handling: string
}

interface ApiDependency {
  id: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  description: string
  requiresAuth: boolean
}

interface AnalyticsEvent {
  id: string
  eventName: string
  properties: string
  trigger: string
}

interface DesignDecision {
  id: string
  decision: string
  rationale: string
  alternatives: string
}

interface HandoffForm {
  title: string
  overview: string
  businessObjective: string
  userStories: UserStory[]
  acceptanceCriteria: AcceptanceCriterion[]
  edgeCases: EdgeCase[]
  apiDependencies: ApiDependency[]
  analyticsEvents: AnalyticsEvent[]
  technicalNotes: string
  designDecisions: DesignDecision[]
}

interface HandoffRecord {
  id: string
  title: string
  generatedBy: string
  generatedAt: Date
  status: 'draft' | 'published' | 'archived'
  markdown: string
}

export interface HandoffPanelProps {
  projectId: string
  screenId?: string
  deploymentId?: string
  userRole: ProjectRole
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

function emptyStory(): UserStory {
  return { id: uid(), asA: '', iWantTo: '', soThat: '' }
}

function emptyCriterion(): AcceptanceCriterion {
  return { id: uid(), text: '', status: 'pending' }
}

function emptyEdgeCase(): EdgeCase {
  return { id: uid(), scenario: '', handling: '' }
}

function emptyApiDep(): ApiDependency {
  return { id: uid(), endpoint: '', method: 'GET', description: '', requiresAuth: false }
}

function emptyAnalyticsEvent(): AnalyticsEvent {
  return { id: uid(), eventName: '', properties: '', trigger: '' }
}

function emptyDesignDecision(): DesignDecision {
  return { id: uid(), decision: '', rationale: '', alternatives: '' }
}

function defaultForm(): HandoffForm {
  return {
    title: '',
    overview: '',
    businessObjective: '',
    userStories: [emptyStory()],
    acceptanceCriteria: [emptyCriterion()],
    edgeCases: [emptyEdgeCase()],
    apiDependencies: [emptyApiDep()],
    analyticsEvents: [emptyAnalyticsEvent()],
    technicalNotes: '',
    designDecisions: [emptyDesignDecision()],
  }
}

function generateMarkdown(form: HandoffForm): string {
  const stories = form.userStories
    .map((s) => `- **As a** ${s.asA}, **I want to** ${s.iWantTo}, **so that** ${s.soThat}`)
    .join('\n')

  const criteria = form.acceptanceCriteria
    .map((c) => `- [${c.status === 'done' ? 'x' : ' '}] ${c.text} *(${c.status})*`)
    .join('\n')

  const edges = form.edgeCases
    .map((e) => `| ${e.scenario} | ${e.handling} |`)
    .join('\n')

  const apis = form.apiDependencies
    .map((a) => `| \`${a.endpoint}\` | ${a.method} | ${a.description} | ${a.requiresAuth ? 'Yes' : 'No'} |`)
    .join('\n')

  const events = form.analyticsEvents
    .map((e) => `| ${e.eventName} | ${e.properties} | ${e.trigger} |`)
    .join('\n')

  const decisions = form.designDecisions
    .map(
      (d) =>
        `### ${d.decision}\n**Rationale:** ${d.rationale}\n**Alternatives considered:** ${d.alternatives}`,
    )
    .join('\n\n')

  return `# ${form.title}

## Overview
${form.overview}

## Business Objective
${form.businessObjective}

## User Stories
${stories}

## Acceptance Criteria
${criteria}

## Edge Cases
| Scenario | Handling |
|----------|----------|
${edges}

## API Dependencies
| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
${apis}

## Analytics Events
| Event Name | Properties | Trigger |
|------------|------------|---------|
${events}

## Technical Notes
${form.technicalNotes}

## Design Decisions
${decisions}
`
}

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_LABELS: Record<HandoffRecord['status'], string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

const STATUS_COLORS: Record<HandoffRecord['status'], string> = {
  draft: '#6B7280',
  published: '#059669',
  archived: '#D97706',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '480px',
    maxWidth: '100vw',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0F1117',
    color: '#E5E7EB',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    borderLeft: '1px solid #1F2937',
    overflowY: 'hidden',
  },
  panelHeader: {
    padding: '20px 24px 0',
    borderBottom: '1px solid #1F2937',
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#F9FAFB',
    marginBottom: '16px',
    margin: '0 0 16px',
  },
  tabsList: {
    display: 'flex',
    gap: '2px',
    backgroundColor: '#1F2937',
    borderRadius: '8px',
    padding: '4px',
    marginBottom: '0',
    width: 'fit-content',
  },
  tabTrigger: (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: active ? '#374151' : 'transparent',
    color: active ? '#F9FAFB' : '#9CA3AF',
    transition: 'all 0.15s ease',
    outline: 'none',
  }),
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#9CA3AF',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  input: {
    backgroundColor: '#1F2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#F9FAFB',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  },
  textarea: {
    backgroundColor: '#1F2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#F9FAFB',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    minHeight: '80px',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  },
  select: {
    backgroundColor: '#1F2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '8px 10px',
    color: '#F9FAFB',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  dynamicRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  removeBtn: {
    padding: '8px',
    backgroundColor: 'transparent',
    border: '1px solid #374151',
    borderRadius: '6px',
    color: '#6B7280',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: 1,
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  addBtn: {
    padding: '7px 14px',
    backgroundColor: 'transparent',
    border: '1px dashed #374151',
    borderRadius: '8px',
    color: '#6B7280',
    cursor: 'pointer',
    fontSize: '13px',
    width: '100%',
    transition: 'all 0.15s',
  },
  submitBtn: {
    padding: '12px 24px',
    backgroundColor: '#4F46E5',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  th: {
    textAlign: 'left' as const,
    color: '#6B7280',
    fontWeight: 500,
    padding: '4px 8px 8px',
    borderBottom: '1px solid #1F2937',
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '6px 8px',
    verticalAlign: 'top' as const,
  },
  badge: (status: HandoffRecord['status']): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: STATUS_COLORS[status] + '22',
    color: STATUS_COLORS[status],
    border: `1px solid ${STATUS_COLORS[status]}44`,
  }),
  historyCard: {
    backgroundColor: '#1F2937',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    border: '1px solid #374151',
  },
  historyCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  },
  historyCardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#F9FAFB',
    margin: 0,
  },
  historyCardMeta: {
    fontSize: '12px',
    color: '#6B7280',
  },
  historyCardActions: {
    display: 'flex',
    gap: '8px',
  },
  secondaryBtn: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #374151',
    borderRadius: '6px',
    color: '#9CA3AF',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  markdownPreview: {
    backgroundColor: '#111827',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '13px',
    lineHeight: 1.7,
    color: '#D1D5DB',
    whiteSpace: 'pre-wrap' as const,
    fontFamily: 'ui-monospace, monospace',
    overflowX: 'auto' as const,
    maxHeight: '360px',
    overflowY: 'auto' as const,
    border: '1px solid #1F2937',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    color: '#4B5563',
    gap: '8px',
    textAlign: 'center' as const,
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#9CA3AF',
  },
}

function InputField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      style={styles.input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={(e) => {
        ;(e.target as HTMLInputElement).style.borderColor = '#6366F1'
      }}
      onBlur={(e) => {
        ;(e.target as HTMLInputElement).style.borderColor = '#374151'
      }}
    />
  )
}

function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      style={{ ...styles.textarea, minHeight: `${rows * 24}px` }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      onFocus={(e) => {
        ;(e.target as HTMLTextAreaElement).style.borderColor = '#6366F1'
      }}
      onBlur={(e) => {
        ;(e.target as HTMLTextAreaElement).style.borderColor = '#374151'
      }}
    />
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span style={styles.label}>{children}</span>
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      style={styles.removeBtn}
      onClick={onClick}
      title="Remove"
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#EF4444'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#EF4444'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#374151'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#6B7280'
      }}
    >
      ✕
    </button>
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      style={styles.addBtn}
      onClick={onClick}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#6366F1'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#6366F1'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#374151'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#6B7280'
      }}
    >
      + {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Generate Tab
// ---------------------------------------------------------------------------

function GenerateTab({
  form,
  setForm,
  onSubmit,
  loading,
}: {
  form: HandoffForm
  setForm: React.Dispatch<React.SetStateAction<HandoffForm>>
  onSubmit: () => void
  loading: boolean
}) {
  function updateField<K extends keyof HandoffForm>(key: K, value: HandoffForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // --- User Stories ---
  function updateStory(id: string, field: keyof UserStory, value: string) {
    setForm((prev) => ({
      ...prev,
      userStories: prev.userStories.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }))
  }
  function removeStory(id: string) {
    setForm((prev) => ({ ...prev, userStories: prev.userStories.filter((s) => s.id !== id) }))
  }

  // --- Acceptance Criteria ---
  function updateCriterion(id: string, field: keyof AcceptanceCriterion, value: string) {
    setForm((prev) => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.map((c) =>
        c.id === id ? { ...c, [field]: value } : c,
      ),
    }))
  }
  function removeCriterion(id: string) {
    setForm((prev) => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.filter((c) => c.id !== id),
    }))
  }

  // --- Edge Cases ---
  function updateEdgeCase(id: string, field: keyof EdgeCase, value: string) {
    setForm((prev) => ({
      ...prev,
      edgeCases: prev.edgeCases.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }))
  }
  function removeEdgeCase(id: string) {
    setForm((prev) => ({ ...prev, edgeCases: prev.edgeCases.filter((e) => e.id !== id) }))
  }

  // --- API Dependencies ---
  function updateApiDep(id: string, field: keyof ApiDependency, value: string | boolean) {
    setForm((prev) => ({
      ...prev,
      apiDependencies: prev.apiDependencies.map((a) =>
        a.id === id ? { ...a, [field]: value } : a,
      ),
    }))
  }
  function removeApiDep(id: string) {
    setForm((prev) => ({
      ...prev,
      apiDependencies: prev.apiDependencies.filter((a) => a.id !== id),
    }))
  }

  // --- Analytics Events ---
  function updateEvent(id: string, field: keyof AnalyticsEvent, value: string) {
    setForm((prev) => ({
      ...prev,
      analyticsEvents: prev.analyticsEvents.map((e) =>
        e.id === id ? { ...e, [field]: value } : e,
      ),
    }))
  }
  function removeEvent(id: string) {
    setForm((prev) => ({
      ...prev,
      analyticsEvents: prev.analyticsEvents.filter((e) => e.id !== id),
    }))
  }

  // --- Design Decisions ---
  function updateDecision(id: string, field: keyof DesignDecision, value: string) {
    setForm((prev) => ({
      ...prev,
      designDecisions: prev.designDecisions.map((d) =>
        d.id === id ? { ...d, [field]: value } : d,
      ),
    }))
  }
  function removeDecision(id: string) {
    setForm((prev) => ({
      ...prev,
      designDecisions: prev.designDecisions.filter((d) => d.id !== id),
    }))
  }

  return (
    <div style={styles.scrollArea}>
      {/* Title */}
      <div style={styles.section}>
        <SectionLabel>Title</SectionLabel>
        <InputField
          value={form.title}
          onChange={(v) => updateField('title', v)}
          placeholder="Handoff title..."
        />
      </div>

      {/* Overview */}
      <div style={styles.section}>
        <SectionLabel>Overview</SectionLabel>
        <TextAreaField
          value={form.overview}
          onChange={(v) => updateField('overview', v)}
          placeholder="Brief overview of what this feature does..."
          rows={3}
        />
      </div>

      {/* Business Objective */}
      <div style={styles.section}>
        <SectionLabel>Business Objective</SectionLabel>
        <TextAreaField
          value={form.businessObjective}
          onChange={(v) => updateField('businessObjective', v)}
          placeholder="Why are we building this? What problem does it solve?"
          rows={3}
        />
      </div>

      {/* User Stories */}
      <div style={styles.section}>
        <SectionLabel>User Stories</SectionLabel>
        {form.userStories.map((story) => (
          <div
            key={story.id}
            style={{
              backgroundColor: '#1A2030',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #1F2937',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={styles.dynamicRow}>
              <div
                style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <InputField
                  value={story.asA}
                  onChange={(v) => updateStory(story.id, 'asA', v)}
                  placeholder="As a... (role)"
                />
                <InputField
                  value={story.iWantTo}
                  onChange={(v) => updateStory(story.id, 'iWantTo', v)}
                  placeholder="I want to... (action)"
                />
                <InputField
                  value={story.soThat}
                  onChange={(v) => updateStory(story.id, 'soThat', v)}
                  placeholder="So that... (benefit)"
                />
              </div>
              <RemoveButton onClick={() => removeStory(story.id)} />
            </div>
          </div>
        ))}
        <AddButton
          label="Add User Story"
          onClick={() =>
            setForm((prev) => ({ ...prev, userStories: [...prev.userStories, emptyStory()] }))
          }
        />
      </div>

      {/* Acceptance Criteria */}
      <div style={styles.section}>
        <SectionLabel>Acceptance Criteria</SectionLabel>
        {form.acceptanceCriteria.map((c) => (
          <div key={c.id} style={styles.dynamicRow}>
            <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                style={{ ...styles.select, flexShrink: 0 }}
                value={c.status}
                onChange={(e) =>
                  updateCriterion(c.id, 'status', e.target.value as AcceptanceCriterion['status'])
                }
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <InputField
                value={c.text}
                onChange={(v) => updateCriterion(c.id, 'text', v)}
                placeholder="Criterion description..."
              />
            </div>
            <RemoveButton onClick={() => removeCriterion(c.id)} />
          </div>
        ))}
        <AddButton
          label="Add Criterion"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              acceptanceCriteria: [...prev.acceptanceCriteria, emptyCriterion()],
            }))
          }
        />
      </div>

      {/* Edge Cases */}
      <div style={styles.section}>
        <SectionLabel>Edge Cases</SectionLabel>
        {form.edgeCases.map((e) => (
          <div
            key={e.id}
            style={{
              backgroundColor: '#1A2030',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #1F2937',
              display: 'flex',
              gap: '8px',
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <InputField
                value={e.scenario}
                onChange={(v) => updateEdgeCase(e.id, 'scenario', v)}
                placeholder="Scenario..."
              />
              <InputField
                value={e.handling}
                onChange={(v) => updateEdgeCase(e.id, 'handling', v)}
                placeholder="Handling / expected behavior..."
              />
            </div>
            <RemoveButton onClick={() => removeEdgeCase(e.id)} />
          </div>
        ))}
        <AddButton
          label="Add Edge Case"
          onClick={() =>
            setForm((prev) => ({ ...prev, edgeCases: [...prev.edgeCases, emptyEdgeCase()] }))
          }
        />
      </div>

      {/* API Dependencies */}
      <div style={styles.section}>
        <SectionLabel>API Dependencies</SectionLabel>
        {form.apiDependencies.map((a) => (
          <div
            key={a.id}
            style={{
              backgroundColor: '#1A2030',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #1F2937',
              display: 'flex',
              gap: '8px',
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  style={{ ...styles.select, flexShrink: 0 }}
                  value={a.method}
                  onChange={(e) =>
                    updateApiDep(a.id, 'method', e.target.value as ApiDependency['method'])
                  }
                >
                  {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <InputField
                  value={a.endpoint}
                  onChange={(v) => updateApiDep(a.id, 'endpoint', v)}
                  placeholder="/api/v1/endpoint"
                />
              </div>
              <InputField
                value={a.description}
                onChange={(v) => updateApiDep(a.id, 'description', v)}
                placeholder="Description..."
              />
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={a.requiresAuth}
                  onChange={(e) => updateApiDep(a.id, 'requiresAuth', e.target.checked)}
                />
                Requires authentication
              </label>
            </div>
            <RemoveButton onClick={() => removeApiDep(a.id)} />
          </div>
        ))}
        <AddButton
          label="Add API Dependency"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              apiDependencies: [...prev.apiDependencies, emptyApiDep()],
            }))
          }
        />
      </div>

      {/* Analytics Events */}
      <div style={styles.section}>
        <SectionLabel>Analytics Events</SectionLabel>
        {form.analyticsEvents.map((e) => (
          <div
            key={e.id}
            style={{
              backgroundColor: '#1A2030',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #1F2937',
              display: 'flex',
              gap: '8px',
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <InputField
                value={e.eventName}
                onChange={(v) => updateEvent(e.id, 'eventName', v)}
                placeholder="event_name"
              />
              <InputField
                value={e.properties}
                onChange={(v) => updateEvent(e.id, 'properties', v)}
                placeholder='Properties (e.g. { userId, screen })'
              />
              <InputField
                value={e.trigger}
                onChange={(v) => updateEvent(e.id, 'trigger', v)}
                placeholder="When is this triggered?"
              />
            </div>
            <RemoveButton onClick={() => removeEvent(e.id)} />
          </div>
        ))}
        <AddButton
          label="Add Analytics Event"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              analyticsEvents: [...prev.analyticsEvents, emptyAnalyticsEvent()],
            }))
          }
        />
      </div>

      {/* Technical Notes */}
      <div style={styles.section}>
        <SectionLabel>Technical Notes</SectionLabel>
        <TextAreaField
          value={form.technicalNotes}
          onChange={(v) => updateField('technicalNotes', v)}
          placeholder="Implementation details, architecture decisions, performance considerations..."
          rows={5}
        />
      </div>

      {/* Design Decisions */}
      <div style={styles.section}>
        <SectionLabel>Design Decisions</SectionLabel>
        {form.designDecisions.map((d) => (
          <div
            key={d.id}
            style={{
              backgroundColor: '#1A2030',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #1F2937',
              display: 'flex',
              gap: '8px',
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <InputField
                value={d.decision}
                onChange={(v) => updateDecision(d.id, 'decision', v)}
                placeholder="Decision made..."
              />
              <TextAreaField
                value={d.rationale}
                onChange={(v) => updateDecision(d.id, 'rationale', v)}
                placeholder="Rationale..."
                rows={2}
              />
              <TextAreaField
                value={d.alternatives}
                onChange={(v) => updateDecision(d.id, 'alternatives', v)}
                placeholder="Alternatives considered..."
                rows={2}
              />
            </div>
            <RemoveButton onClick={() => removeDecision(d.id)} />
          </div>
        ))}
        <AddButton
          label="Add Design Decision"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              designDecisions: [...prev.designDecisions, emptyDesignDecision()],
            }))
          }
        />
      </div>

      {/* Submit */}
      <div style={{ paddingBottom: '8px' }}>
        <button
          type="button"
          style={{
            ...styles.submitBtn,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          onClick={onSubmit}
          disabled={loading}
          onMouseEnter={(e) => {
            if (!loading)
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#4338CA'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = '#4F46E5'
          }}
        >
          {loading && <div style={styles.spinner} />}
          {loading ? 'Generating...' : 'Generate Handoff'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// History Tab
// ---------------------------------------------------------------------------

function HistoryTab({ records }: { records: HandoffRecord[] }) {
  const [previewId, setPreviewId] = useState<string | null>(null)

  if (records.length === 0) {
    return (
      <div style={styles.scrollArea}>
        <div style={styles.emptyState}>
          <span style={{ fontSize: '32px' }}>📋</span>
          <p style={{ margin: 0, fontWeight: 600, color: '#6B7280' }}>No handoffs yet</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#4B5563' }}>
            Generate your first handoff in the Generate tab.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.scrollArea}>
      {records.map((record) => (
        <div key={record.id} style={styles.historyCard}>
          <div style={styles.historyCardHeader}>
            <div>
              <p style={styles.historyCardTitle}>{record.title}</p>
              <p style={{ ...styles.historyCardMeta, marginTop: '4px', margin: '4px 0 0' }}>
                By <strong style={{ color: '#9CA3AF' }}>{record.generatedBy}</strong> &middot;{' '}
                {record.generatedAt.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            <span style={styles.badge(record.status)}>{STATUS_LABELS[record.status]}</span>
          </div>

          <div style={styles.historyCardActions}>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => setPreviewId(previewId === record.id ? null : record.id)}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#6366F1'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#818CF8'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#374151'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'
              }}
            >
              {previewId === record.id ? 'Hide Preview' : 'View'}
            </button>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() =>
                downloadMarkdown(
                  `${record.title.toLowerCase().replace(/\s+/g, '-')}.md`,
                  record.markdown,
                )
              }
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#059669'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#10B981'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#374151'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'
              }}
            >
              Download .md
            </button>
          </div>

          {previewId === record.id && (
            <div style={styles.markdownPreview}>{record.markdown}</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HandoffPanel({ projectId, screenId, deploymentId, userRole }: HandoffPanelProps) {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')
  const [form, setForm] = useState<HandoffForm>(defaultForm)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HandoffRecord[]>([])

  const handleGenerate = useCallback(async () => {
    if (!form.title.trim()) {
      return
    }

    setLoading(true)

    // Simulate async generation (replace with actual API call)
    await new Promise<void>((resolve) => setTimeout(resolve, 1200))

    const markdown = generateMarkdown(form)
    const record: HandoffRecord = {
      id: uid(),
      title: form.title,
      generatedBy: 'You',
      generatedAt: new Date(),
      status: 'draft',
      markdown,
    }

    setHistory((prev) => [record, ...prev])
    setForm(defaultForm)
    setLoading(false)
    setActiveTab('history')
  }, [form])

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .handoff-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .handoff-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .handoff-scroll::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 3px;
        }
        .handoff-scroll::-webkit-scrollbar-thumb:hover {
          background: #4B5563;
        }
      `}</style>

      <div style={styles.panel}>
        <Tabs.Root
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
        >
          {/* Header */}
          <div style={styles.panelHeader}>
            <p style={styles.panelTitle}>Engineering Handoff</p>
            <Tabs.List style={styles.tabsList} aria-label="Handoff tabs">
              <Tabs.Trigger
                value="generate"
                style={styles.tabTrigger(activeTab === 'generate')}
              >
                Generate
              </Tabs.Trigger>
              <Tabs.Trigger
                value="history"
                style={styles.tabTrigger(activeTab === 'history')}
              >
                History
                {history.length > 0 && (
                  <span
                    style={{
                      marginLeft: '6px',
                      backgroundColor: '#4F46E5',
                      color: '#fff',
                      borderRadius: '9999px',
                      padding: '0 6px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    {history.length}
                  </span>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </div>

          {/* Content */}
          <Tabs.Content
            value="generate"
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            className="handoff-scroll"
          >
            <GenerateTab
              form={form}
              setForm={setForm}
              onSubmit={handleGenerate}
              loading={loading}
            />
          </Tabs.Content>

          <Tabs.Content
            value="history"
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            className="handoff-scroll"
          >
            <HistoryTab records={history} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </>
  )
}

export default HandoffPanel
