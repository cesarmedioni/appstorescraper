import { NextResponse } from 'next/server';
import store from 'app-store-scraper';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');
    const country = searchParams.get('country') || 'us';
    const sort = searchParams.get('sort') || 'mostRecent';
    const num = parseInt(searchParams.get('num')) || 50;

    if (!appId) {
      return NextResponse.json(
        { error: 'App ID is required' },
        { status: 400 }
      );
    }

    // Map the sort parameter to app-store-scraper's sort options
    const sortMapping = {
      'mostRecent': store.sort.RECENT
    };

    // Fetch all available pages (up to 10)
    const allReviews = [];
    for (let page = 1; page <= 10; page++) {
      try {
        const pageReviews = await store.reviews({
          id: appId,
          country: country,
          sort: sortMapping[sort] || store.sort.RECENT,
          page: page
        });

        if (pageReviews.length === 0) {
          break; // No more reviews available
        }

        allReviews.push(...pageReviews);

        // If we've reached the requested number of reviews, stop fetching
        if (allReviews.length >= num) {
          break;
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error);
        break; // Stop if we encounter an error
      }
    }

    // Transform the reviews to match our existing format
    const transformedReviews = allReviews
      .slice(0, num) // Limit to requested number
      .map(review => ({
        id: review.id,
        rating: review.score,
        title: review.title,
        content: review.text,
        userName: review.userName,
        date: review.updated,
        version: review.version
      }));

    return NextResponse.json({ 
      reviews: transformedReviews,
      totalFetched: allReviews.length,
      requestedCount: num
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
} 