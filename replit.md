# Training Management System

## Overview

This is a comprehensive training management system built with React, Node.js, and PostgreSQL. The application provides a full-featured platform for managing training batches, users, evaluations, and audio file processing with Azure Blob Storage integration.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Components**: Radix UI primitives with Tailwind CSS
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session management
- **File Processing**: Azure Blob Storage for audio files
- **Task Scheduling**: Cron jobs for batch status management

### Database Design
- **ORM**: Drizzle with TypeScript schema definitions
- **Connection**: Neon serverless PostgreSQL
- **Migrations**: Drizzle Kit for schema migrations
- **Session Storage**: PostgreSQL-backed session store

## Key Components

### User Management
- Multi-role system (owner, admin, manager, trainer, trainee, etc.)
- Permission-based access control
- Bulk user import via Excel templates
- User dashboard customization

### Training Batch Management
- Batch lifecycle management (planned → induction → training → certification → OJT)
- Automated status transitions with cron jobs
- Trainee enrollment and tracking
- Batch history and audit trails

### Audio File Processing
- Azure Blob Storage integration for audio file management
- Metadata extraction and processing
- Audio file allocation to users and batches
- Excel-based metadata import system

### Evaluation System
- Flexible evaluation templates
- Audio file-based evaluations
- Feedback management system
- Performance tracking and reporting

### Quiz System
- Quiz creation and management
- Timed quiz sessions
- Result tracking and analytics
- Integration with training phases

## Data Flow

1. **Authentication Flow**: Users authenticate via username/password, sessions managed server-side
2. **File Upload Flow**: Audio files uploaded to Azure → metadata processed → allocated to users/batches
3. **Batch Management Flow**: Batches created → users enrolled → automated phase transitions → completion tracking
4. **Evaluation Flow**: Audio files allocated → evaluations conducted → feedback collected → reports generated

## External Dependencies

### Azure Services
- **Azure Blob Storage**: Primary storage for audio files
- **Storage Account**: Configured with shared key authentication
- **Container Management**: Automated container creation and management

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL hosting
- **Connection Pooling**: Built-in connection management

### Email Services
- **Nodemailer**: Email delivery for password resets and notifications
- **Ethereal Email**: Development email testing

### Development Tools
- **Replit**: Primary development environment
- **TypeScript**: Type safety across frontend/backend
- **ESLint/Prettier**: Code quality and formatting

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20
- **Hot Reload**: Vite dev server with HMR
- **Database**: Neon PostgreSQL development instance
- **File Storage**: Azure Blob Storage development container

### Production Deployment
- **Target**: Google Cloud Run (configured in .replit)
- **Build Process**: Vite build + esbuild for server bundling
- **Environment Variables**: Managed through Replit secrets
- **Database**: Neon PostgreSQL production instance
- **CDN**: Direct Azure Blob Storage access

### Configuration Management
- **Development**: Local .env files and Replit secrets
- **Production**: Environment-specific configuration
- **Database Migrations**: Automated via Drizzle Kit
- **Asset Optimization**: Vite build optimizations

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 26, 2025. Initial setup