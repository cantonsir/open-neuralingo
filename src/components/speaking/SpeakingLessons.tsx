import React from 'react';
import { Mic } from 'lucide-react';

export default function SpeakingLessons() {
    return (
        <div className="flex-1 p-8 bg-white dark:bg-gray-950 flex flex-col items-center justify-center text-center">
            {/* Icon */}
            <div className="w-32 h-32 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-8">
                <Mic className="w-16 h-16 text-green-600 dark:text-green-400" />
            </div>

            {/* Coming Soon Badge */}
            <div className="inline-block px-6 py-2 bg-green-100 dark:bg-green-900/20 rounded-full mb-6">
                <span className="text-sm font-semibold text-green-700 dark:text-green-400 tracking-wider">
                    COMING SOON
                </span>
            </div>

            {/* Title */}
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
                Speaking Lessons
            </h2>

            {/* Description */}
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mb-12">
                Lessons are on the way. You will be able to practice pronunciation,
                fluency, and conversation skills with AI-guided lessons.
            </p>

            {/* Coming Soon Button */}
            <button
                disabled
                className="px-8 py-4 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl font-semibold text-lg cursor-not-allowed opacity-75"
            >
                Coming Soon
            </button>
        </div>
    );
}
