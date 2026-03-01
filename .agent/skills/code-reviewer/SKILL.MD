---
name: code-reviewer
description: A skill used to enforce clean architecture patterns and validate code quality before any git commits are made.
---
# Code Review Protocol
When the user asks to review code or prepare for a commit, follow these steps:
1. Check that no functions exceed 50 lines.
2. Verify that all variables use camelCase.
3. If any rules are violated, list the errors and refuse to format the commit.