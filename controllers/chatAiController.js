const fs = require('fs');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { Project } = require('../models/projectModel');
const { detectLanguage } = require('./translatorController'); // Import detectLanguage function
const { translateText } = require('./translatorController'); // Import translation function
const { isCompanyQuery, ownershipQueryRegex } = require('./regexCompany');
const { isContactQuery } = require('./regexContacts');
const { isListProjectsQuery, isFeaturedProjectsQuery } = require('./regexProjects');
const { invalidKeywords } = require('./invalidKeywords');

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
const DEFAULT_PROJECT_IMAGE = 'https://via.placeholder.com/100';

const PROJECT_FIELDS = ['name', 'name_ar'];
const USER_FIELDS = ['name', 'email'];

const STOPWORDS = new Set([
  'write', 'link', 'of', 'the', 'for', 'give', 'me',
  'project', 'please', 'show', 'url', 'what', 'is',
  'my', 'in', 'to', 'and', 'a', 'an', 'on', 'about', 'any', 'you',
  'could', 'would', 'like', 'here', 'there',
]);


const detectIntent = (message) => {
  const lower = message.toLowerCase();
  const hasProject = /\bprojects?\b/.test(lower);
  const wantsProject = hasProject;
  const ambiguous =
    (!hasProject) ||
    (hasProject) ||
    (hasProject);
  return { wantsProject, ambiguous };
};

