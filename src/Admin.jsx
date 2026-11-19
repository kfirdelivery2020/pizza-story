import { useState } from 'react'
import { BRANCHES, CATS } from './data.js'
import { useStore, update, reset } from './store.js'

// shortcut: כניסת הדגמה בלי סיסמה, כל מי שיש לו את הקישור נכנס; להחליף באימות אמיתי עם הרשאות (מנהל/עובד) כשיהיה שרת
const TITLES = { network: 'הנהלה מרכזית – ניהול רשת', branch: 'ניהול סניף חריש' }
const Toggle = ({ on, set, label }) => <label className="opt"><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /> {label}</label>

export default function Admin({ route }) {
  const level = route.split('/')[2]
  const [ok, setOk] = useState(() => sessionStorage.getItem('adm-' + level) === '1')
  if (!TITLES[level]) return (
    <section className="pick"><img className="biglogo" src="logo.png" alt="פיצה סטורי" /><h1>כניסת ניהול</h1>
      <a className="btn full" href="#/admin/branch">כניסת מנהל סניף</a>
      <a className="btn full ghost" href="#/admin/network">כניסת הנהלה מרכזית</a></section>
  )
  if (!ok) return (
    <section className="pick"><img className="biglogo" src="logo.png" alt="פיצה סטורי" /><h1>{TITLES[level]}</h1>
      <p className="muted">כניסת הדגמה, ללא סיסמה.</p>
      <button className="btn full" onClick={() => { sessionStorage.setItem('adm-' + level, '1'); setOk(true) }}>כניסה</button></section>
  )
  return (
    <div className="adm">
      <header className="hdr"><b>{TITLES[level]}</b>
        <nav><a href="#/home">לאתר הלקוח ↗</a></nav>
        <button className="btn sm ghost" onClick={() => { sessionStorage.removeItem('adm-' + level); setOk(false) }}>יציאה</button></header>
      <div className="wrap">{level === 'network' ? <Network /> : <Branch />}</div>
    </div>
  )
}

function Tabs({ tabs }) {
  const [t, setT] = useState(0)
  return <><div className="row wrapRow" role="tablist">{tabs.map(([n], i) => <button key={n} role="tab" aria-selected={t === i} className={'chip' + (t === i ? ' on' : '')} onClick={() => setT(i)}>{n}</button>)}</div>{tabs[t][1]}</>
}

function Network() {
  const st = useStore()
  const edit = (id, k, v) => update((s) => { s.menu.find((p) => p.id === id)[k] = v; return s })
  return (
    <Tabs tabs={[
      ['תפריט ראשי', (
        <>
          <p className="muted">שינויים כאן משפיעים על התפריט שהלקוחות רואים. מוצר מוסתר לא יוצג בכל הסניפים.</p>
          {st.menu.map((p) => (
            <div className="card arow" key={p.id}>
              <input className="field" aria-label="שם" value={p.name} onChange={(e) => edit(p.id, 'name', e.target.value)} />
              <input className="field" aria-label="תיאור" value={p.desc} onChange={(e) => edit(p.id, 'desc', e.target.value)} />
              <select className="field" aria-label="קטגוריה" value={p.cat} onChange={(e) => edit(p.id, 'cat', e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              <input className="field price" type="number" min="0" aria-label="מחיר" value={p.price} onChange={(e) => edit(p.id, 'price', +e.target.value)} />
              <Toggle on={!p.hidden} set={(v) => edit(p.id, 'hidden', !v)} label="מוצג" />
              <button className="link" onClick={() => update((s) => { s.menu = s.menu.filter((x) => x.id !== p.id); return s })}>מחיקה</button>
            </div>
          ))}
          <button className="btn" onClick={() => update((s) => { s.menu.push({ id: Date.now(), cat: CATS[0], name: 'מוצר חדש', desc: '', price: 0, pizza: false, ing: [] }); return s })}>+ הוספת מוצר</button>
        </>
      )],
      ['סניפים', (
        <>
          <p className="muted">סניף פעיל מופיע ללקוחות ברשימת הבחירה. כרגע רק חריש מחובר לתפריט ולהזמנות.</p>
          <div className="grid">{BRANCHES.map((b) => <Toggle key={b.city} on={!!st.active[b.city]} set={(v) => update((s) => { s.active[b.city] = v; return s })} label={`${b.city} · ${b.region}`} />)}</div>
        </>
      )],
      ['נתוני דמה', <button className="btn" onClick={() => confirm('לאפס את כל השינויים וההזמנות?') && reset()}>איפוס נתוני הדגמה</button>],
    ]} />
  )
}

function Branch() {
  const st = useStore()
  const b = st.harish
  const set = (fn) => update((s) => { fn(s.harish); return s })
  const next = { 'חדשה': 'בהכנה', 'בהכנה': 'מוכנה', 'מוכנה': 'נמסרה' }
  return (
    <Tabs tabs={[
      ['זמינות מוצרים', (
        <>
          <p className="muted">כיבוי מוצר מסמן אותו "אזל" באתר הלקוח של הסניף. מחירים ושמות מנוהלים מההנהלה המרכזית.</p>
          {st.menu.map((p) => <div className="card arow" key={p.id}><b>{p.name}</b><span className="muted">{p.cat} · ₪{p.price}{p.hidden ? ' · מוסתר ברשת' : ''}</span>
            <Toggle on={!b.out.includes(p.id)} set={(v) => set((h) => { h.out = v ? h.out.filter((x) => x !== p.id) : [...h.out, p.id] })} label="זמין" /></div>)}
        </>
      )],
      ['הגדרות סניף', (
        <>
          <Toggle on={b.open} set={(v) => set((h) => { h.open = v })} label="הסניף פתוח להזמנות" />
          <h2>אמצעי תשלום פעילים</h2>
          {[['cash', 'מזומן'], ['credit', 'אשראי'], ['simply', 'Simply']].map(([k, t]) => <Toggle key={k} on={b.pay[k]} set={(v) => set((h) => { h.pay[k] = v })} label={t} />)}
        </>
      )],
      [`הזמנות (${st.orders.length})`, (
        st.orders.length ? st.orders.map((o, i) => (
          <div className="card arow" key={o.no}><b>{o.no}</b><span>{o.at} · {o.items.map((x) => `${x.qty}× ${x.name}`).join(', ')}</span>
            <span>{o.method} · ₪{o.sum.total} · {o.sum.form.mode === 'pickup' ? 'איסוף' : 'משלוח'}</span>
            <span className="tag ok">{o.status}</span>
            {next[o.status] && <button className="btn sm" onClick={() => update((s) => { s.orders[i].status = next[o.status]; return s })}>{next[o.status]}</button>}</div>
        )) : <p className="empty">אין הזמנות עדיין. בצעו הזמנת דמה באתר הלקוח.</p>
      )],
    ]} />
  )
}
