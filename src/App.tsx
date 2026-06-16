import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './components/auth/AuthProvider'
import { AuthGuard } from './components/auth/AuthGuard'
import { Layout } from './components/layout/Layout'
import { ComingSoon } from './components/shared/ComingSoon'
import RoomsPage from './pages/RoomsPage'
import ChatPage from './pages/ChatPage'
import ListingDetailPage from './pages/ListingDetailPage'
import CreateListingPage from './pages/CreateListingPage'
import ProfilePage from './pages/ProfilePage'
import ApplicantsPage from './pages/ApplicantsPage'
import GroupBroadcastPage from './pages/GroupBroadcastPage'
import AuthPage from './pages/AuthPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Protected — require login */}
          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/rooms" replace />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/chat/:id" element={<ChatPage />} />
              {/* /listing/new must precede /listing/:id */}
              <Route path="/listing/new" element={<CreateListingPage />} />
              <Route path="/listing/:id" element={<ListingDetailPage />} />
              <Route path="/listing/:id/applicants" element={<ApplicantsPage />} />
              <Route path="/listing/:id/group" element={<GroupBroadcastPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route
                path="/marketplace"
                element={
                  <ComingSoon
                    page="Marketplace"
                    icon="ti-shopping-bag"
                    teaser="Buy and sell furniture and student essentials near campus."
                  />
                }
              />
              <Route
                path="/roommates"
                element={
                  <ComingSoon
                    page="Roommate finder"
                    icon="ti-users"
                    teaser="Find and connect with students looking for the same kind of place."
                  />
                }
              />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
