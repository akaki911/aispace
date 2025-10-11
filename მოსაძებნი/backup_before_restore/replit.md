# Bakhmaro Cottages Platform

## Overview

Bakhmaro Cottages is a comprehensive booking platform for mountain cottages and related services in Georgia. The platform serves as a multi-service tourism booking system that connects property providers with customers through a modern web application. It features a sophisticated cottage rental system, hotel booking capabilities, vehicle rentals, and AI-powered customer support, all designed specifically for the Georgian market with comprehensive Georgian language support.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: React + TypeScript + Vite
- **Port**: 5000 (development), production ready
- **Styling**: Tailwind CSS with custom theming
- **State Management**: React hooks and context
- **Real-time Features**: Server-Sent Events (SSE) for live updates
- **Routing**: React Router for multi-page navigation
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Main API Server**: Node.js + Express (port 5002)
- **AI Microservice**: Separate Node.js service (port 5001)
- **Session Management**: Express sessions with Redis support
- **Middleware**: CORS, rate limiting, security headers
- **File Operations**: RESTful APIs for file management
- **Real-time Communication**: SSE endpoints for live data streaming

### Authentication & Authorization
- **Multi-tier Auth System**: 
  - WebAuthn/Passkey for SUPER_ADMIN (biometric authentication)
  - Firebase Auth for regular users (email/password)
- **Role-based Access Control (RBAC)**:
  - SUPER_ADMIN: Full system access
  - ADMIN: Limited administrative functions
  - PROVIDER: Property management access
  - CUSTOMER: Booking and personal account access
- **Session Persistence**: Secure cookie-based sessions
- **Security**: HMAC signatures, CSRF protection

### Data Storage Solutions
- **Primary Database**: Firebase Firestore
- **Collections Structure**:
  - `cottages` - Property listings with seasonal pricing
  - `bookings` - Reservation data with status tracking
  - `users` - User profiles and role assignments
  - `conversations` - Messaging system data
  - `memory` - AI assistant personal memory storage
  - `activity_logs` - System activity tracking
- **File Storage**: Cloudinary for image management
- **Caching**: In-memory caching for frequent queries

### AI Integration Architecture
- **AI Service**: Groq API integration for natural language processing
- **Capabilities**:
  - Georgian language processing and validation
  - Code analysis and generation
  - Project documentation assistance
  - Real-time file system analysis
- **Memory System**: Persistent AI memory per user
- **Response Enhancement**: Multi-stage text processing for natural Georgian output

### Business Logic Components
- **Seasonal Pricing Engine**: Month-based pricing with min/max ranges
- **Booking Management**: Complete reservation lifecycle
- **Provider Dashboard**: Property and booking management
- **Payment Integration**: Ready for payment gateway integration
- **Review System**: Post-checkout rating and feedback
- **Messaging System**: Real-time communication between users

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore database, hosting
- **Groq API**: AI language model for natural language processing
- **Cloudinary**: Image upload, storage, and optimization

### Development & Build Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Type safety across the entire application
- **ESLint**: Code quality and style enforcement
- **Tailwind CSS**: Utility-first CSS framework

### Node.js Packages
- **Express**: Web framework for backend APIs
- **Firebase Admin SDK**: Server-side Firebase operations
- **Express Session**: Session management
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API protection
- **Helmet**: Security headers
- **Axios**: HTTP client for API requests
- **Date-fns**: Date manipulation utilities

### Authentication Libraries
- **@simplewebauthn/server**: WebAuthn server implementation
- **@simplewebauthn/browser**: WebAuthn client implementation
- **Firebase Auth**: User authentication service

### UI & UX Libraries
- **Lucide React**: Icon system
- **Framer Motion**: Animation library
- **React Query**: Data fetching and caching
- **Monaco Editor**: Code editor component
- **HTML2Canvas**: Screenshot generation
- **jsPDF**: PDF generation

### Development Tools
- **Concurrently**: Run multiple processes simultaneously
- **Chokidar**: File system watching
- **Jest**: Testing framework (configured)
- **Docker**: Containerization support (configured)

The architecture emphasizes modularity, scalability, and maintainability while providing a seamless user experience across all user roles and device types.