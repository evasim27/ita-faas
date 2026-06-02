import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { call, naloziSlike } from '../firebase'

const KATEGORIJE = ['elektronika', 'oblačila', 'pohištvo', 'vozila', 'šport', 'ostalo']

export default function ObjavaOglasa() {
  const [naslov, setNaslov] = useState('')
  const [opis, setOpis] = useState('')
  const [cena, setCena] = useState('')
  const [kategorija, setKategorija] = useState('elektronika')
  const [slike, setSlike] = useState([])
  const [previews, setPreviews] = useState([])
  const [napaka, setNapaka] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const izbiraSlik = (e) => {
    const files = Array.from(e.target.files)
    setSlike(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  const oddaj = async (e) => {
    e.preventDefault()
    setNapaka('')
    setLoading(true)
    try {
      const res = await call('objavaOglasa')({ naslov, opis, cena: Number(cena), kategorija })
      const oglasId = res.data.id

      if (slike.length > 0) {
        const urls = await naloziSlike(oglasId, slike)
        await call('posodobiOglas')({ id: oglasId, dodajSlike: urls })
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
        <h2>Objavi oglas</h2>
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

          <label>Slike <span style={{ color: '#888', fontWeight: 400 }}>(do 5, neobvezno)</span></label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={izbiraSlik}
            style={{ padding: '8px', border: '1.5px dashed #aaa', borderRadius: '2px', marginBottom: '10px', cursor: 'pointer', width: '100%' }}
          />

          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {previews.map((p, i) => (
                <img key={i} src={p} alt={`Predogled ${i+1}`}
                  style={{ width: '80px', height: '80px', objectFit: 'cover', border: '1.5px solid #111' }} />
              ))}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Objavljanje...' : 'Objavi oglas'}
          </button>
        </form>
      </div>
    </div>
  )
}
