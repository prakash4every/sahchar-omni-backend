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
import SQLiteStoreFactory from 'connect-sqlite3';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== DIRECTORY SETUP FOR RENDER ====================
// Use /tmp for writable storage on Render
const DATA_DIR = '/tmp/data';
const UPLOAD_DIR = '/tmp/uploads';
const SESSION_DB_DIR = '/tmp/sessions';

[DATA_DIR, UPLOAD_DIR, SESSION_DB_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==================== SESSION CONFIGURATION ====================
const SQLiteStore = SQLiteStoreFactory(session);

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: SESSION_DB_DIR
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// ==================== MULTER CONFIGURATION ====================
const upload = multer({ 
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ==================== DATABASE SETUP ====================
const DB_PATH = path.join(DATA_DIR, 'omni_ai.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database at', DB_PATH);
    initializeDatabase();
  }
});

function initializeDatabase() {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create chat history table
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create generated content table
  db.run(`
    CREATE TABLE IF NOT EXISTS generated_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      file_url TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create user files table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create content filter logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS content_filter_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      original_content TEXT,
      filter_reason TEXT,
      is_blocked BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('Database tables initialized');
}

// ==================== CONTENT FILTERING ====================
function filterContent(content, language = 'en') {
  const blockedPatterns = [
    /violence|harm|abuse/i,
    /explicit|adult|nsfw/i,
    /hate|discrimination|racist/i,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(content)) {
      return {
        isBlocked: true,
        reason: language === 'hi' ? 'अनुपयुक्त सामग्री' : 'Inappropriate content detected'
      };
    }
  }

  return { isBlocked: false };
}

// ==================== DEEPSEEK API INTEGRATION ====================
async function callDeepSeekAPI(messages, language = 'en') {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

  if (!apiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  try {
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('DeepSeek API error:', error.response?.data || error.message);
    throw new Error('Failed to get response from DeepSeek API');
  }
}

// ==================== IMAGE GENERATION (PLACEHOLDER) ====================
async function generateImage(prompt) {
  return {
    url: `https://via.placeholder.com/512x512?text=${encodeURIComponent(prompt.substring(0, 30))}`,
    prompt: prompt
  };
}

// ==================== AUDIO TRANSCRIPTION (PLACEHOLDER) ====================
async function transcribeAudio(audioPath) {
  return {
    text: 'Transcribed audio content would appear here',
    language: 'en',
    confidence: 0.95
  };
}

// ==================== VIDEO GENERATION (PLACEHOLDER) ====================
async function generateVideo(prompt, duration) {
  return {
    videoUrl: `https://via.placeholder.com/1280x720?text=${encodeURIComponent(prompt.substring(0, 30))}`,
    prompt: prompt,
    duration: duration,
    status: 'processing'
  };
}

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'OmniAI server is running' });
});

// ==================== CHAT ROUTES ====================

