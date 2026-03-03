#!/usr/bin/env bash
# Quick test to verify database files are properly excluded from git

echo "🔍 Checking if database files are tracked by git..."
echo ""

# Check if any database files are tracked
TRACKED_DB=$(git ls-files | grep -E '\.(sqlite|db)' || true)

if [ -z "$TRACKED_DB" ]; then
  echo "✅ SUCCESS: No database files are tracked by git"
  echo ""
  echo "📁 These patterns are excluded via .gitignore:"
  echo "   • *.sqlite, *.sqlite3, *.db"
  echo "   • *.sqlite-shm, *.sqlite-wal, *.db-shm, *.db-wal"
  echo "   • backend/data/, data/"
  echo ""
  echo "🚀 When deploy.sh runs, it will:"
  echo "   1. Create a fresh database directory"
  echo "   2. Run all migrations to create tables"
  echo "   3. Populate with default content"
  echo ""
  exit 0
else
  echo "❌ WARNING: Some database files are tracked:"
  echo "$TRACKED_DB"
  echo ""
  echo "To remove them from git:"
  echo "  git rm --cached backend/data/*.sqlite*"
  echo "  git rm --cached backend/data/*.db*"
  echo "  git commit -m 'Remove database files from tracking'"
  echo ""
  exit 1
fi
