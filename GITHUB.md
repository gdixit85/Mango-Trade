# GitHub Repository Documentation

## Mango Trade - Git & GitHub Guide

This document contains all relevant Git/GitHub information for the Mango Trade project.

---

## Repository Information

| Property | Value |
|----------|-------|
| **Repository** | [gdixit85/Mango-Trade](https://github.com/gdixit85/Mango-Trade) |
| **URL** | `https://github.com/gdixit85/Mango-Trade.git` |
| **Default Branch** | `main` |
| **Visibility** | Check GitHub settings |

---

## Quick Reference Commands

### Daily Workflow

```bash
# Check status
git status

# Pull latest changes
git pull origin main

# Stage all changes
git add -A

# Commit with message
git commit -m "Your commit message"

# Push to remote
git push origin main
```

### View History

```bash
# View last 10 commits
git log --oneline -10

# View detailed log
git log -5

# View changes in a commit
git show <commit-hash>
```

### Branching (if needed)

```bash
# Create new branch
git checkout -b feature/my-feature

# Switch branches
git checkout main

# List all branches
git branch -a

# Delete local branch
git branch -d feature/my-feature
```

---

## Commit History

| Commit | Date | Description |
|--------|------|-------------|
| `c7bc079` | 2026-01-17 | Add Supabase documentation and security migrations |
| `d986da0` | 2026-01-17 | Initial commit: Mango Trade seasonal trading app |

---

## Project Structure

```
Mango-Trade/
├── public/                  # Static assets
│   ├── icons/              # PWA icons
│   ├── mango.svg           # Logo
│   └── sw.js               # Service worker
├── src/
│   ├── components/         # React components
│   │   └── common/         # Shared components
│   ├── context/            # React context (Auth)
│   ├── pages/              # Page components
│   ├── services/           # Supabase client
│   ├── styles/             # Global styles
│   └── utils/              # Helper functions
├── supabase/
│   ├── migrations/         # SQL migration files
│   └── SUPABASE.md         # Database documentation
├── .env                    # Environment variables (not in git)
├── .gitignore              # Git ignore rules
├── index.html              # Entry HTML
├── package.json            # Dependencies
├── vite.config.js          # Vite configuration
├── GITHUB.md               # This file
└── README.md               # Project readme
```

---

## Environment Setup for New Clone

### 1. Clone the Repository

```bash
git clone https://github.com/gdixit85/Mango-Trade.git
cd Mango-Trade
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create `.env` file in project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Setup Supabase Database

See [supabase/SUPABASE.md](supabase/SUPABASE.md) for complete database setup instructions.

### 5. Run Development Server

```bash
npm run dev
```

App will be available at `http://localhost:3000`

---

## Git Ignore Rules

The following are excluded from version control (`.gitignore`):

- `node_modules/` - Dependencies
- `.env` - Environment secrets
- `dist/` - Build output
- `.DS_Store` - macOS files
- `*.log` - Log files

---

## Deployment

### Build for Production

```bash
npm run build
```

Output will be in `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

---

## Troubleshooting

### Authentication Issues

```bash
# If push fails, check credentials
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Use credential manager (Windows)
git config --global credential.helper manager
```

### Merge Conflicts

```bash
# Pull with rebase to avoid merge commits
git pull --rebase origin main

# If conflicts occur, resolve them and:
git add .
git rebase --continue
```

### Reset Local Changes

```bash
# Discard all local changes (CAREFUL!)
git checkout -- .

# Reset to remote state (CAREFUL!)
git fetch origin
git reset --hard origin/main
```

---

## Contributing Workflow

1. Pull latest: `git pull origin main`
2. Make changes
3. Test locally: `npm run dev`
4. Stage: `git add -A`
5. Commit: `git commit -m "Description of changes"`
6. Push: `git push origin main`

---

*Documentation for Mango Trade - Last updated: 2026-01-17*
