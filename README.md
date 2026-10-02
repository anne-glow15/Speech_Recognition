# VoxNova — Automatic Speech Recognition

Real-time speech-to-text powered by [Vosk](https://alphacephei.com/vosk/) offline speech recognition.

![VoxNova](https://img.shields.io/badge/VoxNova-ASR-7c3aed?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black)
![Python](https://img.shields.io/badge/Python-3.12-3776ab?style=for-the-badge&logo=python&logoColor=white)

## Features

- **Live microphone recording** — record from any connected mic with real-time waveform visualization
- **File upload transcription** — drag-and-drop or browse for `.wav`, `.mp3`, `.m4a`, `.webm` files
- **Offline Vosk ASR** — Python WebSocket server with Vosk for fully offline, private speech recognition
- **Real-time stats** — word count, speech rate (WPM), confidence %, duration, speech-detected %
- **Transcript editor** — search, clickable timestamps, low-confidence word highlighting, inline editing
- **Audio player** — scrub, play/pause recorded or uploaded audio
- **Export** — download transcripts as TXT, PDF, or SRT (subtitles)
- **History** — recent transcriptions saved to localStorage with load/delete support
- **Dark & light themes** — toggle between dark (default) and light mode
- **Keyboard shortcuts** — Space (record/pause), Esc (stop), Ctrl+E (export), Ctrl+K (search), and more

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [TanStack Start](https://tanstack.com/start) + Vite |
| UI | React 19, Tailwind CSS 4, Radix UI primitives |
| State | Zustand |
| ASR Server | **Python + Vosk** (WebSocket server) |
| ASR Client | WebSocket streaming client with auto-reconnect |
| Export | jsPDF (PDF), custom TXT/SRT generators |
| Storage | localStorage (history, settings) + IndexedDB (audio blobs) |
| Fonts | Inter, Space Grotesk, JetBrains Mono (Google Fonts) |

## Setup

### Prerequisites

- **Node.js 18+** (or Bun) — for the frontend
- **Python 3.9+** — for the Vosk ASR server
- (Optional) A microphone for live recording

### 1. Install frontend dependencies

```bash
cd Speech_Recognition
npm install
```

### 2. Set up the Vosk Python server

```bash
# Install Python dependencies
pip install -r server/requirements.txt

# Download the default higher-accuracy English model
cd server
python download_model.py
```

**Available models** — run `python download_model.py --list` to see options:

| Key | Model | Size |
|-----|-------|------|
| `en-us-lgraph` | Higher-accuracy English (US) — **default** | model-dependent |
| `en-us-0.15` | Small English (US) | ~40 MB |
| `en-us-0.22` | Large English (US) — higher accuracy | ~1.8 GB |
| `en-in-0.5` | Small English (India) | ~36 MB |
| `hi-0.22` | Small Hindi | ~42 MB |
| `fr-0.22` | Small French | ~41 MB |
| `de-0.21` | Small German | ~45 MB |
| `es-0.42` | Small Spanish | ~39 MB |

Download a different model:
```bash
python download_model.py --model hi-0.22
```

### 3. Start both servers

On Windows, you can start the Vosk server and frontend together by double-clicking
[`start.bat`](start.bat) from the project root. It opens one terminal for each
process and reuses an existing Vosk listener on port 2700.

**Terminal 1** — Vosk ASR server:
```bash
cd server
python vosk_server.py
```
You should see:
```
VoxNova Vosk Server is READY
Listening on ws://0.0.0.0:2700
```

**Terminal 2** — Frontend dev server:
```bash
npm run dev
```

Open the frontend URL shown by Vite in your browser. The header should show a green **Connected** pill — that means the frontend is talking to the Vosk server on `ws://127.0.0.1:2700`.

### How it works

```
Browser (mic/file) ──PCM 16-bit──▶ WebSocket ──▶ Python vosk_server.py
                                                       │
                                                  Vosk Model
                                                       │
                        ◀── JSON partial/final ────────┘
```

1. The browser captures audio from the mic or decodes an uploaded file
2. Audio is downsampled to 16 kHz 16-bit PCM and streamed over WebSocket
3. The Python server feeds the PCM to Vosk's `KaldiRecognizer`
4. Vosk returns partial hypotheses and final results with word-level timestamps + confidence scores
5. The frontend renders results in real time

### Demo mode (no server needed)

If the Vosk server isn't running, the app automatically falls back to **demo mode** — it generates simulated transcription results so you can explore the full UI without any server setup. You can also force demo mode in **Settings > Force demo mode**.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start / pause recording |
| `Escape` | Stop recording |
| `Ctrl + E` | Export as TXT |
| `Ctrl + Shift + E` | Export as PDF |
| `Ctrl + K` | Focus transcript search |
| `Ctrl + ,` | Open settings |
| `Ctrl + L` | Clear transcript |
| `?` | Show shortcuts overlay |

## Project Structure

```
Speech_Recognition/
├── server/                        # Python Vosk ASR server
│   ├── vosk_server.py             # WebSocket server (main entry point)
│   ├── download_model.py          # Model downloader script
│   ├── requirements.txt           # Python dependencies
│   └── model/                     # Vosk model (auto-created by download_model.py)
├── src/
│   ├── components/
│   │   ├── ui/                    # Radix-based shadcn/ui primitives
│   │   └── voxnova/               # App-specific components
│   │       ├── Header.tsx
│   │       ├── InputPanel.tsx
│   │       ├── LiveTranscription.tsx
│   │       ├── Recorder.tsx       # Waveform visualizer + controls
│   │       ├── StatsRow.tsx
│   │       ├── TranscriptEditor.tsx
│   │       ├── AudioPlayer.tsx
│   │       ├── RecentTranscriptions.tsx
│   │       ├── SettingsPanel.tsx
│   │       ├── ShortcutsOverlay.tsx
│   │       ├── Toasts.tsx
│   │       └── ui.tsx
│   ├── hooks/
│   │   ├── useRecorder.ts         # Mic capture, file upload, PCM streaming
│   │   └── useKeyboardShortcuts.ts
│   ├── services/
│   │   ├── asrClient.ts           # WebSocket Vosk ASR client
│   │   ├── exporters.ts           # TXT, PDF, SRT export
│   │   └── storage.ts             # localStorage + IndexedDB persistence
│   ├── store/
│   │   └── useStore.ts            # Zustand global state
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   └── format.ts
│   ├── routes/
│   │   ├── __root.tsx
│   │   └── index.tsx              # Main VoxNova page
│   └── styles.css                 # Tailwind config, design tokens, themes
└── package.json
```

## License

This project is part of a final-year academic presentation.
