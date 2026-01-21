const API_KEY = "AIzaSyAwxJpmkOCgld9kG4JNNLopZrjA9qfjhB8";
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function listModels() {
    console.log("Fetching models from:", URL.replace(API_KEY, "KEY_HIDDEN"));
    try {
        const response = await fetch(URL);
        const data = await response.json();

        if (data.error) {
            console.error("API Error:", data.error);
        } else if (data.models) {
            console.log("Available Models:");
            data.models.forEach((m: any) => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
        } else {
            console.log("Unexpected response:", data);
        }
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

listModels();
