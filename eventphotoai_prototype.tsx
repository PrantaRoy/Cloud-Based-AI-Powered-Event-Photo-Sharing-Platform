import React, { useState, useEffect } from 'react';
import { 
  Camera, QrCode, Search, Upload, Shield, Users, Sparkles, Play, 
  CheckCircle2, Clock, BarChart3, Lock, Globe, ChevronRight, Image as ImageIcon, 
  Zap, Server, Database, Bell, ArrowRight, X, Eye, RefreshCw, Cpu, 
  Share2, Key, Check, Filter, Layers, Info, FileText, AlertCircle, User
} from 'lucide-react';

// Mock initial events data
const INITIAL_EVENTS = [
  {
    id: 'evt_98f4a12b',
    name: 'Tech Innovators Summit 2026',
    date: '2026-08-15',
    venue: 'Convention Center Hall A',
    startTime: '09:00',
    endTime: '18:00',
    isProtected: false,
    hostName: 'Pranta (Host)',
    bannerUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    photoCount: 142,
    queueCount: 3,
    lastUpdatedBy: 'Sarah M.',
    createdDate: '2026-07-20',
    description: 'Annual gathering of cloud architects and software engineers.'
  },
  {
    id: 'evt_33c910df',
    name: 'Grand Wedding Celebration',
    date: '2026-09-02',
    venue: 'Grand Palace Resort',
    startTime: '16:00',
    endTime: '23:30',
    isProtected: true,
    hostName: 'Pranta (Host)',
    bannerUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    photoCount: 89,
    queueCount: 0,
    lastUpdatedBy: 'Official Photographer',
    createdDate: '2026-07-22',
    description: 'Private celebration gallery accessible by invitation and face search only.'
  }
];

// Mock Photos for active event
const MOCK_PHOTOS = [
  {
    id: 'p_101',
    eventId: 'evt_98f4a12b',
    url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
    detectedFaces: 3,
    uploader: 'Alex K.',
    time: '10 mins ago',
    tags: ['Stage', 'Keynote', 'Audience'],
    matchedScore: null
  },
  {
    id: 'p_102',
    eventId: 'evt_98f4a12b',
    url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=800&q=80',
    detectedFaces: 4,
    uploader: 'Maria S.',
    time: '25 mins ago',
    tags: ['Workshop', 'Team'],
    matchedScore: null
  },
  {
    id: 'p_103',
    eventId: 'evt_98f4a12b',
    url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
    detectedFaces: 2,
    uploader: 'Pranta (Host)',
    time: '1 hour ago',
    tags: ['Discussion', 'Q&A'],
    matchedScore: null
  },
  {
    id: 'p_104',
    eventId: 'evt_98f4a12b',
    url: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=800&q=80',
    detectedFaces: 1,
    uploader: 'John D.',
    time: '2 hours ago',
    tags: ['Keynote', 'Speaker'],
    matchedScore: null
  },
  {
    id: 'p_105',
    eventId: 'evt_98f4a12b',
    url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=800&q=80',
    detectedFaces: 5,
    uploader: 'Sarah M.',
    time: '3 hours ago',
    tags: ['Networking', 'Coffee Break'],
    matchedScore: null
  },
  {
    id: 'p_106',
    eventId: 'evt_98f4a12b',
    url: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=800&q=80',
    detectedFaces: 2,
    uploader: 'Pranta (Host)',
    time: '4 hours ago',
    tags: ['Panel', 'Stage'],
    matchedScore: null
  }
];

