import { useSyncExternalStore } from 'react'

export type Notification = {
  id: string
  type: 'success' | 'info' | 'warning'
  title: string
  message: string
  at: string // HH:MM:SS
  /** Optional deep link shown as an action on the toast and in the alerts panel. */
  href?: string
  hrefLabel?: string
}

let notifications: Notification[] = []
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function getSnapshot(): Notification[] {
  return notifications
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

let seq = 0

/**
 * Fires a toast (rendered by `ToastStack` in AppShell) and adds the same
 * entry to the persistent notification list read by the alerts bell — one
 * call reflects the event both places, rather than the toast being a
 * fire-and-forget popup nothing else can see happened.
 */
export function pushNotification(n: Omit<Notification, 'id' | 'at'>) {
  seq += 1
  const entry: Notification = { ...n, id: `note-${Date.now()}-${seq}`, at: new Date().toLocaleTimeString(undefined, { hour12: false }) }
  notifications = [entry, ...notifications].slice(0, 30)
  notify()
  return entry.id
}

export function dismissNotification(id: string) {
  notifications = notifications.filter((n) => n.id !== id)
  notify()
}

export function clearNotifications() {
  notifications = []
  notify()
}

export function useNotifications(): Notification[] {
  return useSyncExternalStore(subscribe, getSnapshot)
}
