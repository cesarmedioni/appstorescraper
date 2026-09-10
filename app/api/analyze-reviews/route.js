import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// flash-lite over flash: this is extraction + counting, not deep reasoning, and on the
// free tier gemini-3.8-flash returns 503 on most calls and takes ~43s when it doesn't.
// Measured on 55 reviews: flash-lite 1.9s / no 503s, flash 43s / 2-in-3 calls failed.
const MODEL = 'gemini-3.5-flash-lite';
const MAX_REVIEWS = 2000;
const MAX_REVIEW_CHARS = 1500;
const MAX_ATTEMPTS = 3;

const SYSTEM_INSTRUCTION = `You analyze App Store user reviews for a mobile game publisher.

Ground every statement in the reviews provided — never invent issues, counts, or quotes.
When you cite volume, count actual reviews. When a pattern is limited to certain countries
or app versions, say so. If the reviews don't support an answer, say that instead of guessing.
Answer in the language the question is asked in.`;

// The SDK client is created per-request rather than at module load so a missing
// key surfaces as a clear 500 instead of an opaque API_KEY_INVALID from Google.
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({ apiKey });
}

function formatReviews(reviews) {
  return reviews
    .map((review, i) => {
      const content = String(review.content ?? '').slice(0, MAX_REVIEW_CHARS);
      const parts = [
        `[${i + 1}]`,
        review.country ? `Country: ${review.country}` : null,
        `Rating: ${review.rating}/5`,
        review.version ? `Version: ${review.version}` : null,
        review.date ? `Date: ${new Date(review.date).toISOString().slice(0, 10)}` : null,
        review.title ? `Title: ${review.title}` : null,
        `Review: ${content}`,
      ].filter(Boolean);
      return parts.join('\n');
    })
    .join('\n\n');
}

// The free tier returns 503 (overloaded) and 429 (rate limited) intermittently,
// so a bare single call fails often enough to look broken to the user.
async function generateWithRetry(ai, params) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error) {
      lastError = error;
      const status = error.status ?? Number(error.message?.match(/"code":(\d+)/)?.[1]);

      if (status !== 429 && status !== 503) throw error;
      if (attempt === MAX_ATTEMPTS) break;

      const backoffMs = 500 * 2 ** (attempt - 1);
      console.warn(`analyze-reviews: HTTP ${status}, retrying in ${backoffMs}ms (${attempt}/${MAX_ATTEMPTS})`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

export async function POST(request) {
  try {
    const { prompt, reviews } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'A question is required.' }, { status: 400 });
    }
    if (!Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json({ error: 'No reviews to analyze.' }, { status: 400 });
    }

    const analyzed = reviews.slice(0, MAX_REVIEWS);
    if (reviews.length > MAX_REVIEWS) {
      console.warn(`analyze-reviews: truncated ${reviews.length} reviews to ${MAX_REVIEWS}`);
    }

    const ai = getClient();
    const result = await generateWithRetry(ai, {
      model: MODEL,
      contents: `Here are ${analyzed.length} App Store reviews:\n\n${formatReviews(analyzed)}\n\n---\n\nQuestion: ${prompt}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingLevel: 'LOW' },
      },
    });

    const text = result.text;
    if (!text) {
      return NextResponse.json(
        { error: 'The model returned an empty response. Try rephrasing the question.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ response: text, analyzed: analyzed.length });
  } catch (error) {
    console.error('Error in analyze-reviews:', error);

    if (error.message === 'GEMINI_API_KEY_MISSING') {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.' },
        { status: 500 }
      );
    }

    const status = error.status ?? Number(error.message?.match(/"code":(\d+)/)?.[1]);

    if (status === 503) {
      return NextResponse.json(
        { error: 'Gemini is overloaded right now (free tier). Wait a moment and try again.' },
        { status: 503 }
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: 'Gemini free-tier rate limit reached. Wait a minute before retrying.' },
        { status: 429 }
      );
    }
    if (status === 400) {
      return NextResponse.json(
        { error: 'Gemini rejected the request — the API key may be invalid.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to analyze reviews.' }, { status: 500 });
  }
}