export default function App() {
  // Navigation & User State
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'dashboard' | 'event-detail' | 'architecture'
  const [user, setUser] = useState({ loggedIn: true, name: 'Pranta', email: 'pranta@cloudapp.edu', verified: true });
  
  // App Data State
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [activeEventId, setActiveEventId] = useState('evt_98f4a12b');
  const [photos, setPhotos] = useState(MOCK_PHOTOS);
  
  // UI Modals & Filters
  const [authModal, setAuthModal] = useState({ open: false, mode: 'login' });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selfieModalOpen, setSelfieModalOpen] = useState(false);
  const [activePhotoModal, setActivePhotoModal] = useState(null);
  const [slideshowIndex, setSlideshowIndex] = useState(null);
  
  // Interactive Operations State
  const [isSelfieSearching, setIsSelfieSearching] = useState(false);
  const [isFaceFiltered, setIsFaceFiltered] = useState(false);
  const [simulatedUploadProgress, setSimulatedUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showArchOverlay, setShowArchOverlay] = useState(true);
  const [archLog, setArchLog] = useState([
    { time: '12:59:01', service: 'AWS Cognito', msg: 'JWT User Session active for pranta@cloudapp.edu' },
    { time: '12:59:02', service: 'Amazon DynamoDB', msg: 'Query GSI_EventPhotos: Fetched 6 items' }
  ]);

  const activeEvent = events.find(e => e.id === activeEventId) || events[0];

  const pushLog = (service, msg) => {
    const time = new Date().toLocaleTimeString();
    setArchLog(prev => [{ time, service, msg }, ...prev.slice(0, 7)]);
  };

  const handleSelfieSearch = () => {
    setIsSelfieSearching(true);
    pushLog('Amazon S3', 'Temporary selfie uploaded to s3://bucket/temp-selfies/');
    
    setTimeout(() => {
      pushLog('AWS Lambda (AI)', 'Invoked container: Loaded dlib/OpenCV model in 240ms');
      pushLog('AWS Lambda (AI)', 'Extracted 128-d face embedding vector: [-0.041, 0.128, ...]');
      pushLog('Amazon DynamoDB', 'Query GSI_EventFaces for EventID: evt_98f4a12b');
      
      // Simulate matching scores
      const matched = photos.map((photo, index) => {
        // Mock matching logic: photos 0, 2, and 4 match high confidence
        const isMatch = index === 0 || index === 2 || index === 4;
        return {
          ...photo,
          matchedScore: isMatch ? Math.floor(88 + Math.random() * 10) : Math.floor(12 + Math.random() * 30)
        };
      });

      setPhotos(matched);
      setIsSelfieSearching(false);
      setIsFaceFiltered(true);
      setSelfieModalOpen(false);
      pushLog('CloudFront', 'Generated 3 Signed URLs for matched face gallery');
      pushLog('Amazon SNS', 'Triggered notification pipeline: Face matches ready');
    }, 1800);
  };

  const handleUploadSim = () => {
    setIsUploading(true);
    setSimulatedUploadProgress(15);
    pushLog('Laravel API (EC2)', 'POST /api/v1/events/evt_98f4a12b/upload-url');
    pushLog('AWS Secrets Manager', 'Retrieved S3 signing keys for pre-signed URL generation');

    setTimeout(() => {
      setSimulatedUploadProgress(60);
      pushLog('Amazon S3', 'Direct PUT upload from browser to s3://bucket/originals/');
    }, 800);

    setTimeout(() => {
      setSimulatedUploadProgress(100);
      pushLog('Amazon SQS', 'Dispatched job: { event_id: "evt_98f4a12b", photo_id: "p_107" }');
      
      // Add new photo
      const newPhoto = {
        id: `p_${Date.now()}`,
        eventId: activeEventId,
        url: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=800&q=80',
        detectedFaces: 2,
        uploader: user.name,
        time: 'Just now',
        tags: ['New Upload', 'Audience'],
        matchedScore: isFaceFiltered ? 96 : null
      };

      setPhotos([newPhoto, ...photos]);
      setEvents(events.map(e => e.id === activeEventId ? { ...e, photoCount: e.photoCount + 1, lastUpdatedBy: user.name } : e));
      setIsUploading(false);
      setUploadModalOpen(false);
      setSimulatedUploadProgress(0);
      pushLog('AWS Lambda (AI)', 'SQS Event Source Triggered: Extracted faces & updated DynamoDB');
    }, 1600);
  };

  const handleCreateEvent = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newId = `evt_${Math.random().toString(36).substr(2, 8)}`;
    
    pushLog('Laravel API (EC2)', 'POST /api/v1/events - Validated request payload');
    pushLog('Amazon S3', `Uploaded banner to s3://bucket/events/${newId}/banner.png`);
    
    const newEvt = {
      id: newId,
      name: formData.get('name') || 'New Tech Meetup',
      date: formData.get('date') || '2026-08-30',
      venue: formData.get('venue') || 'Innovation Hub',
      startTime: formData.get('startTime') || '10:00',
      endTime: formData.get('endTime') || '16:00',
      isProtected: formData.get('isProtected') === 'true',
      hostName: user.name,
      bannerUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80',
      photoCount: 0,
      queueCount: 0,
      lastUpdatedBy: user.name,
      createdDate: new Date().toISOString().split('T')[0],
      description: formData.get('description') || 'Created with AeroPhoto AI.'
    };

    setEvents([newEvt, ...events]);
    setActiveEventId(newId);
    setCreateModalOpen(false);
    setCurrentView('event-detail');
    pushLog('Amazon DynamoDB', `PutItem to 'Events' table for PK: ${newId}`);
    pushLog('Amazon S3', `Generated & saved QR Code image s3://bucket/qrcodes/${newId}.png`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top System Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('landing')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AeroSnap <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold">AI Cloud</span>
              </span>
              <p className="text-[10px] text-slate-400 -mt-0.5">Facial Recognition Photo Ecosystem</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <button 
              onClick={() => setCurrentView('landing')} 
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentView === 'landing' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setCurrentView('dashboard')} 
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentView === 'dashboard' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
            >
              Event Directory
            </button>
            <button 
              onClick={() => setCurrentView('architecture')} 
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center space-x-1.5 ${currentView === 'architecture' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
            >
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>AWS Architecture</span>
            </button>
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowArchOverlay(!showArchOverlay)}
              className="hidden lg:flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition"
              title="Toggle Live AWS Telemetry Feed"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>AWS Logs</span>
            </button>

            {user.loggedIn ? (
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => { setCreateModalOpen(true); pushLog('Laravel API (EC2)', 'Initiated Event Creation Form'); }} 
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-medium shadow-md shadow-indigo-500/20 transition flex items-center space-x-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create Event</span>
                </button>
                <div className="h-8 w-8 rounded-full bg-slate-800 border border-indigo-500/50 flex items-center justify-center text-indigo-300 font-bold text-xs">
                  PR
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setAuthModal({ open: true, mode: 'login' })}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {}
      {showArchOverlay && (
        <div className="bg-slate-900 border-b border-indigo-500/30 px-4 py-2 text-xs font-mono text-slate-300 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center space-x-2 shrink-0">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-slate-400 font-sans font-medium text-[11px] uppercase tracking-wider">Live Cloud Telemetry:</span>
          </div>
          <div className="flex items-center space-x-6 overflow-x-auto py-1 px-2">
            {archLog.slice(0, 2).map((log, i) => (
              <div key={i} className="flex items-center space-x-2 shrink-0">
                <span className="text-indigo-400 font-semibold">[{log.service}]</span>
                <span className="text-slate-200">{log.msg}</span>
                <span className="text-slate-500 text-[10px]">{log.time}</span>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setCurrentView('architecture')} 
            className="text-xs text-indigo-400 hover:underline shrink-0 font-sans ml-2"
          >
            Full Diagram →
          </button>
        </div>
      )}

      {}
      <main className="flex-1">
        {currentView === 'landing' && (
          <LandingPage 
            onExplore={() => setCurrentView('dashboard')} 
            onCreateEvent={() => setCreateModalOpen(true)}
            onSelectEvent={(id) => { setActiveEventId(id); setCurrentView('event-detail'); }}
            events={events}
          />
        )}

        {currentView === 'dashboard' && (
          <EventDirectoryView 
            events={events} 
            onSelectEvent={(id) => { setActiveEventId(id); setCurrentView('event-detail'); }}
            onCreateEvent={() => setCreateModalOpen(true)}
          />
        )}

        {currentView === 'event-detail' && (
          <EventDetailView 
            event={activeEvent}
            photos={photos}
            isFaceFiltered={isFaceFiltered}
            onResetFaceFilter={() => {
              setIsFaceFiltered(false);
              setPhotos(MOCK_PHOTOS);
              pushLog('Amazon DynamoDB', 'Cleared search filter: Displaying all event photos');
            }}
            onOpenUpload={() => setUploadModalOpen(true)}
            onOpenSelfieSearch={() => setSelfieModalOpen(true)}
            onPhotoClick={(photo, idx) => {
              setActivePhotoModal(photo);
              setSlideshowIndex(idx);
            }}
          />
        )}

        {currentView === 'architecture' && (
          <ArchitectureView logs={archLog} />
        )}
      </main>

      {}
      
      {/* 1. Create Event Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 text-indigo-400 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Laravel + AWS Pipeline</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Create New Event</h3>
            <p className="text-slate-400 text-xs mb-6">Generates unique UUID, QR code on S3, and DynamoDB event metadata entry.</p>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Event Name</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  placeholder="e.g., Annual Tech Gala 2026"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Event Date</label>
                  <input 
                    type="date" 
                    name="date" 
                    required 
                    defaultValue="2026-08-15"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Venue Location</label>
                  <input 
                    type="text" 
                    name="venue" 
                    required 
                    placeholder="Grand Ballroom"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Start Time</label>
                  <input 
                    type="time" 
                    name="startTime" 
                    defaultValue="09:00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">End Time</label>
                  <input 
                    type="time" 
                    name="endTime" 
                    defaultValue="18:00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Access Privacy Rule</label>
                <select 
                  name="isProtected" 
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="false">Public Event (Open dashboard with authentication)</option>
                  <option value="true">Protected Event (Strict Login required to view content)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Event Description</label>
                <textarea 
                  name="description" 
                  rows="2" 
                  placeholder="Brief overview of the gathering..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-1.5"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Generate Event & QR Code</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Direct-to-S3 Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setUploadModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 text-indigo-400 mb-2">
              <Upload className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Direct S3 Pre-Signed Upload</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Upload Event Photos</h3>
            <p className="text-slate-400 text-xs mb-6">Bypasses EC2 web servers. Files are sent straight to Amazon S3 bucket and enqueued in SQS.</p>

            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-8 text-center bg-slate-800/30 transition flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3">
                <ImageIcon className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-200 mb-1">Drag and drop event photos here</p>
              <p className="text-xs text-slate-500 mb-4">Supports PNG, JPG, WEBP up to 25MB each</p>
              
              {isUploading ? (
                <div className="w-full space-y-2">
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full transition-all duration-300" 
                      style={{ width: `${simulatedUploadProgress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>S3 Uploading...</span>
                    <span>{simulatedUploadProgress}%</span>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleUploadSim}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Simulate Direct Upload</span>
                </button>
              )}
            </div>

            <div className="mt-4 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50 text-[11px] text-slate-400 space-y-1 font-mono">
              <div className="flex items-center justify-between text-slate-300 font-sans font-semibold mb-1">
                <span>Cloud Pipeline Steps:</span>
                <span className="text-emerald-400">Automated</span>
              </div>
              <p>1. Laravel issues S3 pre-signed PUT URL</p>
              <p>2. Browser uploads directly to Amazon S3</p>
              <p>3. Notification dispatches message to SQS queue</p>
              <p>4. Lambda extracts 128-d facial embeddings</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Selfie Facial Search Modal */}
      {selfieModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setSelfieModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 text-indigo-400 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">AI Face Vector Match</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Search Your Photos</h3>
            <p className="text-slate-400 text-xs mb-6">Upload or capture a selfie to extract facial feature vectors and locate your photos in this event gallery.</p>

            <div className="flex flex-col items-center justify-center p-6 bg-slate-800/40 rounded-xl border border-slate-700/60 mb-4">
              <div className="relative w-28 h-28 rounded-full border-2 border-dashed border-indigo-500 flex items-center justify-center bg-slate-800 overflow-hidden mb-3">
                <User className="w-12 h-12 text-slate-500" />
                {isSelfieSearching && (
                  <div className="absolute inset-0 bg-indigo-900/80 flex flex-col items-center justify-center p-2 text-center">
                    <RefreshCw className="w-6 h-6 text-indigo-300 animate-spin mb-1" />
                    <span className="text-[10px] text-indigo-200 font-mono">Vectorizing...</span>
                  </div>
                )}
              </div>
              <p className="text-xs font-medium text-slate-300 text-center mb-4">Selfie image will be processed temporarily in S3 and auto-deleted in 24 hrs.</p>

              <button 
                onClick={handleSelfieSearch}
                disabled={isSelfieSearching}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition flex items-center justify-center space-x-2"
              >
                <Search className="w-4 h-4" />
                <span>{isSelfieSearching ? 'Extracting Embeddings...' : 'Upload Selfie & Find Matches'}</span>
              </button>
            </div>

            <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-lg text-xs text-indigo-300 flex items-start space-x-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p>Lambda uses Python `face_recognition` library to extract a 128-float vector array and performs cosine similarity against DynamoDB index.</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Photo Lightbox / Slideshow Modal */}
      {activePhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-4">
          <div className="w-full max-w-5xl flex items-center justify-between text-slate-300 py-2">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-400">
                AI
              </div>
              <div>
                <p className="text-sm font-bold text-white">Uploaded by {activePhotoModal.uploader}</p>
                <p className="text-xs text-slate-400">{activePhotoModal.time} • Detected {activePhotoModal.detectedFaces} Faces</p>
              </div>
            </div>
            <button 
              onClick={() => setActivePhotoModal(null)}
              className="p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="max-w-4xl max-h-[75vh] flex items-center justify-center my-auto relative overflow-hidden rounded-xl border border-slate-800 shadow-2xl">
            <img 
              src={activePhotoModal.url} 
              alt="Event detail" 
              className="max-h-[70vh] object-contain rounded-lg"
            />
            {activePhotoModal.matchedScore && (
              <div className="absolute top-4 left-4 bg-emerald-500/90 text-white font-bold text-xs px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg flex items-center space-x-1.5">
                <Check className="w-4 h-4" />
                <span>Selfie Match: {activePhotoModal.matchedScore}% Confidence</span>
              </div>
            )}
          </div>

          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <span>Served securely via Amazon CloudFront (OAC Signed Cookie)</span>
            </div>
            <button 
              onClick={() => alert('Pre-signed download link generated by Laravel API')} 
              className="px-3 py-1 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-500"
            >
              Download Original
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 AeroSnap AI • Academic Prototype for Cloud Application Architecture</p>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Laravel on EC2</span>
            <span>•</span>
            <span>DynamoDB</span>
            <span>•</span>
            <span>SQS + Lambda Container</span>
            <span>•</span>
            <span>CloudFront CDN</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LandingPage({ onExplore, onCreateEvent, onSelectEvent, events }) {
  return (
    <div className="space-y-16 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-indigo-950/60 via-slate-900/90 to-slate-950 border border-indigo-500/20 p-8 sm:p-12 lg:p-16 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_50%)]"></div>
        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AWS Cloud Architecture & Open-Source AI</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Event Photo Sharing with <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Facial Recognition</span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Hosts create events with unique QR codes. Attendees instantly find every photo they appear in by searching with a single selfie powered by serverless AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={onCreateEvent}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 transition flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create Event & QR Code</span>
            </button>
            <button 
              onClick={onExplore}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm transition flex items-center justify-center space-x-2"
            >
              <Search className="w-4 h-4 text-indigo-400" />
              <span>Browse Active Events</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <QrCode className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Unique QR Code & URLs</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every event generates an instant unique URL and scannable QR image stored securely on Amazon S3. Guests scan and access the event landing page.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Selfie Face Search</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Upload a single selfie. Our Python Lambda AI container extracts 128-d vector embeddings and queries DynamoDB to find your photos in seconds.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Protected Access Rules</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Choose between Public events or Protected private galleries. Guarded by AWS Cognito authentication and CloudFront signed cookies.
          </p>
        </div>
      </div>

      {/* Active Featured Events Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Active Event Galleries</h2>
            <p className="text-xs text-slate-400">Select an event to explore live insights, upload photos, or search with a selfie.</p>
          </div>
          <button onClick={onExplore} className="text-xs text-indigo-400 font-semibold hover:underline flex items-center space-x-1">
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map(evt => (
            <div 
              key={evt.id} 
              onClick={() => onSelectEvent(evt.id)}
              className="group cursor-pointer rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 overflow-hidden transition shadow-lg hover:shadow-indigo-500/10 flex flex-col sm:flex-row"
            >
              <div className="sm:w-2/5 h-48 sm:h-auto relative overflow-hidden">
                <img 
                  src={evt.bannerUrl} 
                  alt={evt.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-950/80 backdrop-blur-md text-white border border-slate-700">
                  {evt.isProtected ? '🔒 Protected' : '🌐 Public'}
                </div>
              </div>

              <div className="p-5 sm:w-3/5 flex flex-col justify-between space-y-4">
                <div>
                  <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">{evt.id}</span>
                  <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition line-clamp-1">{evt.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{evt.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 border-t border-slate-800/80 pt-3">
                  <div>
                    <span className="text-slate-500 block">Date & Venue</span>
                    <span className="font-medium truncate block">{evt.date} • {evt.venue}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Photos</span>
                    <span className="font-bold text-indigo-400">{evt.photoCount} uploaded</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventDirectoryView({ events, onSelectEvent, onCreateEvent }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Event Directory</h1>
          <p className="text-xs text-slate-400">Manage and browse cloud-hosted event galleries.</p>
        </div>
        <button 
          onClick={onCreateEvent}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center space-x-2 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>New Event</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map(evt => (
          <div 
            key={evt.id}
            onClick={() => onSelectEvent(evt.id)}
            className="cursor-pointer rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-5 space-y-4 transition hover:shadow-xl hover:shadow-indigo-500/5"
          >
            <div className="h-36 rounded-xl overflow-hidden relative">
              <img src={evt.bannerUrl} alt={evt.name} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-950/80 text-[10px] font-mono text-indigo-300">
                {evt.id}
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>{evt.date} • {evt.startTime} - {evt.endTime}</span>
              </div>
              <h3 className="text-base font-bold text-white line-clamp-1">{evt.name}</h3>
              <p className="text-xs text-slate-400 mt-1">{evt.venue}</p>
            </div>

            <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800/80 text-slate-400">
              <span>{evt.photoCount} Photos</span>
              <span className="text-indigo-400 font-medium">View Gallery →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventDetailView({ 
  event, 
  photos, 
  isFaceFiltered, 
  onResetFaceFilter, 
  onOpenUpload, 
  onOpenSelfieSearch, 
  onPhotoClick 
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Event Banner Header */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="h-64 sm:h-80 w-full relative">
          <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
        </div>

        <div className="p-6 sm:p-8 relative -mt-32 z-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono border border-indigo-500/30">
                {event.id}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${event.isProtected ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                {event.isProtected ? 'Protected Event' : 'Public Access'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white">{event.name}</h1>
            <p className="text-xs sm:text-sm text-slate-300 flex items-center space-x-3">
              <span>📍 {event.venue}</span>
              <span>📅 {event.date}</span>
              <span>🕒 {event.startTime} - {event.endTime}</span>
            </p>
          </div>

          {/* Action Buttons & Share URL */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button 
              onClick={handleCopyLink}
              className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition flex items-center space-x-1.5"
            >
              <Share2 className="w-4 h-4 text-indigo-400" />
              <span>{copied ? 'Link Copied!' : 'Share Event Link'}</span>
            </button>

            <button 
              onClick={onOpenSelfieSearch}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition flex items-center space-x-2"
            >
              <Search className="w-4 h-4" />
              <span>Find My Face</span>
            </button>

            <button 
              onClick={onOpenUpload}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Photo</span>
            </button>
          </div>
        </div>
      </div>

      {}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Uploads</span>
            <ImageIcon className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white">{event.photoCount}</p>
          <p className="text-[10px] text-slate-500 font-mono">DynamoDB Query Count</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Processing Queue</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300">{event.queueCount} <span className="text-xs font-normal text-slate-400">queued</span></p>
          <p className="text-[10px] text-slate-500 font-mono">Amazon SQS Backlog</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Last Contributor</span>
            <User className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-base font-bold text-white truncate">{event.lastUpdatedBy}</p>
          <p className="text-[10px] text-slate-500 font-mono">Updated just now</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Access Guard</span>
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-base font-bold text-emerald-400">{event.isProtected ? 'Cognito Protected' : 'Open Gallery'}</p>
          <p className="text-[10px] text-slate-500 font-mono">AWS Cognito JWT Active</p>
        </div>
      </div>

      {}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-white">Event Gallery</h2>
            {isFaceFiltered && (
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>Selfie Match Filter Active</span>
              </span>
            )}
          </div>

          {isFaceFiltered && (
            <button 
              onClick={onResetFaceFilter}
              className="text-xs text-indigo-400 hover:underline font-semibold"
            >
              Show All Event Photos
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {photos.map((photo, idx) => (
            <div 
              key={photo.id}
              onClick={() => onPhotoClick(photo, idx)}
              className="group cursor-pointer rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 overflow-hidden relative shadow-lg transition"
            >
              <div className="h-64 w-full relative overflow-hidden bg-slate-950">
                <img 
                  src={photo.url} 
                  alt="Event photo" 
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />

                {photo.matchedScore && (
                  <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>{photo.matchedScore}% Match</span>
                  </div>
                )}

                <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-slate-300">
                  {photo.detectedFaces} {photo.detectedFaces === 1 ? 'Face' : 'Faces'}
                </div>
              </div>

              <div className="p-3 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
                <span>Uploaded by {photo.uploader}</span>
                <span>{photo.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArchitectureView({ logs }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">AWS Cloud Architecture Blueprint</h1>
        <p className="text-xs text-slate-400">Detailed component mapping satisfying all strict project assignment requirements.</p>
      </div>

      {/* Visual Service Topology Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-indigo-400">
            <Server className="w-5 h-5" />
            <h3 className="font-bold text-white text-sm">Compute & Security</h3>
          </div>
          <ul className="text-xs text-slate-400 space-y-2">
            <li className="flex items-start space-x-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span><strong>EC2 + ELB:</strong> Hosts Laravel API backend behind Application Load Balancer.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span><strong>AWS Lambda:</strong> Runs Docker container with open-source Python face extraction.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span><strong>AWS Cognito:</strong> Manages registration, logins, and email verification tokens.</span>
            </li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-purple-400">
            <Database className="w-5 h-5" />
            <h3 className="font-bold text-white text-sm">Storage & Queueing</h3>
          </div>
          <ul className="text-xs text-slate-400 space-y-2">
            <li className="flex items-start space-x-2">
              <span className="text-purple-400 font-bold">•</span>
              <span><strong>Amazon S3:</strong> Stores photo originals, thumbnails, QR codes, and temporary selfies.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-purple-400 font-bold">•</span>
              <span><strong>DynamoDB:</strong> Stores 128-d facial vector embeddings and event metadata (No RDBMS used).</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-purple-400 font-bold">•</span>
              <span><strong>Amazon SQS:</strong> Decouples photo uploads from background facial recognition processing.</span>
            </li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Zap className="w-5 h-5" />
            <h3 className="font-bold text-white text-sm">Delivery & Monitoring</h3>
          </div>
          <ul className="text-xs text-slate-400 space-y-2">
            <li className="flex items-start space-x-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span><strong>CloudFront:</strong> Delivers photo thumbnails globally via pre-signed URL cookies.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span><strong>Amazon SNS:</strong> Sends email/SMS alerts when face search finds new photos.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-emerald-400 font-bold">•</span>
              <span><strong>Secrets Manager & CloudWatch:</strong> Encrypts APP_KEY and monitors server CPU/queues.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Real-time System Telemetry Stream */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center space-x-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span>Real-time AWS Service Activity Console</span>
        </h3>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-2 max-h-64 overflow-y-auto">
          {logs.map((log, index) => (
            <div key={index} className="flex items-center space-x-3 text-slate-300 border-b border-slate-900/60 pb-1">
              <span className="text-slate-500">{log.time}</span>
              <span className="text-indigo-400 font-bold">[{log.service}]</span>
              <span className="text-slate-200">{log.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}