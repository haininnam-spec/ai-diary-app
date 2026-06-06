const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

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
            if (!redis) {
                return res.status(500).json({ error: 'REDIS_URL 환경 변수가 설정되지 않았습니다.' });
            }

            // 모든 다이어리 키 조회
            const keys = await redis.keys('diary-*');
            
            if (keys.length === 0) {
                return res.status(200).json({ history: [] });
            }

            // 모든 키의 값을 가져오기
            const values = await redis.mget(keys);
            
            const history = values.map(val => JSON.parse(val));
            
            // 최신순(timestamp 내림차순)으로 정렬
            history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            return res.status(200).json({ history });
        } catch (error) {
            console.error('Redis History Error:', error);
            return res.status(500).json({ error: '히스토리를 불러오는 중 오류가 발생했습니다.' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};
