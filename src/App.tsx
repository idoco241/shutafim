import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ComingSoon } from './components/shared/ComingSoon'
import RoomsPage from './pages/RoomsPage'
import ChatPage from './pages/ChatPage'
import ListingDetailPage from './pages/ListingDetailPage'
import CreateListingPage from './pages/CreateListingPage'
import ProfilePage from './pages/ProfilePage'
import AuthPage from './pages/AuthPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/rooms" replace />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:id" element={<ChatPage />} />
          {/* /listing/new must come before /listing/:id */}
          <Route path="/listing/new" element={<CreateListingPage />} />
          <Route path="/listing/:id" element={<ListingDetailPage />} />
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
      </Routes>
    </BrowserRouter>
  )
}
