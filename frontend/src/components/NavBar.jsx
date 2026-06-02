import { Link, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../App'

export default function NavBar() {
  const user = useAuth()
  const navigate = useNavigate()

  const odjava = async () => {
    await signOut(auth)
    navigate('/')
  }

  return (
    <nav>
      <Link to="/" className="logo">Tržnica</Link>
      <div className="nav-links">
        <Link to="/">Oglasi</Link>
        {user ? (
          <>
            <Link to="/objavi" className="btn-objavi">+ Objavi</Link>
            <Link to="/profil">Profil</Link>
            <a onClick={odjava} style={{ cursor: 'pointer' }}>Odjava</a>
          </>
        ) : (
          <Link to="/prijava">Prijava</Link>
        )}
      </div>
    </nav>
  )
}
