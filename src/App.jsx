import { useEffect, useState } from 'react'
import { BRANCH, BRANCHES, ZONES, CATS, PROMOS } from './data.js'
import { useStore, useInfo, actions, load, selectBranch } from './store.js'
import Admin from './Admin.jsx'

const go = (p) => { location.hash = p }
const ils = (n) => `₪${n}`
const useHash = () => {
  const [h, s] = useState(location.hash.slice(1) || '/')
  useEffect(() => {
    const f = () => { s(location.hash.slice(1) || '/'); scrollTo(0, 0) }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return h
}
const Img = ({ hue = 20, img, big }) => img ? <img className={'img' + (big ? ' big' : '')} src={img} alt="" loading="lazy" /> : (
  <div className={'img' + (big ? ' big' : '')} style={{ background: `linear-gradient(135deg,hsl(${hue} 70% 82%),hsl(${hue} 60% 62%))` }} role="img" aria-label="תמונת המוצר">🍕</div>
)
const Back = ({ to, children }) => <a className="back" href={'#' + to}>→ {children}</a>

export default function App() {
  const route = useHash()
  const [cart, setCart] = useState([])
  const st = useStore()
  const closed = !st.branch.open
  const menu = st.menu.filter((p) => !p.hidden).map((p) => ({ ...p, out: st.branch.out.includes(p.id) }))
  const [cookies, setCookies] = useState(() => localStorage.getItem('ck') || '')
  const [form0, setForm] = useState({ mode: 'delivery', name: '', phone: '', city: 'חריש', street: '', num: '', apt: '', floor: '', ent: '', note: '' })
  const [order, setOrder] = useState(null)

  const br = st.branch
  // אם שירות (משלוח/איסוף) כבוי בסניף, עוברים אוטומטית לשירות הפעיל
  const mode = form0.mode === 'delivery' && !br.delivery && br.pickup ? 'pickup' : form0.mode === 'pickup' && !br.pickup && br.delivery ? 'delivery' : form0.mode
  // אזורי משלוח מפורטים קיימים כרגע רק לחריש; לשאר הסניפים אזור ברירת מחדל (העיר עצמה)
  const zones = st.cur === 'חריש' ? ZONES : [{ city: st.cur, fee: 0, min: 0, free: 0, eta: '45–60 דק׳' }]
  const form = { ...form0, mode, branch: st.cur, city: form0.city === 'אחר' || zones.some((z) => z.city === form0.city) ? form0.city : zones[0].city }
  const zone = zones.find((z) => z.city === form.city)
  const sub = cart.reduce((a, i) => a + i.price * i.qty, 0)
  const delivery = form.mode === 'pickup' ? 0 : zone ? (zone.free && sub >= zone.free ? 0 : zone.fee) : 0
  const min = form.mode === 'pickup' ? 0 : zone ? zone.min : 0
  const handling = cart.length ? BRANCH.handling : 0
  const total = sub + delivery + handling
  const count = cart.reduce((a, i) => a + i.qty, 0)
  const addToCart = (item) => {
    setCart((c) => {
      const same = c.find((i) => i.key === item.key)
      return same ? c.map((i) => (i === same ? { ...i, qty: i.qty + item.qty } : i)) : [...c, item]
    })
    go('/cart')
  }
  const setQty = (key, d) => setCart((c) => c.map((i) => (i.key === key ? { ...i, qty: Math.max(1, i.qty + d) } : i)))
  const del = (key) => setCart((c) => c.filter((i) => i.key !== key))
  const sum = { sub, delivery, handling, total, form, zone }

  if (route.startsWith('/admin')) return <Admin route={route} />
  if (!st.ready) return <p className="empty" role="status">{st.error ? <>שגיאה בטעינת הנתונים. <button className="link" onClick={load}>נסו שוב</button></> : 'טוען…'}</p>
  const [, a, b] = route.split('/')
  let page
  if (route === '/') page = <Branches active={st.active} info={st.info} />
  else if (route === '/home') page = <Home menu={menu} />
  else if (route === '/menu') page = <Menu menu={menu} closed={closed} />
  else if (a === 'product') page = <Product p={menu.find((x) => x.id === +b)} extras={st.extras.map((e) => ({ ...e, ok: !st.branch.outEx.includes(e.id) }))} add={addToCart} closed={closed} />
  else if (route === '/cart') page = <Cart cart={cart} sum={sum} setQty={setQty} del={del} closed={closed} />
  else if (route === '/checkout') page = <Checkout form={form} setForm={setForm} sum={sum} min={min} cart={cart} br={br} zones={zones} />
  else if (route === '/pay') page = <Pay sum={sum} cart={cart} pay={st.branch.pay} done={async (o, key) => { const err = await actions.addOrder(o, key); if (err) { alert('שליחת ההזמנה נכשלה: ' + err.message); return false } setOrder(o); setCart([]); go('/done') }} />
  else if (route === '/done') page = <Done order={order} />
  else if (route === '/promos') page = <Promos />
  else if (route === '/info') page = <Info info={st.info[st.cur]} />
  else if (route === '/states') page = <States />
  else page = <States notFound />

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main').focus() }}>דלג לתוכן</a>
      {route !== '/' && (
        <header className="hdr">
          <a className="logo" href="#/home"><img src="logo.png" alt="פיצה סטורי – לדף הבית" /></a>
          <nav aria-label="ראשי">
            <a href="#/home">בית</a><a href="#/menu">תפריט</a><a href="#/promos">מבצעים</a><a href="#/info">צור קשר</a>
          </nav>
          <a className="btn sm cartbtn" href="#/cart" aria-label={`סל קניות, ${count} פריטים`}>סל ({count})</a>
        </header>
      )}
      <main id="main" tabIndex={-1}>
        {closed && route !== '/' && <div className="alert warn" role="status">הסניף סגור כרגע. אפשר לגלוש בתפריט, אך לא ניתן להזמין עד לפתיחה.</div>}
        {page}
      </main>
      <footer className="ftr">
        <b>פיצה סטורי</b>
        <div><a href="#/info">צור קשר</a> · <a href="https://pizza-story.co.il/?page_id=877" target="_blank" rel="noreferrer">הצהרת נגישות</a> · <a href="#/info">מדיניות פרטיות</a> · <a href="#/info">תקנון ותנאי שימוש</a> · <a href="#/info">ביטולים והחזרים</a></div>
        <small>{st.info[st.cur].phone} · {BRANCH.email} · {BRANCH.kosher}</small>
      </footer>
      {!cookies && (
        <div className="cookies" role="dialog" aria-label="העדפות עוגיות">
          <p>אנו משתמשים בעוגיות חיוניות לתפעול האתר. עוגיות שאינן חיוניות (ניתוח ושיווק) – רק באישורך.</p>
          <button className="btn sm" onClick={() => { localStorage.setItem('ck', 'all'); setCookies('all') }}>אישור הכל</button>
          <button className="btn sm ghost" onClick={() => { localStorage.setItem('ck', 'ess'); setCookies('ess') }}>חיוניות בלבד</button>
        </div>
      )}
    </>
  )
}

function Branches({ active, info: allInfo }) {
  const [sort, setSort] = useState('az')
  const [city, setCity] = useState('')
  const list = BRANCHES.map((b) => ({ ...b, active: active[b.city] }))
  const opt = (b) => <option key={b.city} value={b.city} disabled={!b.active}>{b.city}{b.active ? '' : ' (בקרוב)'}</option>
  const regions = [...new Set(BRANCHES.map((b) => b.region))]
  return (
    <section className="pick">
      <img className="biglogo" src="logo.png" alt="פיצה סטורי – הטעם זה כל הסיפור" />
      <h1>באיזה סניף תרצו להזמין?</h1>
      <div className="seg" role="group" aria-label="מיון הרשימה">
        <button className={sort === 'az' ? 'on' : ''} aria-pressed={sort === 'az'} onClick={() => setSort('az')}>לפי א׳–ב׳</button>
        <button className={sort === 'region' ? 'on' : ''} aria-pressed={sort === 'region'} onClick={() => setSort('region')}>לפי אזור</button>
      </div>
      <label className="lbl">בחרו סניף
        <select className="field" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">בחרו סניף מהרשימה…</option>
          {sort === 'az' ? list.map(opt) : regions.map((r) => <optgroup key={r} label={r}>{list.filter((b) => b.region === r).map(opt)}</optgroup>)}
        </select>
      </label>
      {city && active[city] && (
        <div className="card branch">
          <div>
            <h3>פיצה סטורי – {city}</h3>
            <p>{allInfo[city]?.address || city}{allInfo[city]?.hours && <><br />{allInfo[city].hours.split('\n')[0]}</>}</p>
          </div>
          <button className="btn" onClick={async () => { await selectBranch(city); go('/home') }}>המשך להזמנה</button>
        </div>
      )}
    </section>
  )
}

function Home({ menu }) {
  const info = useInfo()
  const cur = useStore().cur
  const top = menu.filter((p) => p.cat === 'פיצות').slice(0, 3)
  return (
    <>
      <section className="hero wrap">
        <div>
          <p className="muted">פיצה סטורי – {cur}</p>
          <h1>כל מגש, סיפור אהבה.</h1>
          <p>בצק שנאפה בשבילכם, תוספות שאתם אוהבים. הזמינו למשלוח או לאיסוף עצמי.</p>
          <div className="row"><a className="btn" href="#/menu">להזמנה</a><a className="btn ghost" href="#/promos">למבצעים</a></div>
        </div>
        <Img img="img/regular.webp" big />
      </section>
      <section className="wrap">
        <h2>קטגוריות</h2>
        <div className="row wrapRow">{CATS.map((c) => <a key={c} className="chip" href="#/menu">{c}</a>)}</div>
        <h2>הפיצות של הערב</h2>
        <div className="grid">{top.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        <div className="card promo">
          <div><h2>יותר משלושה. יותר ביחד.</h2><p>{PROMOS[0].title} – {PROMOS[0].price}</p></div>
          <a className="btn" href="#/promos">לפרטי המבצע</a>
        </div>
        <h2>פרטי הסניף</h2>
        <p>{info.address} · {info.phone}</p>
      </section>
    </>
  )
}

function ProductCard({ p, closed }) {
  return (
    <article className={'card prod' + (p.out ? ' out' : '')}>
      <a href={'#/product/' + p.id}><Img img={p.img} hue={p.hue} /></a>
      <div className="pad">
        <h3>{p.name}</h3>
        <p className="muted">{p.desc}</p>
        <div className="spread">
          <b>{ils(p.price)}</b>
          {p.out ? <span className="tag bad">אזל</span> : <a className="btn sm" href={'#/product/' + p.id} aria-disabled={closed}>הוספה</a>}
        </div>
      </div>
    </article>
  )
}

function Menu({ menu, closed }) {
  const [cat, setCat] = useState('הכל')
  const [q, setQ] = useState('')
  const list = menu.filter((p) => (cat === 'הכל' || p.cat === cat) && (p.name + p.desc).includes(q))
  return (
    <section className="wrap">
      <h1>התפריט שלנו</h1>
      <input className="field" type="search" aria-label="חיפוש בתפריט" placeholder="חיפוש בתפריט" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row wrapRow" role="group" aria-label="סינון לפי קטגוריה">
        {['הכל', ...CATS].map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      {list.length ? <div className="grid">{list.map((p) => <ProductCard key={p.id} p={p} closed={closed} />)}</div> : <p className="empty">לא נמצאו מוצרים. נסו חיפוש אחר.</p>}
    </section>
  )
}

function Product({ p, extras, add, closed }) {
  const [ex, setEx] = useState([])
  const [rm, setRm] = useState([])
  const [note, setNote] = useState('')
  const [qty, setQty] = useState(1)
  if (!p) return <States notFound />
  const inc = p.pizza ? extras.filter((e) => p.ing.includes(e.id)) : []
  const addable = p.noExtras ? [] : extras.filter((e) => !p.ing.includes(e.id))
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const unit = p.price + ex.reduce((a, n) => a + (extras.find((e) => e.name === n)?.price || 0), 0)
  const submit = () => {
    add({ key: [p.id, ex, rm, note].join('|'), name: p.name, detail: [...ex.map((x) => '+' + x), ...rm.map((x) => 'בלי ' + x), note].filter(Boolean).join(' · '), price: unit, qty })
  }
  return (
    <section className="wrap narrow">
      <Back to="/menu">חזרה לתפריט</Back>
      <Img img={p.img} hue={p.hue} big />
      <h1>{p.name}</h1>
      <p>{p.desc}</p>
      <dl className="kv info"><dt>קטגוריה</dt><dd>{p.cat}</dd><dt>כשרות</dt><dd>{BRANCH.kosher}</dd><dt>מחיר</dt><dd>{ils(p.price)}</dd></dl>
      {p.out && <div className="alert bad" role="status">המוצר אזל זמנית ולא ניתן להוסיפו לסל.</div>}
      {inc.length > 0 && <p className="muted">מרכיבים: {inc.map((e) => e.name).join(', ')}</p>}
      {p.pizza && addable.length > 0 && (
        <fieldset><legend>תוספות <span className="opt-tag">רשות</span></legend>
          {addable.map((e) => <label key={e.id} className={'opt' + (e.ok ? '' : ' dis')}><input type="checkbox" disabled={!e.ok} checked={ex.includes(e.name)} onChange={() => toggle(ex, setEx, e.name)} /> {e.name} <em>{e.ok ? '+' + ils(e.price) : 'לא זמין'}</em></label>)}
        </fieldset>
      )}
      {inc.length > 0 && (
        <fieldset><legend>הסרת מרכיבים <span className="opt-tag">רשות</span></legend>
          {inc.map((e) => <label key={e.id} className="opt"><input type="checkbox" checked={rm.includes(e.name)} onChange={() => toggle(rm, setRm, e.name)} /> בלי {e.name}</label>)}
        </fieldset>
      )}
      <label className="lbl">הערות להכנה<textarea className="field" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="spread sticky">
        <div className="qty" role="group" aria-label="כמות">
          <button aria-label="הפחתה" onClick={() => setQty(Math.max(1, qty - 1))}>−</button><b>{qty}</b><button aria-label="הוספה" onClick={() => setQty(qty + 1)}>+</button>
        </div>
        <button className="btn" disabled={p.out || closed} onClick={submit}>הוספה לסל · {ils(unit * qty)}</button>
      </div>
    </section>
  )
}

function Summary({ s }) {
  return (
    <dl className="sum">
      <div><dt>סכום ביניים</dt><dd>{ils(s.sub)}</dd></div>
      <div><dt>דמי משלוח</dt><dd>{s.form.mode === 'pickup' ? 'איסוף עצמי' : s.delivery ? ils(s.delivery) : 'חינם'}</dd></div>
      <div><dt>דמי טיפול</dt><dd>{ils(s.handling)}</dd></div>
      <div className="tot"><dt>סך לתשלום</dt><dd>{ils(s.total)}</dd></div>
    </dl>
  )
}

function Cart({ cart, sum, setQty, del, closed }) {
  if (!cart.length) return <section className="wrap narrow"><p className="empty">הסל ריק. עדיין לא הוספתם מוצרים.</p><a className="btn" href="#/menu">לתפריט</a></section>
  return (
    <section className="wrap narrow">
      <h1>הסל שלי</h1>
      {cart.map((i) => (
        <div className="card line" key={i.key}>
          <div><b>{i.name}</b><p className="muted">{i.detail}</p></div>
          <div className="qty"><button aria-label="הפחתה" onClick={() => setQty(i.key, -1)}>−</button><b>{i.qty}</b><button aria-label="הוספה" onClick={() => setQty(i.key, 1)}>+</button></div>
          <b>{ils(i.price * i.qty)}</b>
          <button className="link" onClick={() => del(i.key)}>הסרה</button>
        </div>
      ))}
      <Summary s={sum} />
      <button className="btn full" disabled={closed} onClick={() => go('/checkout')}>המשך להזמנה</button>
    </section>
  )
}

function Checkout({ form, setForm, sum, min, cart, br, zones }) {
  const info = useInfo()
  const [errs, setErrs] = useState({})
  if (!cart.length) return <section className="wrap narrow"><p className="empty">הסל ריק.</p><a className="btn" href="#/menu">לתפריט</a></section>
  if (!br.delivery && !br.pickup) return <section className="wrap narrow"><div className="alert bad" role="alert">הסניף לא מקבל הזמנות כרגע (אין משלוח ואין איסוף עצמי).</div></section>
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const del = form.mode === 'delivery'
  const out = del && !sum.zone
  const short = del && sum.zone && sum.sub < min
  const next = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'נא להזין שם'
    if (!/^0\d{8,9}$/.test(form.phone.replace(/-/g, ''))) e.phone = 'נא להזין מספר טלפון תקין'
    if (del && !form.street.trim()) e.street = 'נא להזין רחוב'
    if (del && !form.num.trim()) e.num = 'נא להזין מספר בית'
    setErrs(e)
    if (!Object.keys(e).length && !out && !short) go('/pay')
  }
  const F = ({ k, label, ...r }) => (
    <label className="lbl">{label}
      <input className="field" value={form[k]} onChange={set(k)} aria-invalid={!!errs[k]} {...r} />
      {errs[k] && <span className="error" role="alert">{errs[k]}</span>}
    </label>
  )
  return (
    <section className="wrap narrow">
      <Back to="/cart">חזרה לסל</Back>
      <h1>פרטי הזמנה</h1>
      <div className="seg" role="group" aria-label="סוג הזמנה">
        {[['delivery', 'משלוח'], ['pickup', 'איסוף עצמי']].filter(([k]) => br[k]).map(([k, t]) => <button key={k} className={form.mode === k ? 'on' : ''} aria-pressed={form.mode === k} onClick={() => setForm({ ...form, mode: k })}>{t}</button>)}
      </div>
      {F({k:"name", label:"שם מלא", autoComplete:"name" })}
      {F({k:"phone", label:"טלפון", type:"tel", autoComplete:"tel" })}
      {del ? (
        <>
          <label className="lbl">עיר
            <select className="field" value={form.city} onChange={set('city')}>
              {zones.map((z) => <option key={z.city}>{z.city}</option>)}<option value="אחר">עיר אחרת</option>
            </select>
          </label>
          {F({k:"street", label:"רחוב" })}{F({k:"num", label:"מספר בית", inputMode:"numeric" })}
          <div className="row3">{F({k:"apt", label:"דירה" })}{F({k:"floor", label:"קומה" })}{F({k:"ent", label:"כניסה" })}</div>
          <label className="lbl">הערות לשליח<textarea className="field" value={form.note} onChange={set('note')} /></label>
          {out && <div className="alert bad" role="alert">הכתובת מחוץ לאזור השירות ולכן לא ניתן להזמין משלוח. אפשר לבחור איסוף עצמי.</div>}
          {sum.zone && <p className="muted">זמן משלוח משוער: {sum.zone.eta} · מינימום הזמנה: {ils(sum.zone.min)}{sum.zone.free ? ` · משלוח חינם מעל ${ils(sum.zone.free)}` : ''}</p>}
          {short && <div className="alert warn" role="alert">חסרים {ils(min - sum.sub)} להגעה למינימום הזמנה למשלוח ל{form.city}.</div>}
        </>
      ) : <p className="muted">איסוף מ{info.address}. זמן הכנה משוער: 15–20 דק׳.</p>}
      <Summary s={sum} />
      <button className="btn full" disabled={out || short} onClick={next}>המשך לתשלום</button>
    </section>
  )
}

function Pay({ sum, cart, pay, done }) {
  const info = useInfo()
  const methods = [['cash', 'מזומן'], ['credit', 'אשראי'], ['simply', 'Simply']].filter(([k]) => pay[k])
  const [m, setM] = useState(methods[0]?.[0])
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!cart.length) return <section className="wrap narrow"><p className="empty">הסל ריק.</p></section>
  if (!methods.length) return <section className="wrap narrow"><div className="alert bad" role="alert">אין כרגע אמצעי תשלום זמין בסניף.</div></section>
  const place = () => {
    setBusy(true)
    setTimeout(async () => { if ((await done({ address: info.address, no: 'PS-' + (10000 + Math.floor(Math.random() * 89999)), items: cart, sum, method: methods.find(([k]) => k === m)[1] }, m)) === false) setBusy(false) }, 1200)
  }
  return (
    <section className="wrap narrow">
      <Back to="/checkout">חזרה לפרטי הזמנה</Back>
      <h1>תשלום</h1>
      <div role="radiogroup" aria-label="אמצעי תשלום">
        {methods.map(([k, t]) => <label key={k} className={'card opt pm' + (m === k ? ' on' : '')}><input type="radio" name="pm" checked={m === k} onChange={() => setM(k)} /> {t}</label>)}
      </div>
      {m === 'cash' ? (
        <label className="opt"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> אני מתחייב/ת לשלם לשליח את הסכום המלא ({ils(sum.total)}) בעת קבלת ההזמנה</label>
      ) : <div className="alert" role="status">לאחר אישור ההזמנה ניצור איתך קשר להשלמת התשלום.</div>}
      <Summary s={sum} />
      <button className="btn full" disabled={busy || (m === 'cash' && !ok)} onClick={place}>{busy ? 'מעבד הזמנה…' : 'אישור והזמנה'}</button>
    </section>
  )
}

function Done({ order }) {
  if (!order) return <section className="wrap narrow"><p className="empty">אין הזמנה להצגה.</p><a className="btn" href="#/menu">לתפריט</a></section>
  return (
    <section className="wrap narrow">
      <div className="alert ok" role="status"><h1>ההזמנה התקבלה! ✓</h1>מספר הזמנה: <b>{order.no}</b></div>
      <p><b>פיצה סטורי – {order.sum.form.branch}</b> · {order.address}<br />{order.sum.form.mode === 'pickup' ? 'איסוף עצמי' : `משלוח ל${order.sum.form.street} ${order.sum.form.num}, ${order.sum.form.city}`}<br />תשלום: {order.method}</p>
      {order.items.map((i) => <div key={i.key} className="spread"><span>{i.qty}× {i.name} <small className="muted">{i.detail}</small></span><b>{ils(i.price * i.qty)}</b></div>)}
      <Summary s={order.sum} />
      <a className="btn full" href="#/home">חזרה לדף הבית</a>
    </section>
  )
}

function Promos() {
  return (
    <section className="wrap narrow">
      <h1>מבצעים</h1>
      {PROMOS.map((p) => (
        <div className="card promo" key={p.id}>
          <div><h2>{p.title}</h2><p className="muted">{p.terms}</p></div>
          <b className="price">{p.price}</b>
          <a className="btn sm" href="#/menu">לתפריט</a>
        </div>
      ))}
    </section>
  )
}

function Info({ info }) {
  return (
    <section className="wrap narrow">
      <h1>מידע ויצירת קשר</h1>
      <p>פיצה סטורי – {useStore().cur}<br />{info.address}<br />טלפון: <a href={'tel:' + info.phone}>{info.phone}</a><br />דוא״ל: <a href={'mailto:' + BRANCH.email}>{BRANCH.email}</a></p>
      <h2>שעות פעילות</h2>
      <ul>{info.hours.split('\n').map((l) => <li key={l}>{l}</li>)}</ul>
      <h2>כשרות</h2><p>{BRANCH.kosher}</p>
      <h2>מדיניות ונגישות</h2>
      <p><a href="https://pizza-story.co.il/?page_id=877" target="_blank" rel="noreferrer">הצהרת נגישות (באתר הרשמי)</a></p>
    </section>
  )
}

function States({ notFound }) {
  const [load, setLoad] = useState(false)
  return (
    <section className="wrap narrow">
      <h1>{notFound ? 'העמוד לא נמצא' : 'מצבי מערכת'}</h1>
      {notFound ? <a className="btn" href="#/home">לדף הבית</a> : (
        <>
          <div className="card pad"><p className="empty">הסל ריק</p></div>
          <div className="alert bad" role="alert">שגיאה בטעינת התפריט. <button className="link" onClick={() => setLoad(true)}>נסו שוב</button></div>
          {load && <div className="alert" role="status">טוען…</div>}
          <div className="alert warn">הסניף סגור – פתיחה מחר ב־11:00</div>
          <div className="alert bad">הכתובת מחוץ לאזור השירות</div>
          <div className="alert bad">מוצר שאזל – לא ניתן להוסיף לסל</div>
          <div className="alert warn">תוספת שאינה זמינה אינה מוצגת לבחירה</div>
        </>
      )}
    </section>
  )
}
