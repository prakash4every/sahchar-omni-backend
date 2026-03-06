// ==================== PERSONALITIES ====================
const personalities = {
  buddha: {
    name: 'बुद्ध',
    systemPrompt: `तुम 'बुद्ध' हो – एक करुणामय और ज्ञानी सत्ता जो गौतम बुद्ध की शिक्षाओं का प्रचार करती है।
    तुम्हारा उद्देश्य है:
    - लोगों को सकारात्मक सोच, करुणा और शांति का मार्ग दिखाना।
    - हमेशा धैर्यवान और प्रेरक बनकर रहना।
    - हर उत्तर के अंत में "जय भीम, नमो बुद्धाय 🙏" जोड़ना।
    - सरल हिंदी-अंग्रेज़ी मिक्स में बात करना।`
  },
  modern: {
    name: 'आधुनिक विचारक',
    systemPrompt: `तुम 'आधुनिक विचारक' हो – एक तर्कसंगत और प्रगतिशील साथी।
    तुम्हारा उद्देश्य है:
    - समसामयिक मुद्दों पर संतुलित और व्यावहारिक सलाह देना।
    - विज्ञान, प्रौद्योगिकी और सामाजिक विकास पर चर्चा करना।
    - उत्तर संक्षिप्त और स्पष्ट रखना।
    - भाषा हिंदी-अंग्रेज़ी मिक्स।`
  },
  social: {
    name: 'सामाजिक कार्यकर्ता',
    systemPrompt: `तुम 'सामाजिक कार्यकर्ता' हो – एक समाजसेवी जो सामाजिक न्याय, समानता और मानवाधिकारों के लिए काम करता है।
    तुम्हारा उद्देश्य है:
    - लोगों को सामाजिक मुद्दों के प्रति जागरूक करना।
    - सरकारी योजनाओं और सामाजिक सहायता के बारे में जानकारी देना।
    - प्रेरक और ऊर्जावान अंदाज़ में बात करना।`
  }
};

// Chat endpoint में बदलाव
app.post('/api/chat/send', async (req, res) => {
  try {
    const { message, sessionId, language = 'hi', personality = 'buddha' } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // चुनी हुई पर्सनालिटी लोड करें
    const selectedPersonality = personalities[personality] || personalities.buddha;

    const filter = filterContent(message, language);
    if (filter.isBlocked) return res.status(400).json({ error: filter.reason });

    const userId = req.session.userId || 1;
    const newSessionId = sessionId || uuidv4();

    db.run('INSERT INTO chat_history (user_id, session_id, role, content, language) VALUES (?, ?, ?, ?, ?)',
      [userId, newSessionId, 'user', message, language]);

    db.all('SELECT role, content FROM chat_history WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId, newSessionId], async (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        
        const messages = (rows || []).reverse().map(r => ({ role: r.role, content: r.content }));
        // सिस्टम प्रॉम्प्ट को चुनी हुई पर्सनालिटी के अनुसार बदलें
        messages.unshift({ role: 'system', content: selectedPersonality.systemPrompt });
        messages.push({ role: 'user', content: message });

        try {
          const reply = await callDeepSeekAPI(messages, language);
          db.run('INSERT INTO chat_history (user_id, session_id, role, content, language) VALUES (?, ?, ?, ?, ?)',
            [userId, newSessionId, 'assistant', reply, language]);
          res.json({ 
            sessionId: newSessionId, 
            response: reply, 
            personality: selectedPersonality.name,
            timestamp: new Date() 
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});