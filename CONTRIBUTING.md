# Contributing to OpenNeuralingo

Thank you for your interest in contributing to OpenNeuralingo! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Development Setup

### Prerequisites

- Node.js v18 or higher
- Python 3.10 or higher
- Git

### Getting Started

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/deep-listening-trainer.git
   cd deep-listening-trainer
   ```

3. **Install frontend dependencies**
   ```bash
   npm install
   ```

4. **Set up Python virtual environment**
   ```bash
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   ```

5. **Install backend dependencies**
   ```bash
   pip install -r backend/requirements.txt
   ```

6. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

7. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   python backend/run.py
   
   # Terminal 2 - Frontend
   npm run dev
   ```

## Project Structure

```
deep-listening-trainer/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components organized by module
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API and external service integrations
│   ├── context/            # React context providers
│   └── types.ts            # TypeScript type definitions
├── backend/                # Backend (Flask + Python)
│   ├── app/
│   │   ├── routes/         # API endpoints
│   │   ├── config.py       # Configuration
│   │   └── database.py     # Database operations
│   └── run.py              # Entry point
└── docs/                   # Documentation (if applicable)
```

## Code Style

### TypeScript/React

- Use functional components with hooks
- Define TypeScript interfaces for props and state
- Use meaningful variable and function names
- Keep components focused on a single responsibility
- Extract reusable logic into custom hooks

```typescript
// Good
interface UserCardProps {
  user: User;
  onSelect: (id: string) => void;
}

function UserCard({ user, onSelect }: UserCardProps) {
  // ...
}
```

### Python

- Follow PEP 8 style guidelines
- Use docstrings for functions and classes
- Type hints are encouraged but not required
- Use meaningful variable names

```python
# Good
def get_user_profile(user_id: str) -> dict:
    """
    Fetch user profile from database.
    
    Args:
        user_id: The unique user identifier
        
    Returns:
        User profile dictionary
    """
    # ...
```

### General Guidelines

- Write self-documenting code
- Add comments for complex logic
- Keep functions small and focused
- Handle errors gracefully
- No hardcoded secrets or API keys

## Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, readable code
   - Add/update types as needed
   - Test your changes locally

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add description of your change"
   ```

   Use conventional commit messages:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding or updating tests
   - `chore:` - Maintenance tasks

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

## Pull Request Process

1. **Before submitting**
   - Ensure your code runs without errors
   - Test both frontend and backend functionality
   - Update documentation if needed
   - Check for linter errors

2. **Create the Pull Request**
   - Use a clear, descriptive title
   - Describe what changes you made and why
   - Link any related issues
   - Include screenshots for UI changes

3. **Review process**
   - Respond to feedback promptly
   - Make requested changes
   - Keep the PR focused on a single concern

## Reporting Issues

When reporting bugs or requesting features:

1. **Search existing issues** first to avoid duplicates

2. **For bugs, include:**
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Browser/OS information
   - Screenshots if applicable

3. **For feature requests, include:**
   - Clear description of the feature
   - Use case and motivation
   - Possible implementation approach (optional)

## Questions?

If you have questions about contributing, feel free to open an issue with the "question" label.

---

Thank you for contributing to OpenNeuralingo!
