---
description: Git operations and deployment to GitHub
---

# 🚀 Git & GitHub Workflow

Use this workflow to keep your code synchronized with the remote repository on GitHub.

## 💾 Saving Changes (Commit)

1. **Check Status**: See what has changed.
   ```bash
   git status
   ```

2. **Stage Changes**: Add new or modified files.
   ```bash
   git add .
   ```

3. **Commit**: Create a snapshot with a descriptive message.
   ```bash
   git commit -m "Describe your changes here"
   ```

## 📤 Pushing to GitHub

1. **Pull Latest**: Always a good practice to pull before pushing.
   ```bash
   git pull origin main
   ```

2. **Push**: Upload your changes.
   ```bash
   git push origin main
   ```

## 📋 Common Git Tips
- **Discard changes in a file**: `git checkout -- <file>`
- **Undo last commit (keep changes)**: `git reset --soft HEAD~1`
- **View commit history**: `git log --oneline -n 10`
