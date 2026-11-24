import { useEffect, useState } from 'react'
import { Bell, BookOpen, Headphones, Home, LogOut, Music2, ShieldCheck, Users, UserRound, Upload, Download, FileText } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { saveOfflineDocument, getOfflineDocument, removeOfflineDocument, listOfflineDocuments } from './lib/offlineFiles'

type Profile = {
  id: string; full_name: string; phone: string; email: string; address: string
  photo_url: string | null; favourite_song: string; date_of_birth: string
  marital_status: string; education_level: string; role: 'member'|'admin'|'super_admin'
  approval_status: 'pending'|'approved'|'rejected'
}

const nav = [
  { id: 'home', label: 'Overview', icon: Home },
  { id: 'music', label: 'Music library', icon: Headphones },
  { id: 'documents', label: 'PDF Library', icon: FileText },
  { id: 'announcements', label: 'Announcements', icon: Bell },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'profile', label: 'My Profile', icon: UserRound },
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
      {tab==='home' && <div className="quick-grid"><Quick icon={<Headphones/>} title="Music library" desc="Listen to church songs and explore MIDI files." onClick={()=>setTab('music')}/><Quick icon={<Bell/>} title="Announcements" desc="Keep up with church news and programmes." onClick={()=>setTab('announcements')}/><Quick icon={<BookOpen/>} title="My profile" desc="Your account is securely registered." onClick={()=>setTab('profile')}/></div>}
      {tab==='music' && <MusicLibrary role={profile.role} />}
      {tab==='documents' && <DocumentsLibrary role={profile.role} userId={profile.id} />}
      {tab==='announcements' && <Announcements role={profile.role} userId={profile.id} />}
      {tab==='members' && <Members role={profile.role}/>}
      {tab==='profile' && <MyProfile profile={profile} onUpdated={setProfile}/>}
      {tab==='admin' && <AdminPanel role={profile.role} onNavigate={setTab}/>}
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
      setMessage(err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err))
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
function Announcements({role,userId}:{role:string,userId:string}) {
  const [items,setItems] = useState<any[]>([])
  const [title,setTitle] = useState('')
  const [body,setBody] = useState('')
  const [link,setLink] = useState('')
  const [pinned,setPinned] = useState(false)
  const [published,setPublished] = useState(true)
  const [imageFile,setImageFile] = useState<File|null>(null)
  const [pdfFile,setPdfFile] = useState<File|null>(null)
  const [videoFile,setVideoFile] = useState<File|null>(null)
  const [editing,setEditing] = useState<string|null>(null)
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  const isAdmin = role==='admin' || role==='super_admin'

  async function loadAnnouncements() {
    if (!supabase) return
    let query = supabase.from('announcements').select('*')
      .order('pinned',{ascending:false})
      .order('created_at',{ascending:false})
    if (!isAdmin) query = query.eq('published',true)
    const {data,error} = await query
    if (error) { setMessage(error.message); return }
    const rows = await Promise.all((data||[]).map(async (item:any) => {
      const media:any = {}
      for (const field of ['image_path','pdf_path','video_path']) {
        if (item[field]) {
          const {data:file} = await supabase!.storage
            .from('announcement-media').createSignedUrl(item[field],3600)
          media[field.replace('_path','_url')] = file?.signedUrl || ''
        }
      }
      return {...item,...media}
    }))
    setItems(rows)
  }

  useEffect(()=>{ loadAnnouncements() },[role])

  function resetForm() {
    setTitle('')
    setBody('')
    setLink('')
    setPinned(false)
    setPublished(true)
    setImageFile(null)
    setPdfFile(null)
    setVideoFile(null)
    setEditing(null)
  }

  function startEdit(item:any) {
    setEditing(item.id)
    setTitle(item.title||'')
    setBody(item.body||'')
    setLink(item.link_url||'')
    setPinned(!!item.pinned)
    setPublished(!!item.published)
    setImageFile(null)
    setPdfFile(null)
    setVideoFile(null)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  async function saveAnnouncement(e:React.FormEvent) {
    e.preventDefault()
    if (!supabase || !title.trim()) return
    const files = [imageFile,pdfFile,videoFile].filter(Boolean) as File[]
    if (files.some(file=>file.size>50*1024*1024)) {
      setMessage('Each attachment must be below 50MB.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const paths:any = {}
      const uploadFile = async (file:File|null,field:string) => {
        if (!file) return
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_')
        const path = `${userId}/${crypto.randomUUID()}-${safeName}`
        const {error} = await supabase!.storage.from('announcement-media')
          .upload(path,file,{upsert:false})
        if (error) throw error
        paths[field] = path
      }
      await uploadFile(imageFile,'image_path')
      await uploadFile(pdfFile,'pdf_path')
      await uploadFile(videoFile,'video_path')

      const record:any = {
        title:title.trim(),
        body:body.trim(),
        link_url:link.trim()||null,
        pinned,
        published,
        created_by:userId
      }
      Object.assign(record,paths)

      if (editing) {
        const {error} = await supabase.from('announcements')
          .update(record).eq('id',editing)
        if (error) throw error
      } else {
        const {error} = await supabase.from('announcements').insert(record)
        if (error) throw error
      }
      resetForm()
      setMessage('Announcement saved successfully.')
      await loadAnnouncements()
    } catch (error:any) {
      setMessage(error.message||'Could not save announcement.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteAnnouncement(item:any) {
    if (!supabase || !window.confirm('Delete this announcement?')) return
    setBusy(true)
    const paths = [item.image_path,item.pdf_path,item.video_path].filter(Boolean)
    const {error} = await supabase.from('announcements').delete().eq('id',item.id)
    if (error) {
      setMessage(error.message)
    } else {
      if (paths.length) await supabase.storage.from('announcement-media').remove(paths)
      setMessage('Announcement deleted.')
      await loadAnnouncements()
    }
    setBusy(false)
  }

  return (
    <section className="content-card">
      <h2>Announcements</h2>
      <p className="muted">Updates and programmes from GNC Kumo.</p>

      {isAdmin && (
        <form className="announcement-form" onSubmit={saveAnnouncement}>
          <h3>{editing?'Edit announcement':'Publish announcement'}</h3>
          <label>Title</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} required placeholder="Announcement title"/>
          <label>Message</label>
          <textarea value={body} onChange={e=>setBody(e.target.value)} rows={5} placeholder="Write announcement details..."/>
          <label>Image (optional)</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setImageFile(e.target.files?.[0]||null)}/>
          <label>PDF document (optional)</label>
          <input type="file" accept="application/pdf" onChange={e=>setPdfFile(e.target.files?.[0]||null)}/>
          <label>Video (MP4 or WebM, optional)</label>
          <input type="file" accept="video/mp4,video/webm" onChange={e=>setVideoFile(e.target.files?.[0]||null)}/>
          <label>External link (optional)</label>
          <input type="url" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://example.com"/>
          <label className="announcement-check">
            <input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> Publish now
          </label>
          <label className="announcement-check">
            <input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)}/> Pin announcement at top
          </label>
          <div className="announcement-actions">
            <button type="submit" disabled={busy}>{busy?'Saving...':editing?'Update announcement':'Publish announcement'}</button>
            {editing&&<button type="button" className="secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      )}

      {message&&<p className="muted">{message}</p>}

      {items.length===0
        ? <Empty title="No announcements yet" desc="Published church updates will appear here."/>
        : items.map(item=>(
          <article className="announcement" key={item.id}>
            <span className="eyebrow">
              {new Date(item.created_at).toLocaleDateString()}
              {item.pinned?' · PINNED':''}
              {!item.published&&isAdmin?' · DRAFT':''}
            </span>
            <h3>{item.title}</h3>
            <p style={{whiteSpace:'pre-wrap'}}>{item.body}</p>
            {item.image_url&&<img className="announcement-image" src={item.image_url} alt={item.title}/>}
            {item.pdf_url&&<p><a href={item.pdf_url} target="_blank" rel="noreferrer">View / Download PDF</a></p>}
            {item.video_url&&<video className="announcement-video" src={item.video_url} controls/>}
            {item.link_url&&<p><a href={item.link_url} target="_blank" rel="noreferrer">Open link</a></p>}
            {isAdmin&&<div className="announcement-actions">
              <button type="button" className="secondary" onClick={()=>startEdit(item)}>Edit</button>
              <button type="button" className="secondary" disabled={busy} onClick={()=>deleteAnnouncement(item)}>Delete</button>
            </div>}
          </article>
        ))}
    </section>
  )
}

function Members({role}:{role:string}) {
  const [rows,setRows]=useState<any[]>([])
  const [selected,setSelected]=useState<any>(null)
  const [busyId,setBusyId]=useState('')
  const [message,setMessage]=useState('')

  const isAdmin = role === 'admin' || role === 'super_admin'

  async function loadMembers() {
    if (!supabase || !isAdmin) return
    const {data,error} = await supabase
      .from('profiles')
      .select('*')
      .order('created_at',{ascending:false})

    if (error) setMessage(error.message)
    else {
      setRows(data || [])
      if (selected) {
        const updated = (data || []).find((r:any)=>r.id===selected.id)
        setSelected(updated || null)
      }
    }
  }

  useEffect(()=>{loadMembers()},[role])

  async function updateApproval(id:string,status:'approved'|'rejected') {
    if (!supabase || !isAdmin) return

    setBusyId(id)
    setMessage('Updating member status...')

    const {data,error} = await supabase
      .from('profiles')
      .update({approval_status:status})
      .eq('id',id)
      .eq('role','member')
      .select('*')

    if (error) {
      setMessage(error.message)
    } else if (!data || data.length===0) {
      setMessage('No changes made. Please check administrator permissions.')
    } else {
      setMessage(status === 'approved'
        ? 'Member approved successfully.'
        : 'Member rejected successfully.')
      await loadMembers()
    }

    setBusyId('')
  }

  if (!isAdmin) return <Empty title="Restricted area" desc="This directory is available to authorised administrators only."/>

  return <section className="content-card">
    <h2>Member management</h2>
    <p className="muted">Review registrations and approve or reject member accounts.</p>

    {message && <div className="notice">{message}</div>}

    {rows.length===0
      ? <Empty title="No members found" desc="Registered members will appear here."/>
      : rows.map(r=><div className="member-row" key={r.id}>
        <div className="avatar">{r.full_name?.[0] || 'M'}</div>
        <div className="member-info">
          <button type="button" className="text-button" onClick={()=>setSelected(r)}>
            {r.full_name} — View details
          </button>
          <small>{r.email} · {r.phone}</small>
          <small>Role: {r.role}</small>
        </div>
        <span className={`status ${r.approval_status}`}>{r.approval_status}</span>

        {r.role === 'member' && r.approval_status !== 'approved' && (
          <div className="member-actions">
            <button className="primary" disabled={!!busyId} onClick={()=>updateApproval(r.id,'approved')}>
              {busyId===r.id?'Please wait...':'Approve'}
            </button>
            {r.approval_status !== 'rejected' && (
              <button disabled={!!busyId} onClick={()=>updateApproval(r.id,'rejected')}>
                Reject
              </button>
            )}
          </div>
        )}
      </div>)
    }

    {selected && (
      <div className="content-card" style={{marginTop:20}}>
        <h2>Member details</h2>
        {selected.photo_url && (
          <img src={selected.photo_url} alt="Member profile" style={{width:110,height:110,borderRadius:'50%',objectFit:'cover'}}/>
        )}
        <p><b>Full name:</b> {selected.full_name || 'Not provided'}</p>
        <p><b>Email:</b> {selected.email || 'Not provided'}</p>
        <p><b>Phone:</b> {selected.phone || 'Not provided'}</p>
        <p><b>Address:</b> {selected.address || 'Not provided'}</p>
        <p><b>Date of birth:</b> {selected.date_of_birth || 'Not provided'}</p>
        <p><b>Marital status:</b> {selected.marital_status || 'Not provided'}</p>
        <p><b>Education:</b> {selected.education_level || 'Not provided'}</p>
        <p><b>Favourite song:</b> {selected.favourite_song || 'Not provided'}</p>
        <p><b>Role:</b> {selected.role}</p>
        <p><b>Approval status:</b> {selected.approval_status}</p>
        <button type="button" onClick={()=>setSelected(null)}>Close details</button>
      </div>
    )}
  </section>
}

function MyProfile({profile,onUpdated}:{profile:Profile,onUpdated:(profile:Profile)=>void}) {
  const [photoUrl,setPhotoUrl] = useState('')
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')

  useEffect(() => {
    let active = true
    async function loadPhoto() {
      if (!profile.photo_url) { setPhotoUrl(''); return }
      if (profile.photo_url.startsWith('http')) { setPhotoUrl(profile.photo_url); return }
      if (!supabase) return
      const { data } = await supabase.storage.from('avatars').createSignedUrl(profile.photo_url, 3600)
      if (active) setPhotoUrl(data?.signedUrl || '')
    }
    loadPhoto()
    return () => { active = false }
  }, [profile.photo_url])

  async function saveProfile(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    const form = new FormData(e.currentTarget)
    const photo = form.get('photo') as File
    let photoPath = profile.photo_url

    try {
      if (photo && photo.size > 0) {
        if (!photo.type.startsWith('image/')) throw new Error('Please choose an image file.')
        if (photo.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.')
        const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '-')
        const path = `${profile.id}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, photo, { contentType: photo.type })
        if (uploadError) throw uploadError
        photoPath = path
      }

      const changes = {
        full_name: String(form.get('full_name') || '').trim(),
        phone: String(form.get('phone') || '').trim(),
        address: String(form.get('address') || '').trim(),
        favourite_song: String(form.get('favourite_song') || '').trim(),
        date_of_birth: String(form.get('date_of_birth') || ''),
        marital_status: String(form.get('marital_status') || '').trim(),
        education_level: String(form.get('education_level') || '').trim(),
        photo_url: photoPath
      }

      const { data, error } = await supabase.from('profiles').update(changes).eq('id', profile.id).select('*').single()
      if (error) throw error
      onUpdated(data as Profile)
      setMessage('Profile updated successfully.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not update profile.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="content-card profile-card">
    <div className="profile-heading">
      <div>
        <h2>My Profile</h2>
        <p className="muted">Manage your personal information and account details.</p>
      </div>
    </div>

    <form className="profile-form" onSubmit={saveProfile}>
      <div className="profile-photo-area">
        <div className="profile-photo">
          {photoUrl ? <img src={photoUrl} alt="Your profile"/> : <span>{profile.full_name?.[0] || 'U'}</span>}
        </div>
        <label className="photo-upload">
          <span>Change profile photo</span>
          <input type="file" name="photo" accept="image/*"/>
        </label>
        <small>JPG, PNG or other image formats. Maximum 5 MB.</small>
      </div>

      <div className="profile-section-title">Personal information</div>

      <label className="profile-field">
        <span>Full name</span>
        <input name="full_name" defaultValue={profile.full_name || ''} required/>
      </label>

      <label className="profile-field">
        <span>Email address</span>
        <input value={profile.email || ''} readOnly/>
        <small>Email cannot be changed here.</small>
      </label>

      <label className="profile-field">
        <span>Phone number</span>
        <input name="phone" type="tel" defaultValue={profile.phone || ''}/>
      </label>

      <label className="profile-field">
        <span>Residential address</span>
        <input name="address" defaultValue={profile.address || ''}/>
      </label>

      <label className="profile-field">
        <span>Date of birth</span>
        <input type="date" name="date_of_birth" defaultValue={profile.date_of_birth || ''}/>
      </label>

      <label className="profile-field">
        <span>Marital status</span>
        <input name="marital_status" defaultValue={profile.marital_status || ''}/>
      </label>

      <label className="profile-field">
        <span>Education level</span>
        <input name="education_level" defaultValue={profile.education_level || ''}/>
      </label>

      <label className="profile-field">
        <span>Favourite song</span>
        <input name="favourite_song" defaultValue={profile.favourite_song || ''}/>
      </label>

      <div className="profile-section-title">Account information</div>
      <div className="profile-account-info">
        <div><span>Account role</span><b>{profile.role}</b></div>
        <div><span>Approval status</span><b className="profile-approved">{profile.approval_status}</b></div>
      </div>

      {message && <p className="profile-message" role="status">{message}</p>}

      <button className="profile-save" type="submit" disabled={busy}>
        {busy ? 'Saving changes…' : 'Save changes'}
      </button>
    </form>
  </section>
}

function AdminPanel({role,onNavigate}:{role:string,onNavigate:(tab:string)=>void}) {
  if(role==='member')return <Empty title="Restricted area" desc="You do not have administrator permissions."/>
  const sections = [
    {title:'Member management',desc:'Review registrations and manage member approvals.',icon:Users,tab:'members',action:'Manage members'},
    {title:'Music library',desc:'Browse and manage the church music collection.',icon:Headphones,tab:'music',action:'Open music library'},
    {title:'Announcements',desc:'View and publish community announcements.',icon:Bell,tab:'announcements',action:'View announcements'},
    {title:'My profile',desc:'Review and update your administrator profile.',icon:UserRound,tab:'profile',action:'Open profile'}
  ]
  return <section className="admin-dashboard">
    <div className="admin-hero">
      <div className="admin-hero-icon"><ShieldCheck size={30}/></div>
      <div className="admin-hero-copy">
        <span>GNC KUMO MANAGEMENT</span>
        <h2>Welcome, Administrator</h2>
        <p>You are signed in with the {role.replace('_',' ')} role. Manage your church community from one place.</p>
      </div>
    </div>
    <div className="admin-section-heading">
      <div><h2>Administration</h2><p className="muted">Choose a section to continue managing your community.</p></div>
    </div>
    <div className="admin-grid">
      {sections.map(item=><button type="button" className="admin-action-card" key={item.tab} onClick={()=>onNavigate(item.tab)}>
        <div className="admin-action-icon"><item.icon size={22}/></div>
        <b>{item.title}</b>
        <p>{item.desc}</p>
        <span>{item.action} <span aria-hidden="true">→</span></span>
      </button>)}
    </div>
    <div className="admin-security">
      <div className="admin-security-icon"><ShieldCheck size={21}/></div>
      <div><b>Account security</b><p>Administrator permissions are controlled securely through Supabase. Never change roles by editing browser data.</p></div>
    </div>
  </section>
}
function Empty({title,desc}:{title:string,desc:string}) { return <div className="empty"><div className="empty-icon"><Music2/></div><b>{title}</b><p>{desc}</p></div> }

function DocumentsLibrary({role,userId}:{role:string,userId:string}) {
  const [documents,setDocuments] = useState<any[]>([])
  const [offlineIds,setOfflineIds] = useState<string[]>([])
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  const [preview,setPreview] = useState<{title:string,url:string}|null>(null)
  const isAdmin = role === 'admin' || role === 'super_admin'

  async function refreshOfflineIds() {
    try {
      const saved = await listOfflineDocuments()
      setOfflineIds(saved.map(item => item.id))
      return saved
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
      return []
    }
  }

  async function loadDocuments() {
    if (!supabase) return
    const {data,error} = await supabase
      .from('documents')
      .select('*')
      .order('created_at',{ascending:false})
    if (error) setMessage(error.message)
    else setDocuments(data || [])
  }

  useEffect(()=>{ void loadDocuments(); void refreshOfflineIds() },[])

  async function uploadDocument(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase || !isAdmin) return

    const form = e.currentTarget
    const values = new FormData(form)
    const title = String(values.get('title') || '').trim()
    const description = String(values.get('description') || '').trim()
    const file = values.get('pdf') as File

    if (!title || !file || !file.size) {
      setMessage('Please enter a title and select a PDF file.')
      return
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setMessage('Only PDF files are allowed.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setMessage('PDF file must not exceed 20 MB.')
      return
    }

    setBusy(true)
    setMessage('Uploading PDF…')
    const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`

    try {
      const uploaded = await supabase.storage.from('documents').upload(path,file,{
        contentType:'application/pdf',
        upsert:false
      })
      if (uploaded.error) throw uploaded.error

      const {error} = await supabase.from('documents').insert({
        title,
        description,
        file_path:path,
        uploaded_by:userId
      })

      if (error) {
        await supabase.storage.from('documents').remove([path])
        throw error
      }

      form.reset()
      setMessage('PDF uploaded successfully.')
      setPreview(null)
      await loadDocuments()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function saveDocumentOffline(doc:any) {
    if (!supabase) return
    setBusy(true)
    setMessage("Saving PDF for offline reading…")
    try {
      const {data,error} = await supabase.storage.from("documents").download(doc.file_path)
      if (error) throw error
      if (!data) throw new Error("PDF download returned no file.")
      await saveOfflineDocument(doc.id,doc.title,data)
      await refreshOfflineIds()
      setMessage("PDF saved successfully. You can now read it offline.")
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function openDocument(doc:any) {
    setBusy(true)
    setMessage('Opening PDF…')
    try {
      const saved = await getOfflineDocument(doc.id)
      if (saved) {
        const url = URL.createObjectURL(saved.blob)
        setPreview({title:doc.title,url})
        setMessage('Opened saved offline PDF.')
        return
      }
      if (!supabase) throw new Error('This PDF is not saved offline. Connect to the internet first.')
      const {data,error} = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path,3600)
      if (error) throw error
      setPreview({title:doc.title,url:data.signedUrl})
      setMessage('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function downloadDocument(doc:any) {
    if (!supabase) return
    setBusy(true)
    setMessage('Preparing download…')
    const {data,error} = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path,3600,{download:`${doc.title}.pdf`})

    if (error) {
      setMessage(error.message)
    } else {
      const link = document.createElement('a')
      link.href = data.signedUrl
      link.download = `${doc.title}.pdf`
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setMessage('Download started.')
    }
    setBusy(false)
  }

  async function removeDocumentOffline(doc:any) {
    setBusy(true)
    try {
      await removeOfflineDocument(doc.id)
      await refreshOfflineIds()
      setMessage("Offline copy removed from this device.")
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function deleteDocument(doc:any) {
    if (!supabase || !isAdmin) return
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return

    setBusy(true)
    setMessage('Deleting PDF…')
    const {error} = await supabase.from('documents').delete().eq('id',doc.id)

    if (error) {
      setMessage(error.message)
    } else {
      const removed = await supabase.storage.from('documents').remove([doc.file_path])
      setDocuments(current=>current.filter(item=>item.id!==doc.id))
      if (preview?.title === doc.title) setPreview(null)
      setMessage(removed.error ? 'PDF record deleted, but its storage file could not be removed.' : 'PDF deleted successfully.')
    }
    setBusy(false)
  }

  return <section className="content-card">
    <div className="section-head">
      <div>
        <h2><FileText size={20}/> PDF Library</h2>
        <p className="muted">Church documents, books and learning materials.</p>
      </div>
    </div>

    {isAdmin && <div className="notice">
      <h3><Upload size={18}/> Upload PDF document</h3>
      <form className="form" onSubmit={uploadDocument}>
        <label>Document title
          <input name="title" required maxLength={150} placeholder="Enter document title"/>
        </label>
        <label>Description (optional)
          <textarea name="description" rows={3} maxLength={1000} placeholder="Brief description of this document"/>
        </label>
        <label>Choose PDF file (maximum 20 MB)
          <input name="pdf" type="file" accept="application/pdf,.pdf" required/>
        </label>
        <button className="primary" disabled={busy}>
          <Upload size={16}/>{busy?'Please wait…':'Upload PDF'}
        </button>
      </form>
    </div>}

    {message && <div className="notice">{message}</div>}

    {preview && <div className="pdf-reader">
      <div className="section-head">
        <div><h3>{preview.title}</h3><p className="muted">PDF reader</p></div>
        <button className="secondary" type="button" onClick={()=>setPreview(null)}>Close</button>
      </div>
      <iframe
        src={preview.url}
        title={preview.title}
        style={{width:'100%',height:'70vh',minHeight:400,border:'1px solid #e8e1ee',borderRadius:12}}
      />
    </div>}

    <h3>Available documents ({documents.length})</h3>
    {documents.length===0
      ? <Empty title="No PDF documents yet" desc="Documents uploaded by church administrators will appear here."/>
      : <div className="document-list">
        {documents.map(doc=><article key={doc.id} className="document-item">
          <div className="document-icon"><FileText size={25}/></div>
          <div className="document-info">
            <b>{doc.title}</b>
            {doc.description && <p>{doc.description}</p>}
            <small>{new Date(doc.created_at).toLocaleDateString()}</small>
            <div className="document-actions">
              <button className="secondary" type="button" disabled={busy} onClick={()=>openDocument(doc)}>
                <BookOpen size={15}/> Read PDF
              </button>
              <button className="secondary" type="button" disabled={busy || offlineIds.includes(doc.id)} onClick={()=>saveDocumentOffline(doc)}>
                <Download size={15}/> {offlineIds.includes(doc.id) ? 'Saved Offline' : 'Save Offline'}
              </button>
              {offlineIds.includes(doc.id) && <button className="secondary" type="button" disabled={busy} onClick={()=>removeDocumentOffline(doc)}>
                Remove Offline Copy
              </button>}
              <button className="secondary" type="button" disabled={busy} onClick={()=>downloadDocument(doc)}>
                <Download size={15}/> Download
              </button>
              {isAdmin && <button className="secondary" type="button" disabled={busy} onClick={()=>deleteDocument(doc)}>
                Delete
              </button>}
            </div>
          </div>
        </article>)}
      </div>
    }
  </section>
}
