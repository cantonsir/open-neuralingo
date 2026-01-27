import { generateConversationScript, generateChatResponse } from './geminiService';
import { generateSpeech } from './ttsService';

type ServiceStatus = 'disconnected' | 'connecting' | 'listening' | 'speaking';

interface LiveServiceListeners {
    onStatusChange: (status: ServiceStatus) => void;
    onAudioLevel: (level: number) => void;
    onTranscriptUpdate: (text: string, isUser: boolean) => void;
}

export class GeminiLiveService {
    private status: ServiceStatus = 'disconnected';
    private listeners: LiveServiceListeners;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private animationFrame: number | null = null;
    private conversationHistory: { role: 'user' | 'model', text: string }[] = [];
    private topic: string = '';

    // Audio Input & STT
    private stream: MediaStream | null = null;
    private recognition: any | null = null;
    private isRecognitionRunning: boolean = false;

    // Simulation timers
    private responseTimer: number | null = null;
    private silenceTimer: number | null = null;

    constructor(listeners: LiveServiceListeners) {
        this.listeners = listeners;
    }

    public async startSession(topic: string, contextId?: string) {
        this.topic = topic;
        this.conversationHistory = [];
        this.updateStatus('connecting');

        try {
            // Request Microphone Access
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Connect to Visualizer
            this.startAudioVisualizer();

            // Initialize Speech Recognition
            this.initSpeechRecognition();

            // Simulate connection delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            this.updateStatus('listening');

            // Start the conversation with an AI greeting
            this.simulateAIResponse(`Hi! I'm ready to roleplay about "${topic}". You can start speaking whenever you're ready.`);

        } catch (error) {
            console.error('Failed to start session:', error);
            alert("Microphone access denied or not available. Please check your permissions.");
            this.updateStatus('disconnected');
        }
    }

    public async endSession() {
        this.updateStatus('disconnected');
        this.stopAudioVisualizer();
        this.stopSpeechRecognition();

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.responseTimer) clearTimeout(this.responseTimer);
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
    }

    public sendUserMessage(text: string) {
        if (this.status !== 'listening') return;

        // Add user message to transcript
        this.conversationHistory.push({ role: 'user', text });
        this.listeners.onTranscriptUpdate(text, true);

        // Temporarily pause recognition while AI is processing/speaking
        // this.stopSpeechRecognition(); 

        this.scheduleAIResponse(text);
    }

    // --- Speech Recognition ---

    private initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn("Speech Recognition not supported in this browser.");
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false; // We want single turns
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US'; // Default to English for now

        this.recognition.onstart = () => {
            this.isRecognitionRunning = true;
            console.log('Voice recognition activated.');
        };

        this.recognition.onend = () => {
            this.isRecognitionRunning = false;
            // unique logic: restart if we are still in 'listening' mode and haven't processed a result yet
            if (this.status === 'listening') {
                // Simple debounce to prevent rapid loops if something is wrong
                setTimeout(() => {
                    if (this.status === 'listening' && !this.isRecognitionRunning) {
                        try { this.recognition?.start(); } catch (e) { }
                    }
                }, 500);
            }
        };

        this.recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            console.log('Input recognized:', transcript);
            if (transcript.trim().length > 0) {
                this.sendUserMessage(transcript);
            }
        };

        // Start initially
        try {
            this.recognition.start();
        } catch (e) {
            console.error("Failed to start recognition", e);
        }
    }

    private stopSpeechRecognition() {
        if (this.recognition) {
            this.recognition.onend = null; // Prevent auto-restart
            this.recognition.stop();
            this.isRecognitionRunning = false;
        }
    }

    // --- Simulation Logic ---

    private async scheduleAIResponse(userInput: string) {
        // Simulate "thinking" time
        const thinkingTime = 1000 + Math.random() * 1000;

        this.responseTimer = window.setTimeout(async () => {
            const aiText = await this.generateAIResponse(userInput);
            await this.simulateAIResponse(aiText);
        }, thinkingTime);
    }

    private async generateAIResponse(userInput: string): Promise<string> {
        // Use the real API call now
        try {
            return await generateChatResponse(this.conversationHistory, this.topic);
        } catch (e) {
            console.error("Generate Live Response Error", e);
            return "I'm having trouble connecting. Let's try again.";
        }
    }

    private async simulateAIResponse(text: string) {
        this.updateStatus('speaking');
        // Stop recognition so we don't pick up the AI's own voice
        this.stopSpeechRecognition();

        // Add to transcript
        this.conversationHistory.push({ role: 'model', text });
        this.listeners.onTranscriptUpdate(text, false);

        // Generate TTS
        try {
            const audioUrl = await generateSpeech({ text, voiceName: 'Kore' });
            const audio = new Audio(audioUrl);

            // Connect audio to visualizer (AI speaking visualization)
            // Note: We need to disconnect the mic from the visualizer first? 
            // Ideally we mix them, but for simplicity let's just create a new source if needed or rely on the analyser reuse.
            // Actually, we can just connect the element source to the SAME analyser.

            if (this.audioContext && this.analyser) {
                const source = this.audioContext.createMediaElementSource(audio);
                source.connect(this.analyser);
                source.connect(this.audioContext.destination);
            }

            audio.onended = () => {
                this.updateStatus('listening');
                // Restart recognition
                try {
                    this.recognition?.start();
                } catch (e) { }
            };

            await audio.play();
        } catch (e) {
            console.error("TTS Error", e);
            // Fallback: just wait a bit based on text length
            setTimeout(() => {
                this.updateStatus('listening');
                try { this.recognition?.start(); } catch (e) { }
            }, text.length * 50);
        }
    }

    // --- Helpers ---

    private updateStatus(status: ServiceStatus) {
        this.status = status;
        this.listeners.onStatusChange(status);
    }

    private startAudioVisualizer() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (!this.analyser) {
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
        }

        // If we have a mic stream, connect it
        if (this.stream) {
            const source = this.audioContext.createMediaStreamSource(this.stream);
            source.connect(this.analyser);
            // Do NOT connect mic to destination (speakers) to avoid feedback loop
        }

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        const animate = () => {
            if (this.status === 'disconnected') return;

            this.animationFrame = requestAnimationFrame(animate);

            if (this.analyser) {
                this.analyser.getByteFrequencyData(dataArray);
                // Calculate average volume
                const average = dataArray.reduce((src, a) => src + a, 0) / dataArray.length;
                this.listeners.onAudioLevel(average);
            }
        };

        animate();
    }

    private stopAudioVisualizer() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.audioContext) this.audioContext.close();
        this.audioContext = null;
        this.analyser = null;
    }
}
