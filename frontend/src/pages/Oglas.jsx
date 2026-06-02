import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { BASE_URL, call, formatDate } from '../firebase'
import { useAuth } from '../App'

export default function Oglas() {
  const { id } = useParams()
  const [oglas, setOglas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aktivnaSlika, setAktivnaSlika] = useState(0)
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

  if (loading) return <div className="loading">Nalaganje...</div>
  if (!oglas || oglas.error) return <div className="prazno">Oglas ne obstaja.</div>

  return (
    <div>
      <div className="oglas-detail">
        {/* Leva stran – galerija */}
        <div>
          {oglas.slike && oglas.slike.length > 0 ? (
            <>
              <div className="oglas-galerija">
                <img
                  src={oglas.slike[aktivnaSlika]}
                  alt={oglas.naslov}
                  className="oglas-galerija-slika"
                />
                {oglas.slike.length > 1 && (
                  <>
                    <button className="galerija-nav levo" onClick={() => setAktivnaSlika(i => (i - 1 + oglas.slike.length) % oglas.slike.length)}>‹</button>
                    <button className="galerija-nav desno" onClick={() => setAktivnaSlika(i => (i + 1) % oglas.slike.length)}>›</button>
                  </>
                )}
              </div>
              {oglas.slike.length > 1 && (
                <div className="galerija-thumbnails">
                  {oglas.slike.map((url, i) => (
                    <img key={i} src={url} alt={`Slika ${i+1}`}
                      className={`galerija-thumb ${i === aktivnaSlika ? 'active' : ''}`}
                      onClick={() => setAktivnaSlika(i)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="oglas-brez-slike"><span>📦</span></div>
          )}
        </div>

        {/* Desna stran – info */}
        <div className="oglas-info">
          <span className="badge">{oglas.kategorija}</span>
          <h1>{oglas.naslov}</h1>
          <div className="oglas-cena">{oglas.cena} €</div>
          <div className="oglas-datum">Objavljeno: {formatDate(oglas.ustvarjen)}</div>

          {/* Gumbi lastnika */}
          {user && user.uid === oglas.userId && (
            <Link to={`/uredi/${oglas.id}`} className="btn btn-outline" style={{ marginBottom: '20px' }}>
              ✏️ Uredi oglas
            </Link>
          )}

          <p className="oglas-opis">{oglas.opis}</p>

          {/* Forma za sporočilo */}
          {user && user.uid !== oglas.userId && (
            <div className="sporocilo-forma">
              <h3>Kontaktiraj prodajalca</h3>
              {status === 'uspeh' && <p className="uspeh">✅ Sporočilo poslano!</p>}
              {status && status !== 'uspeh' && <p className="napaka">{status}</p>}
              <form onSubmit={posljiSporocilo}>
                <textarea
                  value={vsebina}
                  onChange={e => setVsebina(e.target.value)}
                  placeholder="Npr. Ali je artikel še na voljo?"
                  rows={3}
                  required
                />
                <button className="btn btn-primary" type="submit" disabled={posiljanje} style={{ width: '100%' }}>
                  {posiljanje ? 'Pošiljanje...' : 'Pošlji sporočilo'}
                </button>
              </form>
            </div>
          )}

          {!user && (
            <div className="sporocilo-forma">
              <p style={{ fontSize: '0.88rem', color: '#555' }}>
                Za kontakt prodajalca se <Link to="/prijava" style={{ color: '#111', fontWeight: 600 }}>prijavi</Link>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
