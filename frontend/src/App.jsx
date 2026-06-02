import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import NavBar from './components/NavBar'
import Home from './pages/Home'
import Oglas from './pages/Oglas'
import ObjavaOglasa from './pages/ObjavaOglasa'
import Profil from './pages/Profil'
import Prijava from './pages/Prijava'
import UrejanjeOglasa from './pages/UrejanjeOglasa'
import ProtectedRoute from './components/ProtectedRoute'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u))
  }, [])

  if (user === undefined) return <div className="loading">Nalaganje...</div>

  return (
    <AuthContext.Provider value={user}>
      <BrowserRouter>
        <NavBar />
        <main className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/oglas/:id" element={<Oglas />} />
            <Route path="/prijava" element={<Prijava />} />
            <Route path="/objavi" element={
              <ProtectedRoute><ObjavaOglasa /></ProtectedRoute>
            } />
            <Route path="/profil" element={
              <ProtectedRoute><Profil /></ProtectedRoute>
            } />
            <Route path="/uredi/:id" element={
              <ProtectedRoute><UrejanjeOglasa /></ProtectedRoute>
            } />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
