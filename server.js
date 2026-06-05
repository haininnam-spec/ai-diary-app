require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = 3000;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(express.json());
app.use(express.static('public'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/analyze', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: '일기 내용이 없습니다.' });
        }

        // Initialize model
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        
        const prompt = `너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어( 예: 기쁨, 슬픔, 분노, 불안, 평온)로 요약해줘. 그리고 그 감정에 공감해주고 따뜻한 응원의 메시지를 2~3문장으로 작성해줘. 답변 형식은 반드시 '감정:[요약된 감정]\\n\\n[응원 메시지]'와 같이 줄바꿈을 포함해서 보내줘.\n\n[일기 내용]\n${text}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiText = response.text();

        res.json({ result: aiText });
    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
