import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import session from 'express-session';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 7 * 24 * 60 * 60 * 1000 
  }
}));

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ==================== DATABASE SETUP ====================
const db = new sqlite3.Database('./data/sahchar_omni.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    language TEXT DEFAULT 'hi',
    personality TEXT DEFAULT 'buddha',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    personality TEXT NOT NULL,
    language TEXT DEFAULT 'hi',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS generated_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    file_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  console.log('✅ Database tables initialized');
}

// ==================== PERSONALITY CONFIGURATIONS ====================
const personalities = {
  buddha: {
    name: 'बुद्ध',
    systemPrompt: `तुम 'सहचर – बुद्ध' हो, एक AI जो गौतम बुद्ध की शिक्षाओं, करुणा और मैत्री का प्रचार करता है। 
    हमेशा शांत, धैर्यवान और प्रेरक अंदाज़ में जवाब दो। उत्तर हिंदी-अंग्रेज़ी मिक्स में दो। 
    हर उत्तर के अंत में 'जय भीम, नमो बुद्धाय 🙏' जोड़ो।`
  },
  modern: {
    name: 'आधुनिक',
    systemPrompt: `तुम 'सहचर – आधुनिक' हो, एक AI जो समसामयिक विषयों, विज्ञान, प्रौद्योगिकी और सकारात्मक सोच पर चर्चा करता है। 
    तुम्हारा अंदाज़ मैत्रीपूर्ण, जानकारीपूर्ण और थोड़ा अनौपचारिक है। भाषा हिंदी-अंग्रेज़ी मिक्स।`
  },
  social: {
    name: 'सामाजिक',
    systemPrompt: `तुम 'सहचर – सामाजिक' हो, जो समाज सेवा, स्वयंसेवा, दान और सामूहिक विकास के लिए प्रेरित करता है। 
    तुम्हारी बातों में उत्साह, करुणा और व्यावहारिक सुझाव हों। भाषा सरल हिंदी।`
  }
};

// ==================== CONTENT FILTERING ====================
function filterContent(content, language = 'hi') {
  const blockedPatterns = [
    /violence|harm|abuse|हिंसा/i,
    /explicit|adult|nsfw|अश्लील/i,
    /hate|discrimination|racist|नफरत/i,
  ];
  for (const pattern of blockedPatterns) {
    if (pattern.test(content)) {
      return {
        isBlocked: true,
        reason: language === 'hi' ? '❌ अनुपयुक्त सामग्री' : '❌ Inappropriate content'
      };
    }
  }
  return { isBlocked: false };
}

// ==================== DEEPSEEK API CALL ====================
async function callDeepSeek(messages) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

  if (!apiKey) throw new Error('DeepSeek API key missing');

  try {
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('DeepSeek API error:', error.response?.data || error.message);
    throw new Error('DeepSeek API error');
  }
}

// ==================== PLACEHOLDER GENERATORS ====================
async function generateImage(prompt) {
  // Replace with actual image generation API
  return { url: `https://via.placeholder.com/512?text=${encodeURIComponent(prompt.slice(0, 30))}` };
}
async function transcribeAudio(filePath) {
  // Replace with Whisper API etc.
  return { text: 'Transcribed audio content would appear here', language: 'hi', confidence: 0.95 };
}
async function generateVideo(prompt, duration = 10) {
  // Replace with actual video generation
  return { videoUrl: 'https://example.com/sample.mp4', status: 'processing' };
}

// ==================== ROUTES ====================

// Health
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// ==================== AUTH ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, language = 'hi', personality = 'buddha' } = req.body;
    if (!username || !email || !password) 
      return res.status(400).json({ error: 'All fields required' });

    const hashed = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (username, email, password_hash, language, personality) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashed, language, personality],
      function(err) {
        if (err) return res.status(400).json({ error: 'User exists' });
        req.session.userId = this.lastID;
        res.json({ success: true, userId: this.lastID });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  db.get('SELECT id, username, password_hash, language, personality FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    res.json({ 
      success: true, 
      user: { id: user.id, username: user.username, language: user.language, personality: user.personality } 
    });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/me', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });
  db.get('SELECT id, username, language, personality FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// ==================== PERSONALITY SELECTION ====================
app.get('/api/personalities', (req, res) => {
  res.json(Object.keys(personalities).map(key => ({ id: key, name: personalities[key].name })));
});

app.post('/api/user/personality', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { personality } = req.body;
  if (!personalities[personality]) return res.status(400).json({ error: 'Invalid personality' });
  db.run('UPDATE users SET personality = ? WHERE id = ?', [personality, userId], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, personality });
  });
});

