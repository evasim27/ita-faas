import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth, call, BASE_URL, formatDate } from '../firebase'
import { useAuth } from '../App'

function SporocilaZavihek() {
  const [sporocila, setSporocila] = useState([])
  const [loading, setLoading] = useState(true)
  const [odgovori, setOdgovori] = useState({}) // sporociloId → vsebina
  const [statusi, setStatusi] = useState({})   // sporociloId → 'ok'|'err'

  useEffect(() => {
    call('pridobiVsaSporocila')({})
      .then(res => { setSporocila(res.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const posljiOdgovor = async (sporociloId) => {
    const vsebina = odgovori[sporociloId]
    if (!vsebina?.trim()) return
    try {
      await call('odgovoriNaSporocilo')({ sporociloId, vsebina })
      setStatusi(s => ({ ...s, [sporociloId]: 'ok' }))
      setOdgovori(o => ({ ...o, [sporociloId]: '' }))
    } catch (err) {
      setStatusi(s => ({ ...s, [sporociloId]: 'err' }))
    }
  }

  if (loading) return <div className="loading">Nalaganje sporočil...</div>
  if (sporocila.length === 0) return <div className="prazno"><p>Ni prejetih sporočil.</p></div>

  // Grupiramo po oglasu
  const poOglasih = sporocila.reduce((acc, s) => {
    const key = s.oglasId
    if (!acc[key]) acc[key] = { naslov: s.oglasNaslov, sporocila: [] }
    acc[key].sporocila.push(s)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {Object.entries(poOglasih).map(([oglasId, skupina]) => (
        <div key={oglasId} style={{ border: '1.5px solid #111', background: '#fff' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1.5px solid #111', background: '#f4f2ee' }}>
            <Link to={`/oglas/${oglasId}`} style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111', textDecoration: 'none' }}>
              {skupina.naslov || 'Oglas'}
            </Link>
          </div>
          {skupina.sporocila.map(s => (
            <div key={s.id} style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.posiljateljEmail}</span>
                <span style={{ fontSize: '0.75rem', color: '#999' }}>{formatDate(s.poslano)}</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#333', marginBottom: '12px' }}>{s.vsebina}</p>

              {statusi[s.id] === 'ok' && <p className="uspeh" style={{ marginBottom: '8px' }}>Odgovor poslan.</p>}
              {statusi[s.id] === 'err' && <p className="napaka" style={{ marginBottom: '8px' }}>Napaka pri pošiljanju.</p>}

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Odgovori..."
                  value={odgovori[s.id] || ''}
                  onChange={e => setOdgovori(o => ({ ...o, [s.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && posljiOdgovor(s.id)}
                  style={{ flex: 1, padding: '8px 10px', border: '1.5px solid #111', fontSize: '0.85rem', fontFamily: 'inherit' }}
                />
                <button className="btn btn-primary" onClick={() => posljiOdgovor(s.id)}
                  style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
                  Pošlji
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function Profil() {
  const user = useAuth()
  const navigate = useNavigate()
  const [profil, setProfil] = useState(null)
  const [mojiOglasi, setMojiOglasi] = useState([])
  const [ime, setIme] = useState('')
  const [priimek, setPriimek] = useState('')
  const [telefon, setTelefon] = useState('')
  const [lokacija, setLokacija] = useState('')
  const [status, setStatus] = useState('')
  const [zavihek, setZavihek] = useState('profil')

  useEffect(() => {
    call('pridobiProfil')({}).then(res => {
      setProfil(res.data)
      setIme(res.data.ime || '')
      setPriimek(res.data.priimek || '')
      setTelefon(res.data.telefon || '')
      setLokacija(res.data.lokacija || '')
    }).catch(console.error)

    fetch(`${BASE_URL}/pridobiOglase`)
      .then(r => r.json())
      .then(data => {
        const moji = Array.isArray(data) ? data.filter(o => o.userId === user.uid) : []
        setMojiOglasi(moji)
      })
  }, [user.uid])

  const posodobiProfil = async (e) => {
    e.preventDefault()
    setStatus('')
    try {
      await call('posodobiProfil')({ ime, priimek, telefon, lokacija })
      setStatus('uspeh')
    } catch (err) {
      setStatus('napaka')
    }
  }

  const odjava = async () => {
    await signOut(auth)
    navigate('/')
  }

  return (
    <div>
      <div className="profil-header">
        <div className="profil-avatar">{user.email[0].toUpperCase()}</div>
        <div>
          <h2>{profil?.ime && profil?.priimek ? `${profil.ime} ${profil.priimek}` : profil?.ime || 'Moj profil'}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>{user.email}</p>
        </div>
        <button className="btn btn-secondary" onClick={odjava} style={{ marginLeft: 'auto' }}>Odjava</button>
      </div>

      <div className="tabs">
        <div className={`tab ${zavihek === 'profil' ? 'active' : ''}`} onClick={() => setZavihek('profil')}>Podatki</div>
        <div className={`tab ${zavihek === 'oglasi' ? 'active' : ''}`} onClick={() => setZavihek('oglasi')}>Oglasi ({mojiOglasi.length})</div>
        <div className={`tab ${zavihek === 'sporocila' ? 'active' : ''}`} onClick={() => setZavihek('sporocila')}>Sporočila</div>
      </div>

      {zavihek === 'profil' && (
        <div className="forma" style={{ marginTop: 0 }}>
          {status === 'uspeh' && <p className="uspeh">Profil posodobljen!</p>}
          {status === 'napaka' && <p className="napaka">Napaka pri posodabljanju.</p>}
          <form onSubmit={posodobiProfil}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <div>
                <label>Ime</label>
                <input value={ime} onChange={e => setIme(e.target.value)} placeholder="Ana" />
              </div>
              <div>
                <label>Priimek</label>
                <input value={priimek} onChange={e => setPriimek(e.target.value)} placeholder="Novak" />
              </div>
            </div>
            <label>Telefon</label>
            <input value={telefon} onChange={e => setTelefon(e.target.value)} placeholder="041 123 456" />
            <label>Lokacija</label>
            <input value={lokacija} onChange={e => setLokacija(e.target.value)} placeholder="Ljubljana" />
            <button className="btn btn-primary" type="submit">Shrani spremembe</button>
          </form>
        </div>
      )}

      {zavihek === 'oglasi' && (
        <div>
          {mojiOglasi.length === 0 ? (
            <div className="prazno">
              <p>Še nimaš objavljenih oglasov.</p>
              <Link to="/objavi" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '12px', textDecoration: 'none' }}>+ Objavi oglas</Link>
            </div>
          ) : (
            <div className="grid">
              {mojiOglasi.map(o => (
                <div key={o.id} className="kartica">
                  <Link to={`/oglas/${o.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="kartica-slika">
                      {o.slike && o.slike[0]
                        ? <img src={o.slike[0]} alt={o.naslov} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span>📦</span>}
                    </div>
                    <div className="kartica-body">
                      <div className="kartica-kategorija">{o.kategorija}</div>
                      <div className="kartica-naslov">{o.naslov}</div>
                      <div className="kartica-cena">{o.cena} €</div>
                      <div className="kartica-meta">{formatDate(o.ustvarjen)}</div>
                    </div>
                  </Link>
                  <div style={{ padding: '8px 12px 12px' }}>
                    <Link to={`/uredi/${o.id}`} className="btn btn-secondary" style={{ width: '100%', textAlign: 'center', fontSize: '0.82rem', textDecoration: 'none', display: 'block' }}>Uredi</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {zavihek === 'sporocila' && <SporocilaZavihek />}
    </div>
  )
}
