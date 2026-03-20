import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, UserCheck, UserPlus, ClipboardList, Settings, Loader2, AlertCircle, CameraOff, Scan, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './services/supabase';

// Components
import FaceCanvas from './components/FaceCanvas';

const MODEL_URL = '/models';

const App = () => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [captureMode, setCaptureMode] = useState('attendance'); // 'attendance' or 'registration'
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Iniciando...');
  const [activePlayer, setActivePlayer] = useState(null);
  const [logs, setLogs] = useState([]);
  const [cameraError, setCameraError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const defaultSettings = {
      audioEnabled: true,
      sensitivity: 0.55,
      mirrorCamera: true,
      autoAttendance: true,
      facingMode: 'user', 
      quality: 'high'
    };
    const saved = localStorage.getItem('diba-face-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('diba-face-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setStatus('Cargando modelos de IA...');
        console.log('Loading models from:', MODEL_URL);
        
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

        setModelsLoaded(true);
        setStatus('Sistema Listo');
      } catch (err) {
        console.error('CRITICAL ERROR loading models:', err);
        setStatus(`Error: ${err.message || 'No se pudieron cargar los modelos'}`);
      }
    };
    loadModels();
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('identificacion')
      .select('numero, nombre, apellidos, categoria, face_token, foto_url');
    if (data) setPlayers(data);
    setLoading(false);
  };

  const handleAttendance = async (player) => {
    if (activePlayer?.numero === player.numero) return;
    setActivePlayer(player);
    
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('asistencias')
      .insert([{
        identificacion_numero: player.numero,
        fecha: today,
        asistio: true,
        fuente: 'reconocimiento_facial'
      }]);

    if (!error) {
      if (settings.audioEnabled) {
        new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3').play().catch(() => {});
      }
      setLogs(prev => [{
        time: new Date().toLocaleTimeString(),
        player: `${player.nombre} ${player.apellidos}`,
        status: 'ASISTENCIA MARCADA'
      }, ...prev].slice(0, 10));
      
      setTimeout(() => setActivePlayer(null), 3000);
    }
  };

  const handleRegisterFace = async (player, descriptor) => {
    const token = JSON.stringify(Array.from(descriptor));
    const { error } = await supabase
      .from('identificacion')
      .update({ face_token: token })
      .eq('numero', player.numero);

    if (!error) {
      alert(`Rostro registrado para ${player.nombre}`);
      fetchPlayers();
    }
  };

  const handleCameraError = (err) => {
    console.error('Camera Error Callback:', err);
    setCameraError(err.name === 'NotFoundError' ? 'No se detectó ninguna cámara. Por favor conecta una o revisa los permisos.' : `Error de cámara: ${err.message}`);
    setStatus('Error de hardware');
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedPlayer) return;

    setIsProcessingImage(true);
    try {
      const img = await faceapi.bufferToImage(file);
      const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        handleRegisterFace(selectedPlayer, detection.descriptor);
      } else {
        alert('No se detectó ningún rostro en la imagen. Intenta con otra foto más clara.');
      }
    } catch (err) {
      console.error('Error processing image:', err);
      alert('Error al procesar la imagen.');
    } finally {
      setIsProcessingImage(false);
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (captureMode === 'registration' && selectedPlayer) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (captureMode === 'registration' && selectedPlayer) {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleImageUpload({ target: { files: [files[0]] } });
      }
    }
  };

  const filteredPlayers = players.filter(p => 
    (p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.numero.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-yellow-500/30 overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-yellow-600/5 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <nav className="border-b border-white/5 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Camera className="w-7 h-7 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">
                DIBA <span className="text-yellow-500">FBC</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-500">Face Recognition ID v2.0</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex gap-1 bg-slate-950/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
              <button 
                onClick={() => { setCaptureMode('attendance'); setCameraError(null); }}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${captureMode === 'attendance' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <Scan className="w-4 h-4" /> Asistencia
              </button>
              <button 
                onClick={() => { setCaptureMode('registration'); setCameraError(null); }}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${captureMode === 'registration' ? 'bg-yellow-500 text-black shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}
              >
                <UserPlus className="w-4 h-4" /> Registro
              </button>
            </div>
            
            <button 
              onClick={() => setShowSettings(true)}
              className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group relative overflow-hidden"
            >
              <Settings className="w-5 h-5 text-slate-300 group-hover:rotate-90 transition-transform duration-500" />
              <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
        {/* Left Column: Camera Feed & Player List */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Main Viewport */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="relative aspect-video bg-black rounded-[40px] border border-white/10 overflow-hidden shadow-2xl group ring-1 ring-white/5 transition-all"
          >
            {isDragging ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-yellow-500/20 backdrop-blur-md border-4 border-dashed border-yellow-500 rounded-[40px] animate-pulse">
                <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center shadow-2xl mb-6">
                  <UserPlus className="w-12 h-12 text-black" />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-widest text-white shadow-sm">Suelta para Registrar</h3>
                <p className="text-white/80 font-bold mt-2">Vincular foto a {selectedPlayer?.nombre}</p>
              </div>
            ) : null}
            {isProcessingImage ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-slate-950 z-20">
                <Loader2 className="w-12 h-12 animate-spin text-yellow-500" />
                <p className="font-black uppercase tracking-widest text-sm">Analizando Imagen...</p>
              </div>
            ) : null}
            {cameraError ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-12 bg-slate-900/50">
                <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
                  <CameraOff className="w-12 h-12 text-red-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2 text-white">Hardware no detectado</h3>
                  <p className="text-slate-400 max-w-sm line-clamp-3">{cameraError}</p>
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-8 py-3 bg-yellow-500 text-black font-bold rounded-2xl hover:bg-yellow-400 transition-all flex items-center gap-2 shadow-lg shadow-yellow-500/20"
                >
                  <RefreshCw className="w-5 h-5" /> Reintentar conexión
                </button>
              </div>
            ) : !modelsLoaded ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-slate-950">
                <div className="relative">
                  <Loader2 className="w-16 h-16 animate-spin text-yellow-500" />
                  <div className="absolute inset-0 bg-yellow-500/20 blur-2xl animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold tracking-tight mb-1">{status}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Iniciando Redes Neuronales</p>
                </div>
              </div>
            ) : (
              <FaceCanvas 
                mode={captureMode}
                players={players}
                onMatch={handleAttendance}
                onRegister={handleRegisterFace}
                activePlayer={activePlayer}
                selectedPlayer={selectedPlayer}
                onCameraError={handleCameraError}
                settings={{
                  ...settings,
                  mirrorCamera: settings.facingMode === 'user' ? settings.mirrorCamera : false
                }}
              />
            )}
          </div>

          {/* Player Search Section */}
          <div className="bg-slate-900/30 border border-white/5 backdrop-blur-md rounded-[32px] p-8 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <UserCheck className="w-6 h-6 text-yellow-500" /> 
                  {captureMode === 'registration' ? 'Gestión de Jugadores' : 'Búsqueda Manual'}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {captureMode === 'registration' ? (
                    selectedPlayer ? `Registrando a ${selectedPlayer.nombre}` : 'Selecciona un jugador'
                  ) : 'Busca un jugador para marcar asistencia manual'}
                </p>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                {captureMode === 'registration' && selectedPlayer && (
                  <>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 md:flex-none px-6 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4 text-yellow-500" /> Subir Foto
                    </button>
                  </>
                )}
                <div className="relative flex-1 md:w-64">
                  <input 
                    type="text" 
                    placeholder="Nombre o ID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-yellow-500/50 transition-all placeholder:text-slate-600 outline-none"
                  />
                  <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                </div>
              </div>
            </div>

            <div className="h-[450px] overflow-y-auto pr-3 custom-scrollbar flex flex-col gap-10">
              <AnimatePresence>
                {filteredPlayers.length > 0 ? (
                  Object.entries(
                    filteredPlayers.reduce((groups, player) => {
                      const cat = player.categoria || 'GENERAL';
                      if (!groups[cat]) groups[cat] = [];
                      groups[cat].push(player);
                      return groups;
                    }, {})
                  ).sort((a, b) => a[0].localeCompare(b[0])).map(([category, categoryPlayers]) => (
                    <div key={category} className="space-y-4">
                      <div className="flex items-center gap-4 px-2">
                        <div className="h-0.5 flex-1 bg-white/5" />
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-yellow-500 bg-yellow-500/10 px-4 py-1.5 rounded-full border border-yellow-500/20">
                          Categoría {category}
                        </h4>
                        <div className="h-0.5 flex-1 bg-white/5" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categoryPlayers.map((player) => (
                          <motion.div 
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={player.numero}
                            className={`group p-6 rounded-[32px] border transition-all cursor-pointer relative overflow-hidden min-h-[140px] flex items-center ${
                              selectedPlayer?.numero === player.numero 
                                ? 'bg-yellow-600 border-yellow-400 shadow-2xl shadow-yellow-500/40' 
                                : 'bg-slate-900 border-white/10 hover:border-yellow-500/50 hover:bg-slate-800'
                            }`}
                            onClick={() => captureMode === 'attendance' ? handleAttendance(player) : setSelectedPlayer(player)}
                          >
                            <div className="flex items-center gap-6 relative z-10 w-full">
                              <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center overflow-hidden shadow-2xl border-2 flex-shrink-0 ${
                                player.foto_url 
                                  ? 'border-white/20' 
                                  : selectedPlayer?.numero === player.numero ? 'bg-white text-yellow-600 border-white font-black text-3xl' : 
                                player.face_token ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 font-black text-3xl' : 'bg-slate-800 text-slate-500 border-white/5 font-black text-3xl'
                              }`}>
                                {player.foto_url ? (
                                  <img src={player.foto_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (player.nombre || '?').charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[11px] font-black uppercase tracking-[0.3em] mb-2 ${selectedPlayer?.numero === player.numero ? 'text-yellow-100' : 'text-yellow-500'}`}>
                                  {player.categoria || 'GENERAL'}
                                </p>
                                <h4 className="font-black text-xl leading-tight mb-1 text-white">
                                  {player.nombre || 'SIN NOMBRE'}
                                </h4>
                                <p className={`font-bold text-sm opacity-80 ${selectedPlayer?.numero === player.numero ? 'text-yellow-100' : 'text-slate-300'}`}>
                                  {player.apellidos || ''}
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                    selectedPlayer?.numero === player.numero ? 'bg-yellow-400/30 text-white' : 'bg-black/40 text-slate-400'
                                  }`}>
                                    ID: {player.numero}
                                  </span>
                                </div>
                              </div>
                              {player.face_token && (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${selectedPlayer?.numero === player.numero ? 'bg-white text-yellow-600' : 'bg-yellow-500 text-black shadow-yellow-500/30'}`}>
                                  <UserCheck className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-yellow-500/5 blur-2xl group-hover:bg-yellow-500/10 transition-all rounded-full" />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center text-slate-600 py-20 opacity-50">
                    <AlertCircle className="w-12 h-12 mb-4" />
                    <p className="font-black uppercase tracking-widest">Sin resultados</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Column: Activity & Stats */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* Recent Records */}
          <div className="bg-slate-900/30 border border-white/5 backdrop-blur-md rounded-[40px] overflow-hidden flex flex-col h-[520px] shadow-2xl">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h3 className="font-bold text-lg flex items-center gap-3">
                <ClipboardList className="w-6 h-6 text-yellow-500" /> Registro en Vivo
              </h3>
              <div className="px-3 py-1 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                <span className="text-[10px] font-black uppercase text-yellow-400 tracking-widest">{logs.length} Hoy</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <AnimatePresence initial={false}>
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-40">
                    <Scan className="w-12 h-12" />
                    <p className="text-sm font-black uppercase tracking-widest">Esperando...</p>
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 flex items-start gap-4 hover:bg-white/[0.05] transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 flex-shrink-0">
                        <UserCheck className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate">{log.player}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-yellow-500 uppercase">Éxito</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-[10px] font-bold text-slate-500">{log.time}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Stats Panel */}
          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-br from-yellow-600 to-orange-700 rounded-[32px] p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute -right-6 -bottom-6 w-40 h-40 bg-white/10 rounded-full blur-[60px]" />
              <div className="relative z-10 text-black">
                <h4 className="font-black text-[10px] uppercase tracking-widest mb-2 opacity-70">Total Jugadores</h4>
                <p className="text-5xl font-black tracking-tighter">{players.length}</p>
                <div className="mt-6 pt-6 border-t border-black/10 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Base de datos sincronizada</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 shadow-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Con Rostro</p>
                <div className="flex items-end gap-2 text-yellow-500">
                  <p className="text-3xl font-black leading-none">{players.filter(p => p.face_token).length}</p>
                  <UserPlus className="w-4 h-4 mb-0.5 opacity-50" />
                </div>
              </div>
              <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 shadow-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Pendientes</p>
                <div className="flex items-end gap-2 text-white">
                  <p className="text-3xl font-black leading-none">{players.filter(p => !p.face_token).length}</p>
                  <AlertCircle className="w-4 h-4 mb-0.5 opacity-30" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-[40px] shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/20">
                    <Settings className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Configuración</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ajustes de Sistema IA</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <RefreshCw className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {/* AI Sensitivity */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-black uppercase tracking-widest text-slate-400">Sensibilidad IA</label>
                    <span className="text-yellow-500 font-black px-3 py-1 bg-yellow-500/10 rounded-lg border border-yellow-500/20 text-xs">
                      {Math.round(settings.sensitivity * 100)}%
                    </span>
                  </div>
                  <input 
                    type="range" min="0.3" max="0.8" step="0.05"
                    value={settings.sensitivity}
                    onChange={(e) => setSettings({...settings, sensitivity: parseFloat(e.target.value)})}
                    className="w-full accent-yellow-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed">
                    Valores bajos detectan más rápido pero pueden confundir rostros. Valores altos son más precisos pero requieren mejor iluminación.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Toggles */}
                  {[
                    { key: 'audioEnabled', label: 'Audio Feedback', icon: ClipboardList },
                    { key: 'mirrorCamera', label: 'Modo Espejo', icon: Camera },
                    { key: 'autoAttendance', label: 'Auto-Asistencia', icon: UserCheck },
                    { 
                      key: 'facingMode', 
                      label: settings.facingMode === 'user' ? 'Cámara Frontal' : 'Cámara Trasera', 
                      icon: RefreshCw,
                      onClick: () => setSettings({...settings, facingMode: settings.facingMode === 'user' ? 'environment' : 'user'})
                    },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={item.onClick || (() => setSettings({...settings, [item.key]: !settings[item.key]}))}
                      className={`p-4 rounded-3xl border transition-all flex items-center justify-between group ${
                        (item.key === 'facingMode' ? true : settings[item.key]) ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-5 h-5 ${(item.key === 'facingMode' ? true : settings[item.key]) ? 'text-yellow-500' : 'text-slate-500'} ${item.key === 'facingMode' ? 'group-hover:rotate-180 transition-transform duration-500' : ''}`} />
                        <span className={`text-xs font-black uppercase tracking-widest ${(item.key === 'facingMode' ? true : settings[item.key]) ? 'text-white' : 'text-slate-400'}`}>
                          {item.label}
                        </span>
                      </div>
                      {item.key !== 'facingMode' ? (
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${settings[item.key] ? 'bg-yellow-500' : 'bg-slate-800'}`}>
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings[item.key] ? 'left-6' : 'left-1'}`} />
                        </div>
                      ) : (
                        <RefreshCw className="w-4 h-4 text-yellow-500 opacity-50 transition-transform group-active:rotate-180" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-8 bg-black/40 border-t border-white/5 flex justify-end gap-4">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-8 py-3 bg-yellow-500 text-black font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-yellow-500/20 hover:scale-105 transition-transform"
                >
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md border-t border-white/5 px-8 py-3 z-50 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          <div className="flex items-center gap-6">
            <span className="text-yellow-500">Powered by DIBABOT 2.0</span>
            <span className="w-1 h-1 rounded-full bg-slate-800" />
            <span>Club DIBA FBC Official</span>
          </div>
          <div className="flex items-center gap-6">
            <span className={modelsLoaded ? 'text-green-500' : 'text-red-500 flex items-center gap-2'}>
              {modelsLoaded ? 'SISTEMA IA ONLINE' : 'SISTEMA IA OFFLINE'}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-800" />
            <span>v2.4.1</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
