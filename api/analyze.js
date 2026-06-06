const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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

            // Supabase에 저장 로직 추가
            if (supabase) {
                try {
                    const { error } = await supabase
                        .from('diaries')
                        .insert([
                            {
                                original_text: text,
                                ai_response: aiText
                            }
                        ]);
                    
                    if (error) throw error;
                    console.log('Successfully saved to Supabase');
                } catch (dbError) {
                    console.error('Supabase Save Error:', dbError);
                }
            } else {
                console.warn('SUPABASE 환경 변수가 설정되지 않아 저장되지 않았습니다.');
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
