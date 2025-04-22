import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { prompt, reviews } = await request.json();

    // Format reviews for the prompt
    const formattedReviews = reviews.map(review => 
      `Rating: ${review.rating} stars\nTitle: ${review.title}\nContent: ${review.content}\nDate: ${review.date}\n`
    ).join('\n');

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      "Provide concise and insightful analysis based on the reviews provided.",
      `Here are the reviews to analyze:\n\n${formattedReviews}\n\nQuestion: ${prompt}`
    ]);

    const response = result.response;
    const text = await response.text();

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error('Error in analyze-reviews:', error);
    return NextResponse.json(
      { error: 'Failed to analyze reviews', details: error.message },
      { status: 500 }
    );
  }
} 