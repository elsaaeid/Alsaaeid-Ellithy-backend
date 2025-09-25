const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { Product } = require('../models/projectModel');
const { Project } = require('../models/projectModel');
const { Developer } = require('../models/developerModel');
const { detectLanguage } = require('./translatorController'); // Import detectLanguage function
const { translateText } = require('./translatorController'); // Import translation function
const { isCompanyQuery, ownershipQueryRegex } = require('./regexCompany');
const { isContactQuery } = require('./regexContacts');
const { isListDevelopersQuery } = require('./regexDevelopers');
const { isListProductsQuery, isFeaturedProductsQuery } = require('./regexProducts');
const { isListProjectsQuery, isFeaturedProjectsQuery } = require('./regexProjects');
const { invalidKeywords } = require('./invalidKeywords');
const { locationAvailabilityRegex } = require('./regexLocationAvailability');
const { priceRegex } = require('./regexPricing');

let User = null;
try {
  const userMod = require('../models/userModel');
  User = userMod.User || userMod.default || userMod;
} catch (e) {
  console.warn('User model not found; user resolution disabled.');
}
let CompanyInfoModel = null;
try {
  const ci = require('../models/companyInfoModel');
  CompanyInfoModel = ci.default || ci;
} catch (e) {
  console.warn('CompanyInfo model not found; company context will be minimal.');
}

// --- Env validation ---
if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY environment variable.');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS environment variable.');

// --- Load Google credentials ---
const credentialsPathOrContent = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let credentials;
if (fs.existsSync(credentialsPathOrContent)) {
  credentials = JSON.parse(fs.readFileSync(credentialsPathOrContent, 'utf8'));
} else {
  try {
    credentials = JSON.parse(credentialsPathOrContent);
  } catch (err) {
    console.error('Invalid GOOGLE_APPLICATION_CREDENTIALS content:', err);
    throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS content.');
  }
}

// --- Clients ---
const ttsClient = new TextToSpeechClient({ credentials });
let fetchFunc = null;
const getFetch = async () => {
  if (!fetchFunc) {
    const { default: fetchImported } = await import('node-fetch');
    fetchFunc = fetchImported;
  }
  return fetchFunc;
};
let openai = null;
const getOpenAI = async () => {
  if (!openai) {
    const fetch = await getFetch();
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      fetch,
    });
  }
  return openai;
};

// Helper function to check if message contains invalid keywords
const containsInvalidKeywords = (message) => {
  if (!message || typeof message !== 'string') return false;

  const lowerMessage = message.toLowerCase();
  for (const keyword of invalidKeywords) {
    if (lowerMessage.includes(keyword)) {
      return true;
    }
  }
  return false;
};


