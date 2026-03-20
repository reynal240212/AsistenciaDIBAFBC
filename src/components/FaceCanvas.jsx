import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, Scan, RefreshCw } from 'lucide-react';

const FaceCanvas = ({ mode, players, onMatch, onRegister, activePlayer, selectedPlayer, onCameraError, settings }) => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [recognizing, setRecognizing] = useState(false);
  const [detectedName, setDetectedName] = useState(null);
  const [currentDescriptor, setCurrentDescriptor] = useState(null);
  const [labeledDescriptors, setLabeledDescriptors] = useState([]);

  useEffect(() => {
    startVideo();
    loadLabeledImages();
  }, [players]);

  const startVideo = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Browser does not support camera access');
      return;
    }

    navigator.mediaDevices.getUserMedia({ 
      video: true 
    })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error('Camera Error:', err);
        if (onCameraError) {
          onCameraError(err);
        }
      });
  };

  const loadLabeledImages = () => {
    const descriptors = players
      .filter(p => p.face_token)
      .map(p => {
        try {
          const tokenData = JSON.parse(p.face_token);
          const float32Array = new Float32Array(tokenData);
          return new faceapi.LabeledFaceDescriptors(p.numero, [float32Array]);
        } catch (e) {
          console.error('Invalid face token for', p.nombre);
          return null;
        }
      })
      .filter(d => d !== null);
    
    setLabeledDescriptors(descriptors);
  };

  const handleVideoPlay = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const displaySize = { width: videoRef.current.width, height: videoRef.current.height };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    setInterval(async () => {
      const detections = await faceapi.detectAllFaces(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptors();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, displaySize.width, displaySize.height);

      if (labeledDescriptors.length > 0) {
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, settings.sensitivity);
        const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

        results.forEach((result, i) => {
          const box = resizedDetections[i].detection.box;
          const label = result.toString();
          
          // Draw a custom premium box
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(box.x, box.y, box.width, box.height, 10);
          ctx.stroke();

          if (result.label !== 'unknown') {
            const player = players.find(p => p.numero === result.label);
            if (player) {
              setDetectedName(`${player.nombre} ${player.apellidos}`);
              if (mode === 'attendance') {
                onMatch(player);
              }
            }
          } else if (mode === 'registration' && selectedPlayer) {
            setCurrentDescriptor(resizedDetections[0]?.descriptor || null);
            setDetectedName('Rostro listo para registro');
          } else {
            setDetectedName('Desconocido');
          }
        });
      } else {
        // Just draw detection boxes
        resizedDetections.forEach(detection => {
          if (mode === 'registration' && selectedPlayer) {
            setCurrentDescriptor(detection.descriptor);
            setDetectedName('Rostro detectado');
          }
          const box = detection.detection.box;
          ctx.strokeStyle = '#ffffff50';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.setLineDash([]);
        });
      }
    }, 1000);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        autoPlay
        muted
        onPlay={handleVideoPlay}
        width="1280"
        height="720"
        className={`object-cover w-full h-full grayscale brightness-75 ${settings.mirrorCamera ? 'scale-x-[-1]' : ''}`}
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 pointer-events-none ${settings.mirrorCamera ? 'scale-x-[-1]' : ''}`}
        width="1280"
        height="720"
      />

      {/* Recognition Overlay */}
      <AnimatePresence>
        {activePlayer && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-500/20 backdrop-blur-sm z-10"
          >
            <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[40px] border border-white/20 shadow-2xl flex flex-col items-center gap-6">
              <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                <UserCheck className="w-12 h-12 text-white" />
              </div>
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-1">{activePlayer.nombre}</h2>
                <p className="text-yellow-600 font-black uppercase tracking-[0.2em] text-sm">Asistencia Registrada</p>
              </div>
              <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.5 }}
                   className="h-full bg-yellow-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanning status */}
      {!activePlayer && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-lg">
            <div className="relative flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />
              <div className="absolute inset-0 bg-yellow-500/20 blur-lg animate-pulse" />
            </div>
            <span className="text-sm font-black tracking-widest text-yellow-100 italic uppercase">
              {detectedName ? `Detectado: ${detectedName}` : 'Analizando rasgos faciales...'}
            </span>
          </div>
        </div>
      )}

      {/* Laser Scan Line */}
      {!activePlayer && (
        <motion.div 
          animate={{ top: ["10%", "90%", "10%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent shadow-[0_0_20px_#facc15] z-[5] opacity-50 pointer-events-none"
        />
      )}

      {/* Registration UI */}
      {mode === 'registration' && selectedPlayer && currentDescriptor && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20">
          <motion.button 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onRegister(selectedPlayer, currentDescriptor)}
            className="group flex flex-col items-center gap-3"
          >
            <div className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-4 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-yellow-500/40 border-2 border-white/20 transition-all flex items-center gap-3">
              <Scan className="w-6 h-6 animate-pulse" />
              Registrar rostro para {selectedPlayer.nombre}
            </div>
            <p className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em] bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">
              Mantén el rostro centrado y quieto
            </p>
          </motion.button>
        </div>
      )}

      {/* Modern Scanning Corners */}
      <div className="absolute inset-10 border border-white/5 pointer-events-none leading-none">
        <div className={`absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 rounded-tl-2xl transition-colors ${mode === 'registration' && selectedPlayer ? 'border-orange-500 shadow-[-5px_-5px_15px_rgba(249,115,22,0.3)]' : 'border-yellow-500 shadow-[-5px_-5px_15px_rgba(234,179,8,0.3)]'}`} />
        <div className={`absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 rounded-tr-2xl transition-colors ${mode === 'registration' && selectedPlayer ? 'border-orange-500 shadow-[5px_-5px_15px_rgba(249,115,22,0.3)]' : 'border-yellow-500 shadow-[5px_-5px_15px_rgba(234,179,8,0.3)]'}`} />
        <div className={`absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 rounded-bl-2xl transition-colors ${mode === 'registration' && selectedPlayer ? 'border-orange-500 shadow-[-5px_5px_15px_rgba(249,115,22,0.3)]' : 'border-yellow-500 shadow-[-5px_5px_15px_rgba(234,179,8,0.3)]'}`} />
        <div className={`absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 rounded-br-2xl transition-colors ${mode === 'registration' && selectedPlayer ? 'border-orange-500 shadow-[5px_5px_15px_rgba(249,115,22,0.3)]' : 'border-yellow-500 shadow-[5px_5px_15px_rgba(234,179,8,0.3)]'}`} />
      </div>
    </div>
  );
};

export default FaceCanvas;