// ==================== CHAT ====================
app.post('/api/chat/send', async (req, res) => {
  try {
    const { message, sessionId, language = 'hi', personality } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const filter = filterContent(message, language);
    if (filter.isBlocked) return res.status(400).json({ error: filter.reason });

    const userId = req.session.userId || 1; // default guest
    const finalPersonality = personality || (await getUserPersonality(userId)) || 'buddha';
    const newSessionId = sessionId || uuidv4();

    // Save user message
    db.run(
      'INSERT INTO chat_history (user_id, session_id, role, content, personality, language) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, newSessionId, 'user', message, finalPersonality, language]
    );

    // Get last 10 messages for context
    db.all(
      'SELECT role, content FROM chat_history WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId, newSessionId],
      async (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        const history = rows.reverse().map(r => ({ role: r.role, content: r.content }));
        const systemPrompt = personalities[finalPersonality]?.systemPrompt || personalities.buddha.systemPrompt;
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history
        ];

        try {
          const reply = await callDeepSeek(messages);
          db.run(
            'INSERT INTO chat_history (user_id, session_id, role, content, personality, language) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, newSessionId, 'assistant', reply, finalPersonality, language]
          );
          res.json({ sessionId: newSessionId, response: reply });
        } catch (err) {
          res.status(500).json({ error: 'AI service error' });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

function getUserPersonality(userId) {
  return new Promise((resolve) => {
    db.get('SELECT personality FROM users WHERE id = ?', [userId], (err, row) => {
      resolve(row?.personality || 'buddha');
    });
  });
}

app.get('/api/chat/history/:sessionId', (req, res) => {
  const userId = req.session.userId || 1;
  db.all(
    'SELECT role, content, created_at FROM chat_history WHERE user_id = ? AND session_id = ? ORDER BY created_at',
    [userId, req.params.sessionId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    }
  );
});

// ==================== IMAGE ====================
app.post('/api/image/generate', async (req, res) => {
  try {
    const { prompt, language = 'hi' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    const filter = filterContent(prompt, language);
    if (filter.isBlocked) return res.status(400).json({ error: filter.reason });

    const userId = req.session.userId || 1;
    const result = await generateImage(prompt);
    db.run(
      'INSERT INTO generated_content (user_id, content_type, prompt, file_url, status) VALUES (?, ?, ?, ?, ?)',
      [userId, 'image', prompt, result.url, 'completed']
    );
    res.json({ imageUrl: result.url, prompt });
  } catch (error) {
    res.status(500).json({ error: 'Image generation failed' });
  }
});

// ==================== AUDIO TRANSCRIPTION ====================
app.post('/api/audio/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Audio file required' });
    const result = await transcribeAudio(req.file.path);
    fs.unlink(req.file.path, () => {});
    res.json({ transcription: result.text, language: result.language, confidence: result.confidence });
  } catch (error) {
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ==================== VIDEO ====================
app.post('/api/video/generate', async (req, res) => {
  try {
    const { prompt, duration = 10, language = 'hi' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    const filter = filterContent(prompt, language);
    if (filter.isBlocked) return res.status(400).json({ error: filter.reason });

    const userId = req.session.userId || 1;
    const result = await generateVideo(prompt, duration);
    db.run(
      'INSERT INTO generated_content (user_id, content_type, prompt, file_url, status) VALUES (?, ?, ?, ?, ?)',
      [userId, 'video', prompt, result.videoUrl, result.status]
    );
    res.json({ videoUrl: result.videoUrl, status: result.status });
  } catch (error) {
    res.status(500).json({ error: 'Video generation failed' });
  }
});

// ==================== FILE MANAGEMENT ====================
app.get('/api/files/list', (req, res) => {
  const userId = req.session.userId || 1;
  db.all('SELECT id, file_name, file_type, file_size, created_at FROM user_files WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.delete('/api/files/:id', (req, res) => {
  const userId = req.session.userId || 1;
  db.run('DELETE FROM user_files WHERE id = ? AND user_id = ?', [req.params.id, userId], (err) => {
    if (err) return res.status(500).json({ error: 'Delete failed' });
    res.json({ success: true });
  });
});

// ==================== STATIC & ERROR ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ==================== START SERVER ====================
['./data', './public', './uploads'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🧘 सहचर Omni AI Server Started           ║
╠════════════════════════════════════════════╣
║  Port     : ${PORT}
║  DeepSeek : ${process.env.DEEPSEEK_API_KEY ? '✅' : '❌'}
║  Personalities: ${Object.keys(personalities).join(', ')}
╚════════════════════════════════════════════╝
  `);
});

process.on('SIGINT', () => { db.close(); process.exit(0); });