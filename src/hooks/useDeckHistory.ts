import { useCallback, useRef, useState } from 'react'
import type { Deck } from '../types'

export function useDeckHistory() {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [counts, setCounts] = useState({ past: 0, future: 0 })
  const current = useRef<Deck | null>(null)
  const past = useRef<Deck[]>([])
  const future = useRef<Deck[]>([])
  const group = useRef({ key: '', at: 0 })
  const publish = (next: Deck | null) => {
    current.current = next
    setDeck(next)
    setCounts({ past: past.current.length, future: future.current.length })
  }
  const open = useCallback((next: Deck | null) => {
    past.current = []
    future.current = []
    group.current = { key: '', at: 0 }
    publish(next)
  }, [])
  const change = useCallback((update: (draft: Deck) => void, key = '') => {
    if (!current.current) return
    const now = Date.now()
    const previous = current.current
    const next = structuredClone(previous)
    update(next)
    if (JSON.stringify(previous) === JSON.stringify(next)) return
    if (!key || group.current.key !== key || now - group.current.at > 900) {
      past.current = [...past.current.slice(-49), previous]
    }
    group.current = { key, at: now }
    next.updatedAt = new Date().toISOString()
    future.current = []
    publish(next)
  }, [])
  const undo = useCallback(() => {
    const previous = past.current.pop()
    if (!previous || !current.current) return
    future.current.push(current.current)
    group.current = { key: '', at: 0 }
    publish({ ...previous, updatedAt: new Date().toISOString() })
  }, [])
  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next || !current.current) return
    past.current.push(current.current)
    group.current = { key: '', at: 0 }
    publish({ ...next, updatedAt: new Date().toISOString() })
  }, [])
  return { deck, open, change, undo, redo, canUndo: counts.past > 0, canRedo: counts.future > 0 }
}
