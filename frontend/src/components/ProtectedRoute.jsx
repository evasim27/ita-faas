import { Navigate } from 'react-router-dom'
import { useAuth } from '../App'

export default function ProtectedRoute({ children }) {
  const user = useAuth()
  return user ? children : <Navigate to="/prijava" replace />
}
