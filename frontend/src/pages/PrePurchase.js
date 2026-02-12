import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../App';
import { ArrowLeft, Search, Lightbulb, Leaf } from 'lucide-react';
import { toast } from 'sonner';

const PrePurchase = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
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

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/analysis/carbon', {
        product_name: formData.product_name,
        category: formData.category,
        product_details: formData.product_details
      });
      setAnalysis(response.data);
      toast.success('Analysis complete!');
    } catch (error) {
      toast.error('Failed to analyze product');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLog = async () => {
    try {
      await api.post('/products/log', {
        log_type: 'pre-purchase',
        category: formData.category,
        product_name: formData.product_name,
        product_details: formData.product_details,
        barcode: formData.barcode
      });
      toast.success('Product logged successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to save log');
    }
  };

  return (
    <div className="min-h-screen" data-testid="pre-purchase-page">
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
            <Search className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-green-800 mb-3">Pre-Purchase Inquiry</h1>
          <p className="text-lg text-green-600">
            Check the environmental impact before making a purchase decision.
          </p>
        </div>

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
                placeholder="e.g., iPhone 15, Tesla Model 3"
              />
            </div>

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
              <h3 className="text-2xl font-bold text-green-800 mb-4">Analysis Results</h3>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-green-600 mb-1">Carbon Footprint</p>
                  <p className="text-3xl font-bold text-green-800" data-testid="carbon-result">
                    {analysis.carbon_footprint} kg CO2
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-green-600 mb-1">Eco Score</p>
                  <p className="text-3xl font-bold text-green-800" data-testid="eco-score-result">
                    {analysis.eco_score}/100
                  </p>
                </div>
              </div>

              {analysis.impact && (
                <div className="bg-white rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-600 mb-2">Environmental Impact</p>
                  <p className="text-green-800">{analysis.impact}</p>
                </div>
              )}

              {analysis.alternatives && analysis.alternatives.length > 0 && (
                <div className="bg-white rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-800">Eco-Friendly Alternatives</h4>
                  </div>
                  <ul className="space-y-2">
                    {analysis.alternatives.map((alt, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Leaf className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                        <span className="text-green-700">{alt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                data-testid="save-log-btn"
                onClick={handleSaveLog}
                className="btn-primary w-full mt-6"
              >
                Save to My Logs
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrePurchase;