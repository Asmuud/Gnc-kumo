import { useEffect, useState } from 'react'
import { Bell, BookOpen, Headphones, Home, LogOut, Music2, ShieldCheck, Users, Upload, Download } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Profile = {
  id: string; full_name: string; phone: string; email: string; address: string
  photo_url: string | null; favourite_song: string; date_of_birth: string
  marital_status: string; education_level: string; role: 'member'|'admin'|'super_admin'
  approval_status: 'pending'|'approved'|'rejected'
}

const nav = [
  { id: 'home', label: 'Overview', icon: Home },
  { id: 'music', label: 'Music library', icon: Headphones },
  { id: 'announcements', label: 'Announcements', icon: Bell },
  { id: 'members', label: 'Members', icon: Users },
]

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState('home')
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadProfile() {
      if (!supabase || !session?.user?.id) { setProfile(null); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      setProfile(data as Profile | null)
    }
    loadProfile()
  }, [session])

  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setMessage('')
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: String(form.get('full_name')),
            phone: String(form.get('phone')),
            address: String(form.get('address')),
            favourite_song: String(form.get('favourite_song')),
            date_of_birth: String(form.get('date_of_birth')),
            marital_status: String(form.get('marital_status')),
            education_level: String(form.get('education_level'))
          }
        }
      })

      if (error) throw error
      if (!data.user) throw new Error('Account could not be created.')

      setMessage('Registration submitted successfully. Please verify your email and wait for an administrator to approve your account.')
      setMode('login')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setBusy(false)
    }
  }

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setMessage('')
    const form = new FormData(e.currentTarget)
    const { error } = await supabase.auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) })
    setMessage(error?.message || '')
    setBusy(false)
  }

  async function logout() { await supabase?.auth.signOut(); setProfile(null) }

  if (!isSupabaseConfigured) return <SetupScreen />
  if (!session) return <AuthScreen mode={mode} setMode={setMode} busy={busy} message={message} onLogin={login} onRegister={register} />
  if (!profile) return <main className="center"><div className="loader" /><p>Loading your account…</p></main>
  if (profile.approval_status !== 'approved' && profile.role === 'member') return (
    <main className="center"><div className="brand-mark"><ShieldCheck /></div><h1>Awaiting approval</h1>
      <p className="muted">Your GNC Kumo account has been created. An administrator must approve it before you can access the church community.</p>
      <button className="secondary" onClick={logout}>Sign out</button></main>
  )

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Music2 /></div><div><b>GNC Kumo</b><small>Church Community</small></div></div>
      <div className="nav-label">MENU</div>
      {nav.map(item => <button key={item.id} className={`nav-item ${tab===item.id?'active':''}`} onClick={()=>setTab(item.id)}><item.icon size={18}/>{item.label}</button>)}
      {profile.role !== 'member' && <><div className="nav-label">MANAGEMENT</div><button className={`nav-item ${tab==='admin'?'active':''}`} onClick={()=>setTab('admin')}><ShieldCheck size={18}/>Admin panel</button></>}
      <div className="sidebar-bottom"><button className="nav-item" onClick={logout}><LogOut size={18}/>Sign out</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">WELCOME TO GNC KUMO</span><h1>{nav.find(n=>n.id===tab)?.label || 'Admin panel'}</h1></div><div className="user-chip"><div className="avatar">{profile.full_name?.[0] || 'U'}</div><span>{profile.full_name}</span></div></header>
      {tab==='home' && <section className="welcome-card"><div><span className="eyebrow light">FAITH • MUSIC • COMMUNITY</span><h2>Welcome, {profile.full_name?.split(' ')[0]}.</h2><p>Your church community, music and announcements in one place.</p></div><div className="welcome-icon"><Music2 size={54}/></div></section>}
      {tab==='home' && <div className="quick-grid"><Quick icon={<Headphones/>} title="Music library" desc="Listen to church songs and explore MIDI files." onClick={()=>setTab('music')}/><Quick icon={<Bell/>} title="Announcements" desc="Keep up with church news and programmes." onClick={()=>setTab('announcements')}/><Quick icon={<BookOpen/>} title="My profile" desc="Your account is securely registered." onClick={()=>setTab('home')}/></div>}
      {tab==='music' && <MusicLibrary role={profile.role} />}
      {tab==='announcements' && <Announcements />}
      {tab==='members' && <Members role={profile.role}/>}
      {tab==='admin' && <AdminPanel role={profile.role}/>}
    </main>
  </div>
}

