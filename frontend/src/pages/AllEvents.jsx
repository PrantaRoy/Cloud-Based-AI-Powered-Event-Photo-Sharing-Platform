import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const TABS = ['All', 'Upcoming', 'Active', 'Archived'];

const STATUS_BADGE = {
  Upcoming: 'bg-blue-100 text-blue-800',
  Active:   'bg-green-100 text-green-800',
  Archived: 'bg-gray-100 text-gray-600',
};

export default function AllEvents() {
  const [events, setEvents]   = useState([]);
  const [tab, setTab]         = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.getEvents()
      .then(setEvents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tab === 'All'
    ? events
    : events.filter(e => e.status === tab);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">All Events</h1>
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading events…</p>}
      {error   && <p className="text-red-500 text-sm">Error: {error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-2">📭</p>
          <p>No events found</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {filtered.map(event => (
          <div key={event.eventId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
            <div className="h-32 bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
              <span className="text-white text-4xl">📷</span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">{event.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${STATUS_BADGE[event.status] || 'bg-gray-100 text-gray-600'}`}>
                  {event.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-0.5">{event.date}</p>
              <p className="text-xs text-gray-500 mb-3 truncate">{event.venue}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{event.privacy}</span>
                <button
                  onClick={() => navigate(`/events/${event.eventId}`)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700">
                  Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
