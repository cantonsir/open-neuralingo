# Changelog

All notable changes to OpenNeuralingo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-26

### Added

#### Listening Module
- YouTube video playback with subtitle synchronization
- Loop markers that snap to subtitle boundaries
- Goal videos with automatic segment breakdown
- Mini-test mode for listening drills with thinking time tracking
- Vocabulary database with AI-generated definitions
- Subtitle peeking functionality
- Watch history tracking
- Segment-based learning with Test-Learn-Watch flow

#### Reading Module
- Content library supporting PDF, EPUB, and YouTube transcripts
- AI-generated comprehension questions
- Reading session tracking

#### Speaking Module
- Live conversation practice with AI
- Scenario-based roleplay (ordering food, job interviews, etc.)
- High-quality text-to-speech playback
- Session history with transcripts

#### Writing Module
- Composition practice with AI feedback
- Grammar correction and suggestions
- Writing session history

#### Core Features
- Multi-language support with configurable target language
- Dark/light theme toggle
- Persistent SQLite database
- Keyboard shortcuts for efficient navigation
- Responsive design

### Technical
- React 19 with TypeScript frontend
- Flask backend with modular blueprint architecture
- SQLite database with automatic migrations
- Google Gemini API integration
- Text-to-speech with Google Cloud TTS and Gemini fallback

---

## Future Releases

Features planned for future releases:
- Spaced repetition for flashcards
- Progress analytics dashboard
- Export/import functionality
- Mobile-responsive improvements
- Additional language pair support
