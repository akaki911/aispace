# Bakhmaro Cottages Platform

## Overview
This project is "ბახმაროს ქირავება" (Bakhmaro Rental), a Georgian cottage/accommodation rental platform. It aims to provide a comprehensive solution for property rentals, integrating a modern frontend, a robust backend, and an advanced AI service with RAG capabilities for enhanced data persistence, session management, and codebase understanding. The platform prioritizes security, performance, and a seamless user experience, including full Georgian language support.

## User Preferences
- Project uses Georgian language as primary interface
- Clean, modern UI design with Tailwind CSS
- Multi-service architecture with proper separation of concerns
- Production-grade AI capabilities with real codebase awareness

## System Architecture
The platform is built on a multi-service architecture:
-   **Frontend**: React + TypeScript + Vite (Port 5000), using Tailwind CSS for styling.
-   **Backend**: Node.js + Express (Port 5002) handling API requests and authentication.
-   **AI Service**: Node.js microservice (Port 5001) with advanced Retrieval-Augmented Generation (RAG) capabilities for codebase understanding, real-time file monitoring, and intelligent safety switches.
-   **Database**: Firebase Admin for data storage and session management.
-   **UI/UX**: Focuses on a clean, modern design with full Georgian language support across all interfaces and error messages.
-   **Technical Implementations**:
    -   **Firebase Integration**: Unified configuration for data persistence (Firestore) and session management (@google-cloud/connect-firestore).
    -   **Proxy Routing**: Vite proxy configured for seamless communication between frontend and backend/AI services, resolving 404 errors.
    -   **Authentication**: Secure endpoint migration and authentication guards for all critical operations.
    -   **Port Management Security**: Industrial-grade port management with cascade failure prevention, advanced security features (SUPER_ADMIN authentication, rate limiting, health probes), and PID-targeted service restarts.
    -   **Autonomous Agent (PROJECT "AUTONOMY")**: Unified RAG system with multi-source context, conversational memory fix for Georgian vague follow-ups, secure terminal control system with command blocking, and an intelligent safety switch for risk-based confirmation.
    -   **Real-time Code Intelligence (PROJECT "PHOENIX")**: ProjectIntelligenceService for real-time file scanning, enhanced context building, and sensitive file exclusion.
    -   **Enhanced File System Monitor**: API endpoints for real-time monitoring, recent changes, project insights, security reports, and complexity analysis.
    -   **Developer Console**: Features include an enhanced file tree with advanced search, a multi-tab terminal system with secure shell execution, and a lightweight code preview system.
    -   **Security Hardening**: Comprehensive prevention of package installation bypasses, destructive command confirmation, and validation of terminal command execution.

## External Dependencies
-   **Firebase**: Used for data storage (Firestore) and session management (@google-cloud/connect-firestore).
-   **Groq API**: Utilized by the AI service for its functionality.
-   **Chokidar**: Integrated for real-time file system monitoring in the AI service.
-   **React-Syntax-Highlighter**: Used for lightweight code preview.