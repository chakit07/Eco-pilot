# 🌍 Eco-Pilot: AI-Powered Carbon Tracking & Environmental Wisdom

Eco-Pilot is a state-of-the-art sustainability platform that uses **Gemini 2.0 Flash AI** to transform how users interact with their environmental footprint. Beyond simple carbon tracking, Eco-Pilot provides deep scientific insights and ecological wisdom for every aspect of your daily life.

---

## 🚀 Key Features

### 📸 Omni-Vision AI Scanner
Scan anything—from groceries and electronics to landscapes and urban activities. 
- **Product Analysis**: Get instant LCA (Life Cycle Assessment) data, material breakdowns, and carbon footprints.
- **Environmental Wisdom**: Scan a park or a street to receive insights on carbon sequestration, soil health, and urban ecology.
- **Single-Pass Efficiency**: High-performance unified AI requests identify subjects and calculate impacts in one lightning-fast pass.

### 📱 Seamless Mobile Integration
Logged in on desktop but need a camera?
- **QR Sync**: Instantly connect your mobile device by scanning a QR code on your dashboard.
- **Cloud-Stream Uploads**: Take photos or scan barcodes on your phone; the results appear instantly on your desktop in real-time.
- **Local Fallback**: Works across local networks with specialized secure-context detection.

### 📊 Real-Time Impact Dashboard
- **Dynamic Visualizations**: Monitor your total carbon saved, average eco-scores, and trends over time.
- **Climate Reality Check**: See your impact in relatable terms—like how many trees your savings are worth.
- **Carbon Breakdown**: Detailed percentages showing where emissions come from: Manufacturing, Transport, Usage, and Disposal.

### 💡 Wisdom-Driven Alternatives
Not just "buy this instead," but "think like this." Eco-Pilot provides behavioral shifts and scientific perspectives that empower a sustainable worldview.

---

## 🛠️ Technical Stack

- **Frontend**: React 18, Tailwind CSS, Lucide Icons, Framer Motion (vibrant & premium UI).
- **Backend**: FastAPI (Python), Motor (Async MongoDB), JWT Authentication.
- **AI Core**: Google Gemini 2.0 Flash (Advanced Multimodal LLM).
- **Vision**: `html5-qrcode` & Native Mobile Camera Integration.
- **Database**: MongoDB (NoSQL).

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Node.js (v18+)
- Python (3.9+)
- MongoDB (Running locally or Atlas)
- Google Gemini API Key

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```
**Environment Variables (`backend/.env`):**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=Eco-pilot
JWT_SECRET_KEY=your_secret_key
GOOGLE_API_KEY=your_gemini_api_key
CORS_ORIGINS=http://localhost:3000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```
**Environment Variables (`frontend/.env`):**
```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

### 4. Running the Project
- **Backend**: `uvicorn server:app --reload --host 0.0.0.0`
- **Frontend**: `npm start`

---

## 🛡️ Security & Performance
- **Unified AI Engine**: Optimized for the Gemini Free Tier to prevent 429 Rate Limits by combining vision and analysis logic into single tokens.
- **TLS/HTTPS Aware**: Intelligent camera permission detection for local network vs. production environments.
- **Premium UX**: Glassmorphic designs, glowing accents, and high-performance micro-animations for a "Triple-A" feel.

---

## 🌿 Contribution
Join us in building the most intelligent sustainability tool on the planet.

**Eco-Pilot — Intelligence for a Greener Tomorrow.**
