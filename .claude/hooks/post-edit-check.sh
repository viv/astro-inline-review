#!/bin/bash
# Post-edit hook: type-check after TypeScript file changes
# Runs tsc --noEmit on the whole project since types depend on each other.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check TypeScript files
if [[ ! "$FILE_PATH" =~ \.ts$ ]]; then
  exit 0
fi

# Use fish to get the right PATH (asdf manages Node)
if ! fish -c "cd '$CLAUDE_PROJECT_DIR' && npx tsc --noEmit" 2>&1; then
  echo "TypeScript type errors found after editing $FILE_PATH" >&2
  exit 2
fi
