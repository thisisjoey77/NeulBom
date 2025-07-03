// api-helper.js - Helper function to call local API server instead of OpenAI directly
// This keeps API keys secure on the server side

/**
 * Call OpenAI API through local server
 * @param {Array} messages - Array of message objects for the conversation
 * @param {string} model - Model to use (default: gpt-3.5-turbo)
 * @returns {Promise} - Promise that resolves to the API response
 */
async function callOpenAI(messages, model = 'gpt-3.5-turbo') {
  try {
    const response = await fetch('https://54.180.16.112:5000//api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model
      })
    });

    if (!response.ok) {
      throw new Error(`API server error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

// Make function available globally
window.callOpenAI = callOpenAI;
