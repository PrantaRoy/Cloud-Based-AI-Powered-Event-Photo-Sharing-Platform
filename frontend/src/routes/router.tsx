import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { LandingPage } from '../pages/landing/LandingPage'
import { HowItWorksPage } from '../pages/public/HowItWorksPage'
import { PrivacyPage } from '../pages/public/PrivacyPage'
import { DashboardLayout } from '../pages/dashboard/DashboardLayout'
import { AllEventsPage } from '../pages/dashboard/AllEventsPage'
import { MyEventsPage } from '../pages/dashboard/MyEventsPage'
import { OrganisedEventsPage } from '../pages/dashboard/OrganisedEventsPage'
import { SearchPhotosPage } from '../pages/dashboard/SearchPhotosPage'
import { MyPhotosPage } from '../pages/dashboard/MyPhotosPage'
import { EventDetailsPage } from '../pages/events/EventDetailsPage'
import { EventEditPage } from '../pages/events/EventEditPage'
import { PublicEventPage } from '../pages/events/PublicEventPage'
import { EventUploadPage } from '../pages/events/EventUploadPage'
import { AlbumDetailPage } from '../pages/albums/AlbumDetailPage'
import { ProtectedRoute } from './ProtectedRoute'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/e/:slug/upload" element={<EventUploadPage />} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
