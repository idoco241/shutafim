import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function AuthGuard() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 rounded-full border-2 border-purple-700 border-t-transparent animate-spin" />
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/auth" replace />
}
