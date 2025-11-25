"use client";

import { useState } from "react";

const BEREAL_APP_ID = "1459645446";
const COUNTRIES = ["us", "fr", "jp", "es", "de", "be", "it"];
const COUNTRY_NAMES = {
  us: "United States",
  fr: "France",
  jp: "Japan",
  es: "Spain",
  de: "Germany",
  be: "Belgium",
  it: "Italy"
};

export default function BeRealBugReport() {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isProcessingPrompt, setIsProcessingPrompt] = useState(false);
  const [timeRange, setTimeRange] = useState("weekly"); // "weekly" or "monthly"

  const fetchReviews = async () => {
    setIsLoading(true);
    setError("");
    setReviews([]);
    setPrompt("");
    setAiResponse("");

    try {
      const targetDate = new Date();
      const daysToSubtract = timeRange === "weekly" ? 7 : 30;
      targetDate.setDate(targetDate.getDate() - daysToSubtract);

      // Fetch reviews for all countries in parallel
      const fetchPromises = COUNTRIES.map(async (country) => {
        try {
          const response = await fetch(
            `/api/reviews-v2?appId=${BEREAL_APP_ID}&country=${country}&sort=mostRecent&num=100`
          );

          if (!response.ok) {
            console.error(`Failed to fetch reviews for ${country}`);
            return [];
          }

          const data = await response.json();
          
          if (data.error) {
            console.error(`Error for ${country}:`, data.error);
            return [];
          }

          // Filter reviews from the target date and add country info
          const filteredReviews = (data.reviews || [])
            .filter(review => {
              const reviewDate = new Date(review.date);
              return reviewDate >= targetDate;
            })
            .map(review => ({
              ...review,
              country: COUNTRY_NAMES[country],
              countryCode: country
            }));

          return filteredReviews;
        } catch (error) {
          console.error(`Error fetching reviews for ${country}:`, error);
          return [];
        }
      });

      const allCountryReviews = await Promise.all(fetchPromises);
      const combinedReviews = allCountryReviews.flat();

      // Sort by date (most recent first)
      combinedReviews.sort((a, b) => new Date(b.date) - new Date(a.date));

      setReviews(combinedReviews);

      if (combinedReviews.length === 0) {
        const timeRangeText = timeRange === "weekly" ? "7 days" : "30 days";
        setError(`No reviews found in the last ${timeRangeText} for the selected countries.`);
      }
    } catch (error) {
      console.error('Error fetching weekly reviews:', error);
      setError("Failed to fetch weekly reviews. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || reviews.length === 0) return;

    setIsProcessingPrompt(true);
    try {
      const response = await fetch('/api/analyze-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          reviews: reviews.map(review => ({
            rating: review.rating,
            title: review.title,
            content: review.content,
            date: review.date,
            country: review.country
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      setAiResponse(data.response);
    } catch (error) {
      console.error('Error processing prompt:', error);
      setError('Failed to process prompt. Please try again.');
    } finally {
      setIsProcessingPrompt(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              disabled={isLoading}
              className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
            >
              <option value="weekly">Weekly (7 days)</option>
              <option value="monthly">Monthly (30 days)</option>
            </select>
            <button
              onClick={fetchReviews}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? "Generating Report..." : "Generate Bug Report"}
            </button>
          </div>
          {isLoading && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Fetching reviews from US, France, Japan, Spain, Germany, Belgium, and Italy...
            </p>
          )}
        </div>

        {error && (
          <div className="mb-8 bg-red-50 dark:bg-red-900 p-4 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found <span className="font-semibold text-gray-900 dark:text-gray-100">{reviews.length}</span> reviews from the last {timeRange === "weekly" ? "7 days" : "30 days"}
                </p>
              </div>
              
              {/* Prompt Shortcuts */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quick Analysis
                </label>
                <button
                  onClick={() => {
                    const bugReportPrompt = "List all bugs and issues reported by users. Format:\n\n* [X users] Brief description of the issue - mention affected countries if relevant\n\nBE CONCISE. One line per bug. Order by volume (most reported first).";
                    setPrompt(bugReportPrompt);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  📊 Generate Priority Bug Report
                </button>
              </div>

              <form onSubmit={handlePromptSubmit} className="space-y-4">
                <div>
                  <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ask about these reviews
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      id="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows="3"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                      placeholder="e.g., What are the main bugs reported this week?"
                    />
                    <button
                      type="submit"
                      disabled={isProcessingPrompt}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 self-start"
                    >
                      {isProcessingPrompt ? "Processing..." : "Ask"}
                    </button>
                  </div>
                </div>
              </form>
              {aiResponse && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI Analysis:</h3>
                  <div className="text-sm text-gray-600 dark:text-gray-200 space-y-4">
                    {aiResponse.split('**').map((part, index) => {
                      if (index % 2 === 1) {
                        return (
                          <div key={index} className="font-bold text-gray-800 dark:text-gray-100 mt-4 mb-2">
                            {part}
                          </div>
                        );
                      }
                      return part.split(/(\*)/).map((subPart, subIndex) => {
                        if (subPart === '*') {
                          return null;
                        }
                        if (subIndex % 2 === 1) {
                          return (
                            <div key={`${index}-${subIndex}`} className="ml-4 flex items-start">
                              <span className="mr-2">•</span>
                              <span>{subPart.trim()}</span>
                            </div>
                          );
                        }
                        return subPart.split('\n\n').map((paragraph, pIndex) => {
                          const trimmedParagraph = paragraph.trim();
                          return trimmedParagraph ? (
                            <p key={`${index}-${subIndex}-${pIndex}`} className="mb-2">
                              {trimmedParagraph}
                            </p>
                          ) : null;
                        });
                      }).filter(Boolean);
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Country
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Rating
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Title
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/2">
                      Review
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Version
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {reviews.map((review, idx) => (
                    <tr key={`${review.id}-${idx}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{review.country}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{"⭐".repeat(review.rating)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{review.title}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-gray-100 w-full">{review.content}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {new Date(review.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{review.version}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

