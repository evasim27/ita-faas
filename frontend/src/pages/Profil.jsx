import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth, call, BASE_URL, formatDate } from '../firebase'
import { useAuth } from '../App'

export default function Profil() {
  const user = useAuth()
  const navigate = useNavigate()
  const [profil, setProfil] = useState(null)
  const [mojiOglasi, setMojiOglasi] = useState([])
  const [ime, setIme] = useState('')
  const [telefon, setTelefon] = useState('')
  const [lokacija, setLokacija] = useState('')
  const [status, setStatus] = useState('')
  const [zavihek, setZavihek] = useState('profil')

  useEffect(() => {
    call('pridobiProfil')({}).then(res => {
      setProfil(res.data)
      setIme(res.data.ime || '')
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
      await call('posodobiProfil')({ ime, telefon, lokacija })
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
          <h2>{profil?.ime || 'Moj profil'}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>{user.email}</p>
        </div>
        <button className="btn btn-secondary" onClick={odjava} style={{ marginLeft: 'auto' }}>Odjava</button>
      </div>

      <div className="tabs">
        <div className={`tab ${zavihek === 'profil' ? 'active' : ''}`} onClick={() => setZavihek('profil')}>Moji podatki</div>
        <div className={`tab ${zavihek === 'oglasi' ? 'active' : ''}`} onClick={() => setZavihek('oglasi')}>Moji oglasi ({mojiOglasi.length})</div>
      </div>

      {zavihek === 'profil' && (
        <div className="forma" style={{ marginTop: 0 }}>
          {status === 'uspeh' && <p className="uspeh">✅ Profil posodobljen!</p>}
          {status === 'napaka' && <p className="napaka">Napaka pri posodabljanju.</p>}
          <form onSubmit={posodobiProfil}>
            <label>Ime</label>
            <input value={ime} onChange={e => setIme(e.target.value)} placeholder="Tvoje ime" />
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
                <div key={o.id} className="kartica" style={{ display: 'block', textDecoration: 'none' }}>
                  <Link to={`/oglas/${o.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="kartica-slika">
                      {o.slikaUrl
                        ? <img src={o.slikaUrl} alt={o.naslov} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span>📦</span>}
                    </div>
                    <div className="kartica-body">
                      <div className="kartica-naslov">{o.naslov}</div>
                      <div className="kartica-cena">{o.cena} €</div>
                      <div className="kartica-meta">📅 {formatDate(o.ustvarjen)}</div>
                      <span className="kartica-kategorija" style={{ background: o.aktiven ? '#e8f5e9' : '#fce4ec', color: o.aktiven ? '#2e7d32' : '#c62828' }}>
                        {o.aktiven ? '✅ aktiven' : '❌ neaktiven'}
                      </span>
                    </div>
                  </Link>
                  <div style={{ display: 'flex', gap: '6px', padding: '8px 12px 12px' }}>
                    <Link to={`/uredi/${o.id}`} className="btn btn-secondary" style={{ flex: 1, textAlign: 'center', fontSize: '0.82rem', padding: '6px', textDecoration: 'none' }}>✏️ Uredi</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
