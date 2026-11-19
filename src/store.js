import { useSyncExternalStore } from 'react'
import { createClient } from '@supabase/supabase-js'

// מפתח publishable ציבורי בכוונה; ההגנה על הנתונים היא ב-RLS של Supabase (ראו supabase/schema.sql)
export const sb = createClient('https://ugmrtukkwduyckqvqnnn.supabase.co', 'sb_publishable_ilPoSYYSgfZTDd3aATrhbw_4fxJXHvS')

const NL = String.fromCharCode(10)
const ING = ['בצל', 'זיתים', 'פטריות', 'תירס']
const PAY = { cash: 'מזומן', credit: 'אשראי', simply: 'Simply' }
const hoursToText = (h) => (h || []).map((r) => r.days + ': ' + r.hours).join(NL)
const textToHours = (t) => t.split(NL).filter(Boolean).map((l) => { const i = l.indexOf(': '); return i < 0 ? { days: l, hours: '' } : { days: l.slice(0, i), hours: l.slice(i + 2) } })
const COLS = { cat: 'category', desc: 'description', img: 'image_url', pizza: 'is_pizza' }
const toRow = (patch) => Object.fromEntries(Object.entries(patch).map(([k, v]) => [COLS[k] || k, k === 'img' ? v || null : v]))

let state = { ready: false, error: '', menu: [], active: {}, info: {}, ids: {}, cur: 'חריש', branch: { open: true, delivery: true, pickup: true, pay: { cash: true, credit: false, simply: false }, out: [] }, orders: [] }
// הסניף שהלקוח בחר נשמר לרענון הדף
if (sessionStorage.getItem('ps-branch')) state.cur = sessionStorage.getItem('ps-branch')
const subs = new Set()
const emit = () => subs.forEach((f) => f())
const set = (fn) => { state = fn(structuredClone(state)); emit() }

export async function load() {
  const [br, pr] = await Promise.all([sb.from('branches').select('*'), sb.from('products').select('*').order('id')])
  if (br.error || pr.error) { set((s) => ({ ...s, error: (br.error || pr.error).message })); return }
  const h = br.data.find((b) => b.city === state.cur)
  const [stock, ord] = await Promise.all([
    sb.from('branch_out_of_stock').select('product_id').eq('branch_id', h.id),
    sb.from('orders').select('*').eq('branch_id', h.id).order('created_at', { ascending: false }), // לקוח אנונימי מקבל רשימה ריקה (RLS)
  ])
  set(() => ({
    ready: true, error: '',
    ids: Object.fromEntries(br.data.map((b) => [b.city, b.id])),
    active: Object.fromEntries(br.data.map((b) => [b.city, b.active])),
    info: Object.fromEntries(br.data.map((b) => [b.city, { address: b.address, phone: b.phone, hours: hoursToText(b.hours) }])),
    branch: { open: h.is_open, delivery: h.delivery_enabled, pickup: h.pickup_enabled, pay: { cash: h.pay_cash, credit: h.pay_credit, simply: h.pay_simply }, out: (stock.data || []).map((r) => r.product_id) },
    menu: pr.data.map((p) => ({ id: p.id, cat: p.category, name: p.name, desc: p.description, price: +p.price, img: p.image_url || '', pizza: p.is_pizza, hidden: p.hidden, ing: p.is_pizza ? ING : [] })),
    orders: (ord.data || []).map((o) => ({ id: o.id, no: o.number, at: new Date(o.created_at).toLocaleString('he-IL'), items: o.items, method: PAY[o.payment_method], status: o.status, sum: { total: +o.total, form: { mode: o.mode } } })),
  }))
}
// בהצלחה לא טוענים מחדש (לא לדרוס הקלדה באמצע); בכשל מציגים שגיאה ומסנכרנים מהשרת
const run = async (p, reload = false) => { const { error } = await p; if (error) alert('השמירה נכשלה: ' + error.message); if (error || reload) load() }

