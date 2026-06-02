import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { call, BASE_URL, naloziSlike } from '../firebase'
import { useAuth } from '../App'

const KATEGORIJE = ['elektronika', 'oblačila', 'pohištvo', 'vozila', 'šport', 'ostalo']

export default function UrejanjeOglasa() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuth()

  const [naslov, setNaslov] = useState('')
  const [opis, setOpis] = useState('')
  const [cena, setCena] = useState('')
  const [kategorija, setKategorija] = useState('elektronika')
  const [noveSlikeFiles, setNoveSlikeFiles] = useState([])
  const [novePreviews, setNovePreviews] = useState([])
  const [obstojeceSlike, setObstojeceSlike] = useState([])
  const [napaka, setNapaka] = useState('')
  const [loading, setLoading] = useState(false)
  const [brisanje, setBrisanje] = useState(false)

  useEffect(() => {
    fetch(`${BASE_URL}/pridobiOglas?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.userId !== user?.uid) { navigate('/profil'); return }
        setNaslov(data.naslov || '')
        setOpis(data.opis || '')
        setCena(data.cena || '')
        setKategorija(data.kategorija || 'elektronika')
        setObstojeceSlike(data.slike || [])
      })
  }, [id, user])

  const izbiraSlik = (e) => {
    const files = Array.from(e.target.files)
    setNoveSlikeFiles(files)
    setNovePreviews(files.map(f => URL.createObjectURL(f)))
  }

  const shrani = async (e) => {
    e.preventDefault()
    setNapaka('')
    setLoading(true)
    try {
      let dodajSlike
      if (noveSlikeFiles.length > 0) dodajSlike = await naloziSlike(id, noveSlikeFiles)
      await call('posodobiOglas')({ id, naslov, opis, cena: Number(cena), ...(dodajSlike && { dodajSlike }) })
      navigate(`/oglas/${id}`)
    } catch (err) {
      setNapaka(err.message || 'Napaka pri shranjevanju.')
    } finally {
      setLoading(false)
    }
  }

  const izbrisi = async () => {
    if (!window.confirm('Res želiš izbrisati ta oglas?')) return
    setBrisanje(true)
    try {
      await call('izbrisiOglas')({ id })
      navigate('/profil')
    } catch (err) {
      setNapaka(err.message || 'Napaka pri brisanju.')
      setBrisanje(false)
    }
  }

  return (
    <div style={{ paddingTop: '20px' }}>
      <div className="forma">
        <h2>✏️ Uredi oglas</h2>
        {napaka && <p className="napaka">{napaka}</p>}
        <form onSubmit={shrani}>
          <label>Naslov</label>
          <input value={naslov} onChange={e => setNaslov(e.target.value)} required />

          <label>Opis</label>
          <textarea value={opis} onChange={e => setOpis(e.target.value)} required />

          <label>Cena (€)</label>
          <input type="number" value={cena} onChange={e => setCena(e.target.value)} min="0" required />

          <label>Kategorija</label>
          <select value={kategorija} onChange={e => setKategorija(e.target.value)}>
            {KATEGORIJE.map(k => <option key={k} value={k}>{k}</option>)}
          </select>

          <label>Obstoječe slike</label>
          {obstojeceSlike.length > 0 ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {obstojeceSlike.map((url, i) => (
                <img key={i} src={url} alt={`Slika ${i+1}`}
                  style={{ width: '72px', height: '72px', objectFit: 'cover', border: '1.5px solid #111' }} />
              ))}
            </div>
          ) : <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: '12px' }}>Ni slik.</p>}

          <label>Dodaj nove slike</label>
          <input type="file" accept="image/*" multiple onChange={izbiraSlik}
            style={{ padding: '8px', border: '1.5px dashed #aaa', borderRadius: '2px', marginBottom: '8px', cursor: 'pointer', width: '100%' }} />
          {novePreviews.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {novePreviews.map((p, i) => (
                <img key={i} src={p} alt={`Nova ${i+1}`}
                  style={{ width: '72px', height: '72px', objectFit: 'cover', border: '1.5px solid #111' }} />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Shranjevanje...' : 'Shrani spremembe'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => navigate(`/oglas/${id}`)}>
              Prekliči
            </button>
          </div>
        </form>

        <hr style={{ margin: '24px 0', borderColor: '#f0f0f0' }} />
        <div>
          <p style={{ color: '#888', fontSize: '0.88rem', marginBottom: '10px' }}>Nevarno območje</p>
          <button className="btn btn-danger" onClick={izbrisi} disabled={brisanje} style={{ width: '100%' }}>
            {brisanje ? 'Brisanje...' : '🗑️ Izbriši oglas'}
          </button>
        </div>
      </div>
    </div>
  )
}
