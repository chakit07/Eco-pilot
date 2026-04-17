import { useRef, useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';

const MobileCamera = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const fileInputRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const query = new URLSearchParams(location.search);
    const type = query.get('type');

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.post(`/mobile/upload/${sessionId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            toast.success('Photo uploaded successfully!');
            
            if (type) {
                // Redirect back to analysis page
                setTimeout(() => {
                    navigate(`/${type}-purchase?sessionId=${sessionId}`);
                }, 1000);
            } else {
                setSuccess(true);
            }
        } catch (error) {
            toast.error('Failed to upload photo. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        // Reset success state after a delay to allow another upload
        setTimeout(() => setSuccess(false), 3000);

        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-green-50 p-4 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                            className="w-8 h-8 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-green-800 mb-2">Success!</h2>
                    <p className="text-green-600">
                        Your photo has been uploaded. You can continue on your desktop.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm text-center">
                <h1 className="text-white text-2xl font-bold mb-8">Take a Photo</h1>

                <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                />

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 active:scale-95 transition-transform"
                >
                    {loading ? (
                        <RefreshCw className="w-8 h-8 text-gray-800 animate-spin" />
                    ) : (
                        <Camera className="w-10 h-10 text-gray-800" />
                    )}
                </button>

                <p className="text-gray-400">
                    Tap the button to take a photo or select from gallery.
                </p>
            </div>
        </div>
    );
};

export default MobileCamera;
