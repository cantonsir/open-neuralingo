import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error';
    onUnmount: () => void;
    duration?: number;
    actionLabel?: string;
    onAction?: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'success', onUnmount, duration = 3000, actionLabel, onAction }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onUnmount();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onUnmount]);

    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full flex items-center gap-4 shadow-xl z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
            {type === 'success' ? <Check size={16} className="text-green-400" /> : <X size={16} className="text-red-400" />}
            <span className="font-medium text-sm">{message}</span>
            {actionLabel && (
                <button
                    onClick={onAction}
                    className="ml-2 text-sm font-bold text-yellow-500 hover:text-yellow-400 uppercase tracking-wider"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default Toast;
