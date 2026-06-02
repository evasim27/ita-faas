import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { BASE_URL, call, formatDate } from '../firebase'
import { useAuth } from '../App'

export default function Oglas() {
  const { id } = useParams()
  const [oglas, setOglas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [vsebina, setVsebina] = useState('')
  const [status, setStatus] = useState('')
  const [posiljanje, setPosiljanje] = useState(false)
  const user = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${BASE_URL}/pridobiOglas?id=${id}`)
      .then(r => r.json())
      .then(data => { setOglas(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const posljiSporocilo = async (e) => {
    e.preventDefault()
    if (!user) { navigate('/prijava'); return }
    setPosiljanje(true)
    setStatus('')
    try {
      await call('posljiSporocilo')({ oglasId: id, vsebina })
      setStatus('uspeh')
      setVsebina('')
    } catch (err) {
      setStatus(err.message || 'Napaka pri pošiljanju.')
    } finally {
      setPosiljanje(false)
    }
  }

  if (loading) return <div className="loading">Nalaganje oglasa...</div>
  if (!oglas || oglas.error) return <div className="prazno">Oglas ne obstaja.</div>

  return (
    <div className="oglas-detail">
      {oglas.slikaUrl
        ? <img src={oglas.slikaUrl} alt={oglas.naslov} className="oglas-slika" />
        : <div style={{ background: '#f0f0f0', borderRadius: '8px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem', marginBottom: '16px' }}>📦</div>
      }

      <span className="kartica-kategorija">{oglas.kategorija}</span>
      <h1 style={{ marginTop: '8px' }}>{oglas.naslov}</h1>
      <div className="oglas-cena">{oglas.cena} €</div>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '12px' }}>📅 Objavljeno: {formatDate(oglas.ustvarjen)}</p>
      <p className="oglas-opis">{oglas.opis}</p>

      {/* Gumba za lastnika */}
      {user && user.uid === oglas.userId && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <Link to={`/uredi/${oglas.id}`} className="btn btn-secondary">✏️ Uredi oglas</Link>
        </div>
      )}

      {/* Forma za sporočilo */}
      {user && user.uid !== oglas.userId && (
        <div className="sporocilo-forma">
          <h3>📨 Pošlji sporočilo prodajalcu</h3>
          {status === 'uspeh' && <p className="uspeh">✅ Sporočilo uspešno poslano!</p>}
          {status && status !== 'uspeh' && <p className="napaka">{status}</p>}
          <form onSubmit={posljiSporocilo}>
            <textarea
              value={vsebina}
              onChange={e => setVsebina(e.target.value)}
              placeholder="Npr. Ali je artikel še na voljo?"
              rows={3}
              required
              style={{ width: '100%', padding: '10px', border: '1.5px solid #ddd', borderRadius: '7px', marginBottom: '10px', fontFamily: 'inherit' }}
            />
            <button className="btn btn-primary" type="submit" disabled={posiljanje}>
              {posiljanje ? 'Pošiljanje...' : 'Pošlji sporočilo'}
            </button>
          </form>
        </div>
      )}

      {!user && (
        <div className="sporocilo-forma">
          <p>Za kontakt prodajalca se <a href="/prijava" style={{ color: '#1a73e8' }}>prijavi</a>.</p>
        </div>
      )}
    </div>
  )
}
