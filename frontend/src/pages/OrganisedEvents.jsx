import { useState, useEffect } from 'react';
import { api } from '../api';
import NewEventModal from '../components/NewEventModal';

const STATUS_BADGE = {
  Upcoming: 'bg-blue-100 text-blue-800',
  Active:   'bg-green-100 text-green-800',
  Archived: 'bg-gray-100 text-gray-600',
};

export default function OrganisedEvents() {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showModal, setShowModal] = useState(false);

  function loadEvents() {
    setLoading(true);
    api.getEvents({ organiser: 'me' })
      .then(setEvents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadEvents, []);

  function handleCreated(newEvent) {
    setEvents(prev => [newEvent, ...prev]);
    setShowModal(false);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organised Events</h1>
        <button onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2">
          <span>+</span> New Event
        </button>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {error   && <p className="text-red-500 text-sm">Error: {error}</p>}

      {!loading && !error && events.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-2">🗓️</p>
          <p>No events yet. Create your first event!</p>
        </div>
      )}

      {events.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                {['Name', 'Date', 'Venue', 'Status', 'Participants', 'Photos', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {events.map(e => (
                <tr key={e.eventId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                  <td className="px-4 py-3 text-gray-500">{e.date}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{e.venue}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[e.status] || 'bg-gray-100 text-gray-600'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{e.participantCount ?? 0}</td>
                  <td className="px-4 py-3 text-gray-500">{e.photoCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <button className="text-indigo-600 text-xs font-medium hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <NewEventModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
