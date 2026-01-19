import express from 'express';
import { YoutubeTranscript } from 'youtube-transcript';

const app = express();
const PORT = 3001;

// Manually set CORS headers if needed, but since we use Vite proxy, it should be fine.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Add a root route to provide clear feedback when visiting http://localhost:3001
app.get('/', (req, res) => {
    res.send('<h1>EchoLoop API Server</h1><p>The subtitle fetching service is running.</p><p>Use <code>/api/transcript?videoId=ID</code> to fetch subtitles.</p><p>Visit <a href="http://localhost:3000">http://localhost:3000</a> to use the app.</p>');
});

app.get('/api/transcript', async (req, res) => {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'videoId is required' });
    }

    try {
        console.log(`Fetching transcript for video: ${videoId}`);
        // We try to fetch in English specifically if possible, or just default
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        res.json(transcript);
    } catch (error) {
        console.error('Error fetching transcript:', error);
        res.status(500).json({ error: 'Failed to fetch transcript', details: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
