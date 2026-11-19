import { useState } from 'react'
import { BRANCHES, CATS } from './data.js'
import { useStore, update, reset } from './store.js'
import { login } from './auth.js'

const NL = String.fromCharCode(10)
const ils = (n) => `₪${n}`
const Toggle = ({ on, set, label }) => <label className="sw"><input type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} /><span className="knob" />{label && <span>{label}</span>}</label>

// תמונה מועלית מוקטנת ל-640px ונשמרת בדפדפן. shortcut: dataURL ב-localStorage, לעבור לאחסון קבצים בשרת
const toDataUrl = (file) => new Promise((res) => {
  const img = new Image()
  img.onload = () => {
    const k = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement('canvas')
    c.width = img.width * k; c.height = img.height * k
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    res(c.toDataURL('image/webp', 0.8))
  }
  img.src = URL.createObjectURL(file)
})

const NAV = {
  network: { title: 'הנהלה מרכזית', items: [['overview', 'סקירה כללית'], ['branches', 'סניפים'], ['menu', 'תפריט ראשי'], ['system', 'מערכת']] },
  branch: { title: 'ניהול סניף חריש', items: [['overview', 'סקירה'], ['availability', 'זמינות מוצרים'], ['settings', 'הגדרות סניף'], ['orders', 'הזמנות']] },
}

export default function Admin({ route }) {
  const [, , level, section] = route.split('/')
  const [who, setWho] = useState(() => sessionStorage.getItem('adm-' + level))
  const logo = <img className="biglogo" src="logo.png" alt="פיצה סטורי" />
  if (!NAV[level]) return (
    <section className="pick">{logo}<h1>כניסת ניהול</h1>
      <a className="btn full" href="#/admin/branch">כניסת מנהל סניף</a>
      <a className="btn full ghost" href="#/admin/network">כניסת הנהלה מרכזית</a></section>
  )
  if (!who) return <Login level={level} logo={logo} onOk={(u) => { sessionStorage.setItem('adm-' + level, u); setWho(u) }} />
  const items = NAV[level].items
  const cur = items.find(([k]) => k === section) ? section : items[0][0]
  const Page = { overview: level === 'branch' ? BranchOverview : Overview, branches: Branches, menu: Menu, system: System, availability: Availability, settings: Settings, orders: Orders }[cur]
  return (
    <div className="shell">
      <aside className="side">
        <img src="logo.png" alt="פיצה סטורי" />
        <b>{NAV[level].title}</b>
        <small className="who">מחובר/ת: {who}</small>
        <nav aria-label="ניהול">{items.map(([k, t]) => <a key={k} href={`#/admin/${level}/${k}`} aria-current={k === cur ? 'page' : undefined}>{t}</a>)}</nav>
        <div className="sidefoot">
          <a href="#/home">לאתר הלקוח ↗</a>
          <button className="link" onClick={() => { sessionStorage.removeItem('adm-' + level); setWho(null) }}>יציאה</button>
        </div>
      </aside>
      <main className="adm-main"><Page /></main>
    </div>
  )
}

function Login({ level, logo, onOk }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    const r = await login(level, u, p)
    setBusy(false)
    if (r.error) { setErr(r.error); setP('') } else onOk(r.user)
  }
  return (
    <section className="pick">{logo}<h1>{NAV[level].title}</h1>
      <form className="card loginbox" onSubmit={submit}>
        <label className="lbl">שם משתמש<input className="field" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} required /></label>
        <label className="lbl">סיסמה<input className="field" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn full" disabled={busy}>{busy ? 'בודק…' : 'כניסה'}</button>
      </form>
    </section>
  )
}

const Head = ({ title, sub, children }) => <div className="spread ahead"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>{children}</div>

