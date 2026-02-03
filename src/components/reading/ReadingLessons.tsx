import React from 'react';
import { BookOpen } from 'lucide-react';

export default function ReadingLessons() {
    return (
        <div className="flex-1 p-8 bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
                <BookOpen className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 mb-3">
                Coming Soon
            </span>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Reading Lessons</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Lessons are on the way. You will be able to generate vocabulary and grammar lessons from your library.
            </p>
            <button
                className="mt-8 px-6 py-3 bg-blue-100 text-blue-400 rounded-lg font-medium cursor-not-allowed"
                disabled
            >
                Coming Soon
            </button>
        </div>
    );
}
