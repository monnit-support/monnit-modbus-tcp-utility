This project is an Electron application built with Vue.js. It provides a user interface for managing and monitoring network gateways.

Overall Description:
The application allows users to scan their network for available gateways, configure gateway settings, view gateway history, and set up new gateways. It leverages Electron to create a cross-platform desktop application and Vue.js for a reactive and modular user interface.

File Descriptions:
- .DS_Store: Stores custom folder attributes for macOS.
- .env: Contains environment variables for the application.
- .git/: Directory containing the Git repository.
- .gitignore: Specifies intentionally untracked files that Git should ignore.
- Documentation/: Directory containing project documentation.
- README.txt: This file provides an overview of the project, its purpose, and a description of the files within the project.
- agents/: Directory containing agent-related code.
- connection-pool.js: Manages database connections.
- icon.icns: Application icon for macOS.
- icon.ico: Application icon for Windows.
- main/: Directory containing the main process code for the Electron application.
- main.js: Main process entry point.
- node_modules/: Node.js dependencies.
- package-lock.json: Records the exact versions of dependencies.
- package.json: Lists project metadata and dependencies.
- plugins/: Directory for application plugins.
- preload.js: Script that runs before the renderer process loads.
- public/: Directory for public assets.
- scripts/: Directory containing build and utility scripts.
- src/: Directory containing the source code.
- src/main/*: This directory contains the main process code for the Electron application. It handles the application lifecycle, window management, and any backend logic.
- src/renderer/*: This directory contains the renderer process code, which is the Vue.js application. It handles the user interface and interacts with the main process.
- src/renderer/components/GatewayHistory.vue: This Vue component displays the history of gateway connections and status changes.
- src/renderer/components/GatewaySettings.vue: This Vue component allows users to configure settings for individual gateways.
- src/renderer/components/NetworkScan.vue: This Vue component provides functionality to scan the network for available gateways.
- src/renderer/components/Setup.vue: This Vue component guides the user through the initial setup process for adding new gateways.
- src/renderer/router.js: This file defines the routes for the Vue.js application, enabling navigation between the different components.
