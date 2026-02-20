import asyncio
import base64
import logging
import os
import tempfile
import uuid
import re
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
load_dotenv(ROOT_DIR / '.env')

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductLogCreate(BaseModel):
    log_type: str
    category: str
    product_name: str
    product_details: Optional[str] = None
    barcode: Optional[str] = None

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
    """Use AI to analyze carbon footprint using GHG Protocol standards"""

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
            'gemini-1.5-flash',           # Extremely reliable fallback
            'gemini-2.0-flash',           # Primary: High efficiency, speed & reasoning
            'gemini-1.5-pro',            # High-accuracy fallback
            'models/gemini-1.5-flash',
            'models/gemini-2.0-flash',
            'gemini-2.0-flash-exp'
        ]
        
        for model_name in model_names:
            try:
                model = genai.GenerativeModel(model_name)
                response = await asyncio.to_thread(model.generate_content, prompt)
                response_text = response.text
                
                # Check for markdown blocks
                if "```" in response_text:
                    response_text = re.sub(r'```[a-zA-Z]*\n?', '', response_text).strip()
                
                success = True
                logger.info(f"Success with model: {model_name}")
                break
            except Exception as e:
                last_err = str(e)
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
        if "429" in err_msg:
            err_msg = "Quota exceeded (429). Please wait a minute or use a different API key."
        
        # Dynamic fallback
        response_text = f"CARBON: 1.5\nBREAKDOWN: Manufacturing 60% | Transport 20% | Usage 10% | Disposal 10%\nECO_SCORE: 50\nALTERNATIVES: Alternative for {product_name} | Eco Choice 2\nIMPACT: Analysis temporarily unavailable. {err_msg[:100]}"

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
    except:
        result['impact_details'] = []
    # DETAILED_MATH
    result['calculation'] = extract_section("DETAILED_MATH", response_text)

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
        model_names = ['gemini-1.5-flash', 'gemini-2.0-flash', 'models/gemini-1.5-flash']
        
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
                if "404" in last_err: continue
                if "429" in last_err: break
                raise e
        
        if not success:
            raise Exception(f"Analysis failed. {last_err}")
            
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Unified analysis failed: {err_msg}")
        # Fallback
        response_text = f"PRODUCT: Unknown | CATEGORY: other | DETAILS: {err_msg[:50]} | CARBON: 1.0 | BREAKDOWN: Unknown 100% | ECO_SCORE: 50 | ALTERNATIVES: Alt 1 | IMPACT: 1. Error: {err_msg[:50]} | DETAILED_MATH: N/A"

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
            'gemini-1.5-flash',           # Fast & reliable vision
            'gemini-2.0-flash',           # Omni-capable vision
            'gemini-1.5-pro',            # Complex detail fallback
            'models/gemini-1.5-flash',
            'models/gemini-2.0-flash',
            'gemini-2.0-flash-exp'
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
    
    # Analyze carbon footprint
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
    
    # Carbon saved estimate (assuming eco-conscious choices reduce 30% of footprint)
    total_carbon_saved = total_carbon * 0.3
    
    # Recent logs
    recent_logs = [ProductLog(**log) for log in logs[:5]]
    
    # Carbon trend (last 7 entries)
    carbon_trend = [
        {
            'date': log['created_at'].strftime('%Y-%m-%d') if isinstance(log['created_at'], datetime) else log['created_at'][:10],
            'carbon': log.get('carbon_footprint', 0)
        }
        for log in logs[:7]
    ]
    
    return {
        'total_logs': total_logs,
        'total_carbon_saved': round(total_carbon_saved, 2),
        'eco_score': int(avg_eco_score),
        'recent_logs': recent_logs,
        'carbon_trend': carbon_trend
    }

# Temporary storage for mobile upload sessions (in-memory)
upload_sessions = {}

class MobileUploadInit(BaseModel):
    pass

@api_router.post("/mobile/init")
async def init_mobile_session():
    session_id = str(uuid.uuid4())
    upload_sessions[session_id] = {"status": "waiting", "image_data": None, "barcode_data": None}
    return {"session_id": session_id}

@api_router.post("/mobile/barcode/{session_id}")
async def submit_mobile_barcode(session_id: str, request: dict):
    if session_id not in upload_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    upload_sessions[session_id] = {
        "status": "completed", 
        "barcode_data": request.get('barcode'),
        "image_data": None
    }
    return {"message": "Barcode submitted successfully"}

@api_router.post("/mobile/upload/{session_id}")
async def upload_mobile_photo(session_id: str, file: UploadFile = File(...)):
    if session_id not in upload_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    contents = await file.read()
    image_base64 = base64.b64encode(contents).decode('utf-8')
    
    upload_sessions[session_id] = {
        "status": "completed", 
        "image_data": image_base64,
        "barcode_data": None
    }
    return {"message": "Upload successful"}

@api_router.get("/mobile/status/{session_id}")
async def get_mobile_session_status(session_id: str):
    if session_id not in upload_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return upload_sessions[session_id]

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
