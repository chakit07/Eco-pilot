import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../App';
import { Leaf, Mail, Lock, User, MapPin, Target } from 'lucide-react';
import { toast } from 'sonner';

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    region: '',
    lifestyle_type: '',
    sustainability_goals: []
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGoalsChange = (goal) => {
    setFormData(prev => ({
      ...prev,
      sustainability_goals: prev.sustainability_goals.includes(goal)
        ? prev.sustainability_goals.filter(g => g !== goal)
        : [...prev.sustainability_goals, goal]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await api.post(endpoint, payload);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const goals = [
    'Reduce Carbon Emissions',
    'Sustainable Shopping',
    'Eco-Friendly Travel',
    'Zero Waste Lifestyle'
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-3 sm:mb-4">
            <Leaf className="w-10 h-10 sm:w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-green-800 mb-1 sm:mb-2 tracking-tight">EcoPilot</h1>
          <p className="text-sm sm:text-base text-green-600 font-medium">
            {isLogin ? 'Welcome back!' : 'Start your sustainability journey'}
          </p>
        </div>

        <div className="card">
          <div className="flex mb-6 border-b border-green-200">
            <button
              data-testid="login-tab"
              onClick={() => setIsLogin(true)}
              className={`flex-1 pb-3 font-semibold transition-colors ${
                isLogin ? 'text-green-600 border-b-2 border-green-600' : 'text-green-400'
              }`}
            >
              Login
            </button>
            <button
              data-testid="register-tab"
              onClick={() => setIsLogin(false)}
              className={`flex-1 pb-3 font-semibold transition-colors ${
                !isLogin ? 'text-green-600 border-b-2 border-green-600' : 'text-green-400'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="flex items-center gap-2">
                  <User className="w-4 h-4" /> Name
                </label>
                <input
                  data-testid="name-input"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required={!isLogin}
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email
              </label>
              <input
                data-testid="email-input"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <Lock className="w-4 h-4" /> Password
              </label>
              <input
                data-testid="password-input"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter password"
              />
            </div>

            {!isLogin && (
              <>
                <div>
                  <label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Region
                  </label>
                  <input
                    data-testid="region-input"
                    type="text"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    required={!isLogin}
                    placeholder="Your region"
                  />
                </div>

                <div>
                  <label>Lifestyle Type</label>
                  <select
                    data-testid="lifestyle-select"
                    name="lifestyle_type"
                    value={formData.lifestyle_type}
                    onChange={handleChange}
                    required={!isLogin}
                    className="text-sm sm:text-base py-3 px-4"
                  >
                    <option value="">Select lifestyle</option>
                    <option value="urban">Urban</option>
                    <option value="suburban">Suburban</option>
                    <option value="rural">Rural</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4" /> Sustainability Goals
                  </label>
                  <div className="space-y-2">
                    {goals.map(goal => (
                      <label key={goal} className="flex items-center gap-2 cursor-pointer">
                        <input
                          data-testid={`goal-${goal.toLowerCase().replace(/ /g, '-')}`}
                          type="checkbox"
                          checked={formData.sustainability_goals.includes(goal)}
                          onChange={() => handleGoalsChange(goal)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span className="text-sm">{goal}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              data-testid="submit-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 sm:py-4 text-sm sm:text-base shadow-lg shadow-green-200"
            >
              {loading ? (
                <span className="loading"></span>
              ) : isLogin ? (
                'Login'
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;