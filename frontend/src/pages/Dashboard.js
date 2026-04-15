import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../App';
import { Leaf, ShoppingBag, Camera, BarChart3, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, statsRes] = await Promise.all([
        api.get('/profile'),
        api.get('/dashboard/stats')
      ]);
      setUser(profileRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="dashboard">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Leaf className="w-8 h-8 text-green-600" />
              <h1 className="text-xl sm:text-2xl font-bold text-green-800">EcoPilot</h1>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-2 text-green-700">
                <User className="w-4 h-4 sm:w-5 h-5" />
                <span className="font-medium text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{user?.name}</span>
              </div>
              <button
                data-testid="logout-btn"
                onClick={handleLogout}
                className="btn-secondary py-2 px-4 sm:py-3 sm:px-8 text-sm sm:text-base flex items-center gap-2"
              >
                <LogOut className="w-3 h-3 sm:w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-12">
        {/* Welcome Section */}
        <div className="mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-green-800 mb-3 leading-tight">Welcome back, {user?.name}!</h2>
          <p className="text-base sm:text-lg text-green-600">What would you like to do today?</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-green-800">Total Logs</h3>
              <ShoppingBag className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700" data-testid="total-logs">{stats?.total_logs || 0}</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-green-800">Carbon Saved</h3>
              <Leaf className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700" data-testid="carbon-saved">{stats?.total_carbon_saved || 0} kg</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-green-800">Eco Score</h3>
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700" data-testid="eco-score">{stats?.eco_score || 0}/100</p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          <div
            data-testid="pre-purchase-card"
            onClick={() => navigate('/pre-purchase')}
            className="card cursor-pointer bg-gradient-to-br from-green-50 to-emerald-50 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-600 rounded-full shrink-0">
                <ShoppingBag className="w-6 h-6 sm:w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-green-800 mb-2">Pre-Purchase Inquiry</h3>
                <p className="text-sm sm:text-base text-green-700">
                  Check the carbon footprint before buying a product or vehicle.
                </p>
              </div>
            </div>
          </div>
          <div
            data-testid="post-purchase-card"
            onClick={() => navigate('/post-purchase')}
            className="card cursor-pointer bg-gradient-to-br from-blue-50 to-cyan-50 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-600 rounded-full shrink-0">
                <Camera className="w-6 h-6 sm:w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-blue-800 mb-2">Post-Purchase Log</h3>
                <p className="text-sm sm:text-base text-blue-700">
                  Log items you've already purchased with photo or barcode scanning.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* View Impact */}
        <div className="text-center">
          <button
            data-testid="view-impact-btn"
            onClick={() => navigate('/impact')}
            className="btn-primary text-lg flex items-center gap-2 mx-auto"
          >
            <BarChart3 className="w-5 h-5" />
            View Your Impact Dashboard
          </button>
        </div>

        {/* Recent Activity */}
        {stats?.recent_logs && stats.recent_logs.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h3 
                onClick={() => navigate('/impact')}
                className="text-2xl font-bold text-green-800 cursor-pointer hover:text-green-700 transition-colors"
              >
                Recent Activity
              </h3>
              <button
                onClick={() => navigate('/impact')}
                className="text-green-600 hover:text-green-700 font-semibold text-sm flex items-center gap-1 transition-colors"
              >
                View All Logs <BarChart3 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid gap-4">
              {stats.recent_logs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => navigate('/impact')}
                  className="card flex items-center justify-between cursor-pointer hover:border-green-300 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all group"
                >
                  <div>
                    <h4 className="font-semibold text-green-800 group-hover:text-green-900">{log.product_name}</h4>
                    <p className="text-sm text-green-600">{log.category} • {log.log_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-700">{log.carbon_footprint} kg CO2</p>
                    <p className="text-sm text-green-600">Eco Score: {log.eco_score}/100</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;