const summarizeEntity = (entity, type) => {
  if (!entity) return '';
  switch (type) {
    case 'project': {
      const parts = [];
      if (entity.name) parts.push(`Name: ${entity.name}`);
      if (entity.description) parts.push(`Description: ${entity.description.substring(0, 120)}${entity.description.length > 120 ? '...' : ''}`);
      return `Project details: ${parts.join(' | ')}.`;
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
    'projects': 'projects',
    'projct': 'project',
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

const fetchSampleProjects = async (limit = 4) => {
  if (!Project || typeof Project.find !== 'function') return [];
  let samples = await Project.find({ isFeatured: true }).limit(limit).select('name _id description image').lean();
  if (!samples.length) {
    samples = await Project.find({}).limit(limit).select('name _id description image').lean();
  }
  return samples;
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
  let project = null;
  let user = null;
  const suggestions = [];

  const projectMatch = message.match(/project\s*(?:name)?:\s*([^\n,?.!]+)/i);
  if (projectMatch) {
    project = await findOneFuzzy(Project, projectMatch[1], PROJECT_FIELDS);
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
  if (!project && (intent.wantsProject || intent.ambiguous)) {
    project = await findOneFuzzy(Project, phrase, PROJECT_FIELDS);
  }

  console.log('resolveEntities debug:', {
    message,
    projectId: project?._id,
    userId: user?._id,
    suggestions,
    intent,
  });

  return { project, user, suggestions };
};

// Build structured links (for backward compatibility)
const buildStructuredLinks = ({ project, user }) => {
  const links = [];
  if (project && project._id) {
    links.push({
      type: 'project',
      label: project.name || 'Project',
      url: `https://alsaaeid-ellithy.vercel.app/project/${project._id}`,
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
      aiResponse: "I'm sorry, but your message seems incomplete. Could you please clarify your question about projects?",
      translations: null,
      project: null,
      user: null,
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
    : 'Company information: Alsaaeid Ellithy portfolio that specializes in designing and developing, and selling software projects.';
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
        project: null,
        user: null,
        projectList: [],
        userLanguage: options.userLanguage,
      };
    }
    if (ownershipQueryRegex.test(translatedMessage)) {
      // Provide ownership information in user's language
      let ownershipInfo = `Alsaaeid Ellithy portfolio that specializes in designing and developing, and selling software projects. Founded and owned by Al-Saaeid Ellithy.`;

      // Translate ownership info to user's language if not English
      if (options.userLanguage !== 'en') {
        ownershipInfo = await translateText(ownershipInfo, options.userLanguage);
      }

      return {
        aiResponse: ownershipInfo,
        translations: null,
        project: null,
        user: null,
        projectList: [],
        userLanguage: options.userLanguage,
      };
    }
    return {
      aiResponse: `${companyContext}`,
      translations: null,
      project: null,
      user: null,
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
      project: null,
      user: null,
      projectList: [],
    };
  }

  // Identity / name queries
  const botNameQueryRegex = /\b(?:what(?:'|’)?s your name|who are you|what are you called)\b/i;
  if (botNameQueryRegex.test(translatedMessage)) {
    return {
      aiResponse: 'I am Portfolio Agent. How can I assist you with the digital services?',
      translations: null,
      project: null,
      user: null,
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
      project: null,
      user: null,
      projectList: [],
    };
  }

  if (!declMatch && singleNameRegex.test(trimmed) && !isListProjectsQuery(trimmed)) {
    const userMatch = message.match(/user\s*(?:name)?:\s*([^\n,?.!]+)/i);
    if (userMatch) {
      const name = userMatch[1].trim();
      if (conversationId) {
        sessionNames.set(conversationId, name);
      }
      return {
        aiResponse: `Nice to meet you, ${name}. How can I assist you with your inquiries today?`,
        translations: null,
        project: null,
        user: null,
        projectList: [],
      };
    }
  }
  if (nameQueryRegex.test(message)) {
    if (storedName) {
      return {
        aiResponse: `Your name is ${storedName}.`,
        translations: null,
        project: null,
        user: null,
        projectList: [],
      };
    }
    return {
      aiResponse: "I don't know your name yet. What should I call you?",
      translations: null,
      project: null,
      user: null,
      projectList: [],
    };
  }

  // Early list handlers
  let projectList = [];

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
      projectList = projectList.filter((prop, index, self) =>
        index === self.findIndex((p) => p.name === prop.name)
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
        project: null,
        user: null,
        projectList: [],
      };
    } else {
      let aiResponse;
      if (options.userLanguage === 'ar') {
        aiResponse = "عذرًا، لا توجد تفاصيل عن العقارات في الوقت الحالي. يرجى الاتصال بنا للحصول على معلومات محدثة.";
      } else {
        aiResponse = "I'm sorry, but I don't have specific details about projects at the moment. Please contact us directly for updated and accurate information.";
      }

      return {
        aiResponse,
        translations: null,
        project: null,
        user: null,
        projectList: [],
      };
    }
  }

  // Queries about the best projects
  const bestQueryRegex = /\b(best|top|most popular)\s*(projects)?\b/i;
  const bestMatches = translatedMessage.match(bestQueryRegex);
  if (bestMatches) {
    const category = bestMatches[2].toLowerCase();
    let response = '';

    if (category === 'projects') {
      response = 'the best projects';
    } 

    return {
      aiResponse: response,
      translations: null,
      project: null,
      user: null,
      projectList: [],
    };
  }

  // Intent/entity resolution fallback
  const intent = detectIntent(message);
  let { project, user, suggestions } = await resolveEntities(message, intent);

  // Enforce exclusive intent
  if (intent.wantsProject && !intent.ambiguous) project = null;

  // If a specific project is found, return only its details (skip AI answer)
  if (project && project._id) {
    const proj = normalizeProject(project);
    return {
      aiResponse: null,
      translations: null,
      project: null,
      user: null,
      projectList: [proj],
    };
  }
  // If user asked for featured projects/projects
  if ((isFeaturedProjectsQuery(message) || intent.wantsProject) && !project) {
    const samples = await fetchSampleProjects(3);
    projectList = samples.map(normalizeProject).filter(Boolean);
  }

  // Suggestions-only fallback
  if (suggestions.length > 0 && !project && !user) {
    let reply = "I couldn't confidently resolve what you meant. Did you mean:\n";
    suggestions.forEach((s) => {
      reply += `- ${s.type} similar to \"${s.input}\": ${s.suggestions?.slice(0, 3).join(', ')}\n`;
    });
    return {
      aiResponse: reply.trim(),
      translations: null,
      project,
      user,
      projectList,
    };
  }

  // (removed duplicate declaration)
  const contextParts = [];
  // Only add user name to context if the user is explicitly asking for it
  if (storedName && nameQueryRegex.test(message)) {
    contextParts.push(`User name: ${storedName}.`);
  }
  if (project) contextParts.push(summarizeEntity(project, 'project'));
  if (user) contextParts.push(summarizeEntity(user, 'user'));
  if (projectList.length) {
    const names = projectList.map((p) => p.name).filter(Boolean);
    contextParts.push(`Example available projects: ${names.join(', ')}.`);
  }
  const entityContext = contextParts.length
    ? contextParts.join(' ')
    : '';

  const linksArr = buildStructuredLinks({ project, user });
  const linksText = linksArr.length ? linksArr.map(l => `${l.label}: ${l.url}`).join(' | ') : '';

  // Ensure the database context is included in the system prompt for AI responses
  const fetchDatabaseContext = async () => {
    try {

      const projects = await (Project && typeof Project.find === 'function'
        ? Project.find({})
            .populate('user', 'name email phone photo role bio')
        .sort({ createdAt: -1 })
        .select('name name_ar name_de name_fr name_zh description description_ar description_de description_fr description_zh status isFeatured')
        .limit(5)
        .lean()
    : []);

      return { projects };
    } catch (error) {
      console.error('Error fetching database context:', error);
      return { projects: [] };
    }
  };

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
    project: null,
    user: null,
    projectList: [],
  };
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
      project,
      user,
      translations,
      projectList,
    } = result || {};

    let links = [];
    try {
      links = buildStructuredLinks({ project, user });
    } catch (err) {
      console.error('buildStructuredLinks error:', err);
      // links will be empty
    }

    const payload = {
      message: aiResponse || null,
      links,
      project: project ? normalizeProject(project) : null,
      user: user ? normalizeUser(user) : null,
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

module.exports = { addChat };
