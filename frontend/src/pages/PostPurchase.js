import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../App';
import { ArrowLeft, Camera, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PostPurchase = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [method, setMethod] = useState('manual'); // 'manual', 'photo', 'barcode'
  const [formData, setFormData] = useState({
    product_name: '',
    category: 'product',
    product_details: '',
    barcode: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

      const response = await api.post('/analysis/photo', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setFormData({
        product_name: response.data.product_name,
        category: response.data.category,
        product_details: response.data.details,
        barcode: ''
      });

      setAnalysis({
        carbon_footprint: response.data.carbon_footprint,
        eco_score: response.data.eco_score,
        alternatives: response.data.alternatives
      });

      toast.success('Photo analyzed successfully!');
    } catch (error) {
      toast.error('Failed to analyze photo');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleManualLog = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/products/log', {
        log_type: 'post-purchase',
        category: formData.category,
        product_name: formData.product_name,
        product_details: formData.product_details,
        barcode: formData.barcode
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
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            data-testid="back-btn"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
          >
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Camera className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-blue-800 mb-3">Post-Purchase Log</h1>
          <p className="text-lg text-blue-600">
            Log items you've already purchased and track your carbon footprint.
          </p>
        </div>

        {/* Method Selection */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-green-800 mb-4">Choose Logging Method</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <button
              data-testid="manual-method-btn"
              onClick={() => setMethod('manual')}
              className={`p-4 rounded-lg border-2 transition-all ${
                method === 'manual'
                  ? 'border-green-600 bg-green-50'
                  : 'border-green-200 hover:border-green-400'
              }`}
            >
              <p className="font-semibold text-green-800">Manual Entry</p>
              <p className="text-sm text-green-600 mt-1">Type product details</p>
            </button>

            <button
              data-testid="photo-method-btn"
              onClick={() => setMethod('photo')}
              className={`p-4 rounded-lg border-2 transition-all ${
                method === 'photo'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-green-200 hover:border-green-400'
              }`}
            >
              <p className="font-semibold text-green-800">Photo Recognition</p>
              <p className="text-sm text-green-600 mt-1">Upload product photo</p>
            </button>

            <button
              data-testid="barcode-method-btn"
              onClick={() => setMethod('barcode')}
              className={`p-4 rounded-lg border-2 transition-all ${
                method === 'barcode'
                  ? 'border-green-600 bg-green-50'
                  : 'border-green-200 hover:border-green-400'
              }`}
            >
              <p className="font-semibold text-green-800">Barcode Scan</p>
              <p className="text-sm text-green-600 mt-1">Enter barcode number</p>
            </button>
          </div>
        </div>

        {/* Photo Upload */}
        {method === 'photo' && (
          <div className="card mb-6 fade-in">
            <h3 className="text-lg font-semibold text-green-800 mb-4">Upload Product Photo</h3>
            
            {!preview ? (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-green-300 rounded-lg p-12 text-center hover:border-green-500 transition-colors">
                  <Upload className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <p className="text-green-800 font-medium mb-2">Click to upload photo</p>
                  <p className="text-sm text-green-600">PNG, JPG up to 10MB</p>
                </div>
                <input
                  data-testid="photo-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden">
                  <img src={preview} alt="Preview" className="w-full h-64 object-cover" />
                </div>
                <div className="flex gap-4">
                  <button
                    data-testid="analyze-photo-btn"
                    onClick={handlePhotoAnalysis}
                    disabled={analyzing}
                    className="btn-primary flex-1"
                  >
                    {analyzing ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                      </span>
                    ) : (
                      'Analyze Photo'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreview(null);
                    }}
                    className="btn-secondary"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual Form */}
        <div className="card">
          <h3 className="text-lg font-semibold text-green-800 mb-4">
            {method === 'photo' && analysis ? 'Confirm Product Details' : 'Product Information'}
          </h3>
          
          <form onSubmit={handleManualLog} className="space-y-4">
            <div>
              <label>Category</label>
              <select
                data-testid="category-select"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="product">Product</option>
                <option value="vehicle">Vehicle</option>
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

            {method === 'barcode' && (
              <div>
                <label>Barcode *</label>
                <input
                  data-testid="barcode-input"
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  required
                  placeholder="Enter barcode number"
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
                placeholder="Add any specific details..."
              />
            </div>

            {analysis && (
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-2">AI Analysis</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-green-600">Carbon Footprint</p>
                    <p className="text-lg font-bold text-green-800">{analysis.carbon_footprint} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-600">Eco Score</p>
                    <p className="text-lg font-bold text-green-800">{analysis.eco_score}/100</p>
                  </div>
                </div>
              </div>
            )}

            <button
              data-testid="log-product-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? <span className="loading"></span> : 'Log Product'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostPurchase;