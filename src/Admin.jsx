import { useEffect, useState } from 'react'
import { BRANCHES, CATS } from './data.js'
import { useStore, actions, sb, manageStaff, login, logout, currentStaff } from './store.js'

const NL = String.fromCharCode(10)
const ils = (n) => `₪${n}`
const Toggle = ({ on, set, label }) => <label className="sw"><input type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} /><span className="knob" />{label && <span>{label}</span>}</label>

// תמונה מוקטנת ל-640px לפני העלאה ל-Storage
const toBlob = (file) => new Promise((res) => {
  const img = new Image()
  img.onload = () => {
    const k = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement('canvas')
    c.width = img.width * k; c.height = img.height * k
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    c.toBlob(res, 'image/webp', 0.8)
  }
  img.src = URL.createObjectURL(file)
})

const NAV = {
  network: { title: 'הנהלה מרכזית', items: [['overview', 'סקירה כללית'], ['branches', 'סניפים'], ['menu', 'תפריט ראשי'], ['extras', 'תוספות']] },
  branch: { title: 'ניהול סניף', items: [['overview', 'סקירה'], ['availability', 'זמינות מוצרים'], ['settings', 'הגדרות סניף'], ['orders', 'הזמנות']] },
}

export default function Admin({ route }) {
  const [, , level, section] = route.split('/')
  const [who, setWho] = useState(undefined) // undefined = בודקים סשן קיים
  const st = useStore()
  useEffect(() => { if (NAV[level]) currentStaff(level).then(setWho) }, [level])
  const logo = <img className="biglogo" src="logo.png" alt="פיצה סטורי" />
  if (!NAV[level]) return (
    <section className="pick">{logo}<h1>כניסת ניהול</h1>
      <a className="btn full" href="#/admin/branch">כניסת מנהל סניף</a>
      <a className="btn full ghost" href="#/admin/network">כניסת הנהלה מרכזית</a></section>
  )
  if (who === undefined || (who && !st.ready)) return <p className="empty" role="status">טוען…</p>
  if (!who) return <Login level={level} logo={logo} onOk={setWho} />
  const items = NAV[level].items
  const cur = items.find(([k]) => k === section) ? section : items[0][0]
  const Page = { overview: level === 'branch' ? BranchOverview : Overview, branches: Branches, menu: Menu, extras: Extras, availability: Availability, settings: Settings, orders: Orders }[cur]
  return (
    <div className="shell">
      <aside className="side">
        <img src="logo.png" alt="פיצה סטורי" />
        <b>{level === 'branch' ? `${NAV[level].title} ${st.cur}` : NAV[level].title}</b>
        <small className="who">מחובר/ת: {who}</small>
        <nav aria-label="ניהול">{items.map(([k, t]) => <a key={k} href={`#/admin/${level}/${k}`} aria-current={k === cur ? 'page' : undefined}>{t}</a>)}</nav>
        <div className="sidefoot">
          <a href="#/home">לאתר הלקוח ↗</a>
          <button className="link" onClick={async () => { await logout(); setWho(null) }}>יציאה</button>
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
  const stats = [['סניפים פעילים', act], ['מוצרים בתפריט', st.menu.filter((p) => !p.hidden).length], ['מוצרים מוסתרים', st.menu.filter((p) => p.hidden).length], [`אזלו בסניף ${st.cur}`, st.branch.out.length], ['הזמנות', st.orders.length]]
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
  const setInfo = (c, k, v) => actions.setInfo(c, { [k]: v })
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
              <Toggle on={!!st.active[b.city]} set={(v) => actions.setActive(b.city, v)} />
              <button className="btn sm ghost" onClick={() => setEdit(edit === b.city ? null : b.city)}>{edit === b.city ? 'סגירה' : 'פרטי סניף'}</button>
            </div>
            {edit === b.city && (
              <div className="trow detail">
                <label className="lbl">כתובת<input className="field" value={info(b.city).address} onChange={(e) => setInfo(b.city, 'address', e.target.value)} /></label>
                <label className="lbl">טלפון<input className="field" value={info(b.city).phone} onChange={(e) => setInfo(b.city, 'phone', e.target.value)} /></label>
                <div className="wide"><HoursEditor value={info(b.city).hours} onChange={(v) => setInfo(b.city, 'hours', v)} /></div>
                <div className="wide"><StaffBox city={b.city} /></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function StaffBox({ city }) {
  const st = useStore()
  const [list, setList] = useState([])
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [msg, setMsg] = useState('')
  const refresh = () => sb.from('staff').select('username').eq('branch_id', st.ids[city]).then(({ data }) => setList(data || []))
  useEffect(() => { refresh() }, [city])
  const gen = () => setP(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(9)))).replace(/[+/=]/g, 'x'))
  const call = async (action, username, password) => {
    setMsg('...')
    const r = await manageStaff({ action, city, username, password })
    setMsg(r.error ? r.error : action === 'delete' ? 'המשתמש נמחק' : 'נשמר. העבירו את הסיסמה לצוות הסניף; היא לא תוצג שוב.')
    if (!r.error) { setU(''); setP(''); refresh() }
  }
  return (
    <fieldset className="hrs"><legend>משתמשי סניף (כניסה לניהול הסניף)</legend>
      {list.length ? list.map((x) => <div className="row" key={x.username}><b>{x.username}</b><button type="button" className="link" onClick={() => confirm('למחוק את ' + x.username + '?') && call('delete', x.username)}>מחיקה</button></div>) : <p className="muted">אין עדיין משתמש לסניף</p>}
      <div className="row wrapRow">
        <input className="field" aria-label="שם משתמש" placeholder="שם משתמש (באנגלית)" value={u} onChange={(e) => setU(e.target.value)} />
        <input className="field" aria-label="סיסמה" placeholder="סיסמה (8 תווים ומעלה)" value={p} onChange={(e) => setP(e.target.value)} />
        <button type="button" className="btn sm ghost" onClick={gen}>יצירת סיסמה</button>
        <button type="button" className="btn sm" disabled={!u || !p} onClick={() => call('upsert', u, p)}>שמירת משתמש</button>
      </div>
      <p className="muted">משתמש קיים עם אותו שם מקבל סיסמה חדשה.</p>
      {msg && <p role="status">{msg}</p>}
    </fieldset>
  )
}

function ExtraRow({ e }) {
  const [d, setD] = useState({ name: e.name, price: e.price })
  const [saved, setSaved] = useState(false)
  const upd = (k, v) => { setD({ ...d, [k]: v }); setSaved(false) }
  const dirty = d.name !== e.name || d.price !== e.price
  const save = async () => setSaved(!(await actions.setExtra(e.id, d)))
  return (
    <div className="row wrapRow">
      <input className="field" aria-label="שם תוספת" value={d.name} onChange={(x) => upd('name', x.target.value)} />
      <label className="row">₪<input className="field price" type="number" min="0" aria-label="מחיר תוספת" value={d.price} onChange={(x) => upd('price', +x.target.value)} /></label>
      <button className="btn sm" disabled={!dirty || !d.name.trim()} onClick={save}>שמירה</button>
      {saved && !dirty && <span className="tag ok">נשמר ✓</span>}
      <button className="link" onClick={() => confirm(`למחוק את "${e.name}"? היא תוסר גם מכל הפיצות.`) && actions.deleteExtra(e.id)}>מחיקה</button>
    </div>
  )
}

function Extras() {
  const st = useStore()
  return (
    <>
      <Head title="תוספות" sub="מגדירים כאן פעם אחת את כל התוספות והמחירים. אחר כך מסמנים בתפריט הראשי אילו מהן כלולות בכל פיצה. כל סניף יכול לסמן תוספת שחסרה אצלו.">
        <button className="btn" onClick={() => actions.addExtra()}>+ הוספת תוספת</button>
      </Head>
      <div className="card pad">
        {st.extras.map((e) => <ExtraRow key={e.id} e={e} />)}
        {!st.extras.length && <p className="empty">אין תוספות עדיין</p>}
      </div>
    </>
  )
}

function ProductEditor({ p, extras }) {
  const [d, setD] = useState({ name: p.name, desc: p.desc, cat: p.cat, price: p.price, hidden: p.hidden, noExtras: p.noExtras, ing: p.ing })
  const [saved, setSaved] = useState(false)
  const upd = (k, v) => { setD({ ...d, [k]: v }); setSaved(false) }
  const dirty = Object.keys(d).some((k) => JSON.stringify(d[k]) !== JSON.stringify(p[k]))
  const save = async () => setSaved(!(await actions.setProduct(p.id, d)))
  const tick = (id) => upd('ing', d.ing.includes(id) ? d.ing.filter((x) => x !== id) : [...d.ing, id])
  return (
    <div className="card mrow">
      <div className="thumb">{p.img ? <img src={p.img} alt="" /> : <span>אין תמונה</span>}
        <label className="btn sm ghost up">{p.img ? 'החלפת תמונה' : 'העלאת תמונה'}<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files[0]; if (f) actions.uploadImage(p.id, await toBlob(f)) }} /></label>
        {p.img && <button className="link" onClick={() => actions.setProduct(p.id, { img: '' })}>הסרה</button>}
      </div>
      <div className="mfields">
        <input className="field" aria-label="שם" value={d.name} onChange={(e) => upd('name', e.target.value)} />
        <input className="field" aria-label="תיאור" placeholder="תיאור" value={d.desc} onChange={(e) => upd('desc', e.target.value)} />
        <div className="row wrapRow">
          <select className="field" aria-label="קטגוריה" value={d.cat} onChange={(e) => upd('cat', e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
          <label className="row">₪<input className="field price" type="number" min="0" aria-label="מחיר" value={d.price} onChange={(e) => upd('price', +e.target.value)} /></label>
          <Toggle on={!d.hidden} set={(v) => upd('hidden', !v)} label="מוצג ללקוחות" />
        </div>
        {p.pizza && (
          <fieldset><legend>מרכיבי הפיצה (תוספות שכלולות בה)</legend>
            <div className="row wrapRow">{extras.map((x) => <label key={x.id} className="opt"><input type="checkbox" checked={d.ing.includes(x.id)} onChange={() => tick(x.id)} /> {x.name}</label>)}
              {!extras.length && <span className="muted">קודם מגדירים תוספות בעמוד ״תוספות״</span>}</div>
            <Toggle on={d.noExtras} set={(v) => upd('noExtras', v)} label="פיצה מיוחדת: הלקוח יכול רק להסיר מרכיבים, לא להוסיף" />
          </fieldset>
        )}
        <div className="row wrapRow">
          <button className="btn sm" disabled={!dirty} onClick={save}>שמירת שינויים</button>
          {saved && !dirty && <span className="tag ok">נשמר ✓</span>}
          {dirty && <span className="muted">יש שינויים שלא נשמרו</span>}
          <button className="link" onClick={() => confirm(`למחוק את "${p.name}"?`) && actions.deleteProduct(p.id)}>מחיקה</button>
        </div>
      </div>
    </div>
  )
}

function Menu() {
  const st = useStore()
  const [cat, setCat] = useState('הכל')
  const list = st.menu.filter((p) => cat === 'הכל' || p.cat === cat)
  return (
    <>
      <Head title="תפריט ראשי" sub="שינויים כאן משפיעים על כל הסניפים. זמינות (אזל) מנוהלת בכל סניף בנפרד. אחרי עריכה לוחצים ״שמירת שינויים״.">
        <button className="btn" onClick={() => actions.addProduct()}>+ הוספת מוצר</button>
      </Head>
      <div className="row wrapRow">{['הכל', ...CATS].map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
      {list.map((p) => <ProductEditor key={p.id} p={p} extras={st.extras} />)}
    </>
  )
}

function BranchOverview() {
  const st = useStore()
  const b = st.branch
  const n = st.menu.filter((p) => !p.hidden).length
  const stats = [['הזמנות חדשות', st.orders.filter((o) => o.status === 'חדשה').length], ['בהכנה', st.orders.filter((o) => o.status === 'בהכנה').length], ['מוצרים שאזלו', b.out.length + ' / ' + n]]
  return (
    <>
      <Head title="סקירה" sub={`פיצה סטורי – ${st.cur}`} />
      <div className={'card statusbar ' + (b.open ? 'is-open' : 'is-closed')}>
        <div><b>{b.open ? 'הסניף פתוח להזמנות' : 'הסניף סגור להזמנות'}</b><span>הלקוחות רואים את הסטטוס באתר מיידית</span></div>
        <Toggle on={b.open} set={(v) => actions.setOpen(v)} />
      </div>
      <div className="stats">{stats.map(([t, v]) => <div className="card stat" key={t}><b>{v}</b><span>{t}</span></div>)}</div>
      <div className="row wrapRow"><a className="btn" href="#/admin/branch/availability">עדכון זמינות מוצרים</a><a className="btn ghost" href="#/admin/branch/orders">לניהול הזמנות</a></div>
    </>
  )
}

function Availability() {
  const st = useStore()
  const b = st.branch
  const [cat, setCat] = useState('הכל')
  const [q, setQ] = useState('')
  const shown = st.menu.filter((p) => !p.hidden && (cat === 'הכל' || p.cat === cat) && p.name.includes(q))
  const setOut = (ids, out) => actions.setOut(ids, out)
  return (
    <>
      <Head title="זמינות מוצרים" sub="כיבוי מוצר מסמן אותו כ״אזל״ ללקוחות הסניף. שמות, תמונות ומחירים מנוהלים בהנהלה המרכזית.">
        <button className="btn sm ghost" onClick={() => setOut(shown.map((p) => p.id), false)}>סימון הכל במלאי</button>
      </Head>
      <div className="row wrapRow">
        <input className="field search" type="search" aria-label="חיפוש מוצר" placeholder="חיפוש מוצר" value={q} onChange={(e) => setQ(e.target.value)} />
        {['הכל', ...CATS].map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="card pad"><h2>תוספות לפיצה</h2>
        <p className="muted">כבו תוספת שחסרה בסניף; היא תוצג ללקוחות כ״לא זמין״.</p>
        {st.extras.map((e) => <div className="row wrapRow" key={e.id}><b>{e.name}</b><span className="muted">{ils(e.price)}</span><Toggle on={!b.outEx.includes(e.id)} set={(v) => actions.setExtraOut(e.id, !v)} /></div>)}
      </div>
      <div className="card table">
        {shown.map((p) => {
          const out = b.out.includes(p.id)
          return (
            <div className={'trow' + (out ? ' outrow' : '')} key={p.id}>
              {p.img ? <img className="mini" src={p.img} alt="" /> : <span className="mini" />}
              <b>{p.name}</b><span className="muted">{p.cat} · {ils(p.price)}{p.pizza && p.ing.length > 0 && ' · מרכיבים: ' + st.extras.filter((x) => p.ing.includes(x.id)).map((x) => x.name).join(', ')}{p.pizza && p.noExtras && ' · פיצה מיוחדת'}</span>
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
  const b = st.branch, c = st.cur, info = st.info[c] || { address: '', phone: '', hours: '' }
  const sec = [['delivery', 'משלוח', 'הלקוחות יכולים להזמין משלוח'], ['pickup', 'איסוף עצמי', 'הלקוחות יכולים להזמין ולאסוף מהסניף']]
  return (
    <>
      <Head title="הגדרות סניף" sub="כל סניף מעדכן את הפרטים שלו, והשינויים מופיעים באתר הלקוח." />
      <div className="card pad"><h2>פרטי הסניף</h2>
        <div className="cols">
          <label className="lbl">כתובת<input className="field" value={info.address} onChange={(e) => actions.setInfo(c, { address: e.target.value })} /></label>
          <label className="lbl">טלפון<input className="field" value={info.phone} onChange={(e) => actions.setInfo(c, { phone: e.target.value })} /></label>
        </div>
        <HoursEditor value={info.hours} onChange={(v) => actions.setInfo(c, { hours: v })} />
      </div>
      <div className="card pad"><h2>סוגי שירות</h2><p className="muted">אפשר לכבות משלוח או איסוף עצמי בכל רגע, למשל כשאין שליחים.</p>
        <div className="paygrid">{sec.map(([k, t, d]) => (
          <div className="card paycard" key={k}><div><b>{t}</b><span className="muted">{d}</span></div>
            <Toggle on={b[k]} set={(v) => actions.setService(k, v)} /></div>))}</div>
      </div>
      <div className="card pad"><h2>אמצעי תשלום</h2><p className="muted">רק אמצעי תשלום פעילים מוצגים ללקוחות בסניף.</p>
        <div className="paygrid">{[['cash', 'מזומן', 'תשלום לשליח בעת קבלה'], ['credit', 'אשראי', 'דרך ספק סליקה (בעתיד)'], ['simply', 'Simply', 'דרך Simply (בעתיד)']].map(([k, t, d]) => (
          <div className="card paycard" key={k}><div><b>{t}</b><span className="muted">{d}</span></div>
            <Toggle on={b.pay[k]} set={(v) => actions.setPay(k, v)} /></div>))}</div>
      </div>
    </>
  )
}

const COLS = ['חדשה', 'בהכנה', 'מוכנה', 'נמסרה']
function Orders() {
  const st = useStore()
  return (
    <>
      <Head title="הזמנות" sub="הזמנות הלקוחות של הסניף" />
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
                  {ci < 3 && <button className="btn sm full" onClick={() => actions.setOrderStatus(o.id, COLS[ci + 1])}>העברה ל{COLS[ci + 1]}</button>}
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
