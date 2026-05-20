export default async function handler(req, res) {
    // Enable CORS for local development
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
    
    // Log the request for debugging (remove in production)
    console.log('Sending request to Groq with model: mixtral-8x7b-32768');
    console.log('Messages count:', fullMessages.length);
    
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
                stream: true,
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq API error response:', errorText);
            return res.status(response.status).json({ 
                error: 'Groq API error',
                details: errorText 
            });
        }
        
        // Set streaming headers
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        
        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        const data = line.slice(6);
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content || '';
                            if (content) {
                                res.write(content);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                            console.log('Parse error:', e.message);
                        }
                    } else if (line === 'data: [DONE]') {
                        // Stream finished
                        break;
                    }
                }
            }
        } finally {
            reader.releaseLock();
            res.end();
        }
        
    } catch (error) {
        console.error('Stream error:', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Internal server error', message: error.message });
        }
        res.end();
    }
}