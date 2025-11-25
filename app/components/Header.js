"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

export default function Header() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlParam = searchParams.get('url');
  
  // Check if we're on the BeReal page by looking for the BeReal URL parameter
  const isBeRealPage = pathname === "/" && urlParam && urlParam.includes('bereal');
  const isHomePage = pathname === "/" && !urlParam;
  const isBugReportPage = pathname === "/bereal-bug-report";

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link 
              href="/" 
              className={`text-sm font-medium transition-colors ${
                isHomePage
                  ? "text-blue-600 dark:text-blue-400" 
                  : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
            >
              Home
            </Link>
            <Link 
              href="/?url=https://apps.apple.com/us/app/bereal-photos-friends-daily/id1459645446&reviews=100" 
              className={`text-sm font-medium transition-colors ${
                isBeRealPage
                  ? "text-blue-600 dark:text-blue-400" 
                  : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
            >
              BeReal
            </Link>
            <Link 
              href="/bereal-bug-report" 
              className={`text-sm font-medium transition-colors ${
                isBugReportPage
                  ? "text-blue-600 dark:text-blue-400" 
                  : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
            >
              BeReal bug report
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

