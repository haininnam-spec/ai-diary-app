const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

module.exports = async function handler(req, res) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        try {
            if (!supabase) {
                return res.status(500).json({ error: 'Supabase 환경 변수가 설정되지 않았습니다.' });
            }

            // Supabase에서 데이터 조회 (최신순)
            const { data, error } = await supabase
                .from('diaries')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;

            // 프론트엔드가 기존에 기대하는 포맷으로 매핑 (originalText, aiResponse, timestamp)
            const history = data.map(item => ({
                id: item.id,
                timestamp: item.created_at,
                originalText: item.original_text,
                aiResponse: item.ai_response
            }));

            return res.status(200).json({ history });
        } catch (error) {
            console.error('Supabase History Error:', error);
            return res.status(500).json({ error: '히스토리를 불러오는 중 오류가 발생했습니다.' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};
