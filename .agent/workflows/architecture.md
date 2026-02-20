---
description: System architecture and data flow of Eco-Pilot
---

# 🏗️ Eco-Pilot System Architecture

Eco-Pilot follows a modern **Full-Stack AI** architecture designed for real-time sustainability insights.

## 🧱 Core Components

1.  **Frontend (React 18)**:
    - **Dashboard**: Central hub for stats and recent logs.
    - **Vision Interface**: Integrated camera and file upload for instant analysis.
    - **Mobile Sync**: QR-based session bridging for cross-device camera access.
    - **State Management**: React hooks for local state and session persistence.

2.  **Backend (FastAPI)**:
    - **AI Core**: Orchestrates calls to Gemini 2.0 Flash for unified vision and text analysis.
    - **Session Manager**: Handles in-memory mobile upload sessions for real-time desktop updates.
    - **Auth Service**: JWT-based security with bcrypt hashing.
    - **Persistence**: Async MongoDB integration via `motor`.

3.  **AI Layer (Google Gemini 2.0 Flash)**:
    - **Unified Vision**: Identifies objects and calculates impact in a single token-optimized pass.
    - **Eco-Reasoning**: Uses GHG Protocol and ecological science to generate "Wisdom" and "Sustainable Shifts."

## 🔄 Data Workflows

### 1. Unified Analysis Workflow (Photo Scan)
- **User** takes a photo or uploads an image.
- **Frontend** converts image to Base64 and POSTs to `/api/analysis/photo`.
- **Backend** sends image + specialized prompt to **Gemini**.
- **Gemini** returns object identification, carbon footprint (kg CO2e), eco-score, and scientific insights.
- **Backend** parses the response and returns it to the UI for instant display.

### 2. Product Logging Workflow
- **User** searches for a product or fills the log form.
- **Backend** `/api/products/log` calls `analyze_carbon_footprint`.
- **Gemini** calculates LCA (Life Cycle Assessment) data.
- **Data** is saved to MongoDB under the `product_logs` collection linked to the `user_id`.

### 3. Mobile-to-Desktop Sync (QR Flow)
- **Desktop** requests a session ID from `/api/mobile/init`.
- **Desktop** displays a QR code containing `[Frontend_URL]/mobile-upload/[Session_ID]`.
- **Mobile** scans QR and uploads an image to `/api/mobile/upload/[Session_ID]`.
- **Desktop** polls `/api/mobile/status/[Session_ID]` (or waits for completion).
- **Desktop** receives the Base64 image and triggers analysis automatically.

## 📊 Database Schema (MongoDB)

- **`users`**: Email, hashed password, region, lifestyle type, goals.
- **`product_logs`**: User link, product details, carbon data, eco-score, breakdown, recommendations.