// Main chat endpoint for frontend
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const filterResult = filterContent(message, 'hi');
    if (filterResult.isBlocked) {
      return res.status(400).json({ error: filterResult.reason });
    }

    const sessionId = req.session.id || uuidv4();
    const userId = req.session.userId || 1; // default user

    // Save user message
    db.run(
      'INSERT INTO chat_history (user_id, session_id, role, content, language) VALUES (?, ?, ?, ?, ?)',
      [userId, sessionId, 'user', message, 'hi']
    );

    // Get history
    db.all(
      'SELECT role, content FROM chat_history WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId, sessionId],
      async (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const messages = rows.reverse().map(row => ({
          role: row.role,
          content: row.content
        }));
        messages.push({ role: 'user', content: message });

        try {
          const assistantResponse = await callDeepSeekAPI(messages, 'hi');

          db.run(
            'INSERT INTO chat_history (user_id, session_id, role, content, language) VALUES (?, ?, ?, ?, ?)',
            [userId, sessionId, 'assistant', assistantResponse, 'hi']
          );

          res.json({ reply: assistantResponse });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Detailed chat endpoint
app.post('/api/chat/send', async (req, res) => {
  try {
    const { message, sessionId, language = 'en' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const filterResult = filterContent(message, language);
    if (filterResult.isBlocked) {
      return res.status(400).json({ error: filterResult.reason });
    }

    const newSessionId = sessionId || uuidv4();
    const userId = req.session.userId || 1;

    db.run(
      'INSERT INTO chat_history (user_id, session_id, role, content, language) VALUES (?, ?, ?, ?, ?)',
      [userId, newSessionId, 'user', message, language]
    );

    db.all(
      'SELECT role, content FROM chat_history WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId, newSessionId],
      async (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const messages = rows.reverse().map(row => ({
          role: row.role,
          content: row.content
        }));
        messages.push({ role: 'user', content: message });

        try {
          const assistantResponse = await callDeepSeekAPI(messages, language);

          db.run(
            'INSERT INTO chat_history (user_id, session_id, role, content, language) VALUES (?, ?, ?, ?, ?)',
            [userId, newSessionId, 'assistant', assistantResponse, language]
          );

          res.json({
            sessionId: newSessionId,
            response: assistantResponse,
            timestamp: new Date()
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/chat/history/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId || 1;

    db.all(
      'SELECT role, content, created_at FROM chat_history WHERE user_id = ? AND session_id = ? ORDER BY created_at',
      [userId, sessionId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows || []);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== IMAGE GENERATION ====================

app.post('/api/image/generate', async (req, res) => {
  try {
    const { prompt, language = 'en' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const filterResult = filterContent(prompt, language);
    if (filterResult.isBlocked) {
      return res.status(400).json({ error: filterResult.reason });
    }

    const userId = req.session.userId || 1;
    const contentId = uuidv4();

    db.run(
      'INSERT INTO generated_content (user_id, content_type, prompt, status) VALUES (?, ?, ?, ?)',
      [userId, 'image', prompt, 'pending']
    );

    const result = await generateImage(prompt);

    db.run(
      'UPDATE generated_content SET file_url = ?, status = ? WHERE user_id = ? AND prompt = ?',
      [result.url, 'completed', userId, prompt]
    );

    res.json({
      contentId,
      imageUrl: result.url,
      prompt: prompt,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

app.get('/api/image/history', (req, res) => {
  try {
    const userId = req.session.userId || 1;

    db.all(
      'SELECT id, prompt, file_url, created_at FROM generated_content WHERE user_id = ? AND content_type = ? ORDER BY created_at DESC LIMIT 20',
      [userId, 'image'],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows || []);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== AUDIO TRANSCRIPTION ====================

app.post('/api/audio/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const { language = 'en' } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const userId = req.session.userId || 1;
    const result = await transcribeAudio(req.file.path);

    const filterResult = filterContent(result.text, language);
    if (filterResult.isBlocked) {
      return res.status(400).json({ error: filterResult.reason });
    }

    const sessionId = uuidv4();
    db.run(
      'INSERT INTO chat_history (user_id, session_id, role, content, language) VALUES (?, ?, ?, ?, ?)',
      [userId, sessionId, 'user', result.text, language]
    );

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('File deletion error:', err);
    });

    res.json({
      transcription: result.text,
      language: result.language,
      confidence: result.confidence
    });
  } catch (error) {
    console.error('Audio transcription error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

// ==================== VIDEO GENERATION ====================

app.post('/api/video/generate', async (req, res) => {
  try {
    const { prompt, duration = 10, language = 'en' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const filterResult = filterContent(prompt, language);
    if (filterResult.isBlocked) {
      return res.status(400).json({ error: filterResult.reason });
    }

    const userId = req.session.userId || 1;
    const contentId = uuidv4();

    db.run(
      'INSERT INTO generated_content (user_id, content_type, prompt, status) VALUES (?, ?, ?, ?)',
      [userId, 'video', prompt, 'pending']
    );

    const result = await generateVideo(prompt, duration);

    res.json({
      contentId,
      videoUrl: result.videoUrl,
      prompt: prompt,
      duration: duration,
      status: result.status,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ error: 'Failed to generate video' });
  }
});

app.get('/api/video/history', (req, res) => {
  try {
    const userId = req.session.userId || 1;

    db.all(
      'SELECT id, prompt, file_url, created_at FROM generated_content WHERE user_id = ? AND content_type = ? ORDER BY created_at DESC LIMIT 20',
      [userId, 'video'],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows || []);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== FILE MANAGEMENT ====================

app.get('/api/files/list', (req, res) => {
  try {
    const userId = req.session.userId || 1;

    db.all(
      'SELECT id, file_name, file_type, file_size, created_at FROM user_files WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows || []);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/files/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.session.userId || 1;

    db.run(
      'DELETE FROM user_files WHERE id = ? AND user_id = ?',
      [fileId, userId],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, message: 'File deleted successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== AUTHENTICATION ====================

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password, language = 'en' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    db.run(
      'INSERT INTO users (username, email, password, language) VALUES (?, ?, ?, ?)',
      [username, email, password, language],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'User already exists' });
        }
        req.session.userId = this.lastID;
        res.json({ 
          success: true, 
          userId: this.lastID,
          message: 'User registered successfully' 
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get(
      'SELECT id, username, email FROM users WHERE email = ? AND password = ?',
      [email, password],
      (err, user) => {
        if (err || !user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.session.userId = user.id;
        res.json({ 
          success: true, 
          user: user,
          message: 'Login successful' 
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// ==================== ROOT ROUTE (NO FRONTEND) ====================
app.get('/', (req, res) => {
  res.json({ 
    message: 'OmniAI Backend is running. Frontend is separate.',
    endpoints: {
      chat: '/chat (POST)',
      health: '/api/health (GET)',
      docs: 'See code for full API'
    }
  });
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║         🚀 OmniAI Server Started       ║
╠════════════════════════════════════════╣
║ Server: http://localhost:${PORT}
║ Environment: ${process.env.NODE_ENV || 'development'}
║ DeepSeek API: ${process.env.DEEPSEEK_API_KEY ? '✓ Configured' : '✗ Not configured'}
║ Chat endpoint: http://localhost:${PORT}/chat
║ Database: ${DB_PATH}
║ Uploads: ${UPLOAD_DIR}
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close();
  process.exit(0);
});

export default app;