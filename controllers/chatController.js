const axios = require("axios");

// Add a new chat message
const addChat = async (req, res) => {
    const { userInput } = req.body;
    const token = process.env.HUGGINGFACE_API_KEY;

    try {
        const response = await axios.post(
            "https://api-inference.huggingface.co/models/gpt2",
            { inputs: userInput },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            }
        );

        // Check if the response is valid JSON
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            const generatedText = response.data[0]?.generated_text || "Sorry, I couldn't generate a response.";
            res.json({ 
                response: generatedText,
                sender: 'bot'
            });
        } else {
            res.status(500).json({ 
                message: "Unexpected response format", 
                details: response.data 
            });
        }
    } catch (error) {
        console.error("Error fetching AI response:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            message: "Error fetching AI response",
            details: error.response?.data || error.message,
        });
    }
};

module.exports = { addChat };
