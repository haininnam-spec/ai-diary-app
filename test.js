require('dotenv').config();

async function run() {
    let url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}&pageSize=1000`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.models) {
        const flashModels = data.models.filter(m => m.name.includes('flash'));
        console.log("Available flash models:");
        flashModels.forEach(m => console.log(m.name));
    } else {
        console.log("No models returned", data);
    }
}
run();
run();
