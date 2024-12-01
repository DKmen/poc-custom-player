import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

// Get the current file URL and convert it to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const videoPath = path.resolve(__dirname, 'video/output.mp4');
const videoSize = fs.statSync(videoPath).size;

http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');

    const range = req.headers.range;

    if (!range) {
        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'content-range': `bytes */${videoSize}`,
        });

        return res.end();
    }

    const start = Number((range || '').replace(/bytes=/, '').split('-')[0]);
    const end = Math.min((range || '').replace(/bytes=/, '').split('-')[1], videoSize - 1);

    res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${videoSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4'
    });

    fs.createReadStream(videoPath, { start, end }).pipe(res);
}
).listen(8000, () => console.log('Server running on http://localhost:8000/'));