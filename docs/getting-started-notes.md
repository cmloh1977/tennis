# Getting-started notes

## How this project began
- App idea: shadow-swing practice with random cues so I react instead of planning. Used on my rooftop with the phone in front of me.
- v1.0 built on 2026-10-21 with Claude Code: Return, Volley and Return + Rally modes; green/right arrow = forehand, red/left arrow = backhand; voice says "wide" or "body" at the same moment; rally ends with a white STOP screen.
- Live at https://cmloh1977.github.io/tennis/ (GitHub Pages, public repository).

## Setup on my Mac
- GitHub tool (gh) installed from the macOS .pkg on github.com/cli/cli/releases and logged in with gh auth login. No Homebrew.
- Commits use my GitHub name and private noreply email.

## Things I learned
- index.html = what's on the page; style.css = how it looks; app.js = what it does.
- README.md is for people (shown on GitHub); CLAUDE.md is for Claude Code.
- Git saves versions on my Mac (commit); GitHub stores them online (push) and hosts the app.
- The app works offline after opening it once with internet from the Home Screen icon (the icon keeps its own copy, separate from the browser). Updates need internet; close and reopen twice.
- Never open and save app files in TextEdit.

## How I want to work
- One thread per feature or fix; plan first, then build.
- Finish each feature with: update CLAUDE.md and CHANGELOG.md, bump version, commit and push, stop local servers.
- Log ideas and problems as GitHub Issues.
- Ideas for later: branches with test-before-live, automated tests for timing and randomness, a /release skill, optional cloud environment.
