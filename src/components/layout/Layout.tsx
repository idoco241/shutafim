import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'

export function Layout() {
  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
