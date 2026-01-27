import React from 'react';
import { Mic } from 'lucide-react';

export default function SpeakingLessons() {
    return (
        <div className="flex-1 p-8 bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                <Mic className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Speaking Drills</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Practice pronunciation and fluency with AI-guided drills.
            </p>
            <button className="mt-8 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                Start Drill
            </button>
        </div>
    );
}
