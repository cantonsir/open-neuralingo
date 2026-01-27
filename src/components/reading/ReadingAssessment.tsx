import React, { useState, useEffect } from 'react';
import { generateReadingQuestions, ReadingQuestion } from '../../services/geminiService';
import { Loader2, CheckCircle, XCircle, BrainCircuit } from 'lucide-react';

interface ReadingAssessmentProps {
    text: string;
    onClose: () => void;
}

export default function ReadingAssessment({ text, onClose }: ReadingAssessmentProps) {
    const [questions, setQuestions] = useState<ReadingQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const loadquestions = async () => {
            // Use a slice of text to avoid token limits
            const generated = await generateReadingQuestions(text.slice(0, 3000));
            setQuestions(generated);
            setLoading(false);
        };
        loadquestions();
    }, [text]);

    const handleAnswer = (qId: number, optionIdx: number) => {
        if (submitted) return;
        setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
    };

    const calculateScore = () => {
        let correct = 0;
        questions.forEach(q => {
            if (answers[q.id] === q.correctAnswer) correct++;
        });
        return correct;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <BrainCircuit className="text-indigo-500" />
                        Comprehension Check
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">✕</button>
                </div>

                <div className="p-6 space-y-8 flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                            <p className="text-gray-500">Analyze text and generating questions...</p>
                        </div>
                    ) : questions.length === 0 ? (
                        <p className="text-center text-red-500">Failed to generate questions. Try again later.</p>
                    ) : (
                        questions.map((q, idx) => (
                            <div key={q.id} className="space-y-3">
                                <p className="font-medium text-lg text-gray-900 dark:text-white">
                                    {idx + 1}. {q.question}
                                </p>
                                <div className="space-y-2 pl-4">
                                    {q.options.map((opt, i) => {
                                        const isSelected = answers[q.id] === i;
                                        const isCorrect = q.correctAnswer === i;
                                        let cls = "w-full text-left p-3 rounded-lg border transition-all ";

                                        if (submitted) {
                                            if (isCorrect) cls += "bg-green-100 border-green-500 text-green-900 dark:bg-green-900/30 dark:text-green-100";
                                            else if (isSelected) cls += "bg-red-100 border-red-500 text-red-900 dark:bg-red-900/30 dark:text-red-100";
                                            else cls += "border-gray-200 dark:border-gray-700 opacity-50";
                                        } else {
                                            if (isSelected) cls += "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100";
                                            else cls += "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800";
                                        }

                                        return (
                                            <button
                                                key={i}
                                                onClick={() => handleAnswer(q.id, i)}
                                                className={cls}
                                            >
                                                <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                                {submitted && (
                                    <div className="pl-4 mt-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                        <strong>Explanation:</strong> {q.explanation}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {!loading && questions.length > 0 && (
                    <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 sticky bottom-0">
                        {!submitted ? (
                            <div className="flex justify-end gap-3">
                                <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-900">Cancel</button>
                                <button
                                    onClick={() => setSubmitted(true)}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                                    disabled={Object.keys(answers).length < questions.length}
                                >
                                    Submit Answers
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="text-lg font-bold">
                                    Score: {calculateScore()} / {questions.length}
                                </div>
                                <button onClick={onClose} className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg">
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
