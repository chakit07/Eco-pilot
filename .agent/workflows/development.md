---
description: Local development and testing procedures for Eco-Pilot
---

# 🛠️ Development & Testing Workflow

Follow these steps to develop, test, and maintain the Eco-Pilot codebase.

## 🚀 Local Setup

### Backend (FastAPI)
1. Navigate to `/backend`.
2. Ensure `.env` is configured with `GOOGLE_API_KEY`, `MONGO_URL`, and `JWT_SECRET_KEY`.
// turbo
3. Start the server:
   ```bash
   uvicorn server:app --reload --host 0.0.0.0
   ```

### Frontend (React)
1. Navigate to `/frontend`.
2. Ensure `.env` has `REACT_APP_BACKEND_URL=http://localhost:8000`.
// turbo
3. Start the dev server:
   ```bash
   npm start
   ```

## 🧪 Testing Procedures

### API Testing
The project includes several testing scripts in the root:
- `backend_test.py`: Comprehensive test suite for backend routes.
- `test_endpoints.py`: Quick verification of core API endpoints.
- `reproduce_bug.py`: Utility for isolated debugging.

Run a test:
```bash
python backend_test.py
```

### AI Logic Verification
Since the system relies heavily on Gemini, verify AI responses by checking:
1. **Model Availability**: Run `backend/check_models.py` to see which Gemini models are accessible with your API key.
2. **Prompt Tuning**: The prompts in `server.py` (`analyze_carbon_footprint` and `analyze_image_unified`) are structured for specific parsing. If parsing fails, check the logs for format mismatches.

## 🧹 Code Quality
- **Backend**: Follow PEP 8. Use `async/await` for all DB and AI operations.
- **Frontend**: Components are located in `src/components`, pages in `src/pages`. Use Tailwind CSS for all styling.
