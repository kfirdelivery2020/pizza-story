import { useSyncExternalStore } from 'react'
import { PRODUCTS, BRANCHES } from './data.js'

// מצב משותף לאתר הלקוח ולאדמין. נשמר ב-localStorage, לכן משותף רק בין לשוניות באותו דפדפן.
// shortcut: אין שרת, ולכן שינויי אדמין לא יגיעו ללקוחות במחשבים אחרים; להחליף ב-API/DB בשלב הבא.
const KEY = 'ps-store-v2'
const initial = () => ({
  menu: PRODUCTS,                                  // תפריט ראשי (רמת הרשת)
  active: Object.fromEntries(BRANCHES.map((b) => [b.city, b.active])), // סניפים פעילים (רמת הרשת)
  harish: { open: true, pay: { cash: true, credit: true, simply: true }, out: [] }, // הגדרות סניף חריש
  orders: [],
})
let state = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || initial() } catch { return initial() } })()
const subs = new Set()
const emit = () => subs.forEach((f) => f())
addEventListener('storage', (e) => { if (e.key === KEY) { state = JSON.parse(e.newValue || 'null') || initial(); emit() } })
export const update = (fn) => { state = fn(structuredClone(state)); localStorage.setItem(KEY, JSON.stringify(state)); emit() }
export const reset = () => { localStorage.removeItem(KEY); state = initial(); emit() }
export const useStore = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state)
