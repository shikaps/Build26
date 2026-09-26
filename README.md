# Orbit student workspace

A responsive, dependency-free frontend for student task and project management. The current app uses browser-local mock data so the interface can be explored without a backend.

## Run locally

From the repository root, start any static file server, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Frontend structure

- `index.html` loads the application shell.
- `styles.css` contains the responsive design system and component styles.
- `src/data.js` provides the initial demonstration workspace.
- `src/api.js` is the replaceable data-service boundary; it currently persists the mock workspace in `localStorage`.
- `src/app.js` renders the dashboard, task and project views, team management, and AI organizer prototype.

The AI organizer intentionally returns clearly editable sample suggestions in the browser. Connect `workspaceApi` and the organizer submission to real API endpoints when those services are available; no backend or AI integration is included here.
