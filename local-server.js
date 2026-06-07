require('dotenv').config();
const express = require('express');
const app = express();
const port = 3000;

// CORS 설정 (로컬 환경에서 file:// 로 열었을 때도 통신 가능하게 함)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// JSON 파싱
app.use(express.json());

// 정적 파일 서빙 (루트 디렉토리)
app.use(express.static('.'));

// Vercel 서버리스 함수 라우팅 시뮬레이션
app.post('/api/analyze', async (req, res) => {
    try {
        const analyzeHandler = require('./api/analyze.js');
        await analyzeHandler(req, res);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '로컬 서버 에러' });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const historyHandler = require('./api/history.js');
        await historyHandler(req, res);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '로컬 서버 에러' });
    }
});

app.get('/api/config', async (req, res) => {
    try {
        const configHandler = require('./api/config.js');
        await configHandler(req, res);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '로컬 서버 에러' });
    }
});


app.listen(port, () => {
    console.log(`Local development server running at http://localhost:${port}`);
});
