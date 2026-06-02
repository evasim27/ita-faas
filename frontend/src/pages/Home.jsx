import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BASE_URL } from '../firebase'

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
      {/* Iskalna vrstica */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="🔍 Išči oglase..."
          value={iskanje}
          onChange={e => setIskanje(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '1rem' }}
        />
      </div>

      {/* Filter kategorij */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {KATEGORIJE.map(k => (
          <button
            key={k}
            className={`btn ${filter === k ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(k)}
            style={{ padding: '6px 14px', fontSize: '0.85rem', textTransform: 'capitalize' }}
          >
            {k === 'vse' ? 'Vse' : `${IKONE[k] || '📦'} ${k}`}
          </button>
        ))}
      </div>

      {/* Mreža oglasov */}
      {loading ? (
        <div className="loading">Nalaganje oglasov...</div>
      ) : filtrirani.length === 0 ? (
        <div className="prazno">
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔎</div>
          <p>Ni oglasov{filter !== 'vse' ? ` v kategoriji "${filter}"` : ''}.</p>
        </div>
      ) : (
        <div className="grid">
          {filtrirani.map(oglas => (
            <Link to={`/oglas/${oglas.id}`} key={oglas.id} className="kartica">
              <div className="kartica-slika">
                {oglas.slikaUrl
                  ? <img src={oglas.slikaUrl} alt={oglas.naslov} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span>{IKONE[oglas.kategorija] || '📦'}</span>
                }
              </div>
              <div className="kartica-body">
                <div className="kartica-naslov">{oglas.naslov}</div>
                <div className="kartica-cena">{oglas.cena} €</div>
                <span className="kartica-kategorija">{oglas.kategorija}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
