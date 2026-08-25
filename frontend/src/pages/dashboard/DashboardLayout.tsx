import { Outlet } from 'react-router-dom'
import { TopNav } from '../../components/layout/TopNav'
import { SideMenu } from '../../components/layout/SideMenu'

export function DashboardLayout() {
  return (
    <div className="flex h-screen flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <SideMenu />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