function Quick({icon,title,desc,onClick}:{icon:React.ReactNode,title:string,desc:string,onClick:()=>void}) {
  return <button className="quick-card" onClick={onClick}><div className="quick-icon">{icon}</div><b>{title}</b><p>{desc}</p><span className="text-link">Open section →</span></button>
}

function SetupScreen() {
  return <main className="center setup"><div className="brand-mark"><Music2/></div><span className="eyebrow">CHURCH MUSIC & COMMUNITY</span><h1>GNC Kumo</h1><p className="muted">The application is ready for its Supabase connection.</p><div className="notice"><b>Next setup step</b><p>Create a Supabase project, run <code>supabase/schema.sql</code> in its SQL Editor, create the storage buckets described in README, then add your project URL and anon key to <code>.env</code>.</p></div></main>
}

function AuthScreen({mode,setMode,busy,message,onLogin,onRegister}:{mode:'login'|'register',setMode:(m:'login'|'register')=>void,busy:boolean,message:string,onLogin:(e:React.FormEvent<HTMLFormElement>)=>void,onRegister:(e:React.FormEvent<HTMLFormElement>)=>void}) {
  return <main className="auth-layout"><section className="auth-art"><div className="brand-mark"><Music2/></div><span className="eyebrow light">FAITH • MUSIC • COMMUNITY</span><h1>GNC Kumo</h1><p>A home for our church family, songs and announcements.</p><div className="art-orbit">♪</div></section><section className="auth-panel"><div className="auth-box"><span className="eyebrow">WELCOME</span><h2>{mode==='login'?'Sign in':'Create your account'}</h2><p className="muted">{mode==='login'?'Access your GNC Kumo account.':'Register to join the GNC Kumo community.'}</p>
    <form onSubmit={mode==='login'?onLogin:onRegister} className="form">
      {mode==='register' && <>
        <label>Full name<input name="full_name" required placeholder="Your full name"/></label>
        <div className="two"><label>Phone number<input name="phone" required type="tel" placeholder="+234…"/></label><label>Date of birth<input name="date_of_birth" required type="date"/></label></div>
        <label>Email address<input name="email" required type="email" placeholder="you@example.com"/></label>
        <label>Residential address<textarea name="address" required rows={2} placeholder="Your home address"/></label>
        <label>Profile photo<input name="photo" type="file" accept="image/*"/></label>
        <label>Favourite song<input name="favourite_song" required placeholder="Song title / artist"/></label>
        <div className="two"><label>Marital status<select name="marital_status" required defaultValue=""><option value="" disabled>Select status</option><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option><option>Prefer not to say</option></select></label><label>Education level<select name="education_level" required defaultValue=""><option value="" disabled>Select level</option><option>Primary</option><option>Secondary</option><option>OND / ND</option><option>HND</option><option>Bachelor's degree</option><option>Postgraduate</option><option>Other</option></select></label></div>
      </>}
      {mode==='login' && <label>Email address<input name="email" type="email" required placeholder="you@example.com"/></label>}
      <label>Password<input name="password" type="password" minLength={8} required placeholder="At least 8 characters"/></label>
      <button className="primary" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Submit registration'}</button>
    </form>
    {message && <div className="notice">{message}</div>}
    <p className="switch">{mode==='login'?"Don't have an account?":'Already registered?'} <button onClick={()=>{setMode(mode==='login'?'register':'login')}}>{mode==='login'?'Create account':'Sign in'}</button></p>
    <small className="privacy">Your personal details are private and visible only to authorised church administrators where necessary.</small>
  </div></section></main>
}

