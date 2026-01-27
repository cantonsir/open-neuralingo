import React from 'react';
import { View } from '../../types';
import ConversationPractice from './ConversationPractice';
import LiveConversation from './LiveConversation';

interface SpeakingViewProps {
    mode: 'live' | 'tts';
    topic: string;
    contextId?: string;
    onNavigate: (view: View) => void;
}

export default function SpeakingView({ mode, topic, contextId, onNavigate }: SpeakingViewProps) {
    if (mode === 'live') {
        return <LiveConversation topic={topic} contextId={contextId} onBack={() => onNavigate('scenario')} />;
    } else {
        return <ConversationPractice topic={topic} contextId={contextId} onBack={() => onNavigate('scenario')} />;
    }
}
