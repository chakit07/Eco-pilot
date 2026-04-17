import asyncio
import base64
import logging
import os
import tempfile
import uuid
import re
import json
import httpx
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import bcrypt
import jwt
import google.generativeai as genai
from dotenv import load_dotenv

# Initialize logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from fastapi import (APIRouter, Depends, FastAPI, File, Form, HTTPException,
                     UploadFile)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'your-secret-key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

# AI Client Configuration (Now using Google Gemini)
api_key = os.environ.get('GOOGLE_API_KEY')
if not api_key or api_key == 'YOUR_GEMINI_API_KEY_HERE':
    logger.error("GOOGLE_API_KEY is not set correctly in .env file")
else:
    # Log masked key for diagnostic purposes
    masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "****"
    logger.info(f"Using Google API Key: {masked_key}")

genai.configure(api_key=api_key)

# Log available models to debug 404 issues
try:
    available_models = [m.name for m in genai.list_models()]
    logger.info(f"Available Gemini models: {available_models}")
except Exception as e:
    logger.error(f"Could not list Gemini models: {e}")

# We'll initialize models inside the functions for better flexibility

# Create the main app
app = FastAPI()

# Database initialization
@app.on_event("startup")
async def startup_db_client():
    # Setup TTL index for mobile sessions (expire after 30 mins)
    await db.mobile_sessions.create_index("created_at", expireAfterSeconds=1800)
    logger.info("MongoDB TTL index for mobile_sessions verified.")

