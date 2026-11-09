import { useEffect, useMemo, useRef, useState } from 'react'

export type SearchOption = {
  value: string
  label: string
  search: string
  color?: string
  badge?: string
  tone?: string
}

type Props = {
  label: string
  value: string
  options: SearchOption[]
  onChange: (value: string) => void
  emptyLabel?: string
  placeholder?: string
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function SearchSelect({
  label,
  value,
  options,
  onChange,
  emptyLabel = '--',
  placeholder = 'Pesquisar por nome, sigla ou número…',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((option) => option.value === value) ?? null

  const filtered = useMemo(() => {
    const term = normalize(query)
    if (!term) {
      const emptyOption: SearchOption = { value: '', label: emptyLabel, search: '' }
      return [emptyOption, ...options]
    }
    return options.filter((option) => normalize(option.search).includes(term))
  }, [options, query, emptyLabel])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const toggle = () => {
    if (!open) {
      setQuery('')
      setHighlight(0)
    }
    setOpen(!open)
  }

  const choose = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="search-select" ref={rootRef}>
      <span className="field-label">{label}</span>
      <button
        type="button"
        className="ss-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
      >
        {selected?.color && (
          <span className="ss-swatch" style={{ background: selected.color }} aria-hidden />
        )}
        {selected?.badge && (
          <span className={`ss-badge ss-badge-${selected.tone ?? 'nao'}`}>
            {selected.badge}
          </span>
        )}
        <span className={`ss-value${selected ? '' : ' vazio'}`}>
          {selected ? selected.label : emptyLabel}
        </span>
        <span className="ss-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="ss-pop">
          <input
            ref={inputRef}
            className="ss-input"
            type="text"
            value={query}
            placeholder={placeholder}
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlight(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false)
              } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                setHighlight((current) => Math.min(current + 1, filtered.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setHighlight((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                const option = filtered[highlight]
                if (option) choose(option.value)
              }
            }}
          />
          <ul className="ss-list" role="listbox">
            {filtered.map((option, index) => (
              <li
                key={option.value || '__vazio'}
                role="option"
                aria-selected={option.value === value}
                className={[
                  'ss-option',
                  index === highlight ? 'highlight' : '',
                  option.value === value ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(option.value)
                }}
              >
                {option.color && (
                  <span className="ss-swatch" style={{ background: option.color }} aria-hidden />
                )}
                {option.badge && (
                  <span className={`ss-badge ss-badge-${option.tone ?? 'nao'}`}>
                    {option.badge}
                  </span>
                )}
                <span className="ss-option-text">{option.label}</span>
              </li>
            ))}
            {filtered.length === 0 && <li className="ss-empty">Nenhum resultado</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
