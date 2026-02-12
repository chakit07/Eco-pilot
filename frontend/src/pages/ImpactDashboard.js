import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../App';
import { ArrowLeft, TrendingUp, Leaf, Award, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const ImpactDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/products/logs')
      ]);
      setStats(statsRes.data);
      setLogs(logsRes.data);
    } catch (error) {
      toast.error('Failed to load impact data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="impact-dashboard">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Award className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-green-800 mb-3">Your Environmental Impact</h1>
          <p className="text-lg text-green-600">
            Track your progress and celebrate your sustainability achievements.
          </p>
        </div>

        {/* Main Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="card bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-green-800">Carbon Saved</h3>
            </div>
            <p className="text-4xl font-bold text-green-700 mb-2" data-testid="total-carbon-saved">
              {stats?.total_carbon_saved || 0} kg
            </p>
            <p className="text-sm text-green-600">Equivalent to planting {Math.round((stats?.total_carbon_saved || 0) / 20)} trees</p>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-cyan-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-blue-800">Eco Score</h3>
            </div>
            <p className="text-4xl font-bold text-blue-700 mb-2" data-testid="avg-eco-score">
              {stats?.eco_score || 0}/100
            </p>
            <p className="text-sm text-blue-600">Your average sustainability rating</p>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-pink-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-purple-800">Total Actions</h3>
            </div>
            <p className="text-4xl font-bold text-purple-700 mb-2" data-testid="total-actions">
              {stats?.total_logs || 0}
            </p>
            <p className="text-sm text-purple-600">Eco-conscious decisions made</p>
          </div>
        </div>

        {/* Carbon Trend */}
        {stats?.carbon_trend && stats.carbon_trend.length > 0 && (
          <div className="card mb-12">
            <h3 className="text-2xl font-bold text-green-800 mb-6">Carbon Footprint Trend</h3>
            <div className="space-y-3">
              {stats.carbon_trend.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-green-600">{item.date}</div>
                  <div className="flex-1">
                    <div className="bg-green-100 rounded-full h-8 relative overflow-hidden">
                      <div
                        className="bg-green-600 h-full rounded-full flex items-center justify-end pr-3"
                        style={{ width: `${Math.min((item.carbon / 100) * 100, 100)}%` }}
                      >
                        <span className="text-white text-xs font-semibold">
                          {item.carbon} kg
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Logs */}
        <div className="card">
          <h3 className="text-2xl font-bold text-green-800 mb-6">All Your Logs</h3>
          {logs.length === 0 ? (
            <p className="text-center text-green-600 py-8">No logs yet. Start tracking your purchases!</p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border-2 border-green-100 rounded-lg p-4 hover:border-green-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-green-800 text-lg">{log.product_name}</h4>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          {log.log_type}
                        </span>
                      </div>
                      <p className="text-sm text-green-600 mb-3">
                        {log.category} • {new Date(log.created_at).toLocaleDateString()}
                      </p>
                      {log.product_details && (
                        <p className="text-sm text-green-700 mb-3">{log.product_details}</p>
                      )}
                      {log.recommendations && log.recommendations.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-green-600 mb-2 font-medium">Eco Alternatives:</p>
                          <div className="space-y-1">
                            {log.recommendations.map((rec, idx) => (
                              <p key={idx} className="text-xs text-green-700">• {rec}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-2xl font-bold text-green-700">{log.carbon_footprint}</p>
                      <p className="text-xs text-green-600 mb-2">kg CO2</p>
                      <div className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-semibold">
                        {log.eco_score}/100
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImpactDashboard;