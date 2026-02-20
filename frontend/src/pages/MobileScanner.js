import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Camera, CheckCircle2, AlertCircle } from 'lucide-react';

const getBackendUrl = () => {
    const envUrl = process.env.REACT_APP_BACKEND_URL;
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return `http://${window.location.hostname}:8000`;
    }
    return envUrl || 'http://localhost:8000';
};
const BACKEND_URL = getBackendUrl();

const MobileScanner = () => {
    const { sessionId } = useParams();
    const [scanning, setScanning] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    const scannerRef = useRef(null);
    const qrCodeInstance = useRef(null);

    useEffect(() => {
        return () => {
            if (qrCodeInstance.current) {
                qrCodeInstance.current.stop().catch(err => console.error(err));
            }
        };
    }, []);

    const startScanner = async () => {
        setScanning(true);
        setError(null);

        // Security Check: Modern browsers require HTTPS for camera access
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
            setError("BROWSER SECURITY BLOCK: Camera access requires a secure connection (HTTPS). Since you are on a local network (http), the live scanner is blocked by your browser.");
            setScanning(false);
            return;
        }

        try {
            const instance = new Html5Qrcode("reader");
            qrCodeInstance.current = instance;

            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            await instance.start(
                { facingMode: "environment" },
                config,
                async (decodedText) => {
                    // Success!
                    await handleScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // console.log(errorMessage);
                }
            );
        } catch (err) {
            setError("Could not access camera. Please ensure you've given permission and aren't using another app that's using the camera.");
            setScanning(false);
        }
    };

    const handleScanSuccess = async (decodedText) => {
        try {
            if (qrCodeInstance.current) {
                await qrCodeInstance.current.stop();
            }

            setScanning(false);
            setSuccess(true);

            await axios.post(`${BACKEND_URL}/api/mobile/barcode/${sessionId}`, {
                barcode: decodedText
            });

            toast.success('Barcode scanned and synced!');
        } catch (err) {
            toast.error('Failed to sync barcode with desktop');
            setError("Sync failed. Please try again.");
            setSuccess(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md space-y-8 text-center">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        ECO-PILOT <span className="text-green-500">SCANNER</span>
                    </h1>
                    <p className="text-slate-400 text-sm">Secure mobile pairing active</p>
                </div>

                {/* Main Content Area */}
                <div className="relative bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-8">
                    {!scanning && !success && !error && (
                        <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                                <Camera className="w-10 h-10 text-green-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Ready to Scan</h2>
                            <p className="text-slate-400 text-sm mb-8 max-w-[240px]">
                                Point your camera at a product barcode or QR code
                            </p>
                            <button
                                onClick={startScanner}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-2xl transition-all active:scale-95 shadow-lg shadow-green-900/20"
                            >
                                Start Camera
                            </button>
                        </div>
                    )}

                    {scanning && (
                        <div className="w-full h-full flex flex-col items-center">
                            <div id="reader" className="w-full rounded-2xl overflow-hidden border-2 border-green-500/50"></div>
                            <p className="mt-6 text-green-500 text-sm font-bold flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                SCANNING LIVE...
                            </p>
                        </div>
                    )}

                    {success && (
                        <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-900/40">
                                <CheckCircle2 className="w-12 h-12 text-white" />
                            </div>
                            <h2 className="text-2xl font-black text-white mb-2">SCAN COMPLETE</h2>
                            <p className="text-slate-400 text-sm mb-4">
                                Data sent to your computer successfully.
                            </p>
                            <p className="text-green-500 font-bold text-xs uppercase tracking-widest">
                                You can close this tab now
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                                <AlertCircle className="w-10 h-10 text-red-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Scanner Error</h2>
                            <p className="text-slate-400 text-sm mb-8 px-4">
                                {error}
                            </p>
                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    onClick={startScanner}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-8 rounded-2xl transition-all"
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={() => window.location.href = `/mobile-upload/${sessionId}`}
                                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg shadow-green-900/20"
                                >
                                    Switch to Photo Mode
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="flex items-center justify-center gap-4 py-4">
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
