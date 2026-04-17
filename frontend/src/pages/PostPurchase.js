import { ArrowLeft, Leaf, Lightbulb, Search, Smartphone, Camera, Upload, Loader2, TrendingUp, ChevronDown, ChevronUp, Info, Factory, Truck, Zap, Recycle, TreeDeciduous, Droplets, Flame, CheckCircle, Database, Smartphone as Phone } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../App';

const PostPurchase = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [formData, setFormData] = useState({
    product_name: '',
    category: 'electronics',
    brand: '',
    product_details: '',
    barcode: ''
  });
  const [method, setMethod] = useState('manual'); // 'manual', 'photo', 'mobile'
  const [mobileSessionId, setMobileSessionId] = useState(null);
  const [mobileStatus, setMobileStatus] = useState('waiting');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showScientific, setShowScientific] = useState(false);
  const [isMobile] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Check for sessionId in URL (after mobile redirect)
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const sessionId = query.get('sessionId');
    if (sessionId && !mobileSessionId) {
      setMobileSessionId(sessionId);
      setMethod('mobile');
      setMobileStatus('waiting');
      // Trigger check immediately
      api.get(`/mobile/status/${sessionId}`).then(response => {
        if (response.data.status === 'completed') {
          checkMobileStatus(sessionId);
        }
      });
    }
  }, [location, mobileSessionId]);

  // Mobile session logic - unified
  useEffect(() => {
    const sessionNeeded = (method === 'mobile') || (method === 'photo' && !isMobile);
    if (sessionNeeded && !mobileSessionId) {
      initializeMobileSession();
    }
  }, [method, isMobile]);

  useEffect(() => {
    let interval;
    const pollingNeeded = !isMobile && mobileSessionId && mobileStatus === 'waiting' && (method === 'mobile' || method === 'photo');
    if (pollingNeeded) {
      interval = setInterval(checkMobileStatus, 1000);
    }
    return () => clearInterval(interval);
  }, [mobileSessionId, mobileStatus, method, isMobile]);

  const initializeMobileSession = async () => {
    try {
      const response = await api.post('/mobile/init');
      setMobileSessionId(response.data.session_id);
      setMobileStatus('waiting');
    } catch (error) {
      toast.error('Failed to start mobile session');
    }
  };

  const checkMobileStatus = async (targetId) => {
    if (!targetId) return;
    try {
      const response = await api.get(`/mobile/status/${targetId}`);
      
      // Delta detection: Only process if there is a new update timestamp
      if (response.data.last_update && response.data.last_update !== lastSyncTime) {
        setLastSyncTime(response.data.last_update);
        
        // CASE 1: New Barcode
        if (response.data.barcode_data) {
          const barcode = response.data.barcode_data;
          setFormData(prev => ({ ...prev, barcode }));
          setMethod('manual');
          
          toast.promise(
            api.get(`/analysis/barcode/${barcode}`),
            {
              loading: 'Resolving barcode details...',
              success: (res) => {
                setFormData(prev => ({
                  ...prev,
                  product_name: res.data.product_name,
                  category: res.data.category,
                  product_details: res.data.details,
                  image_url: res.data.image_url
                }));
                return `Detected: ${res.data.product_name}`;
              },
              error: 'Barcode received, but product info not found.'
            }
          );
        }

        // CASE 2: New Photo
        if (response.data.image_data) {
          setMobileStatus('completed');
          setMethod('photo'); // Switch to photo mode to show the preview
          setPreview(`data:image/jpeg;base64,${response.data.image_data}`);
          
          toast.promise(
            api.post('/analysis/photo-base64', { image_data: response.data.image_data }),
            {
              loading: 'Analyzing mobile photo...',
              success: (res) => {
                setFormData(prev => ({
                  ...prev,
                  product_name: res.data.product_name,
                  category: res.data.category,
                  product_details: res.data.details || res.data.product_details,
                  carbon_footprint: res.data.carbon_footprint,
                  eco_score: res.data.eco_score,
                  impact_details: res.data.impact_details,
                  calculation: res.data.calculation,
                  carbon_saved: res.data.carbon_saved
                }));
                setAnalysis(res.data);
                return 'Photo analysis complete!';
              },
              error: 'Failed to analyze mobile photo.'
            }
          );
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoAnalysis = async () => {
    if (!selectedFile) {
      toast.error('Please select a photo first');
      return;
    }

    setAnalyzing(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', selectedFile);

      const response = await api.post('/analysis/photo', formDataObj);

      setFormData({
        product_name: response.data.product_name,
        category: response.data.category,
        product_details: response.data.details,
        barcode: ''
      });

      setAnalysis({
        product_name: response.data.product_name,
        carbon_footprint: response.data.carbon_footprint,
        eco_score: response.data.eco_score,
        alternatives: response.data.alternatives,
        impact: response.data.impact,
        impact_details: response.data.impact_details,
        breakdown: response.data.breakdown,
        calculation: response.data.calculation
      });

      toast.success('Photo analyzed successfully!');
    } catch (error) {
      if (error.response?.status === 429) {
        toast.error('API Rate Limit Exceeded. Please wait 60 seconds before trying again.', {
          description: 'The AI service is temporarily busy.',
          duration: 5000
        });
      } else {
        toast.error(error.response?.data?.detail || 'Failed to analyze photo');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/analysis/carbon', {
        product_name: formData.product_name,
        category: formData.category,
        product_details: formData.product_details,
        image_url: formData.image_url || null
      });
      setAnalysis(response.data);
      toast.success('Analysis complete!');
    } catch (error) {
      if (error.response?.status === 429) {
        toast.error('API Rate Limit Exceeded. Please wait 60 seconds.', {
          description: 'Try again in a minute.',
          duration: 5000
        });
      } else {
        toast.error('Failed to analyze product');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLog = async () => {
    setLoading(true);
    try {
      await api.post('/products/log', {
        log_type: 'post-purchase',
        category: formData.category,
        product_name: formData.product_name,
        product_details: formData.product_details,
        barcode: formData.barcode,
        ...analysis
      });
      toast.success('Product logged successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to save log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" data-testid="post-purchase-page">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-4">
          <button
            data-testid="back-btn"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium text-sm sm:text-base transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-12">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-3 sm:mb-4">
            <Camera className="w-10 h-10 sm:w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-blue-800 mb-2 sm:mb-3 leading-tight">Post-Purchase Log</h1>
          <p className="text-base sm:text-lg text-blue-600 px-4">
            Log items you've already purchased and track your carbon footprint.
          </p>
        </div>

        {/* Method Selection */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-green-800 mb-4">Choose Logging Method</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setMethod('manual')}
              className={`p-4 rounded-xl border-2 transition-all active:scale-95 ${method === 'manual'
                ? 'border-green-600 bg-green-50'
                : 'border-green-200 hover:border-green-400'
                }`}
            >
              <p className="font-bold text-green-800">Manual Entry</p>
              <p className="text-xs text-green-600 mt-1 uppercase tracking-tight font-black">Type details</p>
            </button>
            <button
              onClick={() => setMethod('photo')}
              className={`p-4 rounded-xl border-2 transition-all active:scale-95 ${method === 'photo'
                ? 'border-blue-600 bg-blue-50'
                : 'border-green-200 hover:border-green-400'
                }`}
            >
              <p className="font-bold text-green-800">Photo Upload</p>
              <p className="text-xs text-green-600 mt-1 uppercase tracking-tight font-black">Use local file</p>
            </button>

            <button
              onClick={() => {
                setMethod('mobile');
                if (!isMobile) initializeMobileSession();
              }}
              className={`p-4 rounded-xl border-2 transition-all text-center active:scale-95 ${method === 'mobile'
                ? 'border-blue-600 bg-blue-50'
                : 'border-green-200 hover:border-green-400'
                }`}
            >
              <Smartphone className="w-5 h-5 mx-auto mb-1 text-green-600" />
              <p className="font-bold text-green-800">Use Phone Camera</p>
              <p className="text-xs text-green-600 mt-1 uppercase tracking-tight font-black">{isMobile ? 'Live Scanner' : 'Scan via Mobile'}</p>
            </button>
          </div>
        </div>

        {/* Mobile Scanner / QR Option */}
        {method === 'mobile' && (
          <div className="fade-in space-y-6">
            {!isMobile ? (
              <div className="card mb-6 text-center animate-in zoom-in duration-300">
                <h3 className="text-lg font-semibold text-green-800 mb-4 tracking-tight">Scan with your smartphone</h3>

                {window.location.hostname === 'localhost' && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 text-left animate-in slide-in-from-top duration-300">
                    <p className="text-amber-800 text-xs font-bold uppercase mb-1">⚠️ Setup Required for Mobile</p>
                    <p className="text-amber-700 text-[11px] leading-relaxed">
                      You are accessing the app via <strong>localhost</strong>. Your phone cannot see "localhost".
                      To use the mobile scanner, please open the app on this computer using:
                      <code className="block mt-2 p-2 bg-amber-100 rounded text-amber-900 font-mono text-center select-all">
                        http://10.224.137.250:3000
                      </code>
                    </p>
                  </div>
                )}

                <div className="bg-white p-6 inline-block rounded-3xl shadow-xl border border-blue-100 mb-4">
                  <QRCodeSVG
                    value={`${window.location.origin}/mobile-scanner/${mobileSessionId}`}
                    size={200}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <p className="text-slate-600 text-sm max-w-sm mx-auto font-medium">
                  Scan this QR code to unlock your phone's camera. You can scan barcodes or take product photos.
                </p>
              </div>
            ) : (
              <div className="card border-2 border-green-600 bg-green-50/50 p-10 flex flex-col items-center justify-center text-center animate-in slide-in-from-bottom duration-500">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-900/20">
                  <Camera className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-green-900 mb-2">SCANNER READY</h3>
                <p className="text-green-700 text-sm mb-10 max-w-xs">
                  Instant barcode and product recognition at your fingertips.
                </p>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button
                    onClick={() => navigate(`/mobile-scanner/${mobileSessionId || 'temp'}?type=post`)}
                    className="btn-primary py-4 flex flex-col items-center gap-1"
                  >
                    <div className="flex justify-center">
                      <div className="w-6 h-4 border-x-2 border-white relative mt-1">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-400"></div>
                      </div>
                    </div>
                    <span>Scan Barcode</span>
                  </button>
                  <button
                    onClick={() => navigate(`/mobile-upload/${mobileSessionId || 'temp'}?type=post`)}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl py-4 flex flex-col items-center gap-1 transition-all active:scale-95"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Take Photo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Photo Upload */}
        {method === 'photo' && (
          <div className="card mb-6 fade-in">
            <h3 className="text-lg font-semibold text-green-800 mb-4">Upload Image</h3>
            {!preview ? (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-green-300 rounded-lg p-12 text-center hover:border-green-500 transition-colors">
                  <Upload className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <p className="text-green-800 font-medium mb-2">Click to upload photo</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="space-y-4">
                <img src={preview} alt="Preview" className="w-full h-64 object-cover rounded-lg" />
                <div className="flex gap-4">
                  <button
                    onClick={handlePhotoAnalysis}
                    disabled={analyzing}
                    className="btn-primary flex-1"
                  >
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Analyze Photo'}
                  </button>
                  <button
                    onClick={() => { setSelectedFile(null); setPreview(null); }}
                    className="btn-secondary"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form and Analysis Content Area */}
        <div className="card">
          <form onSubmit={handleAnalyze} className="space-y-6">
            <div>
              <label>Product Category</label>
              <select
                data-testid="category-select"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="electronics">Electronics</option>
                <option value="clothing">Clothing</option>
                <option value="food">Food & Beverages</option>
                <option value="home">Home & Garden</option>
                <option value="vehicle">Vehicle</option>
                <option value="beauty">Beauty & Personal Care</option>
                <option value="sports">Sports & Outdoors</option>
                <option value="books">Books & Media</option>
              </select>
            </div>

            <div>
              <label>Brand (Optional)</label>
              <select
                data-testid="brand-select"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
              >
                <option value="">Select Brand</option>
                <option value="Apple">Apple</option>
                <option value="Samsung">Samsung</option>
                <option value="Nike">Nike</option>
                <option value="Adidas">Adidas</option>
                <option value="Sony">Sony</option>
                <option value="LG">LG</option>
                <option value="Microsoft">Microsoft</option>
                <option value="Google">Google</option>
                <option value="Amazon">Amazon</option>
                <option value="Tesla">Tesla</option>
                <option value="Toyota">Toyota</option>
                <option value="BMW">BMW</option>
                <option value="Coca-Cola">Coca-Cola</option>
                <option value="Pepsi">Pepsi</option>
                <option value="Nestle">Nestle</option>
                <option value="Unilever">Unilever</option>
                <option value="Procter & Gamble">Procter & Gamble</option>
                <option value="L'Oreal">L'Oreal</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label>Product Name *</label>
              <input
                data-testid="product-name-input"
                type="text"
                name="product_name"
                value={formData.product_name}
                onChange={handleChange}
                required
                placeholder="e.g., Samsung Galaxy S24"
              />
            </div>

            {method === 'manual' && (
              <div>
                <label>Barcode (Optional)</label>
                <input
                  data-testid="barcode-input"
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  placeholder="Enter product barcode"
                />
              </div>
            )}

            <div>
              <label>Additional Details (Optional)</label>
              <textarea
                data-testid="details-input"
                name="product_details"
                value={formData.product_details}
                onChange={handleChange}
                rows="3"
                placeholder="Add any specific details about the product..."
              />
            </div>

            <button
              data-testid="analyze-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? <span className="loading"></span> : 'Analyze Carbon Footprint'}
            </button>
          </form>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="mt-8 space-y-6 fade-in">
            <div className="card bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-green-800 mb-2">Analysis Results</h3>
                  <p className="text-sm text-green-600 font-medium">Detailed environmental footprint for {analysis.product_name || formData.product_name}</p>
                </div>
                
                {(preview || analysis.image_url) && (
                  <div className="w-full sm:w-48 h-48 rounded-2xl overflow-hidden shadow-xl border-4 border-white transform hover:scale-105 transition-transform duration-500 shrink-0">
                    <img 
                      src={preview || analysis.image_url} 
                      alt="Product" 
                      className="w-full h-full object-cover"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
                {/* KPI Card: Carbon Footprint */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 h-24 -mr-8 -mt-8 bg-emerald-50 rounded-full group-hover:bg-emerald-100 transition-colors"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 sm:p-2 bg-emerald-500 rounded-lg shadow-sm shrink-0">
                        <Leaf className="w-4 h-4 sm:w-5 h-5 text-white" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Carbon Impact</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tighter" data-testid="carbon-result">
                        {analysis.carbon_footprint}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-400">kg CO2e</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 mt-2 font-medium">Estimated lifecycle emissions</p>
                  </div>
                </div>

                {/* KPI Card: Eco Score */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className={`absolute top-0 right-0 w-20 h-20 sm:w-24 h-24 -mr-8 -mt-8 ${analysis.eco_score > 70 ? 'bg-green-50' : 'bg-amber-50'} rounded-full transition-colors`}></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`p-1.5 sm:p-2 ${analysis.eco_score > 70 ? 'bg-green-500' : 'bg-amber-500'} rounded-lg shadow-sm shrink-0`}>
                        <TrendingUp className="w-4 h-4 sm:w-5 h-5 text-white" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Sustainability</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl sm:text-4xl font-black tracking-tighter ${analysis.eco_score > 70 ? 'text-green-600' : 'text-amber-600'}`} data-testid="eco-score-result">
                        {analysis.eco_score}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-400">/ 100</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 mt-2 font-medium">Overall ecological rating</p>
                  </div>
                </div>

                {/* KPI Card: Quick Label */}
                <div className="bg-slate-50 rounded-2xl p-5 sm:p-6 border-2 border-dashed border-slate-200 flex flex-col justify-center items-center text-center sm:col-span-2 lg:col-span-1">
                  <p className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase mb-2 leading-none">Analysis Status</p>
                  <div className={`px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase ${analysis.eco_score > 70 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {analysis.eco_score > 70 ? 'Eco Friendly' : 'Attention Required'}
                  </div>
                </div>
              </div>

              {analysis.impact && (
                <div className="space-y-6">
                  {/* Discovery & Findings - Professional Box Layout */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-green-800 uppercase tracking-tight border-l-4 border-green-500 pl-3">
                      Discovery & Findings
                    </h3>

                    {analysis.detected_item ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {[
                          { label: "Detected Item", value: analysis.detected_item, icon: <Search size={14} /> },
                          { label: "Assumptions", value: analysis.assumptions, icon: <Info size={14} /> },
                          { label: "Data Source", value: analysis.data_source, icon: <Database size={14} /> },
                          { label: "Why it emits", value: analysis.why_it_emits, icon: <Zap size={14} /> },
                          { label: "Better Choice", value: analysis.better_choice, icon: <CheckCircle size={14} className="text-green-500" /> },
                          { label: "Expected Saving", value: analysis.expected_saving, icon: <TrendingUp size={14} /> },
                          { label: "Carbon Saved", value: analysis.carbon_saved, icon: <Leaf size={14} /> }
                        ].filter(f => f.value).map((field, i) => (
                          <div key={i} className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-green-100 hover:shadow-md transition-all group relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-1.5 bg-green-50 rounded-lg text-green-600 shrink-0">
                                {field.icon}
                              </div>
                              <h4 className="text-xs sm:text-sm font-black text-green-900 uppercase tracking-widest group-hover:text-green-700 transition-colors">
                                {field.label}
                              </h4>
                            </div>
                            <div className="pl-9">
                              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                                {field.value}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      analysis.impact_details && analysis.impact_details.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {analysis.impact_details.map((detail, idx) => (
                            <div key={idx} className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-green-100 hover:shadow-md transition-all group relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="flex-shrink-0 w-6 h-6 rounded bg-green-50 flex items-center justify-center text-[10px] font-extrabold text-green-600 border border-green-100 uppercase">
                                  {idx + 1}
                                </span>
                                <h4 className="text-xs sm:text-sm font-black text-green-900 uppercase tracking-widest group-hover:text-green-700 transition-colors">
                                  {detail.title.replace(/^\d+\.\s*/, '').replace(/:$/, '')}
                                </h4>
                              </div>
                              <div className="pl-9 space-y-2">
                                {detail.content.split('\n').filter(line => line.trim()).map((contentLine, j) => {
                                  if (contentLine.trim().startsWith('*')) {
                                    return (
                                      <div key={j} className="flex gap-2 items-start bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                                        <span className="text-green-500 font-black mt-0.5">•</span>
                                        <span className="text-[10px] sm:text-xs text-slate-600 font-medium italic">{contentLine.trim().substring(1).trim()}</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <p key={j} className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                                      {contentLine}
                                    </p>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null
                    )}
                  </div>

                  {/* Scientific Basis Dashboard - Collapsible */}
                  {analysis.calculation && (
                    <div className="bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 transition-all duration-500">
                      {/* Dashboard Header - Clickable Toggle */}
                      <button
                        onClick={() => setShowScientific(!showScientific)}
                        className="w-full bg-slate-900 px-6 py-5 flex items-center justify-between border-b border-slate-800 hover:bg-slate-800/80 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg border transition-all ${showScientific ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-slate-800 border-slate-700'}`}>
                            <Leaf className={`w-5 h-5 ${showScientific ? 'text-emerald-400' : 'text-slate-400'}`} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none">Scientific Audit</h3>
                            <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold">
                              {showScientific ? 'Decompressing Proof Trail...' : 'Mathematical proof hidden (Click to verify)'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {showScientific ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                        </div>
                      </button>

                      {/* Analysis Grid - Conditional Rendering */}
                      {showScientific && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="p-6 grid grid-cols-1 gap-4">
                            {analysis.calculation.split('*').filter(p => p.trim().length > 10).map((point, i) => {
                              const hasColon = point.includes(':');
                              const title = hasColon ? point.split(':')[0].replace(/\*\*/g, '').trim() : `Step ${i + 1}`;
                              const content = hasColon ? point.split(':').slice(1).join(':').trim() : point.trim();

                              return (
                                <div key={i} className="group relative bg-slate-900/50 rounded-xl p-4 border border-slate-800/50 hover:border-emerald-500/30 transition-all hover:bg-slate-900">
                                  <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-emerald-500 border border-slate-700 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                      {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 group-hover:text-emerald-300">
                                        {title}
                                      </h4>
                                      <p className="text-xs text-slate-300 leading-relaxed font-mono">
                                        {content}
                                      </p>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                      {title.toLowerCase().includes('assumption') && <Info className="w-3 h-3 text-blue-400" />}
                                      {(title.toLowerCase().includes('saving') || title.toLowerCase().includes('saved')) && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Footer Disclaimer */}
                          <div className="px-6 py-3 bg-slate-900/80 border-t border-slate-800 flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                            <span>LCA STANDARDS COMPLIANT</span>
                            <span>SOURCE: GEMINI 1.5 PRO AUDIT</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Environmental Equivalence Dashboard - Innovative Replacement */}
                  <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-800 relative overflow-hidden group">
                    {/* Background Decorative Element */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -ml-24 -mb-24"></div>

                    <div className="relative mb-8">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                          <TrendingUp className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-widest">
                          Climate Reality Check
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest ml-11">
                        Translating {analysis.carbon_footprint}kg CO2e into real-world impact
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 relative">
                      {/* Equivalence Card 1: Trees */}
                      <div className="bg-slate-800/50 rounded-2xl p-5 sm:p-6 border border-slate-700/50 hover:border-emerald-500/50 transition-all group/card">
                        <div className="w-10 h-10 sm:w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4 group-hover/card:scale-110 transition-transform">
                          <TreeDeciduous className="w-5 h-5 sm:w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-widest">Offset Requirement</p>
                          <h4 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">
                            {(analysis.carbon_footprint / 21).toFixed(1)}
                          </h4>
                          <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Full-grown trees needed to absorb this in a year</p>
                        </div>
                      </div>

                      {/* Equivalence Card 2: Energy */}
                      <div className="bg-slate-800/50 rounded-2xl p-5 sm:p-6 border border-slate-700/50 hover:border-blue-500/50 transition-all group/card">
                        <div className="w-10 h-10 sm:w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover/card:scale-110 transition-transform">
                          <Zap className="w-5 h-5 sm:w-6 h-6 text-blue-400" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest">Energy Equivalent</p>
                          <h4 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">
                            {Math.round(analysis.carbon_footprint / 0.005).toLocaleString()}
                          </h4>
                          <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Smartphone charges (0% to 100%)</p>
                        </div>
                      </div>

                      {/* Equivalence Card 3: Waste */}
                      <div className="bg-slate-800/50 rounded-2xl p-5 sm:p-6 border border-slate-700/50 hover:border-teal-500/50 transition-all group/card sm:col-span-2 lg:col-span-1">
                        <div className="w-10 h-10 sm:w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mb-4 group-hover/card:scale-110 transition-transform">
                          <Droplets className="w-5 h-5 sm:w-6 h-6 text-teal-400" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] sm:text-[10px] font-black text-teal-400 uppercase tracking-widest">Resource Drain</p>
                          <h4 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">
                            {Math.round(analysis.carbon_footprint / 0.08).toLocaleString()}
                          </h4>
                          <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Equivalent in plastic PET bottle production</p>
                        </div>
                      </div>
                    </div>

                    {/* Fun Fact Footer */}
                    <div className="mt-8 pt-6 border-t border-slate-800 flex items-center gap-3">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">
                        Did you know? Choosing a sustainable alternative can reduce this impact by up to 85%.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {analysis.alternatives && analysis.alternatives.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-4 border-l-4 border-emerald-500 pl-3">
                    <Lightbulb className="w-6 h-6 text-emerald-600" />
                    <h3 className="text-xl font-bold text-emerald-800 uppercase tracking-tight">Eco-Friendly Alternatives</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analysis.alternatives.map((alt, idx) => (
                      <div key={idx} className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex flex-col gap-3 group">
                        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                          <Leaf className="w-5 h-5 text-emerald-600 group-hover:text-white" />
                        </div>
                        <p className="text-emerald-900 font-medium leading-tight">{alt}</p>
                        <div className="mt-auto pt-2">
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Better Choice</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                data-testid="log-product-btn"
                onClick={handleSaveLog}
                disabled={loading}
                className="btn-primary w-full mt-6 py-4 text-xl font-black"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'LOG TO PORTFOLIO'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PostPurchase;