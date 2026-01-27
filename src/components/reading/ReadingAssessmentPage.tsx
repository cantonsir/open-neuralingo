import React from 'react';
import { ClipboardCheck } from 'lucide-react';

export default function ReadingAssessmentPage() {
    return (
        <div className="flex-1 p-8 bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
                <ClipboardCheck className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Reading Assessment</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Take a comprehension quiz based on your reading materials.
            </p>
            <button className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                Select Material
            </button>
        </div>
    );
}
