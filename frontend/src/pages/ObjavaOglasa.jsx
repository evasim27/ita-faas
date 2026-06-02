import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { call, naloziSliko } from '../firebase'

const KATEGORIJE = ['elektronika', 'oblačila', 'pohištvo', 'vozila', 'šport', 'ostalo']

export default function ObjavaOglasa() {
  const [naslov, setNaslov] = useState('')
  const [opis, setOpis] = useState('')
  const [cena, setCena] = useState('')
  const [kategorija, setKategorija] = useState('elektronika')
  const [slika, setSlika] = useState(null)
  const [preview, setPreview] = useState(null)
  const [napaka, setNapaka] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const izbiraSlike = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSlika(file)
    setPreview(URL.createObjectURL(file))
  }

  const oddaj = async (e) => {
    e.preventDefault()
    setNapaka('')
    setLoading(true)
    try {
      // 1. Ustvari oglas
      const res = await call('objavaOglasa')({ naslov, opis, cena: Number(cena), kategorija })
      const oglasId = res.data.id

      // 2. Naloži sliko (če je izbrana) — Storage trigger jo bo samodejno vezal na oglas
      if (slika) {
        await naloziSliko(oglasId, slika)
      }

      navigate(`/oglas/${oglasId}`)
    } catch (err) {
      setNapaka(err.message || 'Napaka pri objavi oglasa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ paddingTop: '20px' }}>
      <div className="forma">
        <h2>📝 Objavi oglas</h2>
        {napaka && <p className="napaka">{napaka}</p>}
        <form onSubmit={oddaj}>
          <label>Naslov oglasa</label>
          <input value={naslov} onChange={e => setNaslov(e.target.value)} placeholder="Npr. iPhone 14 Pro" required />

          <label>Opis</label>
          <textarea value={opis} onChange={e => setOpis(e.target.value)} placeholder="Opiši artikel, stanje, dodatke..." required />

          <label>Cena (€)</label>
          <input type="number" value={cena} onChange={e => setCena(e.target.value)} placeholder="0" min="0" required />

          <label>Kategorija</label>
          <select value={kategorija} onChange={e => setKategorija(e.target.value)}>
            {KATEGORIJE.map(k => <option key={k} value={k}>{k}</option>)}
          </select>

          <label>Slika <span style={{ color: '#888', fontWeight: 400 }}>(neobvezno)</span></label>
          <input type="file" accept="image/*" onChange={izbiraSlike}
            style={{ padding: '8px', border: '1.5px dashed #ddd', borderRadius: '7px', marginBottom: '8px', cursor: 'pointer' }} />
          {preview && (
            <img src={preview} alt="Predogled"
              style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} />
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Objavljanje...' : 'Objavi oglas'}
          </button>
        </form>
      </div>
    </div>
  )
}
