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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'omni-sahchar-secret-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Multer for uploads
const upload = multer({ dest: 'uploads/' });

// ==================== DATABASE ====================
const dbPath = path.join(process.cwd(), 'data', 'omni_ai.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database at', dbPath);
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        language TEXT DEFAULT 'en',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        language TEXT DEFAULT 'en',
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

    console.log('Database tables initialized');
}

// ==================== CONTENT FILTER ====================
function filterContent(content, language = 'en') {
    const blocked = [/violence|harm|abuse/i, /explicit|adult|nsfw/i, /hate|discrimination|racist/i];
    for (let pattern of blocked) {
        if (pattern.test(content)) {
            return { isBlocked: true, reason: language === 'hi' ? 'अनुपयुक्त सामग्री' : 'Inappropriate content' };
        }
    }
    return { isBlocked: false };
}

// ==================== DEEPSEEK API ====================
async function callDeepSeekAPI(messages, language = 'en') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DeepSeek API key missing');
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 1000
    }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    return response.data.choices[0]?.message?.content || '';
}

// ==================== PLACEHOLDER FUNCTIONS ====================
async function generateImage(prompt) {
    return { url: `https://via.placeholder.com/512?text=${encodeURIComponent(prompt)}`, prompt };
}
async function transcribeAudio(audioPath) {
    return { text: 'Transcribed text would appear here', language: 'en', confidence: 0.95 };
}
async function generateVideo(prompt, duration) {
    return { videoUrl: 'https://via.placeholder.com/640x360?text=Video', prompt, duration, status: 'processing' };
}

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'OmniAI server running' }));

// Chat
app.post('/api/chat/send', async (req, res) => {
    try {
        const { message, sessionId, language = 'en' } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });

        const filter = filterContent(message, language);
        if (filter.isBlocked) return res.status(400).json({ error: filter.reason });

        const userId = req.session.userId || 1;
        const newSessionId = sessionId || uuidv4();

        db.run('INSERT INTO chat_history (user_id, session_id, role, content, language) VALUES (?, ?, ?, ?, ?)',
            [userId, newSessionId, 'user', message, language]);

        // Get last 10 messages for context
        db.all('SELECT role, content FROM chat_history WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 10',
            [userId, newSessionId], async (err, rows) => {
                if (err) return res.status(500).json({ error: 'DB error' });
                const messages = (rows || []).reverse().map(r => ({ role: r.role, content: r.content }));
                messages.push({ role: 'user', content: message });

                try {
                    const reply = await callDeepSeekAPI(messages, language);
                    db.run('INSERT INTO chat_history (user_id, session_id, role, content, language) VALUES (?, ?, ?, ?, ?)',
                        [userId, newSessionId, 'assistant', reply, language]);
                    res.json({ sessionId: newSessionId, response: reply, timestamp: new Date() });
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Image generation (placeholder)
app.post('/api/image/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt required' });
        const result = await generateImage(prompt);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Audio transcription (placeholder)
app.post('/api/audio/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Audio file required' });
        const result = await transcribeAudio(req.file.path);
        fs.unlink(req.file.path, () => {});
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Video generation (placeholder)
app.post('/api/video/generate', async (req, res) => {
    try {
        const { prompt, duration = 10 } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt required' });
        const result = await generateVideo(prompt, duration);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth placeholders (demo)
app.post('/api/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
    db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, password], function(err) {
            if (err) return res.status(400).json({ error: 'User exists' });
            req.session.userId = this.lastID;
            res.json({ success: true, userId: this.lastID });
        });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT id, username FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        req.session.userId = user.id;
        res.json({ success: true, user });
    });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

// Root route – serve index.html if exists, else JSON
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.json({ message: 'OmniAI backend is running. No frontend found.' });
    }
});

// Catch-all 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Start server
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   🚀 Sahchar OmniAI Server Started   ║
╠══════════════════════════════════════╣
║ Port: ${PORT}
║ Database: ${dbPath}
║ DeepSeek: ${process.env.DEEPSEEK_API_KEY ? '✓' : '✗'}
╚══════════════════════════════════════╝
    `);
});
