# OGrid Project Skills

Project-specific skills for Claude Code when working on the OGrid monorepo.

## Available Skills

### `/verify` - Pre-Commit Verification

Comprehensive pre-commit gate that checks the entire monorepo before allowing commits.

**What it checks:**
- ✅ Version synchronization across all 14 packages
- ✅ Documentation version references (StackBlitz config)
- ✅ Full build (`npm run build`)
- ✅ Full test suite (`npm run test:all`) - 2000+ tests
- ✅ Lint (`npm run lint`) - zero errors/warnings
- ✅ Git status review

**When to use:**
```bash
# After completing features, before committing
/verify

# If all checks pass:
git commit -m "your message"
git push
```

**When NOT to use:**
- During active development
- While agents are working
- For docs-only changes (optional)

## Usage

Skills are invoked with `/skill-name` in the chat.

## Adding New Skills

Create new skill files in this directory following the same JSON format as `verify.json`.
