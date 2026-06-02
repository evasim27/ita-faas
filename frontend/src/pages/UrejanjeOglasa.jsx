import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { call, BASE_URL, naloziSliko } from '../firebase'
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
  const [novaSlikaFile, setNovaSlikaFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [obstojecaSlika, setObstojecaSlika] = useState(null)
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
        setObstojecaSlika(data.slikaUrl || null)
      })
  }, [id, user])

  const izbiraSlike = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setNovaSlikaFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const shrani = async (e) => {
    e.preventDefault()
    setNapaka('')
    setLoading(true)
    try {
      let slikaUrl
      if (novaSlikaFile) slikaUrl = await naloziSliko(id, novaSlikaFile)
      await call('posodobiOglas')({ id, naslov, opis, cena: Number(cena), ...(slikaUrl && { slikaUrl }) })
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

          <label>Slika</label>
          {(preview || obstojecaSlika) && (
            <img src={preview || obstojecaSlika} alt="Slika oglasa"
              style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
          )}
          <input type="file" accept="image/*" onChange={izbiraSlike}
            style={{ padding: '8px', border: '1.5px dashed #ddd', borderRadius: '7px', marginBottom: '16px', cursor: 'pointer' }} />

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
