import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'

import { monthLabel } from '../../utils/format'
import { Button } from './Primitives'

/** Page-size aware pagination footer. */
export function Pagination({ meta, page, onPageChange, perPage, onPerPageChange, className = '' }) {
  if (!meta || (meta.total_pages || 0) <= 1) {
    if (!meta?.total) return null
    return (
      <p className={`muted px-1 py-3 ${className}`}>
        Showing {meta.total} {meta.total === 1 ? 'record' : 'records'}
      </p>
    )
  }

  const current = page || meta.page || 1
  const totalPages = meta.total_pages
  const windowStart = Math.max(1, Math.min(current - 2, totalPages - 4))
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => windowStart + index)

  return (
    <nav
      className={`flex flex-wrap items-center justify-between gap-3 px-1 py-3 ${className}`}
      aria-label="Pagination"
    >
      <p className="muted">
        Page {current} of {totalPages} · {meta.total} records
      </p>
      <div className="flex items-center gap-1.5">
        {onPerPageChange && (
          <select
            className="input mr-1 w-auto py-1.5 text-xs"
            value={perPage}
            onChange={(event) => onPerPageChange(Number(event.target.value))}
            aria-label="Records per page"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        )}
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronLeft}
          disabled={!meta.has_prev}
          onClick={() => onPageChange(current - 1)}
          aria-label="Previous page"
        />
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === current ? 'page' : undefined}
            className={`min-w-9 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              pageNumber === current
                ? 'bg-brand-700 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {pageNumber}
          </button>
        ))}
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronRight}
          disabled={!meta.has_next}
          onClick={() => onPageChange(current + 1)}
          aria-label="Next page"
        />
      </div>
    </nav>
  )
}

/** Debounced search input with a clear button. */
export function SearchInput({ value = '', onChange, placeholder = 'Search…', className = '' }) {
  const [local, setLocal] = useState(value)
  const [committed, setCommitted] = useState(value)
  const handlerRef = useRef(onChange)

  useEffect(() => {
    handlerRef.current = onChange
  }, [onChange])

  // Adopt a value pushed down by the parent (for example "clear filters").
  if (committed !== value) {
    setCommitted(value)
    setLocal(value)
  }

  useEffect(() => {
    if (local === committed) return undefined
    const timer = setTimeout(() => handlerRef.current(local), 350)
    return () => clearTimeout(timer)
  }, [local, committed])

  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        className="input pl-9"
        value={local}
        placeholder={placeholder}
        onChange={(event) => setLocal(event.target.value)}
        aria-label={placeholder}
      />
      {local && (
        <button
          type="button"
          onClick={() => {
            setLocal('')
            onChange('')
          }}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/** Horizontally scrollable tabs (works on small screens). */
export function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`scrollbar-thin -mx-1 overflow-x-auto ${className}`}>
      <div className="flex min-w-max gap-1 border-b border-slate-200 px-1" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-brand-700 text-brand-800'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {tab.icon && <tab.icon className="h-4 w-4" aria-hidden="true" />}
              {tab.label}
              {tab.count !== undefined && tab.count !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Month stepper used by attendance calendars and monthly reports. */
export function MonthPicker({ year, month, onPrevious, onNext, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={onPrevious} aria-label="Previous month" />
      <span className="min-w-36 text-center text-sm font-semibold text-slate-800">
        {monthLabel(year, month)}
      </span>
      <Button variant="secondary" size="sm" icon={ChevronRight} onClick={onNext} aria-label="Next month" />
    </div>
  )
}

/** Date stepper for "today" style pages. */
export function DateStepper({ value, onChange, className = '', max }) {
  const shift = (days) => {
    const date = new Date(`${value}T00:00:00`)
    date.setDate(date.getDate() + days)
    onChange(date.toISOString().slice(0, 10))
  }
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => shift(-1)} aria-label="Previous day" />
      <input
        type="date"
        className="input w-auto py-1.5 text-sm"
        value={value}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Select date"
      />
      <Button
        variant="secondary"
        size="sm"
        icon={ChevronRight}
        onClick={() => shift(1)}
        disabled={max ? value >= max : false}
        aria-label="Next day"
      />
    </div>
  )
}
