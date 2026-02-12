from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType, ImageContent
import base64
import tempfile

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

# Create the main app
app = FastAPI()
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

async def analyze_carbon_footprint(product_name: str, category: str, details: str = "") -> dict:
    """Use AI to analyze carbon footprint"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    system_message = """You are an expert in carbon footprint analysis and environmental sustainability. 
    Analyze products and provide:
    1. Estimated carbon footprint in kg CO2
    2. Eco score (0-100, where 100 is most eco-friendly)
    3. Three specific eco-friendly alternatives
    4. Brief explanation of environmental impact
    
    Return your response in this exact format:
    CARBON: [number]
    ECO_SCORE: [number]
    ALTERNATIVES: [alt1] | [alt2] | [alt3]
    IMPACT: [brief explanation]
    """
    
    chat = LlmChat(
        api_key=api_key,
        session_id=f"carbon_{uuid.uuid4()}",
        system_message=system_message
    ).with_model("openai", "gpt-4o-mini")
    
    user_message = UserMessage(
        text=f"Analyze carbon footprint for: Category: {category}, Product: {product_name}, Details: {details}"
    )
    
    response = await chat.send_message(user_message)
    
    # Parse response
    lines = response.strip().split('\n')
    result = {
        'carbon_footprint': 0.0,
        'eco_score': 50,
        'alternatives': [],
        'impact': ''
    }
    
    for line in lines:
        if line.startswith('CARBON:'):
            try:
                result['carbon_footprint'] = float(line.split(':')[1].strip())
            except:
                result['carbon_footprint'] = 10.0
        elif line.startswith('ECO_SCORE:'):
            try:
                result['eco_score'] = int(line.split(':')[1].strip())
            except:
                result['eco_score'] = 50
        elif line.startswith('ALTERNATIVES:'):
            alts = line.split(':')[1].strip().split('|')
            result['alternatives'] = [alt.strip() for alt in alts]
        elif line.startswith('IMPACT:'):
            result['impact'] = line.split(':')[1].strip()
    
    return result

async def analyze_image(image_base64: str) -> dict:
    """Use AI vision to analyze product image"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    system_message = """You are an expert in product identification. 
    Analyze the image and identify:
    1. Product name
    2. Product category (product or vehicle)
    3. Key details about the product
    
    Return your response in this exact format:
    PRODUCT: [product name]
    CATEGORY: [product or vehicle]
    DETAILS: [key details]
    """
    
    chat = LlmChat(
        api_key=api_key,
        session_id=f"vision_{uuid.uuid4()}",
        system_message=system_message
    ).with_model("openai", "gpt-4o-mini")
    
    image_content = ImageContent(image_base64=image_base64)
    
    user_message = UserMessage(
        text="Identify this product and provide details.",
        file_contents=[image_content]
    )
    
    response = await chat.send_message(user_message)
    
    # Parse response
    lines = response.strip().split('\n')
    result = {
        'product_name': 'Unknown Product',
        'category': 'product',
        'details': ''
    }
    
    for line in lines:
        if line.startswith('PRODUCT:'):
            result['product_name'] = line.split(':')[1].strip()
        elif line.startswith('CATEGORY:'):
            cat = line.split(':')[1].strip().lower()
            if 'vehicle' in cat:
                result['category'] = 'vehicle'
            else:
                result['category'] = 'product'
        elif line.startswith('DETAILS:'):
            result['details'] = line.split(':')[1].strip()
    
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
        log_data.product_details or ""
    )
    
    log_dict['carbon_footprint'] = analysis['carbon_footprint']
    log_dict['eco_score'] = analysis['eco_score']
    log_dict['recommendations'] = analysis['alternatives']
    
    product_log = ProductLog(**log_dict)
    doc = product_log.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.product_logs.insert_one(doc)
    return product_log

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
        request.product_details or ""
    )
    return analysis

@api_router.post("/analysis/photo")
async def analyze_photo(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    # Read and encode image
    contents = await file.read()
    image_base64 = base64.b64encode(contents).decode('utf-8')
    
    # Analyze image
    result = await analyze_image(image_base64)
    
    # Get carbon analysis
    carbon_analysis = await analyze_carbon_footprint(
        result['product_name'],
        result['category'],
        result['details']
    )
    
    return {
        **result,
        **carbon_analysis
    }

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

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
