import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Camera, CheckCircle2, AlertCircle } from 'lucide-react';

const MobileScanner = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [scanning, setScanning] = useState(false);
    const [initializing, setInitializing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
    const [debugInfo, setDebugInfo] = useState("");
    const [showDebug, setShowDebug] = useState(false);

    const query = new URLSearchParams(location.search);
    const type = query.get('type');
    const [error, setError] = useState(null);
    const qrCodeInstance = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (qrCodeInstance.current) {
                qrCodeInstance.current.stop().catch(err => console.error('Error stopping scanner:', err));
            }
        };
    }, []);

    // Effect to start scanner once DOM is ready
    useEffect(() => {
        let isMuted = false;

        async function startLiveScanner() {
            if (!scanning || !document.getElementById("reader")) return;

            setInitializing(true);
            setError(null);
            try {
                if (qrCodeInstance.current) {
                    try { await qrCodeInstance.current.stop(); } catch (e) {}
                }

                const instance = new Html5Qrcode("reader", { verbose: false });
                qrCodeInstance.current = instance;

                // Step 1: Enumeration (Keep it async but separate from start)
                if (availableCameras.length === 0) {
                    try {
                        const devices = await Html5Qrcode.getCameras();
                        if (devices && devices.length > 0) {
                            setAvailableCameras(devices);
                            setDebugInfo(devices.map((c, i) => `${i}: ${c.label || 'Unnamed'} [${c.id.substring(0,6)}]`).join('\n'));
                            
                            // Try to guess the best back camera index for switching purposes
                            const backIdx = devices.findIndex(d => 
                                d.label.toLowerCase().includes('back') || 
                                d.label.toLowerCase().includes('rear') ||
                                d.label.toLowerCase().includes('environment') ||
                                d.label.toLowerCase().includes('camera 1') ||
                                d.label.toLowerCase().includes('main')
                            );
                            
                            if (backIdx !== -1) {
                                setCurrentCameraIndex(backIdx);
                            } else if (devices.length > 1) {
                                // Default to last camera if no labels found (often the back one)
                                setCurrentCameraIndex(devices.length - 1);
                            }
                        }
                    } catch (e) {
                        console.warn("Enum failed", e);
                    }
                }

                // Step 2: Minimalist Config
                const config = {
                    fps: 10,
                    qrbox: (viewWidth, viewHeight) => {
                        const size = Math.min(viewWidth, viewHeight) * 0.7;
                        return { width: size, height: size };
                    }
                };

                // Step 3: THE FIX - Start with facingMode directly if it's the first attempt
                // Most browsers handle 'environment' correctly on their own.
                let target;
                if (currentCameraIndex === 0 && availableCameras.length === 0) {
                    target = { facingMode: "environment" };
                } else if (availableCameras.length > 0) {
                    target = availableCameras[currentCameraIndex % availableCameras.length].id;
                } else {
                    target = { facingMode: "environment" };
                }

                await instance.start(
                    target,
                    config,
                    async (decodedText) => {
                        if (!isMuted) {
                            isMuted = true;
                            await handleScanSuccess(decodedText);
                        }
                    },
                    () => {} // Suppress noise
                );

                // Step 4: Forced Rendering
                const v = document.querySelector("#reader video");
                if (v) {
                    v.style.cssText = "width:100% !important; height:100% !important; object-fit:cover !important; border-radius:1.5rem; display:block !important;";
                    v.setAttribute('autoplay', '');
                    v.setAttribute('muted', '');
                    v.setAttribute('playsinline', '');
                    // Some browsers need a slight delay before play()
                    setTimeout(() => v.play().catch(() => {}), 100);
                }

                setInitializing(false);
            } catch (err) {
                console.error("Scanner error:", err);
                setInitializing(false);
                setError(`Failed to open camera: ${err.message || err.toString()}. Please ensure you are on a secure connection and have granted permission.`);
            }
        }

        if (scanning) {
            const timer = setTimeout(startLiveScanner, 150);
            return () => {
                clearTimeout(timer);
                isMuted = true;
            };
        }
    }, [scanning, currentCameraIndex]);

    const switchCamera = async () => {
        if (availableCameras.length <= 1) return;
        const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
        setCurrentCameraIndex(nextIndex);
    };

    const startScanner = async () => {
        setError(null);
        setSuccess(false);

        // Security Check: Modern browsers require HTTPS for camera access
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
            setError("BROWSER SECURITY BLOCK: Camera access requires a secure connection (HTTPS).");
            return;
        }

        // Just trigger the scan state; the useEffect will handle the robust initialization
        setScanning(true);
    };

    const handleScanSuccess = async (decodedText) => {
        try {
            if (qrCodeInstance.current) {
                await qrCodeInstance.current.stop();
            }

            setScanning(false);
            await api.post(`/mobile/barcode/${sessionId}`, {
                barcode: decodedText
            });

            toast.success('Barcode scanned and synced!');

            if (type) {
                // Redirect back to analysis page
                setTimeout(() => {
                    navigate(`/${type}-purchase?sessionId=${sessionId}`);
                }, 1000);
            } else {
                setSuccess(true);
            }
        } catch (err) {
            toast.error('Failed to sync barcode with desktop');
            setError("Sync failed. Please try again.");
            setSuccess(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans text-slate-200">
            <div className="w-full max-w-md space-y-8 text-center">
                {/* Header */}
                <div className="space-y-2 animate-in fade-in slide-in-from-top duration-700">
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        ECO-PILOT <span className="text-green-500">SCANNER</span>
                    </h1>
                    <p className="text-slate-400 text-sm">Secure mobile pairing active</p>
                </div>

                {/* Main Content Area */}
                <div className="relative bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden min-h-[420px] flex flex-col items-center justify-center p-8 transition-all duration-500 group">
                    <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                    {!scanning && !success && !error && (
                        <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-green-500/5">
                                <Camera className="w-10 h-10 text-green-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Ready to Scan</h2>
                            <p className="text-slate-400 text-sm mb-8 max-w-[240px] leading-relaxed">
                                Point your camera at a product barcode or QR code
                            </p>
                            <button
                                onClick={startScanner}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-2xl transition-all active:scale-95 shadow-lg shadow-green-900/40 flex items-center justify-center gap-2"
                            >
                                Start Camera
                            </button>
                        </div>
                    )}

                    {scanning && (
                        <div className="w-full h-full flex flex-col items-center animate-in fade-in duration-500 relative">
                            {initializing && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center space-y-4 bg-slate-900/90 backdrop-blur-md rounded-2xl">
                                    <Loader2 className="w-12 h-12 text-green-500 animate-spin" />
                                    <p className="text-slate-400 font-medium animate-pulse">Mastering camera lens...</p>
                                </div>
                            )}

                            <div
                                id="reader"
                                className="w-full min-h-[300px] rounded-2xl overflow-hidden border-2 border-green-500/50 shadow-2xl shadow-green-500/10 bg-slate-900 transition-all duration-300"
                            ></div>

                            {/* Controls */}
                            <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
                                {!initializing && availableCameras.length > 1 && (
                                    <button
                                        onClick={switchCamera}
                                        className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-full border border-white/20 transition-all active:scale-90"
                                        title="Switch Camera"
                                    >
                                        <Camera className="w-5 h-5 text-white" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowDebug(!showDebug)}
                                    className="bg-white/5 hover:bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/10 transition-all text-[10px] text-white/50"
                                >
                                    DEBUG
                                </button>
                            </div>

                            {showDebug && (
                                <div className="absolute inset-x-4 top-20 z-40 bg-black/80 backdrop-blur-xl p-4 rounded-xl border border-white/10 text-left">
                                    <p className="text-[10px] font-mono text-green-500 mb-2 truncate">Cameras Found: {availableCameras.length}</p>
                                    <pre className="text-[8px] font-mono text-slate-300 overflow-x-auto">
                                        {debugInfo}
                                    </pre>
                                </div>
                            )}

                            {!initializing && (
                                <div className="mt-8 px-6 py-2 bg-green-500/10 rounded-full border border-green-500/20">
                                    <p className="text-green-500 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        SCANNING LIVE
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {success && (
                        <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-900/40 ring-8 ring-green-500/20">
                                <CheckCircle2 className="w-14 h-14 text-white" />
                            </div>
                            <h2 className="text-2xl font-black text-white mb-2 tracking-tight uppercase">SUCCESS!</h2>
                            <p className="text-slate-400 text-sm mb-6 max-w-[200px]">
                                Barcode data synced to your computer.
                            </p>
                            <div className="bg-slate-800/50 border border-slate-700 px-4 py-2 rounded-lg">
                                <p className="text-green-500 font-bold text-[10px] uppercase tracking-widest">
                                    Safe to close this tab now
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-red-500/5">
                                <AlertCircle className="w-10 h-10 text-red-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Scanner Error</h2>
                            <p className="text-slate-400 text-sm mb-8 px-4 leading-relaxed max-w-[300px]">
                                {error}
                            </p>
                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    onClick={startScanner}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-8 rounded-2xl transition-all active:scale-95"
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={() => window.location.href = `/mobile-upload/${sessionId}`}
                                    className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold py-4 px-8 rounded-2xl transition-all active:scale-95"
                                >
                                    Switch to Photo Mode
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="flex items-center justify-center gap-4 py-4 animate-in fade-in duration-1000 delay-500">
                    <div className="h-px w-8 bg-slate-800"></div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] italic">
                        {window.isSecureContext ? "Secure HTTPS Connection" : "Local Network Connection"}
                    </p>
                    <div className="h-px w-8 bg-slate-800"></div>
                </div>
            </div>
        </div>
    );
};

export default MobileScanner;