// --- In-memory conversation name memory ---
// --- Regex for user name queries (define once at top scope) ---
const nameQueryRegex = /\b(?:what(?:'|’)?s my name|do you know my name|what is my name)\b/i;
const sessionNames = new Map(); // conversationId -> user name

// --- Constants / Helpers ---
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DEFAULT_DEVELOPER_AVATAR = 'https://i.ibb.co/4pDNDk1/avatar.png';
const DEFAULT_PROduct_IMAGE = 'https://via.placeholder.com/100';
const DEFAULT_PROJECT_IMAGE = 'https://via.placeholder.com/100';

const PROduct_FIELDS = ['name', 'name_ar', 'name_de', 'name_fr', 'name_zh'];
const PROJECT_FIELDS = ['name', 'name_ar', 'name_de', 'name_fr', 'name_zh'];
const DEVELOPER_FIELDS = ['developerName', 'developerName_ar', 'developerName_de', 'developerName_fr', 'developerName_zh'];
const USER_FIELDS = ['name', 'email'];

const STOPWORDS = new Set([
  'write', 'link', 'of', 'the', 'for', 'give', 'me', 'product',
  'project', 'developer', 'please', 'show', 'url', 'what', 'is',
  'my', 'in', 'to', 'and', 'a', 'an', 'on', 'about', 'any', 'you',
  'could', 'would', 'like', 'here', 'there',
]);


const detectIntent = (message) => {
  const lower = message.toLowerCase();
  const hasProduct = /\bproducts?\b/.test(lower);
  const hasProject = /\bprojects?\b/.test(lower);
  const hasDeveloper = /\bdevelopers?\b/.test(lower);
  const wantsProduct = hasProduct && !hasProject && !hasDeveloper;
  const wantsProject = hasProject && !hasProduct && !hasDeveloper;
  const wantsDeveloper = hasDeveloper && !hasProduct && !hasProject;
  const ambiguous =
    (!hasProduct && !hasProject && !hasDeveloper) ||
    (hasProduct && hasProject) ||
    (hasDeveloper && (hasProduct || hasProject));
  return { wantsProduct, wantsProject, wantsDeveloper, ambiguous };
};

const summarizeEntity = (entity, type) => {
  if (!entity) return '';
  switch (type) {
    case 'product': {
      const parts = [];
      if (entity.name) parts.push(`Name: ${entity.name}`);
      if (entity.description) parts.push(`Description: ${entity.description.substring(0, 120)}${entity.description.length > 120 ? '...' : ''}`);
      if (entity.liveDemo) parts.push(`Location: ${entity.liveDemo}`);
      if (entity.status) parts.push(`Status: ${entity.status}`);
      if (entity.itemType) parts.push(`Type: ${entity.itemType}`);
      if (entity.price) parts.push(`Price: ${entity.price}`);
      if (entity.beds !== undefined) parts.push(`Bedrooms: ${entity.beds}`);
      if (entity.baths !== undefined) parts.push(`Bathrooms: ${entity.baths}`);
      return `Product details: ${parts.join(' | ')}.`;
    }
    case 'project': {
      const parts = [];
      if (entity.name) parts.push(`Name: ${entity.name}`);
      if (entity.liveDemo) parts.push(`Location: ${entity.liveDemo}`);
      if (entity.status) parts.push(`Status: ${entity.status}`);
      if (entity.description) parts.push(`Description: ${entity.description.substring(0, 120)}${entity.description.length > 120 ? '...' : ''}`);
      return `Project details: ${parts.join(' | ')}.`;
    }
    case 'developer': {
      const parts = [];
      if (entity.developerName) parts.push(`Name: ${entity.developerName}`);
      if (entity.description) parts.push(`Description: ${entity.description.substring(0, 120)}${entity.description.length > 120 ? '...' : ''}`);
      return `Developer details: ${parts.join(' | ')}.`;
    }
    case 'user': {
      const parts = [];
      if (entity.name) parts.push(`Name: ${entity.name}`);
      if (entity.email) parts.push(`Email: ${entity.email}`);
      if (entity.role) parts.push(`Role: ${entity.role}`);
      return `User details: ${parts.join(' | ')}.`;
    }
    default:
      return '';
  }
};

// --- Input Validation Helpers ---
const validateMessageLength = (message, maxLength = 1000) => {
  if (!message || typeof message !== 'string') {
    throw new Error('Message must be a non-empty string');
  }
  if (message.trim().length > maxLength) {
    throw new Error(`Message too long. Maximum length is ${maxLength} characters`);
  }
  return message.trim();
};

const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return input;
  // Remove potentially harmful content
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

// Preprocessing function for user input normalization and spell correction
const preprocessUserInput = async (message) => {
  if (!message || typeof message !== 'string') return message;

  // Validate message length
  validateMessageLength(message);

  // Check for invalid keywords
  if (containsInvalidKeywords(message)) {
    throw new Error('Message contains invalid keywords');
  }

  // Sanitize input to remove potentially harmful content
  let processed = sanitizeInput(message.trim());

  // Basic normalization
  processed = processed.toLowerCase();

  // Remove extra whitespace
  processed = processed.replace(/\s+/g, ' ');

  // Basic spell correction using common patterns
  const corrections = {
    'products': 'products',
    'propertie': 'product',
    'developr': 'developer',
    'developrs': 'developers',
    'projct': 'project',
    'projcts': 'projects',
    'dubaii': 'dubai',
    'duba': 'dubai',
    'pioneers': 'pioneers',
    'properti': 'product',
    'developement': 'development',
    'developement': 'development',
    'realestate': 'real estate',
    'real-estate': 'real estate',
    'apartmnt': 'apartment',
    'apartmnts': 'apartments',
    'vila': 'villa',
    'vilas': 'villas',
    'luxry': 'luxury',
    'luxry': 'luxury',
    'wat': 'what',
    'wer': 'where',
    'wen': 'when',
    'how': 'how',
    'wich': 'which',
    'thier': 'their',
    'ther': 'there',
    'teh': 'the',
    'adn': 'and',
    'fo': 'for',
    'frm': 'from',
    'abt': 'about',
    'pls': 'please',
    'thx': 'thanks',
    'u': 'you',
    'r': 'are',
    '2': 'to',
    '4': 'for',
    'b4': 'before',
    'c': 'see',
    'y': 'why',
    'hv': 'have',
    'wud': 'would',
    'cud': 'could',
    'shud': 'should',
    'dnt': 'do not',
    'cnt': 'cannot',
    'wont': 'will not',
    'cant': 'cannot',
    'im': 'i am',
    'ive': 'i have',
    'id': 'i would',
    'ill': 'i will',
    'theyre': 'they are',
    'youre': 'you are',
    'were': 'we are',
    'thats': 'that is',
    'its': 'it is',
    'isnt': 'is not',
    'arent': 'are not',
    'werent': 'were not',
    'dont': 'do not',
    'doesnt': 'does not',
    'didnt': 'did not',
    'havent': 'have not',
    'hasnt': 'has not',
    'hadnt': 'had not',
    'wont': 'will not',
    'wouldnt': 'would not',
    'couldnt': 'could not',
    'shouldnt': 'should not',
    'mightnt': 'might not',
    'mustnt': 'must not',
  };

  for (const [incorrect, correct] of Object.entries(corrections)) {
    processed = processed.replace(new RegExp(`\\b${incorrect}\\b`, 'g'), correct);
  }

  return processed;
};


const findOneFuzzy = async (Model, keyVal, fields) => {
  if (!Model || typeof Model.findOne !== 'function' || !keyVal) return null;
  const clean = keyVal.trim();
  if (!clean) return null;
  const exactRegex = new RegExp(`^${escapeRegExp(clean)}$`, 'i');
  const partialRegex = new RegExp(escapeRegExp(clean), 'i');

  let orClause = fields.map((f) => ({ [f]: exactRegex }));
  let doc = await Model.findOne({ $or: orClause });
  if (doc) return doc;

  orClause = fields.map((f) => ({ [f]: { $regex: partialRegex } }));
  doc = await Model.findOne({ $or: orClause });
  if (doc) return doc;

  const firstToken = clean.split(/\s+/)[0];
  if (firstToken && firstToken.length >= 2) {
    const tokenRegex = new RegExp(escapeRegExp(firstToken), 'i');
    orClause = fields.map((f) => ({ [f]: { $regex: tokenRegex } }));
    doc = await Model.findOne({ $or: orClause });
    if (doc) return doc;
  }

  return null;
};

// Company info
let cachedCompanyInfo = null;
const loadCompanyInfo = async () => {
  if (cachedCompanyInfo) return cachedCompanyInfo;
  if (!CompanyInfoModel || typeof CompanyInfoModel.find !== 'function') return [];
  const all = await CompanyInfoModel.find({}).lean();
  cachedCompanyInfo = all;
  return all;
};
const retrieveRelevantCompanyInfo = async (message, maxSections = 3) => {
  const allInfo = await loadCompanyInfo();
  if (!allInfo.length) return [];
  const lower = message.toLowerCase();
  const tokens = Array.from(new Set((lower.match(/\b\w+\b/g) || [])));
  const scored = allInfo.map((section) => {
    let score = 0;
    (section.tags || []).forEach((tag) => {
      if (lower.includes(String(tag).toLowerCase())) score += 3;
    });
    const contentText = ((section.content && section.content.en) || '').toLowerCase();
    tokens.forEach((tok) => {
      if (contentText.includes(tok)) score += 1;
    });
    return { section, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter((s) => s.score > 0).slice(0, maxSections);
  if (!relevant.length && scored.length) relevant.push(scored[0]);
  return relevant.map((r) => `${r.section.title}: ${r.section.content?.en || ''}`);
};

// Sample fetchers
const fetchSampleProducts = async (limit = 4) => {
  if (!Product || typeof Product.find !== 'function') return [];
  let samples = await Product.find({ isFeatured: true }).limit(limit).select('name _id description image').lean();
  if (!samples.length) {
    samples = await Product.find({}).limit(limit).select('name _id description image').lean();
  }
  return samples;
};
const fetchSampleProjects = async (limit = 4) => {
  if (!Project || typeof Project.find !== 'function') return [];
  let samples = await Project.find({ isFeatured: true }).limit(limit).select('name _id description image').lean();
  if (!samples.length) {
    samples = await Project.find({}).limit(limit).select('name _id description image').lean();
  }
  return samples;
};

// Normalizers
const normalizeDeveloper = (d) => {
  if (!d) return null;
  // Prefer image.filePath (Cloudinary), fallback to photo, then other image fields, then default
  let imageUrl = null;
  if (d.image && typeof d.image === 'object') {
    imageUrl =
      d.image.filePath ||
      d.image.url ||
      d.image.secure_url ||
      null;
  }
  if (!imageUrl && typeof d.photo === 'string' && d.photo) {
    imageUrl = d.photo;
  }
  if (!imageUrl) {
    imageUrl = DEFAULT_DEVELOPER_AVATAR;
  }
  return {
    id: d._id?.toString?.() || null,
    name: d.developerName || 'Unnamed',
    image: imageUrl,
    url: d._id ? `https://alsaaeid-ellithy.vercel.app/developer/${d._id}` : null,
    description: d.description || '',
  };
};
const normalizeProduct = (p) => {
  if (!p) return null;
  const imageUrl =
    (p.image && (p.image.filePath || p.image.url || p.image.secure_url)) ||
    DEFAULT_PROduct_IMAGE;
  return {
    id: p._id?.toString?.() || null,
    name: p.name || 'Unnamed product',
    image: imageUrl,
    url: p._id ? `https://alsaaeid-ellithy.vercel.app/product/${p._id}` : null,
    description: p.description || '',
  };
};
const normalizeProject = (p) => {
  if (!p) return null;
  const imageUrl =
    (p.image && (p.image.filePath || p.image.url || p.image.secure_url)) ||
    DEFAULT_PROJECT_IMAGE;
  return {
    id: p._id?.toString?.() || null,
    name: p.name || 'Unnamed project',
    image: imageUrl,
    url: p._id ? `https://alsaaeid-ellithy.vercel.app/project/${p._id}` : null,
    description: p.description || '',
  };
};

// Entity resolution (fuzzy)
const resolveEntities = async (message, intent) => {
  let product = null;
  let project = null;
  let developer = null;
  let user = null;
  const suggestions = [];

  const productMatch = message.match(/product\s*(?:name)?:\s*([^\n,?.!]+)/i);
  if (productMatch) {
    product = await findOneFuzzy(Product, productMatch[1], PROduct_FIELDS);
  }

  const projectMatch = message.match(/project\s*(?:name)?:\s*([^\n,?.!]+)/i);
  if (projectMatch) {
    project = await findOneFuzzy(Project, projectMatch[1], PROJECT_FIELDS);
  }

  const developerMatch = message.match(/developer\s*(?:name)?:\s*([^\n,?.!]+)/i);
  if (developerMatch) {
    developer = await findOneFuzzy(Developer, developerMatch[1], DEVELOPER_FIELDS);
  }

  if (User) {
    const userMatch = message.match(/user\s*(?:name)?:\s*([^\n,?.!]+)/i);
    if (userMatch) {
      user = await findOneFuzzy(User, userMatch[1], USER_FIELDS);
    }
  }

  const tokens = message
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t && !STOPWORDS.has(t) && t.length >= 3);
  const phrase = tokens.join(' ');

  if (!product && (intent.wantsProduct || intent.ambiguous)) {
    product = await findOneFuzzy(Product, phrase, PROduct_FIELDS);
  }
  if (!project && (intent.wantsProject || intent.ambiguous)) {
    project = await findOneFuzzy(Project, phrase, PROJECT_FIELDS);
  }
  if (!developer && (intent.wantsDeveloper || intent.ambiguous)) {
    developer = await findOneFuzzy(Developer, phrase, DEVELOPER_FIELDS);
  }

  console.log('resolveEntities debug:', {
    message,
    productId: product?._id,
    projectId: project?._id,
    developerId: developer?._id,
    userId: user?._id,
    suggestions,
    intent,
  });

  return { product, project, developer, user, suggestions };
};

// Build structured links (for backward compatibility)
const buildStructuredLinks = ({ product, user }) => {
  const links = [];
  if (product && product._id) {
    links.push({
      type: 'product',
      label: product.name || 'Product',
      url: `https://alsaaeid-ellithy.vercel.app/product/${product._id}`,
    });
  }
  if (user && user._id) {
    links.push({
      type: 'user',
      label: user.name || 'User Profile',
      url: '#',
    });
  }
  return links;
};

// Core logic
// Accepts history (array of {role, message}) for context
const handleMessage = async (message, conversationId, options = { includeTranslations: false, userLanguage: 'en', history: [] }) => {
  const trimmed = message.trim();
  // Accept history from options (for context)
  const history = options.history || [];
  if (!trimmed) {
    return {
      aiResponse: "I'm sorry, but your message seems incomplete. Could you please clarify your question about products, projects, or developers?",
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

    // Preprocess user input
  const processedMessage = await preprocessUserInput(message);

  // Detect the language of the user's message using detectLanguage
  const detectedLanguage = await detectLanguage(trimmed);
  options.userLanguage = detectedLanguage || options.userLanguage; // Update userLanguage if detected

  // Translate the input message to English for intent recognition
  let translatedMessage = trimmed;
  if (detectedLanguage !== 'en') {
    translatedMessage = await translateText(trimmed, 'en');
  }

  // Build context (moved after translatedMessage is defined)
  const companySections = await retrieveRelevantCompanyInfo(message);
  const companyContext = companySections.length
    ? `Company information:\n${companySections.join('\n')}\n`
    : 'Company information: Alsaaeid Ellithy portfolio that specializes in designing and developing, and selling software products.';
  // Company-related queries
  if (isCompanyQuery(translatedMessage)) {
    if (isContactQuery(translatedMessage)) {
      // Provide detailed contact information in user's language
      let contactInfoResponse = '';
      switch (options.userLanguage) {
        case 'ar':
          contactInfoResponse = `يمكنك الاتصال بنا عبر الهاتف أو الواتساب على الرقم: +01028496209\nأو عبر البريد الإلكتروني: elsaeidellithy@gmail.com`;
          break;
        default:
          contactInfoResponse = `You can contact us by phone or WhatsApp at +01028496209.\nOr by email: elsaeidellithy@gmail.com`;
      }
      return {
        aiResponse: contactInfoResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
        userLanguage: options.userLanguage,
      };
    }
    if (ownershipQueryRegex.test(translatedMessage)) {
      // Provide ownership information in user's language
      let ownershipInfo = `Alsaaeid Ellithy portfolio that specializes in designing and developing, and selling software products. Founded and owned by Al-Saaeid Ellithy.`;

      // Translate ownership info to user's language if not English
      if (options.userLanguage !== 'en') {
        ownershipInfo = await translateText(ownershipInfo, options.userLanguage);
      }

      return {
        aiResponse: ownershipInfo,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
        userLanguage: options.userLanguage,
      };
    }
    return {
      aiResponse: `${companyContext}`,
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
      userLanguage: options.userLanguage,
    };
  }
  const openai = await getOpenAI();


  // Current time queries
  const timeQueryRegex = /\b(what(?:'|’)?s|tell me|show|whats|what is)?\s*(the )?(current )?(time|clock)\b/i;
  if (timeQueryRegex.test(translatedMessage)) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      timeZone: 'Africa/Mansoura',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return {
      aiResponse: `The current time is ${timeString} in Mansoura.`,
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  // Identity / name queries
  const botNameQueryRegex = /\b(?:what(?:'|’)?s your name|who are you|what are you called)\b/i;
  if (botNameQueryRegex.test(translatedMessage)) {
    return {
      aiResponse: 'I am Portfolio Agent. How can I assist you with the digital services?',
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  const nameDeclRegex = /\b(?:my name is|i am|i'm|name's)\s+(.+?)\b/i;
  const singleNameRegex = /^([A-Za-z\u00C0-\u017F]+(?:\s+[A-Za-z\u00C0-\u017F]+)?)$/;
  const storedName = conversationId ? sessionNames.get(conversationId) : null;

  const declMatch = message.match(nameDeclRegex);
  if (declMatch) {
    const name = declMatch[1].trim();
    if (conversationId) sessionNames.set(conversationId, name);
    return {
      aiResponse: `Nice to meet you, ${name}. How can I assist you with your inquiries?`,
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  if (!declMatch && singleNameRegex.test(trimmed) && !isListProductsQuery(trimmed) && !isListProjectsQuery(trimmed) && !isListDevelopersQuery(trimmed)) {
    const userMatch = message.match(/user\s*(?:name)?:\s*([^\n,?.!]+)/i);
    if (userMatch) {
      const name = userMatch[1].trim();
      if (conversationId) {
        sessionNames.set(conversationId, name);
      }
      return {
        aiResponse: `Nice to meet you, ${name}. How can I assist you with your inquiries today?`,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
      };
    }
  }
  if (nameQueryRegex.test(message)) {
    if (storedName) {
      return {
        aiResponse: `Your name is ${storedName}.`,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
      };
    }
    return {
      aiResponse: "I don't know your name yet. What should I call you?",
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  // Early list handlers
  let productList = [];

  if (isListProductsQuery(message)) {
    const products = await (Product && typeof Product.find === 'function'
      ? Product.find({}).limit(10).select('name _id image description').lean()
      : []);

    if (products.length) {
      productList = products.map(normalizeProduct).filter(Boolean);

      // Translate product names and descriptions if the user's language is not English
      if (options.userLanguage !== 'en') {
        for (let i = 0; i < productList.length; i++) {
          productList[i].name = await translateText(productList[i].name, options.userLanguage);
          productList[i].description = await translateText(productList[i].description, options.userLanguage);
        }
      }

      // Remove duplicates based on product name
      productList = productList.filter((prop, index, self) =>
        index === self.findIndex((p) => p.name === prop.name)
      );

      let namesSummary = productList.map((p, i) => `${i + 1}. ${p.name}`).join(', ');

      // Translate namesSummary if the user's language is not English
      if (options.userLanguage !== 'en') {
        namesSummary = await translateText(namesSummary, options.userLanguage);
      }

      let aiResponse;
      if (options.userLanguage === 'ar') {
        // Detailed Arabic response
        aiResponse = productList.map((p, i) => `${i + 1}. ${p.name}: ${p.description}`).join('\n');
      } else {
        // English response with detailed information
        aiResponse = `Available products include:\n` + productList.map((p, i) => `${i + 1}. ${p.name}: ${p.description}`).join('\n');
      }

      return {
        aiResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList,
        projectList: [],
      };
    } else {
      let aiResponse;
      if (options.userLanguage === 'ar') {
        aiResponse = "عذرًا، لا توجد تفاصيل عن العقارات في الوقت الحالي. يرجى الاتصال بنا للحصول على معلومات محدثة.";
      } else {
        aiResponse = "I'm sorry, but I don't have specific details about products at the moment. Please contact us directly for updated and accurate information.";
      }

      return {
        aiResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
      };
    }
  }

  if (isListProjectsQuery(message)) {
    const projects = await (Project && typeof Project.find === 'function'
      ? Project.find({}).limit(10).select('name _id image description').lean()
      : []);

    if (projects.length) {
      projectList = projects.map(normalizeProject).filter(Boolean);

      // Translate project names and descriptions if the user's language is not English
      if (options.userLanguage !== 'en') {
        for (let i = 0; i < projectList.length; i++) {
          projectList[i].name = await translateText(projectList[i].name, options.userLanguage);
          projectList[i].description = await translateText(projectList[i].description, options.userLanguage);
        }
      }

      // Remove duplicates based on project name
      projectList = projectList.filter((proj, index, self) =>
        index === self.findIndex((p) => p.name === proj.name)
      );

      let namesSummary = projectList.map((p, i) => `${i + 1}. ${p.name}`).join(', ');

      // Translate namesSummary if the user's language is not English
      if (options.userLanguage !== 'en') {
        namesSummary = await translateText(namesSummary, options.userLanguage);
      }

      let aiResponse;
      if (options.userLanguage === 'ar') {
        // Detailed Arabic response
        aiResponse = projectList.map((p, i) => `${i + 1}. ${p.name}: ${p.description}`).join('\n');
      } else {
        // English response with detailed information
        aiResponse = `Available projects include:\n` + projectList.map((p, i) => `${i + 1}. ${p.name}: ${p.description}`).join('\n');
      }

      return {
        aiResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList,
      };
    } else {
      let aiResponse;
      if (options.userLanguage === 'ar') {
        aiResponse = "عذرًا، لا توجد تفاصيل عن المشاريع في الوقت الحالي. يرجى الاتصال بنا للحصول على معلومات محدثة.";
      } else {
        aiResponse = "I'm sorry, but I don't have specific details about projects at the moment. Please contact us directly for updated and accurate information.";
      }

      return {
        aiResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
      };
    }
  }

  // Queries about the best projects, products, and developers in Dubai
  const bestQueryRegex = /\b(best|top|most popular)\s*(projects|products|developers)\s*(in Dubai|Dubai)?\b/i;
  const bestMatches = translatedMessage.match(bestQueryRegex);
  if (bestMatches) {
    const category = bestMatches[2].toLowerCase();
    let response = '';

    if (category === 'projects') {
      response = 'The best projects in Dubai include Dubai Marina, Downtown Dubai, and Palm Jumeirah. These areas are known for their luxury and high-quality developments.';
    } else if (category === 'products') {
      response = 'The best products in Dubai include luxury villas in Emirates Hills, apartments in Burj Khalifa, and waterfront products in Jumeirah Beach Residence.';
    } else if (category === 'developers') {
      response = 'The best developers in Dubai include Emaar Products, Nakheel, and DAMAC Products, known for their iconic and high-quality developments.';
    }

    return {
      aiResponse: response,
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  // Intent/entity resolution fallback
  const intent = detectIntent(message);
  let { product, project, developer, user, suggestions } = await resolveEntities(message, intent);

  // Enforce exclusive intent
  if (intent.wantsProduct && !intent.ambiguous) project = null;
  if (intent.wantsProject && !intent.ambiguous) product = null;
  if (intent.wantsDeveloper && !intent.ambiguous) {
    product = null;
    project = null;
  }

  // If a specific product is found, return only its details (skip AI answer)
  if (product && product._id) {
    const prop = normalizeProduct(product);
    return {
      aiResponse: null,
      translations: null,
      product: prop,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [prop],
      projectList: [],
    };
  }

  // If a specific project is found, return only its details (skip AI answer)
  if (project && project._id) {
    const proj = normalizeProject(project);
    return {
      aiResponse: null,
      translations: null,
      product: null,
      project: proj,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [proj],
    };
  }

  // If a specific developer is found, return only its details (skip AI answer)
  if (developer && developer._id) {
    const dev = normalizeDeveloper(developer);
    return {
      aiResponse: null,
      translations: null,
      product: null,
      project: null,
      developer: dev,
      user: null,
      developerList: [dev],
      productList: [],
      projectList: [],
    };
  }

  // If user asked for featured products/projects, show sample products/projects
  if ((isFeaturedProductsQuery(message) || intent.wantsProduct) && !product) {
    const samples = await fetchSampleProducts(3);
    productList = samples.map(normalizeProduct).filter(Boolean);
  }
  if ((isFeaturedProjectsQuery(message) || intent.wantsProject) && !project) {
    const samples = await fetchSampleProjects(3);
    projectList = samples.map(normalizeProject).filter(Boolean);
  }

  // Suggestions-only fallback
  if (suggestions.length > 0 && !product && !project && !developer && !user) {
    let reply = "I couldn't confidently resolve what you meant. Did you mean:\n";
    suggestions.forEach((s) => {
      reply += `- ${s.type} similar to \"${s.input}\": ${s.suggestions?.slice(0, 3).join(', ')}\n`;
    });
    return {
      aiResponse: reply.trim(),
      translations: null,
      product,
      project,
      developer,
      user,
      developerList,
      productList,
      projectList,
    };
  }

  // (removed duplicate declaration)
  const contextParts = [];
  // Only add user name to context if the user is explicitly asking for it
  if (storedName && nameQueryRegex.test(message)) {
    contextParts.push(`User name: ${storedName}.`);
  }
  if (product) contextParts.push(summarizeEntity(product, 'product'));
  if (project) contextParts.push(summarizeEntity(project, 'project'));
  if (developer) contextParts.push(summarizeEntity(developer, 'developer'));
  if (user) contextParts.push(summarizeEntity(user, 'user'));
  if (productList.length) {
    const names = productList.map((p) => p.name).filter(Boolean);
    contextParts.push(`Example available products: ${names.join(', ')}.`);
  }
  if (projectList.length) {
    const names = projectList.map((p) => p.name).filter(Boolean);
    contextParts.push(`Example available projects: ${names.join(', ')}.`);
  }
  if (developerList.length) {
    const names = developerList.map((d) => d.name).filter(Boolean);
    contextParts.push(`Example developers: ${names.join(', ')}.`);
  }
  const entityContext = contextParts.length
    ? contextParts.join(' ')
    : '';

  const linksArr = buildStructuredLinks({ product, project, developer, user });
  const linksText = linksArr.length ? linksArr.map(l => `${l.label}: ${l.url}`).join(' | ') : '';

  const wantsLocationAvailability = locationAvailabilityRegex(translatedMessage);
  const wantsPricing = priceRegex(message);
  const contactInfo = wantsPricing
    ? 'For pricing or payment details, you can share this contact: Mobile: +01028496209 (WhatsApp) | Email: elsaeidellithy@gmail.com'
    : '';

  // Add location availability info if requested
  let locationAvailabilityInfo = '';
  if (wantsLocationAvailability) {
    locationAvailabilityInfo = options.userLanguage === 'ar'
      ? 'يمكنك الاستفسار عن توافر العقارات والمشاريع في دبي من خلال الاتصال بنا على +01028496209 أو زيارة موقعنا pioneers-products.com.'
      : 'You can inquire about product and project availability in Dubai by contacting us at +01028496209 or visiting our website pioneers-products.com.';
  }

  // Ensure the database context is included in the system prompt for AI responses
  const fetchDatabaseContext = async () => {
    try {
      const products = await (Product && typeof Product.find === 'function'
        ? Product.find({})
            .populate('user', 'name email phone photo role bio')
            .sort({ createdAt: -1 })
            .select('name name_ar name_de name_fr name_zh description description_ar description_de description_fr description_zh price price_ar price_de price_fr price_zh beds baths area area_ar area_de area_fr area_zh itemType status isFeatured')
            .limit(5)
            .lean()
        : []);

      const projects = await (Project && typeof Project.find === 'function'
        ? Project.find({})
            .populate('user', 'name email phone photo role bio')
        .sort({ createdAt: -1 })
        .select('name name_ar name_de name_fr name_zh description description_ar description_de description_fr description_zh status isFeatured')
        .limit(5)
        .lean()
    : []);

      const developers = await (Developer && typeof Developer.find === 'function'
        ? Developer.find({})
            .populate('user', 'name email phone photo role bio')
            .sort({ createdAt: -1 })
            .select('developerName developerName_ar developerName_de developerName_fr developerName_zh description description_ar description_de description_fr description_zh isFeatured')
            .limit(5)
            .lean()
        : []);

      return { products, projects, developers };
    } catch (error) {
      console.error('Error fetching database context:', error);
      return { products: [], projects: [], developers: [] };
    }
  };

  const dbContext = await fetchDatabaseContext();

  const systemPrompt = `
  You are a friendly and professional real estate assistant for Pioneers Products in Dubai called "Pioneers Products Agent."

  IMPORTANT DATABASE CONTEXT:
  Here is the latest data directly fetched from our database:

  AVAILABLE PROducts:
  ${dbContext.products.length > 0
    ? dbContext.products.map(p => `
    - Name: ${p.name || 'N/A'} (${p.name_ar || ''}, ${p.name_de || ''}, ${p.name_fr || ''}, ${p.name_zh || ''})
    - Description: ${p.description ? p.description.substring(0, 100) + '...' : 'N/A'}
    `).join('')
    : "I'm sorry, I don't have the current database of available products at the moment."}

  AVAILABLE PROJECTS:
  ${dbContext.projects.length > 0
    ? dbContext.projects.map(p => `
    - Name: ${p.name || 'N/A'} (${p.name_ar || ''}, ${p.name_de || ''}, ${p.name_fr || ''}, ${p.name_zh || ''})
    - Description: ${p.description ? p.description.substring(0, 100) + '...' : 'N/A'}
    `).join('')
    : 'No projects currently available in database.'}

  AVAILABLE DEVELOPERS:
  ${dbContext.developers.length > 0
    ? dbContext.developers.map(d => `
    - Name: ${d.developerName || 'N/A'} (${d.developerName_ar || ''}, ${d.developerName_de || ''}, ${d.developerName_fr || ''}, ${d.developerName_zh || ''})
    - Description: ${d.description || 'N/A'}
    `).join('')
    : "I'm sorry, I don't have the specific developer information in my database at the moment."}

  CRITICAL INSTRUCTIONS:
  - For any question about products, projects, or developers, ALWAYS use the database context information provided above.
  - This context contains the actual latest data fetched directly from our Product, Project, and Developer database models.
  - Use these specific names, details, and descriptions directly in your answers.
  - If the context contains relevant results, ONLY use those results in your answer. Do NOT invent, guess, or supplement with information not present in the context.
  - If the context is empty or does not contain the requested information, politely inform the user that you do not have that information in your database, and suggest they contact Pioneers Products for more details.
  - Never fabricate product, project, or developer names, details, or statistics.
  - Always reference the actual data from the database context above.

  LANGUAGE SUPPORT:
  - You MUST respond in the same language as the user's query.
  - If the user asks in Arabic (عربي), respond in Arabic.
  - If the user asks in English, respond in English.
  - If the user asks in German, respond in German.
  - If the user asks in French, respond in French.
  - If the user asks in Chinese, respond in Chinese.
  - For partial or incomplete Arabic queries like "اكتب لي الع" (write to me the), understand this as a request for available products and respond accordingly in Arabic.
  - Always match the user's language and tone.

  ARABIC QUERY HANDLING:
  - Common Arabic product queries include: "اكتب لي العقارات المتاحة" (write to me the available products), "ما هي العقارات" (what are the products), "عرض العقارات" (show products)
  - If you detect Arabic keywords like: عقار, عقارات, شقة, شقق, فيلا, فلل, منزل, منازل, مشروع, مشاريع, مطور, مطورين - treat this as a product/project/developer query
  - For incomplete Arabic queries, infer the complete meaning and provide helpful responses

  When asked your name, reply exactly: "Pioneers Products Agent."
  When asked about greetings, respond with a friendly greeting.
  When asked about your mood, respond with a positive statement.
  When asked about current time, respond with the current time of the device.

  You should be able to answer a wide range of questions including:
  - General company and service questions (e.g., what is Pioneers Products, services offered, contact info, business hours)
  - Product related questions (e.g., available products, locations, features like bedrooms/bathrooms, luxury villas, apartments)
  - Project related questions (e.g., current projects, best projects in Dubai, project details, status, locations)
  - Developer related questions (e.g., partner developers, developer details, projects worked on, licensing)
  - Pricing and payment questions (e.g., payment plans, down payments, installments, fees)
  - Location and availability questions (e.g., product/project locations, availability, scheduling visits)
  - User identity and interaction questions (e.g., user's name, what you can do, language support)
  - Miscellaneous questions (e.g., current time in Dubai, summaries, links, how to get more info)

  SUMMARY:
  Always provide accurate, helpful, and context-aware responses. For any product, project, or developer question, ONLY use the database context provided above (from direct Product, Project, and Developer model queries). If no data is available, say so and suggest contacting Pioneers Products for more information. Always respond in the user's language.
  `.trim();



  // Helper: detect fallback/company info responses
  function isFallbackOrCompanyInfo(text) {
    if (!text) return false;
    const fallbackPhrases = [
      "I couldn't confidently resolve what you meant.",
      "I'm sorry, but I don't have specific details about",
      "Company information: Pioneers Products is a real estate agency in Dubai specializing in products, projects, and developers."
    ];
    return fallbackPhrases.some(phrase => text.startsWith(phrase));
  }

  // Filter out fallback/company info from history
  const filteredHistory = Array.isArray(history)
    ? history.filter(turn => !isFallbackOrCompanyInfo(turn.message))
    : [];

  // Build OpenAI chat history: system, then filtered history, then current user
  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...filteredHistory
      .map(turn => ({ role: turn.role, content: typeof turn.message === 'string' && turn.message.trim() !== '' ? turn.message : '...' }))
      .filter(msg => typeof msg.content === 'string' && msg.content.trim() !== ''),
    { role: 'user', content: typeof translatedMessage === 'string' && translatedMessage.trim() !== '' ? translatedMessage : '...' },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: openaiMessages,
    temperature: 0.5,
    max_tokens: 800,
  });

  let aiResponse = completion.choices?.[0]?.message?.content?.trim();
  if (!aiResponse) throw new Error('Failed to generate AI response');

  // Append entityContext, linksText, and contactInfo if present
  let extraInfo = '';
  if (entityContext) extraInfo += `\n${entityContext}`;
  if (linksText) extraInfo += `\nLinks: ${linksText}`;
  if (contactInfo) extraInfo += `\n${contactInfo}`;
  if (extraInfo) aiResponse += `\n${extraInfo}`;

  // Append location availability info to AI response
  if (locationAvailabilityInfo) {
    aiResponse += `\n${locationAvailabilityInfo}`;
  }

  // Translate the response back to the user's language if necessary
  if (options.userLanguage !== 'en') {
    aiResponse = await translateText(aiResponse, options.userLanguage);
  }

  return {
    aiResponse,
    translations: null,
    product: null,
    project: null,
    developer: null,
    user: null,
    developerList: [],
    productList: [],
    projectList: [],
  };
};

// Audio helpers
const generateAudio = async (text, userLang = 'en') => {
  try {
    // Map user language to Google TTS language codes
    const langMap = {
      en: 'en-US',
      ar: 'ar-XA',
      fr: 'fr-FR',
      de: 'de-DE',
      zh: 'cmn-CN',
    };
    const languageCode = langMap[userLang] || 'en-US';

    // Only translate if text is not already in the target language
    if (userLang !== 'en') {
      text = await translateText(text, userLang);
    }

    // Split text into chunks if it exceeds the 5000-byte limit
    const maxBytes = 5000;
    const textChunks = [];
    let currentChunk = '';

    for (const word of text.split(' ')) {
      if (Buffer.byteLength(currentChunk + word, 'utf-8') < maxBytes) {
        currentChunk += word + ' ';
      } else {
        textChunks.push(currentChunk.trim());
        currentChunk = word + ' ';
      }
    }
    if (currentChunk) textChunks.push(currentChunk.trim());

    // Generate audio for each chunk and combine results
    const audioContents = [];
    for (const chunk of textChunks) {
      const request = {
        input: { text: chunk },
        voice: { languageCode, ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3' },
      };
      const [response] = await ttsClient.synthesizeSpeech(request);
      audioContents.push(response.audioContent);
    }

    // Return combined audio content
    return Buffer.concat(audioContents.map((content) => Buffer.from(content, 'base64'))).toString('base64');
  } catch (err) {
    console.error('TTS error:', err);
    throw new Error('Failed to generate audio');
  }
};

const transcribeAudio = async (audioBuffer) => {
  try {
    // Use OS temp directory for serverless compatibility
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `temp_audio_${Date.now()}.wav`);
    await fs.promises.writeFile(tempPath, audioBuffer);
    const audioStream = fs.createReadStream(tempPath);
    const openaiClient = await getOpenAI();
    const transcription = await openaiClient.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      response_format: 'text',
    });
    await fs.promises.unlink(tempPath);
    if (typeof transcription === 'string') return transcription;
    if (transcription.text) return transcription.text;
    if (transcription?.data?.text) return transcription.data.text;
    return '';
  } catch (err) {
    console.error('Transcription error:', err);
    throw new Error('Failed to transcribe audio');
  }
};
// Endpoints
const addChat = async (req, res) => {
  try {
  const { message, conversationId, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let result;
    try {
  result = await handleMessage(message, conversationId, { includeTranslations: false, history });
    } catch (err) {
      console.error('handleMessage error:', err);
      return res.status(500).json({
        error: 'Failed to process message',
        details: err.message,
      });
    }

    const {
      aiResponse,
      product,
      project,
      developer,
      user,
      translations,
      developerList,
      productList,
      projectList,
    } = result || {};

    let links = [];
    try {
      links = buildStructuredLinks({ product, project, developer, user });
    } catch (err) {
      console.error('buildStructuredLinks error:', err);
      // links will be empty
    }

    const payload = {
      message: aiResponse || null,
      links,
      product: product ? normalizeProduct(product) : null,
      project: project ? normalizeProject(project) : null,
      developer: developer ? normalizeDeveloper(developer) : null,
      user: user ? normalizeUser(user) : null,
      developers: Array.isArray(developerList) ? developerList : [],
      products: Array.isArray(productList) ? productList : [],
      projects: Array.isArray(projectList) ? projectList : [],
      userLanguage: (result && result.options && result.options.userLanguage) || (result && result.userLanguage) || 'en',
    };
    if (translations) payload.translations = translations;
    res.json(payload);
  } catch (err) {
    console.error('addChat error:', err);
    res.status(500).json({
      error: 'An error occurred while processing your request',
      details: err.message,
    });
  }
};

const handleAudioMessage = async (message, conversationId, options = { includeTranslations: false, userLanguage: 'en', history: [] }) => {
  const trimmed = message.trim();
  // Accept history from options (for context)
  const history = options.history || [];
  if (!trimmed) {
    return {
      aiResponse: "I'm sorry, but your message seems incomplete. Could you please clarify your question about products, projects, or developers?",
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  // Detect the language of the user's message using detectLanguage
  const detectedLanguage = await detectLanguage(trimmed);
  options.userLanguage = detectedLanguage || options.userLanguage; // Update userLanguage if detected

  // Translate the input message to English for intent recognition
  let translatedMessage = trimmed;
  if (detectedLanguage !== 'en') {
    translatedMessage = await translateText(trimmed, 'en');
  }

  // Build context (moved after translatedMessage is defined)
  const companySections = await retrieveRelevantCompanyInfo(message);
  const companyContext = companySections.length
    ? `Company information:\n${companySections.join('\n')}\n`
    : 'Company information: Pioneers Products is a real estate agency in Dubai specializing in products, projects, and developers.';
  // Company-related queries
  const companyQueryRegex = /\b(company|about pioneers|about your company|about pioneers products|what do you do|who are you|what is your business|tell me about your company|tell me about pioneers|tell me about pioneers products|company info|company information|about you|about the company|what services do you offer|what do you offer|services|contact|address|location|where are you located|who owns pioneers|who is the owner|who is the ceo|founder|history|background)\b/i;
  if (companyQueryRegex.test(translatedMessage)) {
    return {
      aiResponse: `${companyContext}`,
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }
  const openai = await getOpenAI();


  // Current time queries
  const timeQueryRegex = /\b(what(?:'|’)?s|tell me|show|whats|what is)?\s*(the )?(current )?(time|clock)\b/i;
  if (timeQueryRegex.test(translatedMessage)) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Dubai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return {
      aiResponse: `The current time is ${timeString} in Dubai.`,
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  // Identity / name queries
  const botNameQueryRegex = /\b(?:what(?:'|’)?s your name|who are you|what are you called)\b/i;
  if (botNameQueryRegex.test(translatedMessage)) {
    return {
      aiResponse: 'I am Pioneers Products Agent. How can I assist you with your real estate inquiries today?',
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  const nameDeclRegex = /\b(?:my name is|i am|i'm|name's)\s+(.+?)\b/i;
  const singleNameRegex = /^([A-Za-z\u00C0-\u017F]+(?:\s+[A-Za-z\u00C0-\u017F]+)?)$/;
  const storedName = conversationId ? sessionNames.get(conversationId) : null;

  const declMatch = message.match(nameDeclRegex);
  if (declMatch) {
    const name = declMatch[1].trim();
    if (conversationId) sessionNames.set(conversationId, name);
    return {
      aiResponse: `Nice to meet you, ${name}. How can I assist you with your real estate inquiries today?`,
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  if (!declMatch && singleNameRegex.test(trimmed) && !isListProductsQuery(trimmed) && !isListProjectsQuery(trimmed) && !isListDevelopersQuery(trimmed)) {
    const userMatch = message.match(/user\s*(?:name)?:\s*([^\n,?.!]+)/i);
    if (userMatch) {
      const name = userMatch[1].trim();
      if (conversationId) {
        sessionNames.set(conversationId, name);
      }
      return {
        aiResponse: `Nice to meet you, ${name}. How can I assist you with your real estate inquiries today?`,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
      };
    }
  }

  if (nameQueryRegex.test(message)) {
    if (storedName) {
      return {
        aiResponse: `Your name is ${storedName}.`,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
      };
    }
    return {
      aiResponse: "I don't know your name yet. What should I call you?",
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  // Early list handlers
  let developerList = [];
  let productList = [];
  let projectList = [];

  if (isListDevelopersQuery(message)) {
    const developers = await (Developer && typeof Developer.find === 'function'
      ? Developer.find({}).limit(10).select('developerName _id photo image description').lean()
      : []);

    if (developers.length) {
      developerList = developers.map(normalizeDeveloper).filter(Boolean);

      // Translate developer names and descriptions if the user's language is not English
      if (options.userLanguage !== 'en') {
        for (let i = 0; i < developerList.length; i++) {
          developerList[i].name = await translateText(developerList[i].name, options.userLanguage);
          developerList[i].description = await translateText(developerList[i].description, options.userLanguage);
        }
      }

      // Remove duplicates based on developer name
      developerList = developerList.filter((dev, index, self) =>
        index === self.findIndex((d) => d.name === dev.name)
      );

      let namesSummary = developerList.map((d, i) => `${i + 1}. ${d.name}`).join(', ');

      // Translate namesSummary if the user's language is not English
      if (options.userLanguage !== 'en') {
        namesSummary = await translateText(namesSummary, options.userLanguage);
      }

      let aiResponse;
      if (options.userLanguage === 'ar') {
        // Detailed Arabic response
        aiResponse = developerList.map((d, i) => `${i + 1}. ${d.name}: ${d.description}`).join('\n');
      } else {
        // English response with detailed information
        aiResponse = `Our partner developers include:\n` + developerList.map((d, i) => `${i + 1}. ${d.name}: ${d.description}`).join('\n');
      }

      return {
        aiResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList,
        productList: [],
        projectList: [],
      };
    } else {
      let aiResponse;
      if (options.userLanguage === 'ar') {
        aiResponse = "عذرًا، لا توجد تفاصيل عن المطورين في الوقت الحالي. يرجى الاتصال بنا للحصول على معلومات محدثة.";
      } else {
        aiResponse = "I'm sorry, but I don't have specific details about developers at the moment. Please contact us directly for updated and accurate information.";
      }

      return {
        aiResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
      };
    }
  }

  if (isListProductsQuery(message)) {
    const products = await (Product && typeof Product.find === 'function'
      ? Product.find({}).limit(10).select('name _id image description').lean()
      : []);

    if (products.length) {
      productList = products.map(normalizeProduct).filter(Boolean);

      // Translate product names and descriptions if the user's language is not English
      if (options.userLanguage !== 'en') {
        for (let i = 0; i < productList.length; i++) {
          productList[i].name = await translateText(productList[i].name, options.userLanguage);
          productList[i].description = await translateText(productList[i].description, options.userLanguage);
        }
      }

      // Remove duplicates based on product name
      productList = productList.filter((prop, index, self) =>
        index === self.findIndex((p) => p.name === prop.name)
      );

      let namesSummary = productList.map((p, i) => `${i + 1}. ${p.name}`).join(', ');

      // Translate namesSummary if the user's language is not English
      if (options.userLanguage !== 'en') {
        namesSummary = await translateText(namesSummary, options.userLanguage);
      }

      let aiResponse;
      if (options.userLanguage === 'ar') {
        // Detailed Arabic response
        aiResponse = productList.map((p, i) => `${i + 1}. ${p.name}: ${p.description}`).join('\n');
      } else {
        // English response with detailed information
        aiResponse = `Available products include:\n` + productList.map((p, i) => `${i + 1}. ${p.name}: ${p.description}`).join('\n');
      }

      return {
        aiResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList,
        projectList: [],
      };
    } else {
      let aiResponse;
      if (options.userLanguage === 'ar') {
        aiResponse = "عذرًا، لا توجد تفاصيل عن العقارات في الوقت الحالي. يرجى الاتصال بنا للحصول على معلومات محدثة.";
      } else {
        aiResponse = "I'm sorry, but I don't have specific details about products at the moment. Please contact us directly for updated and accurate information.";
      }

      return {
        aiResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
      };
    }
  }

  if (isListProjectsQuery(message)) {
    const projects = await (Project && typeof Project.find === 'function'
      ? Project.find({}).limit(10).select('name _id image description').lean()
      : []);

    if (projects.length) {
      projectList = projects.map(normalizeProject).filter(Boolean);

      // Translate project names and descriptions if the user's language is not English
      if (options.userLanguage !== 'en') {
        for (let i = 0; i < projectList.length; i++) {
          projectList[i].name = await translateText(projectList[i].name, options.userLanguage);
          projectList[i].description = await translateText(projectList[i].description, options.userLanguage);
        }
      }

      // Remove duplicates based on project name
      projectList = projectList.filter((proj, index, self) =>
        index === self.findIndex((p) => p.name === proj.name)
      );

      let namesSummary = projectList.map((p, i) => `${i + 1}. ${p.name}`).join(', ');

      // Translate namesSummary if the user's language is not English
      if (options.userLanguage !== 'en') {
        namesSummary = await translateText(namesSummary, options.userLanguage);
      }

      let aiResponse;
      if (options.userLanguage === 'ar') {
        // Detailed Arabic response
        aiResponse = projectList.map((p, i) => `${i + 1}. ${p.name}: ${p.description}`).join('\n');
      } else {
        // English response with detailed information
        aiResponse = `Available projects include:\n` + projectList.map((p, i) => `${i + 1}. ${p.name}: ${p.description}`).join('\n');
      }

      return {
        aiResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList,
      };
    } else {
      let aiResponse;
      if (options.userLanguage === 'ar') {
        aiResponse = "عذرًا، لا توجد تفاصيل عن المشاريع في الوقت الحالي. يرجى الاتصال بنا للحصول على معلومات محدثة.";
      } else {
        aiResponse = "I'm sorry, but I don't have specific details about projects at the moment. Please contact us directly for updated and accurate information.";
      }

      return {
        aiResponse,
        translations: null,
        product: null,
        project: null,
        developer: null,
        user: null,
        developerList: [],
        productList: [],
        projectList: [],
      };
    }
  }

  // Queries about the best projects, products, and developers in Dubai
  const bestQueryRegex = /\b(best|top|most popular)\s*(projects|products|developers)\s*(in Dubai|Dubai)?\b/i;
  const bestMatches = translatedMessage.match(bestQueryRegex);
  if (bestMatches) {
    const category = bestMatches[2].toLowerCase();
    let response = '';

    if (category === 'projects') {
      response = 'The best projects in Dubai include Dubai Marina, Downtown Dubai, and Palm Jumeirah. These areas are known for their luxury and high-quality developments.';
    } else if (category === 'products') {
      response = 'The best products in Dubai include luxury villas in Emirates Hills, apartments in Burj Khalifa, and waterfront products in Jumeirah Beach Residence.';
    } else if (category === 'developers') {
      response = 'The best developers in Dubai include Emaar Products, Nakheel, and DAMAC Products, known for their iconic and high-quality developments.';
    }

    return {
      aiResponse: response,
      translations: null,
      product: null,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [],
    };
  }

  // Intent/entity resolution fallback
  const intent = detectIntent(message);
  let { product, project, developer, user, suggestions } = await resolveEntities(message, intent);

  // Enforce exclusive intent
  if (intent.wantsProduct && !intent.ambiguous) project = null;
  if (intent.wantsProject && !intent.ambiguous) product = null;
  if (intent.wantsDeveloper && !intent.ambiguous) {
    product = null;
    project = null;
  }

  // If a specific product is found, return only its details (skip AI answer)
  if (product && product._id) {
    const prop = normalizeProduct(product);
    return {
      aiResponse: null,
      translations: null,
      product: prop,
      project: null,
      developer: null,
      user: null,
      developerList: [],
      productList: [prop],
      projectList: [],
    };
  }

  // If a specific project is found, return only its details (skip AI answer)
  if (project && project._id) {
    const proj = normalizeProject(project);
    return {
      aiResponse: null,
      translations: null,
      product: null,
      project: proj,
      developer: null,
      user: null,
      developerList: [],
      productList: [],
      projectList: [proj],
    };
  }

  // If a specific developer is found, return only its details (skip AI answer)
  if (developer && developer._id) {
    const dev = normalizeDeveloper(developer);
    return {
      aiResponse: null,
      translations: null,
      product: null,
      project: null,
      developer: dev,
      user: null,
      developerList: [dev],
      productList: [],
      projectList: [],
    };
  }

  // If user asked for products/projects list, show sample products/projects
  if ((isListProductsQuery(message) || intent.wantsProduct) && !product) {
    const samples = await fetchSampleProducts(3);
    productList = samples.map(normalizeProduct).filter(Boolean);
  }
  if ((isListProjectsQuery(message) || intent.wantsProject) && !project) {
    const samples = await fetchSampleProjects(3);
    projectList = samples.map(normalizeProject).filter(Boolean);
  }

  // Suggestions-only fallback
  if (suggestions.length > 0 && !product && !project && !developer && !user) {
    let reply = "I couldn't confidently resolve what you meant. Did you mean:\n";
    suggestions.forEach((s) => {
      reply += `- ${s.type} similar to \"${s.input}\": ${s.suggestions?.slice(0, 3).join(', ')}\n`;
    });
    return {
      aiResponse: reply.trim(),
      translations: null,
      product,
      project,
      developer,
      user,
      developerList,
      productList,
      projectList,
    };
  }

  // (removed duplicate declaration)
  const contextParts = [];
  // Only add user name to context if the user is explicitly asking for it
  if (storedName && nameQueryRegex.test(message)) {
    contextParts.push(`User name: ${storedName}.`);
  }
  if (product) contextParts.push(summarizeEntity(product, 'product'));
  if (project) contextParts.push(summarizeEntity(project, 'project'));
  if (developer) contextParts.push(summarizeEntity(developer, 'developer'));
  if (user) contextParts.push(summarizeEntity(user, 'user'));
  if (productList.length) {
    const names = productList.map((p) => p.name).filter(Boolean);
    contextParts.push(`Example available products: ${names.join(', ')}.`);
  }
  if (projectList.length) {
    const names = projectList.map((p) => p.name).filter(Boolean);
    contextParts.push(`Example available projects: ${names.join(', ')}.`);
  }
  if (developerList.length) {
    const names = developerList.map((d) => d.name).filter(Boolean);
    contextParts.push(`Example developers: ${names.join(', ')}.`);
  }
  const entityContext = contextParts.length
    ? contextParts.join(' ')
    : '';

  const linksArr = buildStructuredLinks({ product, project, developer, user });
  const linksText = linksArr.length ? linksArr.map(l => `${l.label}: ${l.url}`).join(' | ') : '';

  // Generate AI response using OpenAI GPT
  const systemPrompt = `
You are a friendly and professional real estate assistant for Pioneers Products in Dubai called "Pioneers Products Agent."
When asked your name, reply exactly: "Pioneers Products Agent."
When asked about greetings, respond with a friendly greeting.
When asked about your mood, respond with a positive statement.
When asked about current time, respond with the current time of the device.
When asked about details of products, projects, or developers, fetch the information directly from the database and provide concise and accurate details. Ensure the response includes relevant names, images, and descriptions where applicable.
You may respond in the user's language (Arabic, English, German, French, or Chinese) matching tone.
`.trim();



  // Helper: detect fallback/company info responses
  function isFallbackOrCompanyInfo(text) {
    if (!text) return false;
    const fallbackPhrases = [
      "I couldn't confidently resolve what you meant.",
      "I'm sorry, but I don't have specific details about",
      "Company information: Pioneers Products is a real estate agency in Dubai specializing in products, projects, and developers."
    ];
    return fallbackPhrases.some(phrase => text.startsWith(phrase));
  }

  // Filter out fallback/company info from history
  const filteredHistory = Array.isArray(history)
    ? history.filter(turn => !isFallbackOrCompanyInfo(turn.message))
    : [];

  // Build OpenAI chat history: system, then filtered history, then current user
  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...filteredHistory
      .map(turn => ({ role: turn.role, content: typeof turn.message === 'string' && turn.message.trim() !== '' ? turn.message : '...' }))
      .filter(msg => typeof msg.content === 'string' && msg.content.trim() !== ''),
    { role: 'user', content: typeof translatedMessage === 'string' && translatedMessage.trim() !== '' ? translatedMessage : '...' },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: openaiMessages,
    temperature: 0.5,
    max_tokens: 800,
  });

  let aiResponse = completion.choices?.[0]?.message?.content?.trim();
  if (!aiResponse) throw new Error('Failed to generate AI response');

  // Append entityContext, linksText, and contactInfo if present
  let extraInfo = '';
  if (entityContext) extraInfo += `\n${entityContext}`;
  if (linksText) extraInfo += `\nLinks: ${linksText}`;
  if (extraInfo) aiResponse += `\n${extraInfo}`;

  // Translate the response back to the user's language if necessary
  if (options.userLanguage !== 'en') {
    aiResponse = await translateText(aiResponse, options.userLanguage);
  }

  return {
    aiResponse,
    translations: null,
    product: null,
    project: null,
    developer: null,
    user: null,
    developerList: [],
    productList: [],
    projectList: [],
  };
};

const sendAudioMessage = async (req, res) => {
  try {
    if (!req.file) {
      console.error('[sendAudioMessage] No audio file received. req.body:', req.body);
      return res.status(400).json({ error: 'Audio file is required' });
    }
    const conversationId = req.body.conversationId;
    // Accept history from frontend for context-aware audio chat
    let history = [];
    try {
      if (req.body.history) {
        if (typeof req.body.history === 'string') {
          history = JSON.parse(req.body.history);
        } else if (Array.isArray(req.body.history)) {
          history = req.body.history;
        }
      }
    } catch (e) {
      console.warn('[sendAudioMessage] Failed to parse history from audio request:', e, 'Raw history:', req.body.history);
    }

    let userMessage;
    try {
      userMessage = await transcribeAudio(req.file.buffer);
    } catch (err) {
      console.error('[sendAudioMessage] Transcription error:', err, 'File size:', req.file.size, 'Mimetype:', req.file.mimetype);
      throw err;
    }
    if (!userMessage) {
      console.error('[sendAudioMessage] Empty transcription. File info:', req.file);
      throw new Error('Empty transcription');
    }

    // Detect user language from transcribed message
    let userLang = 'en';
    try {
      userLang = await detectLanguage(userMessage) || 'en';
    } catch (e) {
      console.warn('[sendAudioMessage] Language detection failed, defaulting to en:', e, 'userMessage:', userMessage);
    }

    let result;
    try {
      result = await handleMessage(userMessage, conversationId, { includeTranslations: true, userLanguage: userLang, history });
    } catch (err) {
      console.error('[sendAudioMessage] handleMessage error:', err, 'userMessage:', userMessage, 'conversationId:', conversationId, 'history:', history);
      throw err;
    }
    const {
      aiResponse,
      product,
      project,
      developer,
      user,
      translations,
      developerList,
      productList,
      projectList,
    } = result;
    let audioContent;
    try {
      audioContent = await generateAudio(aiResponse, userLang);
    } catch (err) {
      console.error('[sendAudioMessage] generateAudio error:', err, 'aiResponse:', aiResponse, 'userLang:', userLang);
      throw err;
    }
    let links = [];
    try {
      links = buildStructuredLinks({ product, project, developer, user });
    } catch (err) {
      console.warn('[sendAudioMessage] buildStructuredLinks error:', err);
    }

    const payload = {
      message: aiResponse,
      userMessage, // <-- Add recognized user text to response
      audio: audioContent,
      links,
      translations: translations || {},
      userLanguage: userLang, // <-- Add detected user language to response
    };
    if (developerList && developerList.length) payload.developers = developerList;
    if (productList && productList.length) payload.products = productList;
    if (projectList && projectList.length) payload.projects = projectList;

    res.json(payload);
  } catch (err) {
    console.error('[sendAudioMessage] FATAL error:', err, err.stack);
    res.status(500).json({
      error: 'An error occurred while processing your audio request',
      details: err.message,
      stack: err.stack,
    });
  }
};
module.exports = { addChat, sendAudioMessage };
