"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const COUNTRY_MAPPING = {
  jp: "Japan",
  fr: "France",
  us: "United States",
  de: "Germany",
  es: "Spain",
  it: "Italy",
  gb: "United Kingdom",
  pl: "Poland",
  be: "Belgium",
  ca: "Canada",
  nl: "Netherlands",
  mx: "Mexico",
  ch: "Switzerland",
  pt: "Portugal",
  ie: "Ireland",
  gr: "Greece",
  at: "Austria",
  co: "Colombia",
  hu: "Hungary"
};

const COUNTRY_CODE_TO_NAME = Object.entries(COUNTRY_MAPPING).reduce((acc, [code, name]) => {
  acc[code] = name;
  return acc;
}, {});

const COUNTRY_NAME_TO_CODE = Object.entries(COUNTRY_MAPPING).reduce((acc, [code, name]) => {
  acc[name] = code;
  return acc;
}, {});

function HomeContent() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    appName: "",
    appId: "",
    country: "",
    reviewCount: "",
    appStoreUrl: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isProcessingPrompt, setIsProcessingPrompt] = useState(false);

  // Handle URL parameters to pre-fill form
  useEffect(() => {
    const urlParam = searchParams.get('url');
    const reviewsParam = searchParams.get('reviews');
    
    if (urlParam) {
      // Pre-fill the URL and trigger the auto-fill logic
      const processUrl = async () => {
        setFormData(prev => ({ 
          ...prev, 
          appStoreUrl: urlParam,
          reviewCount: reviewsParam || ""
        }));
        
        try {
          const urlObj = new URL(urlParam);
          const pathParts = urlObj.pathname.split('/');
          const countryCode = pathParts[1];
          const appId = extractAppId(urlParam);
          
          setIsLoading(true);
          const appDetails = await fetchAppDetails(appId);
          
          setFormData(prev => ({
            ...prev,
            appId: appId,
            appName: appDetails.sellerName || "",
            country: countryCode,
            reviewCount: reviewsParam || "",
            appStoreUrl: urlParam
          }));
        } catch (error) {
          console.error('Error processing URL parameter:', error);
          setError("Error processing pre-filled URL");
        } finally {
          setIsLoading(false);
        }
      };
      
      processUrl();
    } else {
      // Clear form data when no URL parameters (e.g., when clicking Home)
      setFormData({
        appName: "",
        appId: "",
        country: "",
        reviewCount: "",
        appStoreUrl: ""
      });
      setReviews([]);
      setError("");
      setPrompt("");
      setAiResponse("");
    }
  }, [searchParams]);

  const fetchAppDetails = async (appId) => {
    try {
      const response = await fetch(`/api/app-details?id=${appId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        return data.results[0];
      }
      throw new Error("No app found");
    } catch (error) {
      console.error('Error fetching app details:', error);
      throw error;
    }
  };

  const extractAppId = (url) => {
    // Get the last part of the URL path
    const pathParts = url.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    
    // Extract just the numeric ID
    const numericId = lastPart.match(/\d+/);
    if (numericId) {
      return numericId[0];
    }
    throw new Error("Could not extract App ID from URL");
  };

  const handleUrlChange = async (e) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, appStoreUrl: url }));
    setError("");

    if (!url) return;

    try {
      const urlObj = new URL(url);
      
      // Extract country code from URL path parts
      const pathParts = urlObj.pathname.split('/');
      const countryCode = pathParts[1]; // e.g., "fr" from "/fr/app/..."
      
      // Extract app ID
      const appId = extractAppId(url);
      console.log('Extracted App ID:', appId); // Debug log
      
      setIsLoading(true);
      const appDetails = await fetchAppDetails(appId);
      
      setFormData(prev => ({
        ...prev,
        appId: appId,
        appName: appDetails.sellerName || "",
        country: countryCode || prev.country
      }));
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes("App ID")) {
        setError("Invalid App Store URL format. Please ensure it contains an app ID.");
      } else if (error.message.includes("HTTP error")) {
        setError("Error fetching app details. Please check the App ID and try again.");
      } else if (error.message === "No app found") {
        setError("No app found with this ID. Please check the URL and try again.");
      } else {
        setError("Invalid App Store URL or error fetching app details");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsFetchingReviews(true);
    // Reset prompt and AI response when fetching new reviews
    setPrompt("");
    setAiResponse("");

    try {
      // New implementation using app-store-scraper
      const response = await fetch(
        `/api/reviews-v2?appId=${formData.appId}&country=${formData.country}&sort=mostRecent&num=${formData.reviewCount || 50}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setReviews(data.reviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setError(error.message || "Failed to fetch reviews. Please try again.");
    } finally {
      setIsFetchingReviews(false);
    }
  };

  /* Old implementation using direct App Store API
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsFetchingReviews(true);

    try {
      const response = await fetch(
        `/api/reviews?appId=${formData.appId}&country=${formData.country}&sort=mostRecent`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setReviews(data.reviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setError(error.message || "Failed to fetch reviews. Please try again.");
    } finally {
      setIsFetchingReviews(false);
    }
  };
  */

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
            date: review.date
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
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
          <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm">
            <div>
              <label htmlFor="appStoreUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                App Store URL
              </label>
              <input
                type="url"
                id="appStoreUrl"
                name="appStoreUrl"
                value={formData.appStoreUrl}
                onChange={handleUrlChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="https://apps.apple.com/fr/app/bereal-tes-amis-pour-de-vrai/id1459645446"
                required
              />
              {error && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
              {isLoading && (
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
                name="appName"
                value={formData.appName}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="App name will be auto-filled"
                required
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
                name="appId"
                value={formData.appId}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="App ID will be auto-filled"
                required
                readOnly
              />
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                App Store Country
              </label>
              <select
                id="country"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Select a country</option>
                {Object.entries(COUNTRY_MAPPING).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reviewCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Reviews
              </label>
              <input
                type="number"
                id="reviewCount"
                name="reviewCount"
                value={formData.reviewCount}
                onChange={handleInputChange}
                min="1"
                max="1000"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter number of reviews to fetch"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Fetch Reviews"}
            </button>
          </form>

          {reviews.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <form onSubmit={handlePromptSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ask about these reviews
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="e.g., What are the main complaints in these reviews?"
                      />
                      <button
                        type="submit"
                        disabled={isProcessingPrompt}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
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
                          // This is bold text
                          return (
                            <div key={index} className="font-bold text-gray-800 dark:text-gray-100 mt-4 mb-2">
                              {part}
                            </div>
                          );
                        }
                        // Split by asterisk but keep empty strings to preserve structure
                        return part.split(/(\*)/).map((subPart, subIndex) => {
                          if (subPart === '*') {
                            return null; // Skip the asterisk itself
                          }
                          if (subIndex % 2 === 1) {
                            // This is bullet point content
                            return (
                              <div key={`${index}-${subIndex}`} className="ml-4 flex items-start">
                                <span className="mr-2">•</span>
                                <span>{subPart.trim()}</span>
                              </div>
                            );
                          }
                          // Regular paragraph text - split by double newlines
                          return subPart.split('\n\n').map((paragraph, pIndex) => {
                            const trimmedParagraph = paragraph.trim();
                            return trimmedParagraph ? (
                              <p key={`${index}-${subIndex}-${pIndex}`} className="mb-2">
                                {trimmedParagraph}
                              </p>
                            ) : null;
                          });
                        }).filter(Boolean); // Remove null values
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
                    {reviews.map((review) => (
                      <tr key={review.id}>
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

          {isFetchingReviews && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
