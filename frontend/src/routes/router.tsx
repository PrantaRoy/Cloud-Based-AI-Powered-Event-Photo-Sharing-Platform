import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '../pages/auth/LoginPage'
import { DashboardLayout } from '../pages/dashboard/DashboardLayout'
import { AllEventsPage } from '../pages/dashboard/AllEventsPage'
import { MyEventsPage } from '../pages/dashboard/MyEventsPage'
import { OrganisedEventsPage } from '../pages/dashboard/OrganisedEventsPage'
import { SearchPhotosPage } from '../pages/dashboard/SearchPhotosPage'
import { MyPhotosPage } from '../pages/dashboard/MyPhotosPage'
import { EventDetailsPage } from '../pages/events/EventDetailsPage'
import { EventEditPage } from '../pages/events/EventEditPage'
import { PublicEventPage } from '../pages/events/PublicEventPage'
import { AlbumDetailPage } from '../pages/albums/AlbumDetailPage'
import { ProtectedRoute } from './ProtectedRoute'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/e/:slug" element={<PublicEventPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="events" replace />} />
        <Route path="events" element={<AllEventsPage />} />
        <Route path="events/mine" element={<MyEventsPage />} />
        <Route path="events/organised" element={<OrganisedEventsPage />} />
        <Route path="events/organised/:id/edit" element={<EventEditPage />} />
        <Route path="events/:id" element={<EventDetailsPage />} />
        <Route path="search-photos" element={<SearchPhotosPage />} />
        <Route path="photos" element={<MyPhotosPage />} />
        <Route path="albums/:id" element={<AlbumDetailPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard/events" replace />} />
      <Route path="*" element={<Navigate to="/dashboard/events" replace />} />
    </Routes>
  )
}
