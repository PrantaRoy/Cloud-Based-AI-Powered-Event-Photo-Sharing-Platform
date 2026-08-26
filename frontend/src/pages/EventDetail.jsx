import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const STATUS_BADGE = {
  Upcoming: 'bg-blue-100 text-blue-800',
  Active:   'bg-green-100 text-green-800',
  Archived: 'bg-gray-100 text-gray-600',
};

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent]     = useState(null);
  const [photos, setPhotos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState('');
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([api.getEvent(id), api.getGallery(id)])
      .then(([ev, ph]) => { setEvent(ev); setPhotos(ph); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('Getting upload URL…');
    try {
      // 1. Get pre-signed URL
      const { photoId, uploadUrl, key, note } = await api.getUploadUrl(id, file.name, file.type);

      // 2. PUT file to S3 (or stub URL in local dev)
      if (!note) {
        setUploadMsg('Uploading photo…');
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      } else {
        setUploadMsg('Local dev: skipping real S3 upload');
      }

      // 3. Notify API
      setUploadMsg('Processing…');
      await api.notifyUploaded(id, photoId, key);

      // 4. Add optimistic photo card
      setPhotos(prev => [{
        photoId,
        s3Key: key,
        uploadedAt: new Date().toISOString(),
        processed: false,
        _localFile: URL.createObjectURL(file),
      }, ...prev]);

      setUploadMsg('✅ Uploaded! AI pipeline will process it shortly.');
    } catch (err) {
      setUploadMsg('❌ Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading event…</div>;
  if (error)   return <div className="p-8 text-red-500 text-sm">Error: {error}</div>;
  if (!event)  return <div className="p-8 text-gray-400 text-sm">Event not found.</div>;

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="text-sm text-indigo-600 hover:underline mb-4 flex items-center gap-1">
        ← Back
      </button>

      {/* Banner */}
      <div className="h-48 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-end p-6 mb-6 relative">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[event.status] || 'bg-gray-100 text-gray-600'}`}>
              {event.status}
            </span>
            <span className="text-white text-xs opacity-75">{event.privacy}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{event.name}</h1>
          <p className="text-white opacity-80 text-sm mt-1">
            📅 {event.date} &nbsp;·&nbsp; 📍 {event.venue}
          </p>
        </div>

        {/* QR code placeholder */}
        <div className="absolute top-4 right-4 bg-white rounded-xl p-2 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
            {event.qrcodeKey ? '⬛' : '📷'}
          </div>
          <p className="text-xs text-gray-500 mt-1">QR Code</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-6">
        {[
          { label: 'Participants', value: event.participantCount ?? 0 },
          { label: 'Photos',       value: photos.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 px-5 py-3 text-center shadow-sm">
            <div className="text-xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Upload section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-3">Upload Photos</h2>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload}
            className="hidden" id="photo-upload" />
          <label htmlFor="photo-upload"
            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${
              uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}>
            {uploading ? 'Uploading…' : '+ Choose Photo'}
          </label>
          {uploadMsg && <p className="text-sm text-gray-600">{uploadMsg}</p>}
        </div>
        <p className="text-xs text-gray-400 mt-2">After upload, AI will automatically find people in the photo.</p>
      </div>

      {/* Photo gallery */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-4">Photos ({photos.length})</h2>
        {photos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <span className="text-4xl block mb-2">📷</span>
            <p>No photos yet. Be the first to upload!</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {photos.map(photo => (
              <div key={photo.photoId} className="relative rounded-xl overflow-hidden aspect-square bg-gray-100 group">
                {photo._localFile ? (
                  <img src={photo._localFile} alt="" className="w-full h-full object-cover" />
                ) : photo.thumbKey ? (
                  <img src={`/api/photo-url/${photo.photoId}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📷</div>
                )}
                {!photo.processed && (
                  <div className="absolute bottom-1 right-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                    Processing…
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
