import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import AllEvents from './pages/AllEvents';
import MyEvents from './pages/MyEvents';
import OrganisedEvents from './pages/OrganisedEvents';
import EventDetail from './pages/EventDetail';
import SearchPhotos from './pages/SearchPhotos';
import MyPhotos from './pages/MyPhotos';

function RequireAuth({ children }) {
  const token = sessionStorage.getItem('eventpro_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/events" replace />} />
        <Route path="events"             element={<AllEvents />} />
        <Route path="events/:id"         element={<EventDetail />} />
        <Route path="my-events"          element={<MyEvents />} />
        <Route path="organised-events"   element={<OrganisedEvents />} />
        <Route path="search-photos"      element={<SearchPhotos />} />
        <Route path="my-photos"          element={<MyPhotos />} />
      </Route>
      <Route path="*" element={<Navigate to="/events" replace />} />
    </Routes>
  );
}
