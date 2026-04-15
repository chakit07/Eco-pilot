import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../App';
import { ArrowLeft, TrendingUp, Leaf, Award, Calendar, Trash2, TreeDeciduous, Zap, Droplets, Lightbulb, Search, Info, Database, CheckCircle, Smartphone, PieChart as PieIcon, LineChart as LineIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from 'sonner';

const ImpactDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedScientific, setExpandedScientific] = useState({}); // { logId: boolean }
  const [expandedLogs, setExpandedLogs] = useState({}); // { logId: boolean }

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
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-4">
          <button
            data-testid="back-btn"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium text-sm sm:text-base"
          >
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-12">
        <div className="text-center mb-10 sm:mb-12">
          <div className="flex justify-center mb-4">
            <Award className="w-10 h-10 sm:w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-green-800 mb-3 leading-tight">Your Environmental Impact</h1>
          <p className="text-base sm:text-lg text-green-600">
            Track your progress and celebrate your sustainability achievements.
          </p>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="card bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-600 rounded-lg shrink-0">
                <Leaf className="w-5 h-5 sm:w-6 h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-green-800">Carbon Saved</h3>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-green-700 mb-2" data-testid="total-carbon-saved">
              {stats?.total_carbon_saved || 0} kg
            </p>
            <p className="text-xs sm:text-sm text-green-600">Equivalent to planting {Math.round((stats?.total_carbon_saved || 0) / 20)} trees</p>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-cyan-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-600 rounded-lg shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-6 h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-blue-800">Eco Score</h3>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-blue-700 mb-2" data-testid="avg-eco-score">
              {stats?.eco_score || 0}/100
            </p>
            <p className="text-xs sm:text-sm text-blue-600">Your average sustainability rating</p>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-pink-50 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-600 rounded-lg shrink-0">
                <Calendar className="w-5 h-5 sm:w-6 h-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-purple-800">Total Actions</h3>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-purple-700 mb-2" data-testid="total-actions">
              {stats?.total_logs || 0}
            </p>
            <p className="text-xs sm:text-sm text-purple-600">Eco-conscious decisions made</p>
          </div>
        </div>

        {/* Visual Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Savings Trend Chart */}
          <div className="card lg:col-span-2 bg-white/80 backdrop-blur-xl border-green-50 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-green-900">Impact Savings Trend</h3>
                <p className="text-sm text-green-600">Total carbon saved over time (kg CO2)</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <LineIcon className="w-5 h-5 text-green-600" />
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.savings_history || []}>
                  <defs>
                    <linearGradient id="colorSaved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0fdf4" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#059669', fontSize: 12 }}
                    minTickGap={30}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#059669', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      borderRadius: '16px',
                      border: '1px solid #d1fae5',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="saved"
                    stroke="#059669"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorSaved)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Distribution Chart */}
          <div className="card bg-white/80 backdrop-blur-xl border-blue-50 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-blue-900">Footprint Mix</h3>
                <p className="text-sm text-blue-600">By category (kg)</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <PieIcon className="w-5 h-5 text-blue-600" />
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.category_distribution || []}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {(stats?.category_distribution || []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={[
                          '#10b981', // Emerald
                          '#3b82f6', // Blue
                          '#8b5cf6', // Purple
                          '#f59e0b', // Amber
                          '#ef4444', // Red
                          '#ec4899'  // Pink
                        ][index % 6]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      borderRadius: '16px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-semibold text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Carbon Trend (Old Bar Chart - Kept for legacy look) */}
        {stats?.carbon_trend && stats.carbon_trend.length > 0 && (
          <div className="card mb-12 bg-white/50 backdrop-blur-sm border-dashed border-green-200">
            <h3 className="text-lg font-bold text-green-800 mb-6 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Recent Activity Footprint
            </h3>
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
                <div
                  key={log.id}
                  className={`border-2 rounded-2xl overflow-hidden transition-all duration-300 ${expandedLogs[log.id]
                      ? 'border-green-400 shadow-lg bg-white mb-6'
                      : 'border-green-100 bg-green-50/30 hover:border-green-300 mb-4'
                    }`}
                >
                  <div
                    onClick={() => setExpandedLogs(prev => ({ ...prev, [log.id]: !prev[log.id] }))}
                    className="p-4 sm:p-6 cursor-pointer flex items-start justify-between group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-bold text-green-800 text-lg sm:text-xl group-hover:text-green-600 transition-colors">
                          {log.product_name}
                        </h4>
                        <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
                          {log.log_type}
                        </span>
                      </div>
                      <p className="text-sm text-green-600 font-medium">
                        {log.category} • {new Date(log.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-8">
                      <div className="text-right">
                        <p className="text-xl sm:text-2xl font-black text-green-700">{log.carbon_footprint}</p>
                        <p className="text-[10px] sm:text-xs font-bold text-green-600 uppercase tracking-tighter">kg CO2</p>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="px-3 py-1 bg-green-600 text-white rounded-full text-xs sm:text-sm font-black shadow-sm">
                          {log.eco_score}/100
                        </div>
                        <div className={`p-1 rounded-full transition-transform duration-300 ${expandedLogs[log.id] ? 'rotate-180 bg-green-100' : 'bg-green-50'}`}>
                          <ChevronDown className={`w-4 h-4 ${expandedLogs[log.id] ? 'text-green-700' : 'text-green-400'}`} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedLogs[log.id] && (
                    <div className="px-4 pb-6 sm:px-6 sm:pb-8 border-t border-green-50 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="pt-4 flex justify-between items-center mb-4">
                        <div className="h-px flex-1 bg-green-100"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(log.id, log.product_name);
                          }}
                          className="mx-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                          title="Delete log"
                        >
                          <Trash2 className="w-4 h-4" /> Remove Entry
                        </button>
                        <div className="h-px flex-1 bg-green-100"></div>
                      </div>

                      {log.product_details && (
                        <p className="text-sm text-green-700 mb-6 bg-green-50/50 p-4 rounded-xl border border-green-100 italic line-clamp-3">
                          "{log.product_details}"
                        </p>
                      )}
                      {/* Detailed Environmental Audit */}
                      {(() => {
                        const fields = [
                          { label: "Detected Item", value: log.detected_item, icon: <Search size={14} /> },
                          { label: "Assumptions", value: log.assumptions, icon: <Info size={14} /> },
                          { label: "Data Source", value: log.data_source, icon: <Database size={14} /> },
                          { label: "Why it emits", value: log.why_it_emits, icon: <Zap size={14} /> },
                          { label: "Better Choice", value: log.better_choice, icon: <CheckCircle size={14} className="text-green-500" /> },
                          { label: "Expected Saving", value: log.expected_saving, icon: <TrendingUp size={14} /> },
                          { label: "Carbon Saved", value: log.carbon_saved, icon: <Leaf size={14} /> }
                        ].filter(f => f.value);

                        if (fields.length === 0) return null;

                        return (
                          <div className="mt-6">
                            <p className="text-xs font-black text-green-700 mb-4 uppercase tracking-widest border-l-4 border-green-500 pl-3">
                              Environmental Audit
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                              {fields.map((field, i) => (
                                <div key={i} className="bg-white rounded-xl p-3 sm:p-4 border border-green-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                                    <div className="p-1 sm:p-1.5 bg-green-50 rounded-lg text-green-600 shrink-0">
                                      {field.icon}
                                    </div>
                                    <h5 className="text-[10px] sm:text-[11px] font-black text-green-900 uppercase tracking-widest">
                                      {field.label}
                                    </h5>
                                  </div>
                                  <div className="pl-7 sm:pl-9">
                                    <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed font-medium">
                                      {field.value}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {(!log.detected_item && log.environmental_impact) && (
                        <div className="mt-6">
                          <p className="text-xs font-black text-green-700 mb-4 uppercase tracking-widest border-l-4 border-green-500 pl-3">
                            Legacy Methodology & Impact
                          </p>
                          <div className="flex flex-col gap-3">
                            {(() => {
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

                      {/* Scientific Audit / Calculations */}
                      {log.calculation && (
                        <div className="mt-6 bg-slate-950 rounded-2xl overflow-hidden shadow-xl border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setExpandedScientific(prev => ({ ...prev, [log.id]: !prev[log.id] }))}
                            className="w-full bg-slate-900 px-5 py-3.5 flex items-center justify-between border-b border-slate-800 hover:bg-slate-800/80 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded-lg border transition-all ${expandedScientific[log.id] ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-slate-800 border-slate-700'}`}>
                                <Leaf className={`w-4 h-4 ${expandedScientific[log.id] ? 'text-emerald-400' : 'text-slate-400'}`} />
                              </div>
                              <div>
                                <h5 className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Scientific Audit</h5>
                                <p className="text-[8px] text-slate-500 mt-1 uppercase font-bold">
                                  {expandedScientific[log.id] ? 'Decompressing Proof Trail...' : 'Mathematical proof hidden (Click to verify)'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {expandedScientific[log.id] ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            </div>
                          </button>

                          {expandedScientific[log.id] && (
                            <div className="p-4 grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                              {log.calculation.split('*').filter(p => p.trim().length > 1).map((point, i) => {
                                const hasColon = point.includes(':');
                                const titleRaw = hasColon ? point.split(':')[0].replace(/\*\*/g, '').trim() : `Step ${i + 1}`;
                                const content = hasColon ? point.split(':').slice(1).join(':').trim() : point.trim();

                                return (
                                  <div key={i} className="group relative bg-slate-900/50 rounded-xl p-3 border border-slate-800/50 hover:border-emerald-500/30 transition-all">
                                    <div className="flex items-start gap-3">
                                      <div className="flex-shrink-0 w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[9px] font-black text-emerald-500 border border-slate-700">
                                        {i + 1}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h6 className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">
                                          {titleRaw}
                                        </h6>
                                        <p className="text-[10px] text-slate-300 leading-relaxed font-mono">
                                          {content}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Relatable Impact for this specific log */}
                      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center gap-4">
                          <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
                            <TreeDeciduous className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Growth Debt</p>
                            <p className="text-sm font-black text-white">{(log.carbon_footprint / 21).toFixed(1)} Trees</p>
                          </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center gap-4">
                          <div className="p-2 bg-blue-500/20 rounded-lg shrink-0">
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
                          <div className="bg-gray-50 rounded-2xl p-4 sm:p-5 border border-gray-100">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
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
                  )}
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