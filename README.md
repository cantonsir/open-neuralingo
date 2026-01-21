# EchoLoop – Deep Listening Trainer

EchoLoop is a premium, web-based tool designed for language learners and anyone looking to improve their listening comprehension. By combining a precise YouTube player with automatic subtitle snapping, EchoLoop allows you to focus on the exact moments you miss, loop them indefinitely, and tag them for future review.

<div align="center">
  <img width="1200" alt="EchoLoop Dashboard" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## ✨ Key Features

- **🎯 Smart Marker Snapping**: Press `Space` to instantly create a loop marker. The app automatically snaps the start and end times to the current subtitle sentence for perfect precision.
- **👁️ Subtitle Peeking**: Keep subtitles hidden to challenge yourself, then press and hold `S` to "peek" at the text when you're stuck.
- **🔄 Precision Looping**: Easily loop any marked segment to drill down on difficult pronunciations or fast speech.
- **🏷️ Review Points**: Manage your markers in a clean sidebar, add tags for specific types of confusion (e.g., Vocabulary, Grammar), and delete what you've mastered.
- **⚡ Advanced Playback Controls**: Built-in speed adjustment (0.75x, 1x, 1.25x) and a custom timeline for visual navigation.
- **🔗 YouTube Integration**: Works with any public YouTube video—just paste the link and start training.

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Create/Update marker (Snaps to current subtitle) |
| `S` (Hold) | Peek current subtitle |
| `K` / `P` | Toggle Play/Pause |

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/cantonsir/deep-listening-trainer.git
   cd deep-listening-trainer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Set your `GEMINI_API_KEY` in `.env.local` if using AI-enhanced features:
   ```env
   GEMINI_API_KEY=your_key_here
   ```

4. **Backend Setup**:
   Install the required Python dependencies:
   ```bash
   "C:\Users\Jayden\anaconda3\python.exe" -m pip install -r backend/requirements.txt
   ```

5. **Launch the app**:
   You need to run both the backend and frontend servers:

   **Terminal 1 (Backend)**:
   ```bash
   "C:\Users\Jayden\anaconda3\python.exe" backend/server.py
   ```

   **Terminal 2 (Frontend)**:
   ```bash
   npm run dev
   ```

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Vanilla CSS + Lucide Icons
- **Tooling**: Vite 6
- **Video**: `react-youtube` API

## 📝 Subtitles Notice
This version is **Frontend-Only**. For the best experience, you can paste WebVTT or SRT subtitles directly into the setup screen. Automatic fetching of YouTube transcripts is currently disabled to ensure maximum privacy and zero-config deployment.

---
Created with ❤️ for language learners.
