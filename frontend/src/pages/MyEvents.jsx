import { useState, useEffect } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';

const STATUS_BADGE = {
  Upcoming: 'bg-blue-100 text-blue-800',
  Active:   'bg-green-100 text-green-800',
  Archived: 'bg-gray-100 text-gray-600',
};

export default function MyEvents() {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Events you joined (participantId matches) — for now returns all public events
    api.getEvents()
      .then(setEvents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Events</h1>
      <p className="text-sm text-gray-500 mb-6">Events you have joined or registered for.</p>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {error   && <p className="text-red-500 text-sm">Error: {error}</p>}

      {!loading && !error && events.length === 0 && (
        <div className="text-center py-24 text-gray-400">
          <span className="text-5xl block mb-3">⭐</span>
          <p className="font-medium text-gray-500">No events joined yet</p>
          <p className="text-sm mt-1">Browse <span className="text-indigo-600 cursor-pointer" onClick={() => navigate('/events')}>All Events</span> and click Details to join.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {events.map(event => (
          <div key={event.eventId}
            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition"
            onClick={() => navigate(`/events/${event.eventId}`)}>
            <div className="h-28 bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
              <span className="text-white text-3xl">📷</span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">{event.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${STATUS_BADGE[event.status] || 'bg-gray-100 text-gray-600'}`}>
                  {event.status}
                </span>
              </div>
              <p className="text-xs text-gray-400">{event.date} · {event.venue}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
