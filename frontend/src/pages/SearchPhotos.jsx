import { useState, useRef } from 'react';
import { api } from '../api';

export default function SearchPhotos() {
  const [eventId, setEventId]     = useState('');
  const [preview, setPreview]     = useState(null);
  const [matches, setMatches]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const fileRef = useRef();

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setMatches(null);
    setError('');
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!eventId) { setError('Please enter an Event ID'); return; }
    if (!fileRef.current?.files[0]) { setError('Please select a selfie photo'); return; }
    setError(''); setLoading(true);
    try {
      const result = await api.searchBySelfie(eventId);
      setMatches(result.matches || []);
      if (result.note) setError('ℹ️ ' + result.note);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPreview(null); setMatches(null); setEventId(''); setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Search My Photos</h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload a selfie and we'll find every event photo you appear in using AI face matching.
      </p>

      <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Event ID</label>
          <input value={eventId} onChange={e => setEventId(e.target.value)}
            placeholder="evt-demo-001"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <p className="text-xs text-gray-400 mt-1">Find the event ID on the event details page or from the QR code.</p>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Selfie</label>
          <div className="flex items-start gap-4">
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Selfie preview"
                  className="w-28 h-28 rounded-xl object-cover border border-gray-200" />
                <button type="button" onClick={reset}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
                  ✕
                </button>
              </div>
            ) : (
              <label className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition">
                <span className="text-2xl mb-1">🤳</span>
                <span className="text-xs text-gray-400">Upload selfie</span>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            )}
            <div className="text-xs text-gray-400 mt-2">
              <p>• Clear face, good lighting</p>
              <p>• JPG or PNG, max 10 MB</p>
              <p>• Only you need to be visible</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">{error}</div>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition">
          {loading ? 'Searching…' : '🔍 Find My Photos'}
        </button>
      </form>

      {/* Results */}
      {matches !== null && (
        <div>
          <h2 className="font-semibold text-gray-800 mb-4">
            {matches.length === 0 ? 'No matches found' : `Found ${matches.length} photo${matches.length > 1 ? 's' : ''}`}
          </h2>

          {matches.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400">
              <span className="text-4xl block mb-2">🤷</span>
              <p>No photos of you found in this event.</p>
              <p className="text-xs mt-1">Try a clearer selfie or check the event ID.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {matches.map((photo, i) => (
                <div key={photo.photoId || i} className="rounded-xl overflow-hidden aspect-square bg-gray-100 shadow-sm">
                  {photo.thumbUrl ? (
                    <img src={photo.thumbUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📷</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
