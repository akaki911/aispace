
# DevConsole v2 In-Panel Implementation (SOL-202)

## Overview

DevConsole v2 არის AI Developer Panel-ის Console ტაბში ჩაშენებული განახლებული Developer Console, რომელიც უზრუნველყოფს Real-time log streaming-ს, ფილტრაციას, ექსპორტს და დიდი ნაკადების ეფექტურ მართვას.

## Features

### 🔄 Real-time Streaming
- **SSE (Server-Sent Events)** მუდმივი კავშირით
- **Auto-reconnect** გაწყვეტის შემთხვევაში 
- **Polling fallback** SSE-ის ვერმუშაობისას
- **Connection status** ინდიკატორი

### 🔍 Advanced Filtering
- **Source filtering**: AI/Backend/Frontend/All
- **Level filtering**: Info/Warning/Error/All  
- **Text search** with case-insensitive matching
- **Regex support** advanced searching-სთვის
- **Time range** filtering (5m/15m/1h/All)

### ⚡ Performance Optimized
- **Virtual scrolling** (@tanstack/react-virtual) 50k+ ჩანაწერისთვის
- **Rolling buffer** (100k ჩანაწერის მაქსიმუმი)
- **IndexedDB storage** დიდი ლოგების დასამახსოვრებლად
- **Memory management** automatic cleanup-ით

### 📤 Export Capabilities
- **CSV export** Excel-თან თავსებადი
- **NDJSON export** programmatic processing-სთვის
- **Configurable options**: timestamp, metadata inclusion
- **Filtered exports** მხოლოდ ხილული ლოგების

### 🎨 User Experience
- **Keyboard shortcuts** მანევრირებისთვის:
  - `Ctrl/⌘+F` - Filter focus
  - `Ctrl/⌘+P` - Pause/Resume
  - `Ctrl/⌘+E` - Export dialog
  - `Ctrl/⌘+J` - Jump to latest
  - `?` - Help modal
- **Dark/Light theme** support
- **Pin/Unpin logs** important entries-სთვის
- **Copy line** functionality
- **JSON folding** metadata-სთვის

## Setup Instructions

### 1. Feature Flag ჩართვა

`.env` ფაილში დაამატეთ:
```bash
VITE_FEATURE_DEVCONSOLE_V2=1
```

### 2. Access Control

DevConsole v2 მხოლოდ **Super Admin** (01019062020) მომხმარებელს ეწვდება.

### 3. Backend Requirements

SSE endpoints უკვე კონფიგურირებულია:
- `GET /api/dev/console/stream` - Real-time log streaming
- `GET /api/dev/metrics/stream` - Metrics streaming
- `GET /api/dev/console/tail?limit=500` - Polling fallback

## Architecture

### Frontend Stack
- **React + TypeScript**
- **Zustand** state management-სთვის
- **@tanstack/react-virtual** virtualization-სთვის
- **IndexedDB** large data storage-სთვის
- **SSE/WebSocket** real-time communication-სთვის

### Data Flow
```
Backend SSE → EventSource → Buffer Management → Virtual List → UI
                    ↓
           IndexedDB Storage ← Rolling Buffer (100k)
```

### Storage Strategy
- **UI Preferences** → localStorage (`OURANOS_DEVCONSOLE_V2_*`)
- **Large Log Buffer** → IndexedDB (50-100k ჩანაწერი)
- **Connection State** → Memory (session-specific)

## Usage Guide

### Basic Operations
1. **View Logs**: ავტომატური streaming ყველა service-დან
2. **Filter**: Source/Level/Text dropdown-ებისა და input-ების გამოყენება
3. **Search**: Text input ან regex checkbox-ის ჩართვა
4. **Export**: Export ღილაკზე დაჭერა→ Format/Options→ Download

### Keyboard Navigation
- Filter ველზე ფოკუსი: `Ctrl/⌘+F`
- Pause/Resume streaming: `Ctrl/⌘+P`
- ბოლო ლოგებზე გადასვლა: `Ctrl/⌘+J`
- Export dialog: `Ctrl/⌘+E`
- Help modal: `?`

### Performance Tips
- **ძიება** რეგულარულად filter-ების გასასუფთავებლად
- **Pause** streaming რთული debugging-ისას
- **Export** filtered logs analysis-სთვის
- **Pin** important log entries

## Troubleshooting

### Connection Issues
1. SSE connection failed → ავტომატური polling fallback
2. Reconnection attempts (მაქს 10)
3. Connection status indicator ზედა bar-ში

### Performance Issues
1. Virtual scrolling 5k+ entries-ზე
2. Rolling buffer automatically clears old logs
3. IndexedDB cleanup on browser restart

### Feature Flag Issues
- `VITE_FEATURE_DEVCONSOLE_V2=0` → ძველი console
- `VITE_FEATURE_DEVCONSOLE_V2=1` → ახალი DevConsole v2
- No flag → ძველი console (default)

## Development Notes

### File Structure
```
src/features/devconsole-v2/
├── DevConsoleV2Container.tsx     # Main container
├── useConsoleStream.ts           # SSE/Polling hook
├── consoleStore.ts               # Zustand state
├── storage.ts                    # IndexedDB/localStorage utils
└── components/
    ├── ConsoleToolbar.tsx        # Filters and controls
    ├── LogList.tsx               # Virtual list
    ├── LogLine.tsx               # Individual log renderer
    ├── ExportMenu.tsx            # Export dialog
    └── ShortcutsHelp.tsx         # Help modal
```

### Security Considerations
- Super Admin access only (01019062020)
- Log redaction for sensitive data (tokens, passwords)
- Safe command execution (mock-only for dangerous operations)
- CORS credentials required for SSE

## Future Enhancements
- [ ] Log search highlighting
- [ ] Advanced time filtering
- [ ] Log aggregation/grouping
- [ ] Real-time metrics integration
- [ ] Custom log parsing rules
- [ ] Multi-user session support