# CORS Configuration
cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.15:3000').split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    region: str
    lifestyle_type: str
    sustainability_goals: List[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    region: str
    lifestyle_type: str
    sustainability_goals: List[str]

class UserLogin(BaseModel):
    email: str
    password: str

class ProductLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    log_type: str  # "pre-purchase" or "post-purchase"
    category: str  # "product" or "vehicle"
    product_name: str
    product_details: Optional[str] = None
    barcode: Optional[str] = None
    image_url: Optional[str] = None
    carbon_footprint: Optional[float] = None
    eco_score: Optional[int] = None
    recommendations: Optional[List[str]] = None
    environmental_impact: Optional[str] = None
    carbon_breakdown: Optional[dict] = None
    impact_details: Optional[List[dict]] = None
    # Discrete impact fields
    detected_item: Optional[str] = None
    assumptions: Optional[str] = None
    data_source: Optional[str] = None
    why_it_emits: Optional[str] = None
    better_choice: Optional[str] = None
    expected_saving: Optional[str] = None
    carbon_saved: Optional[str] = None
    calculation: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductLogCreate(BaseModel):
    model_config = ConfigDict(extra="allow") # Allow extra fields for easier mapping
    log_type: str
    category: str
    product_name: str
    product_details: Optional[str] = None
    barcode: Optional[str] = None
    # Optional pre-calculated analysis data to ensure 1:1 consistency
    carbon_footprint: Optional[float] = None
    eco_score: Optional[int] = None
    recommendations: Optional[List[str]] = None
    environmental_impact: Optional[str] = None
    carbon_breakdown: Optional[dict] = None
    impact_details: Optional[List[dict]] = None
    # Support for frontend field names
    impact: Optional[str] = None
    alternatives: Optional[List[str]] = None
    breakdown: Optional[dict] = None
    # Discrete impact fields
    detected_item: Optional[str] = None
    assumptions: Optional[str] = None
    data_source: Optional[str] = None
    why_it_emits: Optional[str] = None
    better_choice: Optional[str] = None
    expected_saving: Optional[str] = None
    carbon_saved: Optional[str] = None
    calculation: Optional[str] = None

class CarbonAnalysisRequest(BaseModel):
    product_name: str
    category: str
    product_details: Optional[str] = None

class DashboardStats(BaseModel):
    total_logs: int
    total_carbon_saved: float
    eco_score: int
    recent_logs: List[ProductLog]
    carbon_trend: List[dict]
    category_distribution: List[dict]
    savings_history: List[dict]

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# In-memory cache for analysis results to save quota
analysis_cache = {}

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload['user_id']
        user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

async def analyze_carbon_footprint(product_name: str, category: str, details: str = "", region: str = "Global", lifestyle: str = "General") -> dict:
    """Use AI to analyze carbon footprint using GHG Protocol standards with caching"""
    
    # Check cache first
    cache_key = f"{product_name.lower()}_{category.lower()}_{details.lower()[:50]}"
    if cache_key in analysis_cache:
        logger.info(f"Using cached analysis for {product_name}")
        return analysis_cache[cache_key]


    prompt = f"""You are EcoCalc AI — an Environmental Impact Scientist and Wisdom Consultant.
    Your mission is to provide DEEP ENVIRONMENTAL INSIGHTS, carbon data, and GENUINE WISDOM for whatever subject is presented.
    
    CRITICAL INSTRUCTIONS:
    - BEYOND PRODUCTS: If the subject is a scene, activity, or land-type, analyze its environmental role (e.g., carbon sink potential, biodiversity value, or indirect climate contribution).
    - SCIENTIFIC LENS: Use GHG Protocol for footprints, but use Ecological Science for "random things" (e.g., Albedo effects, particulate matter, soil health).
    - ACTIONABLE WISDOM: Don't just give suggestions - provide environmental perspectives that empower the user's worldview.
    - MATH PRECISION: Always show a calculation, even if it's an estimation based on a scene's scale.

    STEP 1 — Object Identification: Identify the exact item/activity.
    STEP 2 — Unit Conversion: Convert to kilograms, kWh, km, or passenger-kms.
    STEP 3 — Factor Mapping: Cite the specific database source (e.g., "DEFRA 2023 Factor: 0.17kg/km").
    STEP 4 — Calculation: Show the formula and the final result.
    STEP 5 — Better Alternative: Provide a real, shoppable, or actionable alternative with its estimated % reduction.

    Response Format (STRICT):
    CARBON: [Numeric value only in kg CO2e, e.g., 12.45]
    BREAKDOWN: Manufacturing [X]% | Transport [Y]% | Usage [Z]% | Disposal [W]%
    ECO_SCORE: [0-100 rating]
    ALTERNATIVES: [Alternative 1] | [Alternative 2] | [Alternative 3]
    IMPACT:
    1. Detected Item: [Exact name]
    2. Assumptions: [Weight/Distance/Usage assumed]
    3. Data Source: [Specific standard/year cited]
    4. Why it emits: [Scientific explanation]
    5. Better Choice: [Genuine product/service]
    6. Expected Saving: [Calculation for the alternative]
    7. Carbon Saved: [% reduction]

    DETAILED_MATH: [Equation used: e.g., (150km * 0.12kg/km) = 18kg CO2e]

    TASK: Analyze carbon for: Product: {product_name}, Category: {category}, Details: {details}.
    """

    try:
        # Robust model selection: prioritized for efficiency and speed
        # Gemini 2.0 Flash is currently the fastest and most efficient for these tasks
        success = False
        last_err = ""
        model_names = [
            'gemini-2.0-flash',           # Primary: High efficiency
            'gemini-flash-latest',        # Reliable alias
            'models/gemini-2.0-flash',    # Explicit path
            'models/gemini-flash-latest', # Explicit path
            'gemini-pro-latest'           # High-accuracy fallback
        ]
        
        for model_name in model_names:
            try:
                model = genai.GenerativeModel(model_name)
                
                # Internal retry logic for 429s specifically
                for attempt in range(2):
                    try:
                        response = await asyncio.to_thread(model.generate_content, prompt)
                        response_text = response.text
                        success = True
                        break
                    except Exception as e:
                        if "429" in str(e) and attempt == 0:
                            logger.warning(f"429 hit for {model_name}. Retrying in 2 seconds...")
                            await asyncio.sleep(2)
                            continue
                        raise e
                
                if success:
                    # Check for markdown blocks
                    if "```" in response_text:
                        response_text = re.sub(r'```[a-zA-Z]*\n?', '', response_text).strip()
                    logger.info(f"Success with model: {model_name}")
                    break
            except Exception as e:
                # ... rest of except logic ...
                last_err = str(e)
                if "429" in last_err:
                    # If we still get a 429 after retry, wait then fail fast or try fallback
                    logger.error(f"Quota exhausted for {model_name} after retry.")
                    # Don't try other models if it's a 429 - usually means account-wide limit
                    raise e
                if "404" in last_err or "unsupported" in last_err.lower():
                    logger.warning(f"Model {model_name} failed: {last_err}")
                    continue
                else:
                    raise e
        
        if not success:
            # Final attempt: list models and try the first one that supports generateContent
            try:
                available = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
                if available:
                    logger.info(f"Trying first available model: {available[0]}")
                    model = genai.GenerativeModel(available[0])
                    response = await asyncio.to_thread(model.generate_content, prompt)
                    response_text = response.text
                    if "```" in response_text:
                        response_text = re.sub(r'```[a-zA-Z]*\n?', '', response_text).strip()
                    success = True
            except:
                pass
                
        if not success:
            raise Exception(f"All analysis models failed. Last attempted: {model_names[-1]}. Error: {last_err}")
            
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Gemini Analysis Error: {err_msg}")
        
        # We no longer raise HTTPException(429) here because it breaks the 'Save Log' workflow.
        # Instead, we'll return a robust fallback and log the issue.
        # Robust fallback for all cases
        response_text = f"""
PRODUCT: {product_name}
CATEGORY: {category}
DETAILS: Estimated environmental baseline for {product_name} in {region}.
CARBON: 0.0
BREAKDOWN: Manufacturing 50% | Transport 25% | Usage 20% | Disposal 5%
ECO_SCORE: 50
ALTERNATIVES: Sustainable Version | Minimalist Choice | Reuse Existing
IMPACT:
1. Detected Item: {product_name} (Estimated)
2. Assumptions: Standard industry averages for {category} category.
3. Data Source: Generic Lifecycle Assessment (LCA) database.
4. Why it emits: Energy-intensive production and global logistics.
5. Better Choice: Opt for locally sourced or recycled alternatives.
6. Expected Saving: 0.2 kg CO2 per lifecycle.
7. Carbon Saved: 0.05 kg CO2 (Estimated)
DETAILED_MATH: [Baseline Emission (0.0 kg) based on generic {category} profile]
"""

    # Parse response
    logger.info(f"Carbon Analysis Response: {response_text}")
    
    result = {
        'carbon_footprint': 0.0,
        'eco_score': 50,
        'alternatives': [],
        'impact': '',
        'impact_details': [],
        'breakdown': {},
        'calculation': ''
    }

    
    # Helper to extract section content
    def extract_section(name, text):
        pattern = rf"{name}:\s*(.*?)(?=\n[A-Z_]+:|$)"
        match = re.search(pattern, text, re.S | re.I)
        return match.group(1).strip() if match else ""

    # Carbon
    carbon_str = extract_section("CARBON", response_text)
    try:
        result['carbon_footprint'] = float(re.search(r'[\d\.]+', carbon_str).group())
    except:
        result['carbon_footprint'] = 1.0

    # Eco Score
    score_str = extract_section("ECO_SCORE", response_text)
    try:
        result['eco_score'] = int(re.search(r'\d+', score_str).group())
    except:
        result['eco_score'] = 50

    # Breakdown
    breakdown_str = extract_section("BREAKDOWN", response_text)
    if breakdown_str:
        try:
            parts = breakdown_str.split('|')
            for part in parts:
                subparts = part.strip().split()
                if len(subparts) >= 2:
                    label = subparts[0]
                    value = re.search(r'\d+', subparts[1])
                    if value:
                        result['breakdown'][label] = float(value.group())
        except:
            pass

    # Alternatives
    alts_str = extract_section("ALTERNATIVES", response_text)
    if alts_str:
        # Split by | or newline or bullet points
        alts = [a.strip('- ').strip() for a in re.split(r'[|\n]', alts_str) if a.strip()]
        result['alternatives'] = [a for a in alts if a and len(a) > 2]

    # Impact
    impact_text = extract_section("IMPACT", response_text)
    result['impact'] = impact_text
    
    # Parse impact details into list of {title, content}
    try:
        # Split by "N. Label:"
        points = re.split(r'(\d+\.\s+[^:]+:)', impact_text)
        details = []
        if len(points) > 1:
            for i in range(1, len(points), 2):
                title = points[i].strip()
                # Remove number from title if needed, but let's keep it for now
                content = points[i+1].strip() if i+1 < len(points) else ""
                if title and content:
                    details.append({"title": title, "content": content})
        result['impact_details'] = details
        
        # Map specific fields for easy access
        field_map = {
            "detected_item": ["detected item", "item"],
            "assumptions": ["assumptions"],
            "data_source": ["data source", "source"],
            "why_it_emits": ["why it emits", "emissions rationale"],
            "better_choice": ["better choice", "alternative"],
            "expected_saving": ["expected saving", "savings"],
            "carbon_saved": ["carbon saved", "reduction"]
        }
        
        for detail in details:
            title_low = detail['title'].lower()
            for field, keywords in field_map.items():
                if any(k in title_low for k in keywords):
                    result[field] = detail['content']
                    break
    except Exception as parse_err:
        logger.error(f"Impact details parsing failed: {parse_err}")
        result['impact_details'] = []
    # DETAILED_MATH
    result['calculation'] = extract_section("DETAILED_MATH", response_text)

    # ONLY SAVE TO CACHE IF SUCCESSFUL
    if success:
        logger.info(f"Caching successful analysis for {product_name}")
        analysis_cache[cache_key] = result
    else:
        logger.warning(f"Not caching fallback analysis for {product_name}")
    
    return result

async def analyze_image_unified(image_base64: str, region: str = "Global", lifestyle: str = "General") -> dict:
    """Simplified Vision & Carbon Analysis in a single API call to save quota and time"""
    prompt = f"""You are EcoCalc AI Unified — an Environmental Scientist and Vision Expert.
    
    CRITICAL CAPABILITY: Analyze the image and provide identification + carbon data in ONE go.
    
    INSTRUCTIONS:
    - BEYOND PRODUCTS: If the image is a scene, land-type, or activity, analyze its environmental role.
    - MATH PRECISION: Always show a calculation (Activity x Factor).
    - REGIONAL SENSITIVITY: Consider electricity grid intensity for {region}.

    Return your response in this exact format (STRICT):
    PRODUCT: [Identified Subject]
    CATEGORY: [electronics, clothing, food, home, vehicle, beauty, sports, books, or 'other']
    DETAILS: [Scientific description]
    CARBON: [Numeric value in kg CO2e]
    BREAKDOWN: Manufacturing [X]% | Transport [Y]% | Usage [Z]% | Disposal [W]%
    ECO_SCORE: [0-100 rating]
    ALTERNATIVES: [Insight 1] | [Insight 2] | [Insight 3]
    IMPACT:
    1. Key Observation: [Impact summary]
    2. Deep Insight: [Scientific fact about this specific item]
    3. Sustainable Shift: [A specific behavioral improvement]
    
    DETAILED_MATH: [(Weight/Usage * Emission Factor) = result]
    """

    try:
        success = False
        last_err = ""
        image_data = base64.b64decode(image_base64)
        model_names = [
            'gemini-2.0-flash', 
            'gemini-flash-latest', 
            'models/gemini-2.0-flash', 
            'models/gemini-flash-latest'
        ]
        
        for model_name in model_names:
            try:
                model = genai.GenerativeModel(model_name)
                response = await asyncio.to_thread(
                    model.generate_content,
                    [prompt, {'mime_type': 'image/jpeg', 'data': image_data}]
                )
                response_text = response.text
                if "```" in response_text:
                    response_text = re.sub(r'```[a-zA-Z]*\n?', '', response_text).strip()
                success = True
                break
            except Exception as e:
                last_err = str(e)
                if "404" in last_err or "unsupported" in last_err.lower(): 
                    continue
                # If we get a 429, we still try next model just in case, 
                # but if all fail we'll handle it in the outer block
                logger.warning(f"Model {model_name} failed: {last_err}")
                continue
        
        if not success:
            raise Exception(f"Analysis failed. {last_err}")
            
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Unified analysis failed: {err_msg}")
        
        if "429" in err_msg:
            logger.warning("Vision AI Quota Exceeded. Using fallback.")
            fallback_impact = "Vision AI Service Busy. Using generic environmental impact estimation. (Error 429)"
        else:
            fallback_impact = f"Analysis failed: {err_msg[:50]}"
            
        # Fallback for all errors
        response_text = f"PRODUCT: Unknown | CATEGORY: other | DETAILS: {fallback_impact} | CARBON: 1.0 | BREAKDOWN: Unknown 100% | ECO_SCORE: 50 | ALTERNATIVES: Alt 1 | IMPACT: 1. Error: {fallback_impact} | DETAILED_MATH: N/A"

    # Parse response (using existing robust logic)
    def extract_section(name, text):
        pattern = rf"{name}:\s*(.*?)(?=\n[A-Z_]+:|$)"
        match = re.search(pattern, text, re.S | re.I)
        return match.group(1).strip() if match else ""

    result = {
        'product_name': extract_section("PRODUCT", response_text) or 'Unknown',
        'category': extract_section("CATEGORY", response_text).lower() or 'other',
        'details': extract_section("DETAILS", response_text),
        'carbon_footprint': 1.0,
        'eco_score': 50,
        'alternatives': [],
        'impact': extract_section("IMPACT", response_text),
        'breakdown': {},
        'calculation': extract_section("DETAILED_MATH", response_text)
    }

    # Fix category
    if result['category'] not in ['electronics', 'clothing', 'food', 'home', 'vehicle', 'beauty', 'sports', 'books', 'other']:
        result['category'] = 'other'

    # Fix Carbon
    try: result['carbon_footprint'] = float(re.search(r'[\d\.]+', extract_section("CARBON", response_text)).group())
    except: pass

    # Fix Eco Score
    try: result['eco_score'] = int(re.search(r'\d+', extract_section("ECO_SCORE", response_text)).group())
    except: pass

    # Alternatives
    alts_str = extract_section("ALTERNATIVES", response_text)
    if alts_str: result['alternatives'] = [a.strip() for a in re.split(r'[|\n]', alts_str) if a.strip()]

    # Map individual impact fields for vision as well
    try:
        points = re.split(r'(\d+\.\s+[^:]+:)', result['impact'])
        details = []
        if len(points) > 1:
            for i in range(1, len(points), 2):
                title = points[i].strip()
                content = points[i+1].strip() if i+1 < len(points) else ""
                if title and content:
                    details.append({"title": title, "content": content})
        result['impact_details'] = details
        
        field_map = {
            "detected_item": ["detected item", "item"],
            "assumptions": ["assumptions"],
            "data_source": ["data source", "source"],
            "why_it_emits": ["why it emits", "emissions rationale"],
            "better_choice": ["better choice", "alternative"],
            "expected_saving": ["expected saving", "savings"],
            "carbon_saved": ["carbon saved", "reduction"]
        }
        
        for detail in details:
            title_low = detail['title'].lower()
            for field, keywords in field_map.items():
                if any(k in title_low for k in keywords):
                    result[field] = detail['content']
                    break
    except:
        result['impact_details'] = []

    return result

async def analyze_image(image_base64: str) -> dict:
    """Use AI vision to analyze ANY image with hyper-efficiency"""
    prompt = """You are EcoCalc AI Vision — an advanced Omni-Scanner for environmental impacts.
    
    CRITICAL CAPABILITY: You can analyze ANY image. Whether it's a specific product, a wide landscape, a person, or a complex indoor scene, you must extract environmental meaning.
    
    INSTRUCTIONS:
    - If the image is a PRODUCT: Identify its materials, estimated weight, and lifecycle impact.
    - If the image is a SCENE (Landscape/City): Identify environmental health (vibrant nature vs urban smog), carbon sequestration potential (trees/plants), or urban footprint (cars/buildings).
    - If the image is a PERSON/ACTIVITY: Identify the context (e.g., traveling, eating, working) and its associated footprint.
    - NEVER say "I don't know". Provide an 'Environmental Perspective' based on visual cues.
    
    Structure your identification:
    1. Subject/Activity: [Specific identification]
    2. Category: [electronics, clothing, food, home, vehicle, beauty, sports, books, or 'other']
    3. Key details: [Identify materials, energy indicators, or environmental context]
    4. Three eco-friendly specific alternatives or behavioral improvements
    
    Return your response in this exact format:
    PRODUCT: [Identified Subject]
    CATEGORY: [Category]
    DETAILS: [Detailed description for carbon analysis]
    ALTERNATIVES: [alt1] | [alt2] | [alt3]
    """

    try:
        success = False
        last_err = ""
        image_data = base64.b64decode(image_base64)
        model_names = [
            'gemini-2.0-flash',           # Fast & reliable vision
            'gemini-flash-latest',        # Modern alias
            'models/gemini-2.0-flash',
            'models/gemini-flash-latest'
        ]
        
        for model_name in model_names:
            try:
                model = genai.GenerativeModel(model_name)
                response = await asyncio.to_thread(
                    model.generate_content,
                    [prompt, {'mime_type': 'image/jpeg', 'data': image_data}]
                )
                response_text = response.text
                if "```" in response_text:
                    response_text = re.sub(r'```[a-zA-Z]*\n?', '', response_text).strip()
                success = True
                logger.info(f"Success with vision model: {model_name}")
                break
            except Exception as e:
                last_err = str(e)
                if "404" in last_err:
                    logger.warning(f"Vision model {model_name} failed: {last_err}")
                    continue
                else:
                    raise e
                    
        if not success:
            # Final attempt: list models and try the first one that supports generateContent
            try:
                available = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
                for am in available:
                    try:
                        model = genai.GenerativeModel(am)
                        response = await asyncio.to_thread(
                            model.generate_content,
                            [prompt, {'mime_type': 'image/jpeg', 'data': image_data}]
                        )
                        response_text = response.text
                        if "```" in response_text:
                            response_text = re.sub(r'```[a-zA-Z]*\n?', '', response_text).strip()
                        success = True
                        logger.info(f"Success with discovered vision model: {am}")
                        break
                    except:
                        continue
            except:
                pass

        if not success:
            raise Exception(f"All vision models failed. Last attempted: {model_names[-1]}. Error: {last_err}")
            
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Gemini image analysis failed: {err_msg}")
        if "429" in err_msg:
            err_msg = "Quota exceeded (429). Gemini API is rate-limiting this request."
            
        # Fallback values if API fails
        response_text = f"PRODUCT: Unknown Image | CATEGORY: other | DETAILS: Analysis failed: {err_msg[:100]} | ALTERNATIVES: Eco Choice 1 | Eco Choice 2"

    # Parse response
    logger.info(f"AI Image Analysis Response: {response_text}")
    print(f"DEBUG: AI Image Analysis Response: {response_text}")

    result = {
        'product_name': 'Unknown Product',
        'category': 'electronics',
        'details': '',
        'alternatives': []
    }

    import re
    
    def extract_section(name, text):
        pattern = rf"{name}:\s*(.*?)(?=\n[A-Z_]+:|$)"
        match = re.search(pattern, text, re.S | re.I)
        return match.group(1).strip() if match else ""

    result['product_name'] = extract_section("PRODUCT", response_text) or 'Unknown Product'
    
    cat = extract_section("CATEGORY", response_text).lower()
    valid_cats = ['electronics', 'clothing', 'food', 'home', 'vehicle', 'beauty', 'sports', 'books', 'other']
    if cat in valid_cats:
        result['category'] = cat
    else:
        # Fallback mapping
        if 'car' in cat or 'bike' in cat: result['category'] = 'vehicle'
        elif 'wear' in cat: result['category'] = 'clothing'
        elif 'plant' in cat or 'tree' in cat: result['category'] = 'home'
        else: result['category'] = 'other'

    result['details'] = extract_section("DETAILS", response_text)
    
    alts_str = extract_section("ALTERNATIVES", response_text)
    if alts_str:
        alts = [a.strip('- ').strip() for a in re.split(r'[|\n]', alts_str) if a.strip()]
        result['alternatives'] = [a for a in alts if a and len(a) > 2]

    return result

async def lookup_upcitemdb(barcode: str) -> Optional[dict]:
    """Look up product details using UPCitemdb Trial API"""
    url = "https://api.upcitemdb.com/prod/trial/lookup"
    params = {'upc': barcode}
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 'OK' and data.get('items'):
                    item = data['items'][0]
                    return {
                        "product_name": item.get('title'),
                        "brand": item.get('brand'),
                        "category": item.get('category') or item.get('type'),
                        "details": item.get('description', '')
                    }
            elif response.status_code == 429:
                logger.warning("UPCitemdb Rate Limit Exceeded (429)")
    except Exception as e:
        logger.error(f"UPCitemdb lookup error: {e}")
    
    return None

def extract_json(text: str) -> Optional[dict]:
    """Robust JSON extraction from LLM response"""
    try:
        # First try to find a JSON block between curly braces
        match = re.search(r'(\{.*\})', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        # Fallback to direct load
        return json.loads(text)
    except Exception:
        return None

async def resolve_barcode_info(barcode: str) -> dict:
    """Robust Hybrid Resolve: Database first, then Aggressive AI identification"""
    
    # 1. Try Database Lookup (UPCitemdb)
    db_info = await lookup_upcitemdb(barcode)
    
    if db_info and db_info.get('product_name'):
        logger.info(f"Barcode {barcode} found in database: {db_info['product_name']}")
        
        prompt = f"""Identify exactly one category for: {db_info['product_name']} ({db_info['brand']}).
        App Categories: [electronics, clothing, food, home, vehicle, beauty, sports, books, other].
        
        Return ONLY JSON:
        {{
          "product_name": "{db_info['product_name']}",
          "brand": "{db_info['brand']}",
          "category": "chosen_category",
          "details": "1-sentence summary"
        }}
        """
        
        try:
            model = genai.GenerativeModel('gemini-2.0-flash')
            response = await asyncio.to_thread(model.generate_content, prompt)
            data = extract_json(response.text)
            if data:
                valid_cats = ['electronics', 'clothing', 'food', 'home', 'vehicle', 'beauty', 'sports', 'books', 'other']
                if data.get('category') not in valid_cats: data['category'] = 'other'
                return data
        except Exception:
            pass # Fall through to raw data if AI fails
            
        return {
            "product_name": db_info['product_name'],
            "brand": db_info['brand'] or "",
            "category": "other",
            "details": db_info['details'][:100] if db_info['details'] else ""
        }

    # 2. Fallback: Aggressive AI Lookup
    logger.info(f"Barcode {barcode} not in DB. Using aggressive AI identification.")
    prompt = f"""You are an expert product identifier. Identify the product for barcode: {barcode}.
    
    Even if you are not 100% sure, provide your BEST GUESS based on the barcode number prefixes and internal knowledge.
    
    Return EXACTLY this JSON format:
    {{
      "product_name": "Product Name",
      "brand": "Brand Name",
      "category": "one of: electronics, clothing, food, home, vehicle, beauty, sports, books, other",
      "details": "1-sentence description"
    }}
    
    If absolutely impossible to determine, use the barcode as the product name.
    """

    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(model.generate_content, prompt)
        data = extract_json(response.text)
        if data:
            valid_cats = ['electronics', 'clothing', 'food', 'home', 'vehicle', 'beauty', 'sports', 'books', 'other']
            if data.get('category') not in valid_cats: data['category'] = 'other'
            return data
    except Exception as e:
        logger.error(f"AI identification failed: {e}")
        
    return {
        "product_name": f"Product {barcode}",
        "brand": "",
        "category": "other",
        "details": f"Scan for {barcode}"
    }

# Routes
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({'email': user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = user_data.model_dump()
    password = user_dict.pop('password')
    hashed_password = hash_password(password)
    
    user = User(**user_dict)
    doc = user.model_dump()
    doc['password'] = hashed_password  # Add hashed password to document
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    token = create_token(user.id)
    return {'token': token, 'user': user}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({'email': credentials.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_doc.pop('_id', None)
    user_doc.pop('password', None)
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**user_doc)
    token = create_token(user.id)
    return {'token': token, 'user': user}

@api_router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/profile")
async def update_profile(updates: dict, current_user: User = Depends(get_current_user)):
    allowed_fields = ['name', 'region', 'lifestyle_type', 'sustainability_goals']
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    await db.users.update_one({'id': current_user.id}, {'$set': update_data})
    return {'message': 'Profile updated successfully'}

@api_router.post("/products/log", response_model=ProductLog)
async def create_product_log(log_data: ProductLogCreate, current_user: User = Depends(get_current_user)):
    # Create product log
    log_dict = log_data.model_dump()
    log_dict['user_id'] = current_user.id
    
    # Map frontend field names to backend model field names if they differ
    # We do this BEFORE checking has_analysis to ensure we recognize pre-calculated data
    if 'alternatives' in log_dict and log_dict['alternatives'] is not None:
        log_dict['recommendations'] = log_dict.pop('alternatives')
    if 'impact' in log_dict and log_dict['impact'] is not None:
        log_dict['environmental_impact'] = log_dict.pop('impact')
    if 'breakdown' in log_dict and log_dict['breakdown'] is not None:
        log_dict['carbon_breakdown'] = log_dict.pop('breakdown')
    
    # Check if we already have the analysis results from the frontend to ensure 1:1 consistency
    has_analysis = all(log_dict.get(k) is not None for k in ['carbon_footprint', 'eco_score', 'environmental_impact'])
    
    if not has_analysis:
        # Analyze carbon footprint only if not already provided
        analysis = await analyze_carbon_footprint(
            log_data.product_name,
            log_data.category,
            log_data.product_details or "",
            region=current_user.region,
            lifestyle=current_user.lifestyle_type
        )
        
        log_dict['carbon_footprint'] = analysis['carbon_footprint']
        log_dict['eco_score'] = analysis['eco_score']
        log_dict['recommendations'] = analysis['alternatives']
        log_dict['environmental_impact'] = analysis['impact']
        log_dict['carbon_breakdown'] = analysis['breakdown']
        log_dict['impact_details'] = analysis.get('impact_details', [])
        log_dict['detected_item'] = analysis.get('detected_item')
        log_dict['assumptions'] = analysis.get('assumptions')
        log_dict['data_source'] = analysis.get('data_source')
        log_dict['why_it_emits'] = analysis.get('why_it_emits')
        log_dict['better_choice'] = analysis.get('better_choice')
        log_dict['expected_saving'] = analysis.get('expected_saving')
        log_dict['carbon_saved'] = analysis.get('carbon_saved')
        log_dict['calculation'] = analysis.get('calculation')

    # Ensure metadata passed from frontend is preserved if already present (e.g. calculation, impact_details)
    # This specifically addresses the 'Save' consistency issue
    if 'calculation' not in log_dict or not log_dict['calculation']:
        # Fallback to calculation from request if not already set by internal analysis
        pass 

    product_log = ProductLog(**log_dict)
    doc = product_log.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.product_logs.insert_one(doc)
    return product_log

@api_router.delete("/products/log/{log_id}")
async def delete_product_log(log_id: str, current_user: User = Depends(get_current_user)):
    # Find and delete specific log for this user
    result = await db.product_logs.delete_one({
        'id': log_id,
        'user_id': current_user.id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found or unauthorized")
        
    return {"message": "Log deleted successfully"}

@api_router.get("/products/logs", response_model=List[ProductLog])
async def get_product_logs(current_user: User = Depends(get_current_user)):
    logs = await db.product_logs.find(
        {'user_id': current_user.id},
        {'_id': 0}
    ).sort('created_at', -1).to_list(100)
    
    for log in logs:
        if isinstance(log['created_at'], str):
            log['created_at'] = datetime.fromisoformat(log['created_at'])
    
    return logs

@api_router.post("/analysis/carbon")
async def analyze_carbon(request: CarbonAnalysisRequest, current_user: User = Depends(get_current_user)):
    analysis = await analyze_carbon_footprint(
        request.product_name,
        request.category,
        request.product_details or "",
        region=current_user.region,
        lifestyle=current_user.lifestyle_type
    )
    return analysis

@api_router.post("/analysis/photo")
async def analyze_photo(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    # Read and encode image
    contents = await file.read()
    image_base64 = base64.b64encode(contents).decode('utf-8')
    
    # Perform Unified Analysis in ONE call to save quota
    analysis = await analyze_image_unified(
        image_base64,
        region=current_user.region,
        lifestyle=current_user.lifestyle_type
    )
    
    return analysis

@api_router.get("/analysis/barcode/{barcode}")
async def analyze_barcode(barcode: str, current_user: User = Depends(get_current_user)):
    info = await resolve_barcode_info(barcode)
    if not info.get('product_name'):
        raise HTTPException(status_code=404, detail="Product not identified from barcode")
    return info

@api_router.post("/analysis/photo-path")
async def analyze_photo_path(data: dict, current_user: User = Depends(get_current_user)):
    file_path = data.get('file_path')
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Photo file not found")
        
    try:
        with open(file_path, "rb") as image_file:
            image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
            
        analysis = await analyze_image_unified(
            image_base64,
            region=current_user.region,
            lifestyle=current_user.lifestyle_type
        )
        return analysis
    except Exception as e:
        logger.error(f"Failed to analyze photo path: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/analysis/photo-base64")
async def analyze_photo_base64(data: dict, current_user: User = Depends(get_current_user)):
    image_base64 = data.get('image_data')
    if not image_base64:
        raise HTTPException(status_code=400, detail="Image data missing")
        
    analysis = await analyze_image_unified(
        image_base64,
        region=current_user.region,
        lifestyle=current_user.lifestyle_type
    )
    return analysis

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    # Get all logs
    logs = await db.product_logs.find(
        {'user_id': current_user.id},
        {'_id': 0}
    ).to_list(1000)
    
    for log in logs:
        if isinstance(log['created_at'], str):
            log['created_at'] = datetime.fromisoformat(log['created_at'])
    
    # Calculate stats
    total_logs = len(logs)
    total_carbon = sum(log.get('carbon_footprint', 0) for log in logs)
    avg_eco_score = sum(log.get('eco_score', 0) for log in logs) / total_logs if total_logs > 0 else 0
    
    # Calculate real carbon saved by summing up the numeric parts of carbon_saved fields
    total_carbon_saved = 0
    for log in logs:
        saved_text = log.get('carbon_saved')
        if saved_text:
            try:
                # Try to extract number from "0.2 kg CO2"
                match = re.search(r'[\d\.]+', str(saved_text))
                if match:
                    total_carbon_saved += float(match.group())
            except:
                pass
    
    # If no specific savings recorded, use the 30% estimate as a minimum baseline of conscious effort
    if total_carbon_saved == 0:
        total_carbon_saved = total_carbon * 0.3
    
    # Recent logs
    recent_logs = [ProductLog(**log) for log in logs[:10]]
    
    # Category distribution
    categories = {}
    for log in logs:
        cat = log.get('category', 'other')
        categories[cat] = categories.get(cat, 0) + log.get('carbon_footprint', 0)
    
    category_distribution = [
        {'name': cat.capitalize(), 'value': round(val, 2)}
        for cat, val in categories.items()
    ]
    
    # Savings history (Cumulative)
    sorted_logs = sorted(logs, key=lambda x: x['created_at'])
    savings_history = []
    cumulative_saved = 0
    
    # Group by date to keep the chart clean
    daily_savings = {}
    for log in sorted_logs:
        date_str = log['created_at'].strftime('%Y-%m-%d')
        saved_val = 0
        saved_text = log.get('carbon_saved')
        if saved_text:
            match = re.search(r'[\d\.]+', str(saved_text))
            if match:
                saved_val = float(match.group())
        
        # If no specific saving, use the baseline 30% estimate logic to show "potential effort"
        if saved_val == 0:
            saved_val = log.get('carbon_footprint', 0) * 0.3
            
        daily_savings[date_str] = daily_savings.get(date_str, 0) + saved_val

    for date in sorted(daily_savings.keys()):
        cumulative_saved += daily_savings[date]
        savings_history.append({
            'date': date,
            'saved': round(cumulative_saved, 2)
        })

    # Carbon trend (last 7 entries)
    carbon_trend = [
        {
            'date': log['created_at'].strftime('%Y-%m-%d') if isinstance(log['created_at'], datetime) else str(log['created_at'])[:10],
            'carbon': log.get('carbon_footprint', 0)
        }
        for log in logs[:7]
    ]
    
    return {
        'total_logs': total_logs,
        'total_carbon_saved': round(total_carbon_saved, 2),
        'eco_score': int(avg_eco_score),
        'recent_logs': recent_logs,
        'carbon_trend': carbon_trend,
        'category_distribution': category_distribution,
        'savings_history': savings_history
    }

@api_router.post("/mobile/init")
async def init_mobile_session():
    session_id = str(uuid.uuid4())
    session_doc = {
        "session_id": session_id,
        "status": "waiting",
        "image_data": None,
        "barcode_data": None,
        "last_update": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc)
    }
    await db.mobile_sessions.insert_one(session_doc)
    return {"session_id": session_id}

@api_router.post("/mobile/barcode/{session_id}")
async def submit_mobile_barcode(session_id: str, data: dict):
    # Support both 'barcode' and direct dict
    barcode = data.get('barcode', data.get('barcode_data'))
    
    result = await db.mobile_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "barcode_data": barcode,
            "last_update": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "success"}

@api_router.post("/mobile/upload/{session_id}")
async def upload_mobile_photo(session_id: str, file: UploadFile = File(...)):
    contents = await file.read()
    image_base64 = base64.b64encode(contents).decode('utf-8')
    
    result = await db.mobile_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "image_data": image_base64,
            "barcode_data": None,
            "last_update": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "success"}

@api_router.get("/mobile/status/{session_id}")
async def get_mobile_status(session_id: str):
    session = await db.mobile_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Standardize result for frontend
    if "created_at" in session and isinstance(session["created_at"], datetime):
        session["created_at"] = session["created_at"].isoformat()
        
    return session

# Include router
app.include_router(api_router)


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend is running"}

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
