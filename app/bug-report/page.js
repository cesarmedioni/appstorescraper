"use client";

import { useState } from "react";
import { COUNTRY_MAPPING } from "../lib/countries";
import { extractAppId, fetchAppDetails } from "../lib/appStore";

export default function BugReport() {
  const [appStoreUrl, setAppStoreUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [appId, setAppId] = useState("");
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [timeRange, setTimeRange] = useState("weekly"); // "weekly" or "monthly"

  const [reviews, setReviews] = useState([]);
  const [isLoadingApp, setIsLoadingApp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isProcessingPrompt, setIsProcessingPrompt] = useState(false);

  const handleUrlChange = async (e) => {
    const url = e.target.value;
    setAppStoreUrl(url);
    setError("");
    setAppName("");
    setAppId("");

    if (!url) return;

    try {
      const id = extractAppId(url);
      setIsLoadingApp(true);
      const details = await fetchAppDetails(id);

      setAppId(id);
      setAppName(details.trackName || details.sellerName || "");

      // Pre-select the country present in the URL, if any
      const countryCode = new URL(url).pathname.split('/')[1];
      if (COUNTRY_MAPPING[countryCode]) {
        setSelectedCountries(prev =>
          prev.includes(countryCode) ? prev : [...prev, countryCode]
        );
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes("App ID")) {
        setError("Invalid App Store URL format. Please ensure it contains an app ID.");
      } else if (error.message === "No app found") {
        setError("No app found with this ID. Please check the URL and try again.");
      } else {
        setError("Invalid App Store URL or error fetching app details");
      }
    } finally {
      setIsLoadingApp(false);
    }
  };

  const toggleCountry = (code) => {
    setSelectedCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const fetchReviews = async (e) => {
    e.preventDefault();

    if (!appId) {
      setError("Enter a valid App Store URL first.");
      return;
    }
    if (selectedCountries.length === 0) {
      setError("Select at least one country.");
      return;
    }

    setIsLoading(true);
    setError("");
    setReviews([]);
    setPrompt("");
    setAiResponse("");

    try {
      const targetDate = new Date();
      const daysToSubtract = timeRange === "weekly" ? 7 : 30;
      targetDate.setDate(targetDate.getDate() - daysToSubtract);

      const fetchPromises = selectedCountries.map(async (country) => {
        try {
          const response = await fetch(
            `/api/reviews-v2?appId=${appId}&country=${country}&sort=mostRecent&num=100`
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

          return (data.reviews || [])
            .filter(review => new Date(review.date) >= targetDate)
            .map(review => ({
              ...review,
              country: COUNTRY_MAPPING[country],
              countryCode: country
            }));
        } catch (error) {
          console.error(`Error fetching reviews for ${country}:`, error);
          return [];
        }
      });

      const allCountryReviews = await Promise.all(fetchPromises);
      const combinedReviews = allCountryReviews.flat();

      combinedReviews.sort((a, b) => new Date(b.date) - new Date(a.date));

      setReviews(combinedReviews);

      if (combinedReviews.length === 0) {
        const timeRangeText = timeRange === "weekly" ? "7 days" : "30 days";
        setError(`No reviews found in the last ${timeRangeText} for the selected countries.`);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setError("Failed to fetch reviews. Please try again.");
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get AI response');
      }

      setAiResponse(data.response);
    } catch (error) {
      console.error('Error processing prompt:', error);
      setError(error.message || 'Failed to process prompt. Please try again.');
    } finally {
      setIsProcessingPrompt(false);
    }
  };

  const selectedCountryNames = selectedCountries
    .map(code => COUNTRY_MAPPING[code])
    .join(", ");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <form onSubmit={fetchReviews} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3">
              <label htmlFor="appStoreUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                App Store URL
              </label>
              <input
                type="url"
                id="appStoreUrl"
                value={appStoreUrl}
                onChange={handleUrlChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="https://apps.apple.com/fr/app/bereal-tes-amis-pour-de-vrai/id1459645446"
                required
              />
              {isLoadingApp && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Loading app details...
                </p>
              )}
            </div>

            <div>
              <label htmlFor="appName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                App Name
              </label>
              <input
                type="text"
                id="appName"
                value={appName}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="App name will be auto-filled"
                readOnly
              />
            </div>

            <div>
              <label htmlFor="appId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                App ID
              </label>
              <input
                type="text"
                id="appId"
                value={appId}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="App ID will be auto-filled"
                readOnly
              />
            </div>

            <div>
              <label htmlFor="timeRange" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Range
              </label>
              <select
                id="timeRange"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
              >
                <option value="weekly">Weekly (7 days)</option>
                <option value="monthly">Monthly (30 days)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Countries{selectedCountries.length > 0 && ` (${selectedCountries.length})`}
              </label>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setSelectedCountries(Object.keys(COUNTRY_MAPPING))}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCountries([])}
                  className="text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {Object.entries(COUNTRY_MAPPING).map(([code, name]) => (
                <label
                  key={code}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                    selectedCountries.includes(code)
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCountries.includes(code)}
                    onChange={() => toggleCountry(code)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100">{name}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? "Generating Report..." : "Generate Bug Report"}
          </button>

          {isLoading && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Fetching reviews from {selectedCountryNames}...
            </p>
          )}
        </form>

        {error && (
          <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found <span className="font-semibold text-gray-900 dark:text-gray-100">{reviews.length}</span> reviews for{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{appName || appId}</span> from the last {timeRange === "weekly" ? "7 days" : "30 days"}
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
