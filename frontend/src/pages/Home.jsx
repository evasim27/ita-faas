import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BASE_URL, formatDate } from '../firebase'

const KATEGORIJE = ['vse', 'elektronika', 'oblačila', 'pohištvo', 'vozila', 'šport', 'ostalo']
const IKONE = { elektronika: '📱', oblačila: '👕', pohištvo: '🛋️', vozila: '🚗', šport: '⚽', ostalo: '📦' }

export default function Home() {
  const [oglasi, setOglasi] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('vse')
  const [iskanje, setIskanje] = useState('')

  useEffect(() => {
    fetch(`${BASE_URL}/pridobiOglase`)
      .then(r => r.json())
      .then(data => { setOglasi(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtrirani = oglasi.filter(o => {
    const ujemaKat = filter === 'vse' || o.kategorija === filter
    const ujemaIsk = o.naslov.toLowerCase().includes(iskanje.toLowerCase())
    return ujemaKat && ujemaIsk
  })

  return (
    <div>
      <div className="page-header">
        <h1>Vsi oglasi</h1>
        <span style={{ fontSize: '0.82rem', color: '#888' }}>{filtrirani.length} {filtrirani.length === 1 ? 'oglas' : 'oglasov'}</span>
      </div>

      {/* Iskanje */}
      <input
        className="iskanje-vrstica"
        type="text"
        placeholder="Išči oglase..."
        value={iskanje}
        onChange={e => setIskanje(e.target.value)}
      />

      {/* Kategorije */}
      <div className="filter-bar">
        {KATEGORIJE.map(k => (
          <button
            key={k}
            className={`filter-btn ${filter === k ? 'active' : ''}`}
            onClick={() => setFilter(k)}
          >
            {k === 'vse' ? 'Vse' : k}
          </button>
        ))}
      </div>

      {/* Mreža */}
      {loading ? (
        <div className="loading">Nalaganje...</div>
      ) : filtrirani.length === 0 ? (
        <div className="prazno">
          <div style={{ fontSize: '3rem' }}>🔎</div>
          <p>Ni oglasov{filter !== 'vse' ? ` v kategoriji "${filter}"` : ''}.</p>
        </div>
      ) : (
        <div className="grid">
          {filtrirani.map(oglas => (
            <div key={oglas.id} className="kartica">
              <Link to={`/oglas/${oglas.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="kartica-slika">
                  {oglas.slike && oglas.slike[0]
                    ? <img src={oglas.slike[0]} alt={oglas.naslov} />
                    : <span>{IKONE[oglas.kategorija] || '📦'}</span>
                  }
                </div>
                <div className="kartica-body">
                  <div className="kartica-kategorija">{oglas.kategorija}</div>
                  <div className="kartica-naslov">{oglas.naslov}</div>
                  <div className="kartica-cena">{oglas.cena} €</div>
                  <div className="kartica-meta">{formatDate(oglas.ustvarjen)}</div>
                </div>
              </Link>
              <Link to={`/oglas/${oglas.id}`} className="btn-kartica">Oglej si</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
