// Background service worker for Coursera Quiz Automation

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.includes('coursera.org')) {
    return;
  }

  if (command === 'solve-quiz') {
    chrome.tabs.sendMessage(tab.id, { action: 'solveQuiz' });
  } else if (command === 'next-question') {
    chrome.tabs.sendMessage(tab.id, { action: 'nextQuestion' });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAnswer') {
    handleGetAnswer(request.question, request.options)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'getAnswers') {
    handleGetAnswers(request.questions)
      .then(results => sendResponse(results))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Get answer for a single question
async function handleGetAnswer(question, options) {
  const settings = await chrome.storage.sync.get({
    aiProvider: 'openai',
    openaiKey: '',
    openaiModel: 'gpt-4o',
    geminiKey: '',
    geminiModel: 'gemini-1.5-pro'
  });

  const provider = settings.aiProvider;
  const apiKey = provider === 'openai' ? settings.openaiKey : settings.geminiKey;
  const model = provider === 'openai' ? settings.openaiModel : settings.geminiModel;

  if (!apiKey) {
    throw new Error('API key not configured. Please set it in extension settings.');
  }

  if (provider === 'openai') {
    return await callOpenAI(apiKey, model, question, options);
  } else {
    return await callGemini(apiKey, model, question, options);
  }
}

// Get answers for multiple questions (batch)
async function handleGetAnswers(questions) {
  const results = [];

  for (const q of questions) {
    try {
      const result = await handleGetAnswer(q.question, q.options);
      results.push({
        questionIndex: q.index,
        ...result
      });
    } catch (error) {
      results.push({
        questionIndex: q.index,
        error: error.message
      });
    }
  }

  return results;
}

// Call OpenAI API
async function callOpenAI(apiKey, model, question, options) {
  const prompt = buildPrompt(question, options);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: `You are an expert quiz solver. Analyze the question and options carefully.
Your response must be valid JSON with this exact format:
{
  "answer": "The exact text of the correct option(s)",
  "answerIndices": [0],
  "confidence": 95,
  "explanation": "Brief explanation of why this is correct"
}

For multiple correct answers, include all correct option texts separated by " | " and all indices in the array.
The answerIndices array should contain 0-based indices of correct options.
Confidence should be 0-100 based on how certain you are.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';

  return parseAIResponse(content, options);
}

// Call Google Gemini API
async function callGemini(apiKey, model, question, options) {
  const prompt = buildPrompt(question, options);

  const systemPrompt = `You are an expert quiz solver. Analyze the question and options carefully.
Your response must be valid JSON with this exact format:
{
  "answer": "The exact text of the correct option(s)",
  "answerIndices": [0],
  "confidence": 95,
  "explanation": "Brief explanation of why this is correct"
}

For multiple correct answers, include all correct option texts separated by " | " and all indices in the array.
The answerIndices array should contain 0-based indices of correct options.
Confidence should be 0-100 based on how certain you are.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt + '\n\n' + prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return parseAIResponse(content, options);
}

// Build the prompt for the AI
function buildPrompt(question, options) {
  let prompt = `Question: ${question}\n\nOptions:\n`;

  options.forEach((opt, i) => {
    prompt += `${i}. ${opt}\n`;
  });

  prompt += `\nAnalyze this question and determine the correct answer(s). Respond with JSON only.`;

  return prompt;
}

// Parse the AI response
function parseAIResponse(content, options) {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;

    // Remove markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object in the response
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize the response
    const result = {
      answer: parsed.answer || '',
      answerIndices: Array.isArray(parsed.answerIndices) ? parsed.answerIndices : [0],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 80,
      explanation: parsed.explanation || ''
    };

    // If answerIndices wasn't properly parsed, try to find by matching text
    if (result.answerIndices.length === 0 || result.answerIndices[0] === undefined) {
      result.answerIndices = findMatchingIndices(result.answer, options);
    }

    return result;
  } catch (error) {
    console.error('Failed to parse AI response:', content, error);

    // Fallback: try to extract answer from text
    return {
      answer: content.substring(0, 200),
      answerIndices: [0],
      confidence: 50,
      explanation: 'Failed to parse structured response'
    };
  }
}

// Find matching option indices based on answer text
function findMatchingIndices(answerText, options) {
  const indices = [];
  const answerLower = answerText.toLowerCase();

  options.forEach((opt, i) => {
    const optLower = opt.toLowerCase();
    // Check if option text is contained in answer or vice versa
    if (answerLower.includes(optLower) || optLower.includes(answerLower)) {
      indices.push(i);
    }
  });

  // If no match found, try partial matching
  if (indices.length === 0) {
    const answerWords = answerLower.split(/\s+/).filter(w => w.length > 3);
    options.forEach((opt, i) => {
      const optLower = opt.toLowerCase();
      const matchCount = answerWords.filter(word => optLower.includes(word)).length;
      if (matchCount >= answerWords.length * 0.5) {
        indices.push(i);
      }
    });
  }

  return indices.length > 0 ? indices : [0];
}
