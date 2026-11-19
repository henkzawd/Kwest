// Alt som snakker med databasen og sanntidskanalen.
// To varianter med likt grensesnitt: Supabase (ekte) og demo (bare i denne nettleseren).
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { uid } from './util.js';

const LIST_COLS = 'id,title,description,owner,question_count,created_at,updated_at,profiles(name,email)';

function supabaseBackend() {
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  const ok = ({ data, error }) => { if (error) throw error; return data; };

  async function profile(userId) {
    return ok(await client.from('profiles').select('*').eq('id', userId).maybeSingle());
  }

  return {
    mode: 'supabase',
    async session() {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      return { user: { id: user.id, email: user.email }, profile: await profile(user.id) };
    },
    async signIn(email, password) {
      ok(await client.auth.signInWithPassword({ email, password }));
    },
    async signUp(email, password, name) {
      const data = ok(await client.auth.signUp({ email, password, options: { data: { name } } }));
      // Hvis e-postbekreftelse er slått på i Supabase, finnes ingen innlogging ennå.
      return { needsConfirm: !data.session };
    },
    async signOut() { await client.auth.signOut(); },
    async resetPassword(email) {
      ok(await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
    },
    async updatePassword(password) { ok(await client.auth.updateUser({ password })); },
    onAuth(cb) { client.auth.onAuthStateChange((event) => cb(event)); },

    async listQuizzes() {
      const rows = ok(await client.from('quizzes').select(LIST_COLS).order('updated_at', { ascending: false }));
      return rows.map(r => ({ ...r, owner_name: r.profiles?.name || r.profiles?.email || '' }));
    },
    async getQuiz(id) {
      return ok(await client.from('quizzes').select('*').eq('id', id).single());
    },
    async saveQuiz(q) {
      const row = { title: q.title, description: q.description, data: q.data, question_count: q.data.questions.length, updated_at: new Date().toISOString() };
      if (q.id) return ok(await client.from('quizzes').update(row).eq('id', q.id).select('id,owner,updated_at').single());
      return ok(await client.from('quizzes').insert(row).select('id,owner,updated_at').single());
    },
    async deleteQuiz(id) { ok(await client.from('quizzes').delete().eq('id', id)); },
    async listProfiles() {
      return ok(await client.from('profiles').select('*').order('created_at', { ascending: true }));
    },
    async updateProfile(id, patch) { ok(await client.from('profiles').update(patch).eq('id', id)); },

    channel(pin) {
      const ch = client.channel('kwest-' + pin, { config: { broadcast: { self: false, ack: false } } });
      return {
        on(event, cb) { ch.on('broadcast', { event }, msg => cb(msg.payload || {})); },
        subscribe(onStatus) {
          return new Promise(resolve => {
            ch.subscribe(status => {
              onStatus?.(status);
              if (status === 'SUBSCRIBED') resolve();
            });
          });
        },
        send(event, payload) { return ch.send({ type: 'broadcast', event, payload }); },
        close() { client.removeChannel(ch); },
      };
    },
  };
}

// ---------- Demo: lagrer i nettleseren og bruker BroadcastChannel mellom faner ----------
function demoBackend() {
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const users = () => read('kwest-demo-users', []);
  const quizzes = () => read('kwest-demo-quizzes', []);
  const current = () => read('kwest-demo-session', null);
  const listeners = [];
  const fire = e => listeners.forEach(cb => cb(e));
  const me = () => users().find(u => u.id === current());
  const prof = u => u && ({ id: u.id, email: u.email, name: u.name, is_admin: u.is_admin, approved: u.approved, created_at: u.created_at });

  return {
    mode: 'demo',
    async session() {
      const u = me();
      return u ? { user: { id: u.id, email: u.email }, profile: prof(u) } : null;
    },
    async signIn(email, password) {
      const u = users().find(x => x.email === email.toLowerCase() && x.password === password);
      if (!u) throw new Error('Invalid login credentials');
      write('kwest-demo-session', u.id);
      fire('SIGNED_IN');
    },
    async signUp(email, password, name) {
      const list = users();
      if (list.some(x => x.email === email.toLowerCase())) throw new Error('User already registered');
      const first = list.length === 0;
      const u = { id: uid(), email: email.toLowerCase(), password, name, is_admin: first, approved: first, created_at: new Date().toISOString() };
      list.push(u);
      write('kwest-demo-users', list);
      write('kwest-demo-session', u.id);
      fire('SIGNED_IN');
      return { needsConfirm: false };
    },
    async signOut() { localStorage.removeItem('kwest-demo-session'); fire('SIGNED_OUT'); },
    async resetPassword() { throw new Error('Ikke tilgjengelig i demo-modus'); },
    async updatePassword() {},
    onAuth(cb) { listeners.push(cb); },

    async listQuizzes() {
      const us = users();
      return quizzes().map(({ data, ...q }) => {
        const o = us.find(u => u.id === q.owner);
        return { ...q, owner_name: o?.name || o?.email || '' };
      }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },
    async getQuiz(id) {
      const q = quizzes().find(x => x.id === id);
      if (!q) throw new Error('not-found');
      return q;
    },
    async saveQuiz(q) {
      const list = quizzes();
      const now = new Date().toISOString();
      const u = me();
      if (q.id) {
        const row = list.find(x => x.id === q.id);
        if (!row) throw new Error('not-found');
        if (row.owner !== u.id && !u.is_admin) throw new Error('permission denied');
        Object.assign(row, { title: q.title, description: q.description, data: q.data, question_count: q.data.questions.length, updated_at: now });
        write('kwest-demo-quizzes', list);
        return { id: row.id, owner: row.owner, updated_at: now };
      }
      const row = { id: uid(), owner: u.id, title: q.title, description: q.description, data: q.data, question_count: q.data.questions.length, created_at: now, updated_at: now };
      list.push(row);
      write('kwest-demo-quizzes', list);
      return { id: row.id, owner: row.owner, updated_at: now };
    },
    async deleteQuiz(id) { write('kwest-demo-quizzes', quizzes().filter(x => x.id !== id)); },
    async listProfiles() { return users().map(prof); },
    async updateProfile(id, patch) {
      const list = users();
      Object.assign(list.find(u => u.id === id), patch);
      write('kwest-demo-users', list);
    },

    channel(pin) {
      const bc = new BroadcastChannel('kwest-' + pin);
      const handlers = {};
      bc.onmessage = e => { const { event, payload } = e.data || {}; handlers[event]?.forEach(cb => cb(payload || {})); };
      return {
        on(event, cb) { (handlers[event] ||= []).push(cb); },
        async subscribe(onStatus) { onStatus?.('SUBSCRIBED'); },
        async send(event, payload) { bc.postMessage({ event, payload }); },
        close() { bc.close(); },
      };
    },
  };
}

export const backend = SUPABASE_URL && SUPABASE_KEY && window.supabase ? supabaseBackend() : demoBackend();
