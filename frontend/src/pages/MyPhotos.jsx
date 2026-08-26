import { useState, useEffect } from 'react';
import { api } from '../api';

export default function MyPhotos() {
  const [photos, setPhotos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.getMyPhotos()
      .then(setPhotos)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Photos</h1>
      <p className="text-sm text-gray-500 mb-6">
        All event photos you appear in, found automatically by AI face matching.
      </p>

      {loading && <p className="text-gray-400 text-sm">Loading your photos…</p>}
      {error   && <p className="text-red-500 text-sm">Error: {error}</p>}

      {!loading && !error && photos.length === 0 && (
        <div className="text-center py-24 text-gray-400">
          <span className="text-5xl block mb-3">🖼️</span>
          <p className="font-medium text-gray-500">No photos yet</p>
          <p className="text-sm mt-1">
            Upload a selfie on the <span className="text-indigo-600">Search My Photos</span> page
            after attending an event — AI will find you automatically.
          </p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {photos.map((photo, i) => (
            <div key={photo.photoId || i}
              className="rounded-xl overflow-hidden aspect-square bg-gray-100 shadow-sm group relative cursor-pointer">
              {photo.thumbUrl ? (
                <img src={photo.thumbUrl} alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📷</div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-end p-2 opacity-0 group-hover:opacity-100">
                <p className="text-white text-xs truncate">{photo.eventId}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
