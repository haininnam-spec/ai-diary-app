const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

// Supabase 관리자 클라이언트 초기화 (Service Role Key 사용)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Serverless Redis 클라이언트 초기화
const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;

module.exports = async function handler(req, res) {
    // CORS 설정 추가 (로컬 테스트나 다른 도메인 호출 방지)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

            // JWT 토큰 검증
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
            
            if (!supabaseAdmin) {
                console.error('SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.');
                return res.status(500).json({ error: '서버 설정 오류가 발생했습니다.' });
            }

            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !user) return res.status(401).json({ error: '유효하지 않은 인증입니다.' });

            // Gemini API 호출 설정
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            
            const prompt = `너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어( 예: 기쁨, 슬픔, 분노, 불안, 평온)로 요약해줘. 그리고 그 감정에 공감해주고 따뜻한 응원의 메시지를 2~3문장으로 작성해줘. 답변 형식은 반드시 '감정:[요약된 감정]\\n\\n[응원 메시지]'와 같이 줄바꿈을 포함해서 보내줘.\n\n[일기 내용]\n${text}`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const aiText = response.text();

            // Redis에 저장 로직 (사용자 ID 포함)
            if (redis) {
                try {
                    const now = new Date();
                    // YYYYMMDDHHMM 형식 생성 (예: 202601010001)
                    const timestampStr = now.toISOString().replace(/[-:T.]/g, '').slice(0, 12);
                    const diaryKey = `user:${user.id}:diary-${timestampStr}`;
                    
                    const diaryData = {
                        id: diaryKey,
                        original_text: text,
                        ai_response: aiText,
                        user_id: user.id,
                        created_at: now.toISOString()
                    };
                    
                    await redis.set(diaryKey, JSON.stringify(diaryData));
                    console.log('Successfully saved to Redis with key:', diaryKey);
                } catch (redisError) {
                    console.error('Redis Save Error:', redisError);
                }
            } else {
                console.warn('REDIS_URL이 설정되지 않아 Redis에 저장되지 않았습니다.');
            }

            // Supabase에 저장 로직 (기존 호환성 유지)
            try {
                const { error } = await supabaseAdmin
                    .from('diaries')
                    .insert([
                        {
                            original_text: text,
                            ai_response: aiText,
                            user_id: user.id
                        }
                    ]);
                
                if (error) throw error;
                console.log('Successfully saved to Supabase');
            } catch (dbError) {
                console.error('Supabase Save Error:', dbError);
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
