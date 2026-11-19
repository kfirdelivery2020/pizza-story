// shortcut: חשבונות הדגמה עם סיסמאות מגובבות (SHA-256) בקוד הלקוח – זה לא אבטחה אמיתית (כל אחד רואה את הקוד).
// להחליף בכניסה מול שרת (סשן/JWT, סיסמאות bcrypt, הרשאות מנהל/עובד, נעילה בצד שרת) לפני שימוש אמיתי.
const ACCOUNTS = [
  {
    "level": "branch",
    "user": "harish",
    "hash": "0a4df8181a1cc11f052244d0e50fb5f0ae0fbef20ca58d6b8d89b8a2958da711"
  },
  {
    "level": "network",
    "user": "hq",
    "hash": "e0e4d6aea82ac98d163a3ee3da4f2962cd7560ac36dd87244c66852f4321d1f2"
  }
]
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')
let fails = 0, until = 0
export async function login(level, user, pass) {
  if (Date.now() < until) return { error: 'יותר מדי ניסיונות. נסו שוב בעוד דקה.' }
  const a = ACCOUNTS.find((x) => x.level === level && x.user === user.trim().toLowerCase())
  if (a && a.hash === (await sha(`ps:${level}:${a.user}:${pass}`))) { fails = 0; return { user: a.user } }
  if (++fails >= 5) { until = Date.now() + 60000; fails = 0 }
  return { error: 'שם משתמש או סיסמה שגויים' }
}