export const actions = {
  setProduct(id, patch) { set((s) => { Object.assign(s.menu.find((p) => p.id === id), patch); return s }); return run(sb.from('products').update(toRow(patch)).eq('id', id)) },
  addProduct: () => run(sb.from('products').insert({ category: 'פיצות', name: 'מוצר חדש', price: 0 }), true),
  deleteProduct: (id) => run(sb.from('products').delete().eq('id', id), true),
  async uploadImage(id, blob) {
    const path = `${id}-${Date.now()}.webp`
    const { error } = await sb.storage.from('product-images').upload(path, blob, { contentType: 'image/webp' })
    if (error) return alert('העלאת התמונה נכשלה: ' + error.message)
    return actions.setProduct(id, { img: sb.storage.from('product-images').getPublicUrl(path).data.publicUrl })
  },
  setActive(city, v) { set((s) => { s.active[city] = v; return s }); return run(sb.from('branches').update({ active: v }).eq('city', city)) },
  setInfo(city, patch) {
    set((s) => { Object.assign(s.info[city], patch); return s })
    const row = { ...patch }
    if ('hours' in row) row.hours = textToHours(row.hours)
    return run(sb.from('branches').update(row).eq('city', city))
  },
  setOpen(v) { set((s) => { s.branch.open = v; return s }); return run(sb.from('branches').update({ is_open: v }).eq('city', state.cur)) },
  setPay(k, v) { set((s) => { s.branch.pay[k] = v; return s }); return run(sb.from('branches').update({ ['pay_' + k]: v }).eq('city', state.cur))
  },
  setService(k, v) { set((s) => { s.branch[k] = v; return s }); return run(sb.from('branches').update({ [k + '_enabled']: v }).eq('city', state.cur)) },
  async setOut(ids, out) {
    set((s) => { const x = new Set(s.branch.out); ids.forEach((i) => (out ? x.add(i) : x.delete(i))); s.branch.out = [...x]; return s })
    const bid = state.ids[state.cur]
    return run(out ? sb.from('branch_out_of_stock').upsert(ids.map((p) => ({ branch_id: bid, product_id: p }))) : sb.from('branch_out_of_stock').delete().eq('branch_id', bid).in('product_id', ids))
  },
  async addOrder(o, methodKey) {
    const f = o.sum.form
    const { error } = await sb.from('orders').insert({
      number: o.no, branch_id: state.ids[state.cur], mode: f.mode, payment_method: methodKey,
      customer: { name: f.name, phone: f.phone, city: f.city, street: f.street, num: f.num, apt: f.apt, floor: f.floor, ent: f.ent, note: f.note },
      items: o.items, subtotal: o.sum.sub, delivery: o.sum.delivery, handling: o.sum.handling, total: o.sum.total,
    })
    return error
  },
  setOrderStatus(id, status) { set((s) => { s.orders.find((o) => o.id === id).status = status; return s }); return run(sb.from('orders').update({ status }).eq('id', id)) },
}

// כניסת צוות: שם משתמש ממופה לאימייל פנימי ב-Supabase Auth; ההרשאה נקבעת בטבלת staff
const EMAIL = (u) => `${u.trim().toLowerCase()}@staff.pizzastory.test`
export async function currentStaff(level) {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return null
  const { data } = await sb.from('staff').select('role, username, branches(city)').eq('user_id', session.user.id).maybeSingle()
  if (!data || !(level === 'branch' || data.role === 'network')) return null
  if (data.role === 'branch' && data.branches?.city && data.branches.city !== state.cur) { state.cur = data.branches.city; load() } // מנהל סניף עובד על הסניף שלו
  return data.username
}
export async function login(level, user, pass) {
  const { error } = await sb.auth.signInWithPassword({ email: EMAIL(user), password: pass })
  if (error) return { error: 'שם משתמש או סיסמה שגויים' }
  const who = await currentStaff(level)
  if (!who) { await sb.auth.signOut(); return { error: 'אין הרשאה לאזור זה' } }
  load()
  return { user: who }
}
// ניהול משתמשי צוות לסניף (פונקציית Edge; רק הנהלה מרכזית מורשית)
export async function manageStaff(body) {
  const { error } = await sb.functions.invoke('manage-staff', { body })
  if (!error) return {}
  const j = await error.context?.json?.().catch(() => null)
  return { error: j?.error || error.message }
}
export const selectBranch = (city) => { state.cur = city; sessionStorage.setItem('ps-branch', city); return load() }
export const useInfo = () => { const s = useStore(); return s.info[s.cur] }
export const logout = async () => { await sb.auth.signOut(); state.cur = sessionStorage.getItem('ps-branch') || 'חריש'; load() }

load()
setInterval(load, 20000)
addEventListener('focus', load)
export const useStore = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state)
