import { useNavigate } from 'react-router-dom';
import { Leaf, BarChart3, Lightbulb, TrendingDown } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center fade-in">
            <div className="flex justify-center mb-6">
              <Leaf className="w-16 h-16 text-green-600" />
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-green-800 mb-6">
              EcoPilot
            </h1>
            <p className="text-lg sm:text-xl text-green-700 mb-4 max-w-3xl mx-auto">
              AI-Powered Personalized Carbon Tracker
            </p>
            <p className="text-base sm:text-lg text-green-600 mb-12 max-w-2xl mx-auto">
              Track your carbon footprint, get eco-friendly recommendations, and make sustainable choices with AI-driven insights.
            </p>
            <button
              data-testid="get-started-btn"
              onClick={() => navigate('/auth')}
              className="btn-primary text-lg"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-green-800 mb-16">
          How EcoPilot Helps You
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Leaf className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-800 mb-3">Smart Tracking</h3>
            <p className="text-green-700 text-sm">
              Log purchases with barcode scanning or photo recognition for instant carbon analysis.
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Lightbulb className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-800 mb-3">AI Recommendations</h3>
            <p className="text-green-700 text-sm">
              Get personalized eco-friendly alternatives powered by advanced AI analysis.
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <BarChart3 className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-800 mb-3">Impact Dashboard</h3>
            <p className="text-green-700 text-sm">
              Visualize your environmental impact and track progress toward sustainability goals.
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <TrendingDown className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-800 mb-3">Reduce Footprint</h3>
            <p className="text-green-700 text-sm">
              Make informed decisions and significantly reduce your carbon footprint over time.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-green-800 mb-6">
            Start Your Sustainability Journey Today
          </h2>
          <p className="text-lg text-green-700 mb-8">
            Join thousands making eco-conscious choices every day.
          </p>
          <button
            data-testid="cta-get-started-btn"
            onClick={() => navigate('/auth')}
            className="btn-primary text-lg"
          >
            Create Free Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Landing;