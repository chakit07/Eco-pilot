import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../App';
import { ArrowLeft, TrendingUp, Leaf, Award, Calendar, Trash2, TreeDeciduous, Zap, Droplets, Lightbulb } from 'lucide-react';
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

  const handleDelete = async (logId, productName) => {
    if (!window.confirm(`Are you sure you want to remove "${productName}" from your history?`)) return;

    try {
      await api.delete(`/products/log/${logId}`);
      toast.success(`Removed: ${productName}`);
      loadData(); // Refresh data
    } catch (error) {
      toast.error('Failed to remove entry');
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-4">
          <button
            data-testid="back-btn"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
          >
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-12">
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-green-800">All Your Logs</h3>
          </div>
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
                      {log.environmental_impact && (
                        <div className="mt-6">
                          <p className="text-xs font-black text-green-700 mb-4 uppercase tracking-widest border-l-4 border-green-500 pl-3">
                            Methodology & Impact
                          </p>
                          <div className="flex flex-col gap-3">
                            {(() => {
                              // Intelligent splitting for cases where newlines are missing
                              const text = log.environmental_impact;
                              const segments = text.split(/(\d+\.\s+[^:]+:)/).filter(Boolean);
                              const points = [];
                              for (let i = 0; i < segments.length; i++) {
                                if (segments[i].match(/^\d+\.\s+[^:]+:$/)) {
                                  points.push({ title: segments[i], content: segments[i + 1] || "" });
                                  i++;
                                } else if (segments[i].trim()) {
                                  points.push({ title: "Observation", content: segments[i] });
                                }
                              }

                              return points.map((point, i) => (
                                <div key={i} className="bg-white rounded-xl p-4 border border-green-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="flex-shrink-0 w-6 h-6 rounded bg-green-50 flex items-center justify-center text-[10px] font-extrabold text-green-600 border border-green-100">
                                      {i + 1}
                                    </span>
                                    <h5 className="text-[11px] font-black text-green-900 uppercase tracking-widest group-hover:text-green-700 transition-colors">
                                      {point.title.replace(/^\d+\.\s*/, '').replace(/:$/, '')}
                                    </h5>
                                  </div>
                                  <div className="pl-9">
                                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                      {point.content.trim()}
                                    </p>
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Relatable Impact for this specific log */}
                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center gap-4">
                          <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <TreeDeciduous className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Growth Debt</p>
                            <p className="text-sm font-black text-white">{(log.carbon_footprint / 21).toFixed(1)} Trees</p>
                          </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center gap-4">
                          <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Zap className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Energy Use</p>
                            <p className="text-sm font-black text-white">{Math.round(log.carbon_footprint / 0.005).toLocaleString()} Charges</p>
                          </div>
                        </div>
                      </div>

                      {log.carbon_breakdown && Object.keys(log.carbon_breakdown).length > 0 && (
                        <div className="mt-6">
                          <p className="text-xs font-black text-green-700 mb-3 uppercase tracking-widest border-l-4 border-emerald-500 pl-3">Lifecycle Carbon Breakdown</p>
                          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                              {Object.entries(log.carbon_breakdown).map(([label, value]) => (
                                <div key={label} className="group">
                                  <div className="flex justify-between text-[10px] text-slate-600 mb-1.5 font-bold uppercase tracking-wider">
                                    <span>{label}</span>
                                    <span className="text-green-600">{value}%</span>
                                  </div>
                                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-green-500 h-1.5 rounded-full group-hover:bg-green-600 transition-colors"
                                      style={{ width: `${value}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {log.recommendations && log.recommendations.length > 0 && (
                        <div className="mt-6">
                          <p className="text-xs text-green-700 mb-3 font-black uppercase tracking-widest border-l-4 border-amber-500 pl-3 flex items-center gap-2">
                            <Lightbulb className="w-3 h-3 text-amber-500" /> Eco Alternatives
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {log.recommendations.map((rec, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50">
                                <Leaf className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                <span className="text-[11px] text-amber-900 font-bold">{rec}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4 flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleDelete(log.id, log.product_name)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div>
                        <p className="text-2xl font-bold text-green-700">{log.carbon_footprint}</p>
                        <p className="text-xs text-green-600 mb-2">kg CO2</p>
                      </div>
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