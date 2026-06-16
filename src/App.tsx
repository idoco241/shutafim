import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './components/auth/AuthProvider'
import { AuthGuard } from './components/auth/AuthGuard'
import { Layout } from './components/layout/Layout'
import { ComingSoon } from './components/shared/ComingSoon'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
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
    <ErrorBoundary>
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
                      page="שוק"
                      icon="ti-shopping-bag"
                      teaser="קנה ומכור ריהוט וציוד לסטודנטים ליד הקמפוס שלך."
                    />
                  }
                />
                <Route
                  path="/roommates"
                  element={
                    <ComingSoon
                      page="שותפים"
                      icon="ti-users"
                      teaser="מצא סטודנטים שמחפשים בדיוק את אותו הדבר ותתחבר איתם."
                    />
                  }
                />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
