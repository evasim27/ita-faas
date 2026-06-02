import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, call } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

export default function Prijava() {
  const [zavihek, setZavihek] = useState('prijava')
  const [email, setEmail] = useState('')
  const [geslo, setGeslo] = useState('')
  const [ime, setIme] = useState('')
  const [priimek, setPriimek] = useState('')
  const [napaka, setNapaka] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const user = useAuth()

  if (user) { navigate('/'); return null }

  const sporocila = {
    'auth/user-not-found': 'Uporabnik ne obstaja.',
    'auth/wrong-password': 'Napačno geslo.',
    'auth/email-already-in-use': 'Email je že v uporabi.',
    'auth/weak-password': 'Geslo mora imeti vsaj 6 znakov.',
    'auth/invalid-email': 'Neveljaven email naslov.',
    'auth/invalid-credential': 'Napačen email ali geslo.',
  }

  const oddaj = async (e) => {
    e.preventDefault()
    setNapaka('')
    setLoading(true)
    try {
      if (zavihek === 'prijava') {
        await signInWithEmailAndPassword(auth, email, geslo)
      } else {
        // Registracija
        await createUserWithEmailAndPassword(auth, email, geslo)
        // Shrani ime in priimek v profil
        await call('posodobiProfil')({ ime, priimek })
      }
      navigate('/')
    } catch (err) {
      setNapaka(sporocila[err.code] || err.message || 'Prišlo je do napake.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="prijava-wrap">
      <div className="forma">
        <div className="tabs">
          <div className={`tab ${zavihek === 'prijava' ? 'active' : ''}`} onClick={() => { setZavihek('prijava'); setNapaka('') }}>Prijava</div>
          <div className={`tab ${zavihek === 'registracija' ? 'active' : ''}`} onClick={() => { setZavihek('registracija'); setNapaka('') }}>Registracija</div>
        </div>

        <form onSubmit={oddaj}>
          {napaka && <p className="napaka">{napaka}</p>}

          {zavihek === 'registracija' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <div>
                <label>Ime</label>
                <input value={ime} onChange={e => setIme(e.target.value)} placeholder="Ana" required />
              </div>
              <div>
                <label>Priimek</label>
                <input value={priimek} onChange={e => setPriimek(e.target.value)} placeholder="Novak" required />
              </div>
            </div>
          )}

          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ime@example.com" required />

          <label>Geslo</label>
          <input type="password" value={geslo} onChange={e => setGeslo(e.target.value)} placeholder="Vsaj 6 znakov" required />

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Nalaganje...' : zavihek === 'prijava' ? 'Prijava' : 'Registracija'}
          </button>
        </form>
      </div>
    </div>
  )
}
