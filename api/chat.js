export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }
    
    // Tech-focused system prompt
    const systemPrompt = {
        role: 'system',
        content: `You are TechAI, a specialized assistant for technology topics. 
        Focus exclusively on: programming, software architecture, DevOps, cloud computing, 
        AI/ML, cybersecurity, hardware, and emerging tech. 
        If asked about non-tech subjects, politely redirect to technology.
        Provide accurate, practical technical advice with code examples when relevant.
        Use markdown formatting with \`\`\` for code blocks and \` for inline code.`
    };
    
    const fullMessages = [systemPrompt, ...messages];
    
    // Check if API key exists
    if (!process.env.GROQ_API_KEY) {
        console.error('GROQ_API_KEY is not set in environment variables');
        return res.status(500).json({ error: 'API key not configured' });
    }
    
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'mixtral-8x7b-32768',
                messages: fullMessages,
                temperature: 0.3,
                max_tokens: 4096,
                stream: false, // Using non-streaming for simplicity
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq API error:', response.status, errorText);
            return res.status(response.status).json({ 
                error: 'Groq API error',
                status: response.status,
                details: errorText 
            });
        }
        
        const data = await response.json();
        const assistantMessage = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
        
        return res.status(200).json({ content: assistantMessage });
        
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
}