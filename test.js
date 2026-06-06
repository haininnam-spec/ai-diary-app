require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent("테스트 메시지입니다.");
        console.log("Success:", result.response.text());
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
run();
