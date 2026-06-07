const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

// Supabase 관리자 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Serverless Redis 클라이언트 초기화
const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;

module.exports = async function handler(req, res) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        try {
            // JWT 토큰 검증
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
            
            if (!supabaseAdmin) {
                return res.status(500).json({ error: 'Supabase Admin 환경 변수가 설정되지 않았습니다.' });
            }

            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !user) return res.status(401).json({ error: '유효하지 않은 인증입니다.' });

            let history = [];

            // 1. Redis에서 먼저 조회 시도
            if (redis) {
                try {
                    const pattern = `user:${user.id}:diary-*`;
                    const keys = await redis.keys(pattern);
                    
                    if (keys.length > 0) {
                        const pipeline = redis.pipeline();
                        keys.forEach(key => pipeline.get(key));
                        const results = await pipeline.exec();
                        
                        history = results.map(([err, val]) => {
                            if (!err && val) {
                                const parsed = JSON.parse(val);
                                return {
                                    id: parsed.id,
                                    timestamp: parsed.created_at,
                                    originalText: parsed.original_text,
                                    aiResponse: parsed.ai_response
                                };
                            }
                            return null;
                        }).filter(item => item !== null);
                        
                        // 최신순 정렬
                        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                        
                        return res.status(200).json({ history });
                    }
                } catch (redisError) {
                    console.error('Redis History Error:', redisError);
                    // Redis 오류 시 Supabase로 폴백
                }
            }

            // 2. Redis에 없거나 Redis가 설정되지 않은 경우 Supabase에서 조회
            const { data, error } = await supabaseAdmin
                .from('diaries')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;

            // 프론트엔드가 기존에 기대하는 포맷으로 매핑
            history = data.map(item => ({
                id: item.id,
                timestamp: item.created_at,
                originalText: item.original_text,
                aiResponse: item.ai_response
            }));

            return res.status(200).json({ history });
        } catch (error) {
            console.error('History Fetch Error:', error);
            return res.status(500).json({ error: '히스토리를 불러오는 중 오류가 발생했습니다.' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};
