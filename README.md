# Silk Road: Legends of Wulin

## Table of Contents
- [Project Description](#project-description)
- [Minimum Viable Product (MVP)](#minimum-viable-product-mvp)
  - [Core Features](#core-features)
- [High-Level Overview](#high-level-overview)
- [Technologies Used](#technologies-used)
- [Key Classes and Components](#key-classes-and-components)
- [Server Dependencies](#server-dependencies)
  - [Node.js](#nodejs)
  - [npm (Node Package Manager)](#npm-node-package-manager)
  - [npm Packages](#npm-packages)
  - [Create a `package.json` file](#create-a-packagejson-file)
- [Running the Application Locally](#running-the-application-locally)
  - [Steps](#steps)
  - [Configuration Example](#configuration-example)
  - [Using Let's Encrypt for Free SSL Certificates](#using-lets-encrypt-for-free-ssl-certificates)
- [API Endpoints](#api-endpoints)
  - [WebSocket Endpoints](#websocket-endpoints)
- [Advanced Features](#advanced-features)
- [Best Practices and Coding Standards](#best-practices-and-coding-standards)
- [License](#license)
  - [Public Domain Notice](#public-domain-notice)
  - [Warranty Disclaimer](#warranty-disclaimer)

For more detailed information refer to the file: "game design document.md" located in the "documentation" folder.

## Project Description

This project is a Multiplayer Game Server (MUD) designed for use with browser-based clients. It utilizes various technologies and architectural patterns to manage real-time communication, database interactions, game entity management, and player sessions. The server supports multiplayer gameplay by handling socket events, managing in-game entities like players, NPCs, and items, and by ensuring data consistency across connected clients. Its architecture is optimized for web-based interactions, making it ideal for games that can be played directly in web browsers without any need for additional software installation.

## Minimum Viable Product (MVP)

### Core Features:

1. **Player Authentication**: Secure login system using bcrypt for password hashing.
2. **Session Management**: Handles player sessions with token-based authentication and session restoration.
3. **Real-time Player Interaction**: Supports multiple concurrent player connections and interactions.
4. **Game State Management**: Efficiently manages game states, including player positions, NPC movements, and item transactions.
5. **Game Loop Execution**: Implements a game loop for processing real-time updates and periodic events.
6. **Database Operations**: Manages game data persistence using a file system-based approach.
7. **Socket Communication**: Utilizes Socket.IO for real-time bidirectional event-based communication.
8. **Logging and Error Handling**: Comprehensive logging system with multiple log levels (debug, info, warn, error).

## High-Level Overview

The server is built with a modular architecture, centered around the `Server` class which orchestrates various components:

1. **Authentication and Session Management**:
   - Implemented via `AuthenticationManager` and `SessionManager` classes.
   - Supports login, session restoration, and logout functionalities.

2. **Game Management**:
   - `GameManager` handles core game logic and entity management.
   - `NpcMovementManager` for NPC behavior and movement.
   - `ItemManager` for item-related operations.

3. **Real-Time Communication**:
   - `SocketEventManager` handles Socket.IO events and player connections.
   - Implements a custom `SocketEventEmitter` for game-specific events.

4. **Data Persistence and Replication**:
   - `DatabaseManager` interface for data operations.
   - `ReplicationManager` with filters for efficient data synchronization between server and clients.

5. **Transaction and Queue Management**:
   - `TransactionManager` for handling in-game transactions.
   - `QueueManager` and `MessageQueueSystem` for managing game tasks and messages.

## Technologies Used

1. **Node.js**: Runtime environment for the server.
2. **Express**: Web application framework for additional HTTP endpoints.
3. **Socket.IO**: Real-time bidirectional event-based communication.
4. **bcrypt**: Secure password hashing.
5. **File System (fs)**: Native Node.js module for file operations, used for data persistence.
6. **http/https**: Native Node.js modules for creating HTTP/HTTPS servers.
7. **SSL/TLS Support**: Optional secure communication (HTTPS) using SSL certificates, with support for Let's Encrypt for free certificates.

## Key Classes and Components

1. **Server**: Central orchestrator for the game server application.
2. **ServerInitializer**: Manages the initialization process of the server.
3. **ServerConfigurator**: Handles server setup, including Express and Socket.IO configuration.
4. **ILogger**: Interface for the logging system used throughout the application.
5. **ConfigManager**: Centralizes configuration management.
6. **GameComponentInitializer**: Initializes various game components.
7. **ReplicationManager**: Manages data replication between server and clients with custom filters.
8. **SocketEventManager**: Handles WebSocket events and communication.

## Server Dependencies

This server requires certain dependencies. Here's a list of the main dependencies you'll need to install if not already installed:

### Node.js

To install Node.js:

```bash
sudo apt update
sudo apt install nodejs
```

To query Node.js for its version number:

```bash
node -v
```

### npm (Node Package Manager)

Node Package Manager usually comes with Node.js. If not, install it with:

```bash
sudo apt install npm
```

### npm Packages

You'll need to install the following npm packages if not already installed:

```bash
npm install socket.io express fs bcrypt
```

### Create a `package.json` file

If you haven't already, create a `package.json` file:

```bash
npm init -y
```

This will help manage project dependencies and scripts.

## Running the Application Locally

### Steps:

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Configure `config.js` with appropriate settings for your environment, such as port numbers, database paths, and SSL options.
4. Run the server using the command:
   ```bash
   node server.js
   ```
5. The server will start in either HTTP or HTTPS mode based on your configuration.
6. The server supports both HTTP and HTTPS modes. To use HTTPS, ensure you have valid SSL certificates and update the `config.js` file accordingly. You can obtain free SSL certificates from Let's Encrypt.

### Configuration Example:

- `config.js` contains settings like `PORT`, `HOST`, `SSL_CERT_PATH`, `SSL_KEY_PATH`, and database paths (for Npcs, locations, and items).

### Using Let's Encrypt for Free SSL Certificates

To obtain and use free SSL certificates from Let's Encrypt:

1. Install Certbot, the official Let's Encrypt client:
   ```bash
   sudo apt-get update
   sudo apt-get install certbot
   ```

2. Obtain a certificate (replace `yourdomain.com` with your actual domain):
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com
   ```

3. Certbot will guide you through the process. Once completed, your certificates will typically be located at:
   - `/etc/letsencrypt/live/yourdomain.com/fullchain.pem` (certificate)
   - `/etc/letsencrypt/live/yourdomain.com/privkey.pem` (private key)

4. Update your `config.js` file with these paths:
   ```javascript
   SSL_CERT_PATH: '/etc/letsencrypt/live/yourdomain.com/fullchain.pem',
   SSL_KEY_PATH: '/etc/letsencrypt/live/yourdomain.com/privkey.pem'
   ```

5. Set up auto-renewal for your certificates:
   ```bash
   sudo certbot renew --dry-run
   ```
   If successful, add a cron job to renew certificates automatically:
   ```bash
   sudo crontab -e
   ```
   Add this line to run the renewal check twice daily:
   ```
   0 0,12 * * * certbot renew --quiet
   ```

Remember to restart your Node.js server after obtaining or renewing certificates for the changes to take effect.

## API Endpoints

### WebSocket Endpoints:

The application uses WebSocket communication via Socket.IO. Below are the key WebSocket message types and their expected responses:

1. **Login (Message Type: `login`)**
   - **Parameters**:
     - `characterName`: Player's username.
     - `password`: Player's password.
   - **Response**:
     - On success: `{ type: 'loginResult', success: true, sessionToken: 'token_value' }`
     - On failure: `{ type: 'loginResult', success: false, message: 'Invalid credentials' }`

2. **Restore Session (Message Type: `restoreSession`)**
   - **Parameters**:
     - `token`: Player's session token.
   - **Response**:
     - On success: Session restored and player state is sent.
     - On failure: `{ type: 'sessionExpired' }`

3. **Player Movement (Message Type: `moveEntity`)**
   - **Parameters**:
     - `entity`: Entity to move (could be player or Npc).
     - `newLocationId`: The ID of the new location.
   - **Response**: Location details of the new position.

4. **Item Interaction (Message Type: `useItem`)**
   - **Parameters**:
     - `itemId`: ID of the item to be used.
   - **Response**:
     - Item usage success or failure message.

5. **Logout (Message Type: `logout`)**
   - **Parameters**:
     - `token`: Player's session token.
   - **Response**: `{ type: 'logoutConfirmation' }`

The server primarily uses WebSocket communication, but also sets up an Express server that can be extended for additional HTTP endpoints if needed.

## Advanced Features

1. **Replication Filtering**: The server implements a sophisticated replication system that filters data sent to clients based on their context (e.g., player location, inventory).

2. **Modular Architecture**: The server is designed with a highly modular structure, allowing for easy extension and maintenance of different game components.

3. **Comprehensive Error Handling**: The server implements try-catch blocks throughout critical operations and includes a custom error handling middleware for Express.

4. **Flexible Configuration**: The `ConfigManager` allows for easy adjustment of server settings without modifying core code.

5. **Scalable Task Management**: Utilizes a `QueueManager` and `MessageQueueSystem` for handling game tasks and messages efficiently.

This MVP provides a robust foundation for an extensible game server capable of handling real-time multiplayer interactions, with clear pathways for future enhancements in game features, scalability, and security.

## Best Practices and Coding Standards

This project adheres to modern JavaScript best practices and coding standards to ensure maintainability, readability, and efficiency. Here are some key principles we follow:

1. **Object-Oriented Programming (OOP)**:
   - Utilize ES6+ class syntax for creating objects with shared behavior.
   - Encapsulate related functionality within classes.
   - Implement inheritance where appropriate using the `extends` keyword.

2. **Dependency Injection**:
   - Pass instances of classes as parameters to constructors or methods to promote loose coupling and improve testability.

3. **Efficient Data Structures**:
   - Use `Set` for unique values and fast lookups.
   - Use `Map` for key-value pairs with any type of key.

4. **Naming Conventions**:
   - Use PascalCase for class names (e.g., `class UserAccount {}`).
   - Use camelCase for instances and variables (e.g., `const userAccount = new UserAccount()`).
   - Use UPPER_SNAKE_CASE for constants (e.g., `const MAX_USERS = 100`).

5. **String Formatting**:
   - Utilize template literals for string formatting and multiline strings.

6. **Constants and Magic Numbers**:
   - Use named constants for magic numbers and strings.
   - Group related constants in objects or enums.

7. **Variable Declarations**:
   - Use `const` for variables that won't be reassigned, and `let` for those that will.

8. **Arrow Functions**:
   - Prefer arrow functions for short, non-method functions and to preserve `this` context.

9. **Destructuring**:
   - Use object and array destructuring for cleaner code.

10. **Error Handling**:
    - Implement comprehensive error handling using try-catch blocks.

11. **Asynchronous Programming**:
    - Use async/await for cleaner asynchronous code.

12. **Modularity**:
    - Write modular code by separating concerns and using ES6 modules.

By adhering to these practices, we aim to create a codebase that is not only functional but also maintainable, scalable, and easy to understand for all contributors.

# License

  - ### Public Domain Notice

      The content presented here is intended for entertainment, informational, educational, and research purposes. The textual content and source code for this website and game is in the public domain. You are free to share, copy, redistribute, adapt, remix, transform, and build upon this material in any medium or format and for any purpose.

   - ### Warranty Disclaimer

      This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors, contributors, or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with this software or the use or other dealings in this software.