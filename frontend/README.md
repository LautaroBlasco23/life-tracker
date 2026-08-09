# Life Tracker Frontend

Web application for tracking personal activities, finances, spent time, notes and user's profile.
Developed initially with Vercel V0. Built with Next.js and TypeScript.

![Next.js Version](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## Features

- **Authentication**
  - Secure user registration and login
  - Protected routes with session management
  - Persistent authentication state

- **Activity Tracking**
  - Create, edit, and delete activities
  - Interactive progress tracking
  - Target-based completion system
  - Time-based categories (Morning, Afternoon, Night)
  - Flexible frequency settings (Daily, Weekly with specific days)
  - Visual progress indicators

- **Finance Management**
  - Personal finance tracking interface
  - Backend integration in progress

- **User Profile**
  - Profile information management
  - Avatar upload
  - Theme preferences (Light/Dark mode)
  - Account settings

- **Architecture & Quality**
  - Type-safe development with TypeScript
  - Component-driven architecture
  - Reusable UI components with shadcn/ui
  - Form validation with Zod schemas
  - Responsive design

---

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS v4** - Utility-first styling
- **shadcn/ui + Radix UI** - Accessible component primitives
- **React Hook Form + Zod** - Form handling and validation
- **date-fns** - Date utilities
- **Lucide React** - Icon library

---

## Project Structure

```text
frontend/
├── app/              # Next.js pages and layouts
├── components/       # Reusable React components
├── services/         # API service layer
├── types/            # TypeScript type definitions
├── contexts/         # React context providers
├── lib/              # Utility functions
├── public/           # Static assets
├── .env.example
├── Dockerfile
├── Makefile
└── package.json
```

---

## Quick Start

### Prerequisites

- Node.js 22+
- npm or yarn
- Backend API running (see backend repository)

### Fastest Path (One Command)

```bash
git clone <your-repo-url>
cd frontend
make start
```

Application runs at `http://localhost:3000`

> **Note:** This creates `.env` from `.env.example` and starts the development server.

### Standard Setup (More Control)

```bash
# 1. Clone and install dependencies
git clone <your-repo-url>
cd frontend
npm install

# 2. Setup environment
make setup

# 3. Start development server
npm run dev
```

### Environment Configuration

```bash
# Create environment file
cp .env.example .env
```

Edit `.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

### Available Commands

Run `make help` to see all available commands for development, building, and Docker deployment.

---

## Development

### Prerequisites

Install dependencies:

```bash
npm install
```

### Running the Application

Start the development server with hot reload:

```bash
npm run dev
```

Or using Make:

```bash
make dev
```

### Code Quality

Format and type-check code:

```bash
make code-check
```

Format only:

```bash
npm run format
```

Lint only:

```bash
npm run lint
```

Type check:

```bash
npm run lint:ts
```

### Building for Production

```bash
npm run build
npm run start
```

Or using Make:

```bash
make build
```

---

## Docker Deployment

Build and run with Docker:

```bash
# Build production image
make build-prod

# Run container
make run-container

# View logs
make logs

# Stop container
make stop
```

---

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:ts` - Type check with TypeScript
- `npm run format` - Format code with Prettier

---

## License

MIT License - free to use for learning and personal projects.
