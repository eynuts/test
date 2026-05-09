import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKeys = [
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3,
  import.meta.env.VITE_GEMINI_API_KEY_4,
  import.meta.env.VITE_GEMINI_API_KEY_5,
  import.meta.env.VITE_GEMINI_API_KEY_6,
  import.meta.env.VITE_GEMINI_API_KEY_7
].filter(Boolean);

// Track which keys are known to be rate-limited and when they were marked
const rateLimitedKeys = new Set()
let currentKeyIndex = 0

function shouldTryNextKey(error) {
  const msg = error?.message || ''
  return (
    msg.includes('429') ||
    msg.includes('403') ||
    msg.includes('401') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('denied access') ||
    error?.status === 429 ||
    error?.status === 403
  )
}

// Get next available key that is NOT known rate-limited
// Returns null if all keys are exhausted
function getNextAvailableKey() {
  const total = apiKeys.length

  for (let i = 0; i < total; i++) {
    const index = (currentKeyIndex + i) % total
    if (!rateLimitedKeys.has(index)) {
      currentKeyIndex = (index + 1) % total // advance for next call
      return { key: apiKeys[index], index }
    }
  }

  return null // all keys exhausted
}

async function callWithFallback(fn) {
  // Try every non-rate-limited key
  while (true) {
    const next = getNextAvailableKey()

    if (!next) {
      // All keys are rate-limited — clear the set and give up
      // (the rate limits reset daily, so clearing lets next session retry)
      rateLimitedKeys.clear()
      throw new Error('All API keys are rate limited. Please wait a moment and try again.')
    }

    try {
      const result = await fn(next.key)
      return result
    } catch (error) {
      if (shouldTryNextKey(error)) {
        console.warn(`⚠️ API key ${next.index + 1}/${apiKeys.length} failed (${error?.message?.match(/\[(\d+)\]/)?.[1] || 'error'}), trying next...`)
        rateLimitedKeys.add(next.index)
        continue // loop back and pick next available key
      }
      // Unrecoverable error — don't retry
      throw error
    }
  }
}

export async function generateContent(prompt) {
  return callWithFallback(async (apiKey) => {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  })
}

export async function chat(message, history = []) {
  return callWithFallback(async (apiKey) => {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const chatSession = model.startChat({
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.content }]
      })),
    })

    const result = await chatSession.sendMessage(message)
    const response = await result.response
    return response.text()
  })
}