function MusicLibrary({role}:{role:string}) {
  const [songs,setSongs] = useState<any[]>([])
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')

  async function loadSongs() {
    if (!supabase) return
    let query = supabase.from('songs').select('*').order('created_at',{ascending:false})
    if (role === 'member') query = query.eq('published',true)
    const {data,error} = await query
    if (error) setMessage(error.message)
    else setSongs(data || [])
  }

  useEffect(()=>{ loadSongs() },[role])

  async function uploadSong(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase) return
    const client = supabase
    const form = e.currentTarget
    const values = new FormData(form)
    const title = String(values.get('title') || '').trim()
    const artist = String(values.get('artist') || '').trim()
    const category = String(values.get('category') || '').trim()
    const lyrics = String(values.get('lyrics') || '').trim()
    const audio = values.get('audio') as File
    const cover = values.get('cover') as File
    const midi = values.get('midi') as File
    const published = values.get('published') === 'on'

    if (!title || !audio || !audio.size) {
      setMessage('Please enter a song title and select an audio file.')
      return
    }
    if (audio.size > 50 * 1024 * 1024) {
      setMessage('Audio file must be smaller than 50 MB.')
      return
    }
    if (cover.size > 5 * 1024 * 1024) {
      setMessage('Cover image must be smaller than 5 MB.')
      return
    }
    if (midi.size > 10 * 1024 * 1024) {
      setMessage('MIDI file must be smaller than 10 MB.')
      return
    }

    setBusy(true)
    setMessage('Uploading song files…')
    const id = crypto.randomUUID()
    const safeName = (file:File) => file.name.replace(/[^a-zA-Z0-9._-]/g,'_')
    let audioUrl:string | null = null
    let coverUrl:string | null = null
    let midiPath:string | null = null

    try {
      const audioPath = `${id}/${safeName(audio)}`
      const audioResult = await client.storage.from('song-audio').upload(audioPath,audio)
      if (audioResult.error) throw audioResult.error
      audioUrl = client.storage.from('song-audio').getPublicUrl(audioPath).data.publicUrl

      if (cover.size) {
        const coverPath = `${id}/${safeName(cover)}`
        const result = await client.storage.from('song-covers').upload(coverPath,cover)
        if (result.error) throw result.error
        coverUrl = client.storage.from('song-covers').getPublicUrl(coverPath).data.publicUrl
      }

      if (midi.size) {
        midiPath = `${id}/${safeName(midi)}`
        const result = await client.storage.from('song-midi').upload(midiPath,midi)
        if (result.error) throw result.error
      }

      const {error} = await client.from('songs').insert({
        title, artist, category, lyrics,
        audio_url:audioUrl,
        cover_url:coverUrl,
        midi_url:midiPath,
        published,
        created_by:(await client.auth.getUser()).data.user?.id
      })
      if (error) throw error

      form.reset()
      setMessage(published ? 'Song uploaded and published successfully.' : 'Song uploaded successfully. It is saved as unpublished.')
      await loadSongs()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function downloadMidi(path:string) {
    if (!supabase) return
    const {data,error} = await supabase.storage.from('song-midi').createSignedUrl(path,3600)
    if (error) {
      setMessage(error.message)
      return
    }
    window.open(data.signedUrl,'_blank','noopener,noreferrer')
  }

  return <section className="content-card">
    <div className="section-head"><div><h2>Church music</h2><p className="muted">Songs, lyrics and MIDI resources shared by church administrators.</p></div></div>

    {role !== 'member' && <div className="notice">
      <h3><Upload size={18}/> Upload new music</h3>
      <form className="form" onSubmit={uploadSong}>
        <label>Song title<input name="title" required placeholder="Enter song title"/></label>
        <div className="two">
          <label>Artist / Choir<input name="artist" placeholder="Artist or choir name"/></label>
          <label>Category<input name="category" placeholder="e.g. Worship, Praise"/></label>
        </div>
        <label>Lyrics<textarea name="lyrics" rows={5} placeholder="Enter song lyrics here"/></label>
        <label>Audio file (required)<input name="audio" type="file" accept="audio/*" required/></label>
        <label>Cover image (optional)<input name="cover" type="file" accept="image/*"/></label>
        <label>MIDI file (optional)<input name="midi" type="file" accept=".mid,.midi,audio/midi"/></label>
        <label><input name="published" type="checkbox" defaultChecked/> Publish immediately for approved members</label>
        <button className="primary" disabled={busy}><Upload size={16}/>{busy?'Uploading…':'Upload song'}</button>
      </form>
    </div>}

    {message && <div className="notice">{message}</div>}

    <h3>Available songs</h3>
    {songs.length===0?<Empty title="No songs available" desc="New songs uploaded by the music administrator will appear here."/>:
      <div className="song-list">{songs.map(song=><article className="song" key={song.id}>
        {song.cover_url?<img src={song.cover_url} alt="Song cover"/>:<div className="song-cover"><Music2/></div>}
        <div className="song-info">
          <b>{song.title}</b>
          <small>{song.artist||'GNC Kumo Music'}{song.category ? ` · ${song.category}` : ''}</small>
          {song.audio_url&&<audio controls src={song.audio_url}/>}
          {song.lyrics&&<details><summary>View lyrics</summary><p style={{whiteSpace:'pre-wrap'}}>{song.lyrics}</p></details>}
          {song.midi_url&&<button className="secondary" type="button" onClick={()=>downloadMidi(song.midi_url)}><Download size={15}/> Download MIDI</button>}
          {role !== 'member' && <small>Publication: {song.published?'Published':'Unpublished'}</small>}
        </div>
      </article>)}</div>
    }
  </section>
}
function Announcements() {
  const [items,setItems]=useState<any[]>([])
  useEffect(()=>{if(!supabase)return;supabase.from('announcements').select('*').eq('published',true).order('created_at',{ascending:false}).then(({data})=>setItems(data||[]))},[])
  return <section className="content-card"><h2>Announcements</h2><p className="muted">Updates and programmes from GNC Kumo.</p>{items.length===0?<Empty title="No announcements yet" desc="Published church updates will appear here."/>:items.map(a=><article className="announcement" key={a.id}><span className="eyebrow">{new Date(a.created_at).toLocaleDateString()}</span><h3>{a.title}</h3><p>{a.body}</p></article>)}</section>
}
function Members({role}:{role:string}) {
  const [rows,setRows]=useState<any[]>([])
  useEffect(()=>{if(role==='member'||!supabase)return;supabase.from('profiles').select('id,full_name,phone,email,approval_status,role').order('full_name').then(({data})=>setRows(data||[]))},[role])
  if(role==='member')return <Empty title="Members directory" desc="This directory is available to authorised administrators only in this starter build."/>
  return <section className="content-card"><h2>Member management</h2><p className="muted">Review registered accounts and approval status.</p>{rows.map(r=><div className="member-row" key={r.id}><div className="avatar">{r.full_name?.[0]}</div><div className="member-info"><b>{r.full_name}</b><small>{r.email} · {r.phone}</small></div><span className={`status ${r.approval_status}`}>{r.approval_status}</span></div>)}</section>
}
function AdminPanel({role}:{role:string}) {
  if(role==='member')return <Empty title="Restricted area" desc="You do not have administrator permissions."/>
  return <section className="content-card"><div className="admin-banner"><ShieldCheck/><div><b>Administrator workspace</b><p>Signed in with the {role.replace('_',' ')} role.</p></div></div><h2>Administration</h2><p className="muted">The next development step will add secure song uploads, announcement publishing, member approvals and administrator role management.</p><div className="notice"><b>Security note</b><p>Never promote an account by editing browser data. Admin roles must be assigned by the trusted project owner through Supabase's protected database tools.</p></div></section>
}
function Empty({title,desc}:{title:string,desc:string}) { return <div className="empty"><div className="empty-icon"><Music2/></div><b>{title}</b><p>{desc}</p></div> }
