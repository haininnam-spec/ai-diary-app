const { GoogleGenerativeAI } = require('@google/generative-ai');
const Redis = require('ioredis');

// Redis 클라이언트 초기화. Vercel 환경 변수 REDIS_URL 사용.
// 서버리스 환경에서는 매 요청마다 연결을 만들거나 기존 연결을 재사용합니다.
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 날짜 포맷 함수 (YYYYMMDDHHMM)
function getFormattedDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}`;
}

module.exports = async function handler(req, res) {
    // CORS 설정 추가 (로컬 테스트나 다른 도메인 호출 방지)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONS preflight 요청 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const { text } = req.body;

            if (!text) {
                return res.status(400).json({ error: '일기 내용이 없습니다.' });
            }

            // Gemini API 호출 설정
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            
            const prompt = `너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어( 예: 기쁨, 슬픔, 분노, 불안, 평온)로 요약해줘. 그리고 그 감정에 공감해주고 따뜻한 응원의 메시지를 2~3문장으로 작성해줘. 답변 형식은 반드시 '감정:[요약된 감정]\\n\\n[응원 메시지]'와 같이 줄바꿈을 포함해서 보내줘.\n\n[일기 내용]\n${text}`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const aiText = response.text();

            // Redis에 저장 로직 추가
            if (redis) {
                try {
                    const diaryId = `diary-${getFormattedDate()}`;
                    const payload = {
                        id: diaryId,
                        timestamp: new Date().toISOString(),
                        originalText: text,
                        aiResponse: aiText
                    };
                    
                    // JSON 형태로 Redis에 저장
                    await redis.set(diaryId, JSON.stringify(payload));
                    console.log(`Successfully saved to Redis with key: ${diaryId}`);
                } catch (redisError) {
                    console.error('Redis Save Error:', redisError);
                    // Redis 저장이 실패하더라도 사용자에게 결과는 반환하기 위해 throw하지 않음
                }
            } else {
                console.warn('REDIS_URL 환경 변수가 설정되지 않아 저장되지 않았습니다.');
            }

            // 결과 반환
            return res.status(200).json({ result: aiText });
        } catch (error) {
            console.error('Gemini API Error:', error);
            return res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다.' });
        }
    } else {
        // POST 요청이 아닐 경우 에러 처리
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};
