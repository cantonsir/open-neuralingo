import React from 'react';
import { View } from '../../types';
import LiveConversation from './LiveConversation';

interface SpeakingViewProps {
    mode: 'live' | 'tts';
    topic: string;
    contextId?: string;
    onNavigate: (view: View) => void;
}

export default function SpeakingView({ mode, topic, contextId, onNavigate }: SpeakingViewProps) {
    // All modes now route to LiveConversation (full audio experience)
    // The new text-based conversation mode is handled directly in SpeakingScenario
    return <LiveConversation topic={topic} contextId={contextId} onBack={() => onNavigate('scenario')} />;
}
