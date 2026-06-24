import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home | My Next.js App",
  description: "Welcome to our Next.js application with home and login pages",
};

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center p-4 bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-3xl mx-auto text-center px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 sm:text-5xl md:text-6xl animate-fade-in dark:text-white">
          Welcome to <span className="text-blue-600 dark:text-blue-400">My Next.js App</span>
        </h1>
        
        <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto animate-fade-in-delay dark:text-gray-300">
          This is a simple application built with Next.js, TypeScript, and Tailwind CSS.
          It features a responsive design with home and login pages.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-delay-2">
          <Link 
            href="/login" 
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            Login to Get Started
          </Link>
          
          <Link 
            href="#" 
            className="inline-block bg-white hover:bg-gray-100 text-blue-600 font-medium py-3 px-8 rounded-lg border border-gray-300 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-blue-400 dark:border-gray-700"
          >
            Learn More
          </Link>
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow dark:bg-gray-800 animate-fade-in-delay">
            <div className="text-blue-500 mb-4 dark:text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Fast Performance</h3>
            <p className="text-gray-600 dark:text-gray-300">Built with Next.js for optimal performance and user experience.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow dark:bg-gray-800 animate-fade-in-delay" style={{ animationDelay: "0.2s" }}>
            <div className="text-blue-500 mb-4 dark:text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Secure Design</h3>
            <p className="text-gray-600 dark:text-gray-300">Security best practices implemented throughout the application.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow dark:bg-gray-800 animate-fade-in-delay" style={{ animationDelay: "0.4s" }}>
            <div className="text-blue-500 mb-4 dark:text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Responsive UI</h3>
            <p className="text-gray-600 dark:text-gray-300">Fully responsive design that works on all devices and screen sizes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