function Overview() {
  const st = useStore()
  const act = Object.values(st.active).filter(Boolean).length
  const stats = [['סניפים פעילים', act], ['מוצרים בתפריט', st.menu.filter((p) => !p.hidden).length], ['מוצרים מוסתרים', st.menu.filter((p) => p.hidden).length], ['אזלו בסניף חריש', st.harish.out.length], ['הזמנות (דמה)', st.orders.length]]
  return (
    <>
      <Head title="סקירה כללית" sub="מצב הרשת במבט אחד" />
      <div className="stats">{stats.map(([t, n]) => <div className="card stat" key={t}><b>{n}</b><span>{t}</span></div>)}</div>
      <div className="row wrapRow"><a className="btn" href="#/admin/network/branches">ניהול סניפים</a><a className="btn ghost" href="#/admin/network/menu">עריכת תפריט</a></div>
    </>
  )
}

const parseHours = (t) => t.split(NL).filter(Boolean).map((l) => { const i = l.indexOf(': '); return i < 0 ? [l, ''] : [l.slice(0, i), l.slice(i + 2)] })
function HoursEditor({ value, onChange }) {
  const rows = parseHours(value)
  const put = (r) => onChange(r.map(([d, h]) => d + ': ' + h).join(NL))
  return (
    <fieldset className="hrs"><legend>שעות פעילות</legend>
      {rows.map(([d, h], i) => (
        <div className="row" key={i}>
          <input className="field" aria-label="ימים" value={d} onChange={(e) => put(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} />
          <input className="field" aria-label="שעות" value={h} onChange={(e) => put(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} />
          <button type="button" className="link" onClick={() => put(rows.filter((_, j) => j !== i))}>הסרה</button>
        </div>
      ))}
      <button type="button" className="btn sm ghost" onClick={() => put([...rows, ['יום', '00:00–00:00']])}>+ הוספת שורה</button>
    </fieldset>
  )
}

function Branches() {
  const st = useStore()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const list = BRANCHES.filter((b) => b.city.includes(q) || b.region.includes(q))
  const info = (c) => st.info[c] || { address: '', phone: '', hours: '' }
  const setInfo = (c, k, v) => update((s) => { s.info[c] = { ...info(c), [k]: v }; return s })
  return (
    <>
      <Head title="סניפים" sub="הפעלת סניפים ופרטי הסניף. סניף פעיל מופיע ללקוחות ברשימת הבחירה." />
      <input className="field" type="search" aria-label="חיפוש סניף" placeholder="חיפוש לפי עיר או אזור" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card table">
        {list.map((b) => (
          <div key={b.city}>
            <div className="trow">
              <b>{b.city}</b><span className="muted">{b.region}</span>
              <span className={'tag ' + (st.active[b.city] ? 'ok' : 'off')}>{st.active[b.city] ? 'פעיל' : 'לא פעיל'}</span>
              <Toggle on={!!st.active[b.city]} set={(v) => update((s) => { s.active[b.city] = v; return s })} />
              <button className="btn sm ghost" onClick={() => setEdit(edit === b.city ? null : b.city)}>{edit === b.city ? 'סגירה' : 'פרטי סניף'}</button>
            </div>
            {edit === b.city && (
              <div className="trow detail">
                <label className="lbl">כתובת<input className="field" value={info(b.city).address} onChange={(e) => setInfo(b.city, 'address', e.target.value)} /></label>
                <label className="lbl">טלפון<input className="field" value={info(b.city).phone} onChange={(e) => setInfo(b.city, 'phone', e.target.value)} /></label>
                <div className="wide"><HoursEditor value={info(b.city).hours} onChange={(v) => setInfo(b.city, 'hours', v)} /></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function Menu() {
  const st = useStore()
  const [cat, setCat] = useState('הכל')
  const edit = (id, k, v) => update((s) => { s.menu.find((p) => p.id === id)[k] = v; return s })
  const list = st.menu.filter((p) => cat === 'הכל' || p.cat === cat)
  return (
    <>
      <Head title="תפריט ראשי" sub="שינויים כאן משפיעים על כל הסניפים. זמינות (אזל) מנוהלת בכל סניף בנפרד.">
        <button className="btn" onClick={() => update((s) => { s.menu.unshift({ id: Date.now(), cat: CATS[0], name: 'מוצר חדש', desc: '', price: 0, pizza: false, ing: [] }); return s })}>+ הוספת מוצר</button>
      </Head>
      <div className="row wrapRow">{['הכל', ...CATS].map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
      {list.map((p) => (
        <div className="card mrow" key={p.id}>
          <div className="thumb">{p.img ? <img src={p.img} alt="" /> : <span>אין תמונה</span>}
            <label className="btn sm ghost up">{p.img ? 'החלפת תמונה' : 'העלאת תמונה'}<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files[0]; if (f) edit(p.id, 'img', await toDataUrl(f)) }} /></label>
            {p.img && <button className="link" onClick={() => edit(p.id, 'img', '')}>הסרה</button>}
          </div>
          <div className="mfields">
            <input className="field" aria-label="שם" value={p.name} onChange={(e) => edit(p.id, 'name', e.target.value)} />
            <input className="field" aria-label="תיאור" placeholder="תיאור" value={p.desc} onChange={(e) => edit(p.id, 'desc', e.target.value)} />
            <div className="row wrapRow">
              <select className="field" aria-label="קטגוריה" value={p.cat} onChange={(e) => edit(p.id, 'cat', e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              <label className="row">₪<input className="field price" type="number" min="0" aria-label="מחיר" value={p.price} onChange={(e) => edit(p.id, 'price', +e.target.value)} /></label>
              <Toggle on={!p.hidden} set={(v) => edit(p.id, 'hidden', !v)} label="מוצג ללקוחות" />
              <button className="link" onClick={() => confirm(`למחוק את "${p.name}"?`) && update((s) => { s.menu = s.menu.filter((x) => x.id !== p.id); return s })}>מחיקה</button>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

function System() {
  return (
    <>
      <Head title="מערכת" sub="כלי הדגמה" />
      <div className="card pad"><p>איפוס מוחק את כל השינויים בתפריט, בסניפים ובהזמנות בדפדפן הזה וחוזר לנתוני ההתחלה.</p>
        <button className="btn" onClick={() => confirm('לאפס את כל נתוני ההדגמה?') && reset()}>איפוס נתוני הדגמה</button></div>
    </>
  )
}

function BranchOverview() {
  const st = useStore()
  const b = st.harish
  const n = st.menu.filter((p) => !p.hidden).length
  const stats = [['הזמנות חדשות', st.orders.filter((o) => o.status === 'חדשה').length], ['בהכנה', st.orders.filter((o) => o.status === 'בהכנה').length], ['מוצרים שאזלו', b.out.length + ' / ' + n]]
  return (
    <>
      <Head title="סקירה" sub="פיצה סטורי – חריש" />
      <div className={'card statusbar ' + (b.open ? 'is-open' : 'is-closed')}>
        <div><b>{b.open ? 'הסניף פתוח להזמנות' : 'הסניף סגור להזמנות'}</b><span>הלקוחות רואים את הסטטוס באתר מיידית</span></div>
        <Toggle on={b.open} set={(v) => update((s) => { s.harish.open = v; return s })} />
      </div>
      <div className="stats">{stats.map(([t, v]) => <div className="card stat" key={t}><b>{v}</b><span>{t}</span></div>)}</div>
      <div className="row wrapRow"><a className="btn" href="#/admin/branch/availability">עדכון זמינות מוצרים</a><a className="btn ghost" href="#/admin/branch/orders">לניהול הזמנות</a></div>
    </>
  )
}

function Availability() {
  const st = useStore()
  const b = st.harish
  const [cat, setCat] = useState('הכל')
  const [q, setQ] = useState('')
  const shown = st.menu.filter((p) => !p.hidden && (cat === 'הכל' || p.cat === cat) && p.name.includes(q))
  const setOut = (ids, out) => update((s) => { const set = new Set(s.harish.out); ids.forEach((i) => (out ? set.add(i) : set.delete(i))); s.harish.out = [...set]; return s })
  return (
    <>
      <Head title="זמינות מוצרים" sub="כיבוי מוצר מסמן אותו כ״אזל״ ללקוחות הסניף. שמות, תמונות ומחירים מנוהלים בהנהלה המרכזית.">
        <button className="btn sm ghost" onClick={() => setOut(shown.map((p) => p.id), false)}>סימון הכל במלאי</button>
      </Head>
      <div className="row wrapRow">
        <input className="field search" type="search" aria-label="חיפוש מוצר" placeholder="חיפוש מוצר" value={q} onChange={(e) => setQ(e.target.value)} />
        {['הכל', ...CATS].map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="card table">
        {shown.map((p) => {
          const out = b.out.includes(p.id)
          return (
            <div className={'trow' + (out ? ' outrow' : '')} key={p.id}>
              {p.img ? <img className="mini" src={p.img} alt="" /> : <span className="mini" />}
              <b>{p.name}</b><span className="muted">{p.cat} · {ils(p.price)}</span>
              <span className={'tag ' + (out ? 'bad' : 'ok')}>{out ? 'אזל' : 'במלאי'}</span>
              <Toggle on={!out} set={(v) => setOut([p.id], !v)} />
            </div>
          )
        })}
        {!shown.length && <p className="empty">לא נמצאו מוצרים</p>}
      </div>
    </>
  )
}

function Settings() {
  const st = useStore()
  const b = st.harish, info = st.info['חריש']
  const rows = parseHours(info.hours)
  return (
    <>
      <Head title="הגדרות סניף" sub="פרטי הסניף (כתובת, טלפון, שעות) מוגדרים בהנהלה המרכזית." />
      <div className="cols">
        <div className="card pad"><h2>פרטי הסניף</h2>
          <dl className="kv"><dt>כתובת</dt><dd>{info.address}</dd><dt>טלפון</dt><dd>{info.phone}</dd></dl>
        </div>
        <div className="card pad"><h2>שעות פעילות</h2>
          <table className="hoursT"><tbody>{rows.map(([d, h]) => <tr key={d}><th scope="row">{d}</th><td>{h}</td></tr>)}</tbody></table>
        </div>
      </div>
      <div className="card pad"><h2>אמצעי תשלום</h2><p className="muted">רק אמצעי תשלום פעילים מוצגים ללקוחות בסניף.</p>
        <div className="paygrid">{[['cash', 'מזומן', 'תשלום לשליח בעת קבלה'], ['credit', 'אשראי', 'דרך ספק סליקה (בעתיד)'], ['simply', 'Simply', 'דרך Simply (בעתיד)']].map(([k, t, d]) => (
          <div className="card paycard" key={k}><div><b>{t}</b><span className="muted">{d}</span></div>
            <Toggle on={b.pay[k]} set={(v) => update((s) => { s.harish.pay[k] = v; return s })} /></div>))}</div>
      </div>
    </>
  )
}

const COLS = ['חדשה', 'בהכנה', 'מוכנה', 'נמסרה']
function Orders() {
  const st = useStore()
  return (
    <>
      <Head title="הזמנות" sub="הזמנות דמה שבוצעו באתר הלקוח בדפדפן זה" />
      <div className="kanban">
        {COLS.map((c, ci) => {
          const list = st.orders.map((o, i) => [o, i]).filter(([o]) => o.status === c)
          return (
            <section key={c} aria-label={c}><h2>{c} <span className="cnt">{list.length}</span></h2>
              {list.map(([o, i]) => (
                <div className="card pad order" key={o.no}>
                  <div className="spread"><b>{o.no}</b><small className="muted">{o.at}</small></div>
                  <ul>{o.items.map((x) => <li key={x.key}>{x.qty}× {x.name}</li>)}</ul>
                  <small className="muted">{o.method} · {ils(o.sum.total)} · {o.sum.form.mode === 'pickup' ? 'איסוף' : 'משלוח'}</small>
                  {ci < 3 && <button className="btn sm full" onClick={() => update((s) => { s.orders[i].status = COLS[ci + 1]; return s })}>העברה ל{COLS[ci + 1]}</button>}
                </div>
              ))}
              {!list.length && <p className="muted empty2">אין הזמנות</p>}
            </section>
          )
        })}
      </div>
    </>
  )
}
