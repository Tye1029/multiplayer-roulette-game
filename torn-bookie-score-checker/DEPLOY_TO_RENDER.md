# Torn Bookie Score Checker — Deploy

Click the button below to create the Render web service from the isolated `torn-bookie-score-checker` branch.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Tye1029/multiplayer-roulette-game/tree/torn-bookie-score-checker)

The repository Blueprint already specifies:

- Service: `torn-bookie-score-tracker`
- Runtime: Docker
- Plan: Free
- Branch: `torn-bookie-score-checker`
- Root directory: `torn-bookie-score-checker`
- Health check: `/health`
- Automatic deploys: on commit

After deployment succeeds, copy the service's `onrender.com` address and append `/mcp` for the ChatGPT custom MCP Server URL.
