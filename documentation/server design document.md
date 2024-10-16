# MUD Game Server Design Document

This document provides a detailed and comprehensive framework for developing a MUD (Multi-User Dungeon) game server. It outlines the architecture, core components, key features of the server implementation, server management, various aspects of game development, and best practices for creating a robust and scalable gaming platform.

## I. Technology Stack and Core Server System Requirements

### 1. Core Server System
- Node.js as the runtime environment
  - Leverage asynchronous I/O and event-driven architecture
  - Use the latest LTS version for stability and performance
- Express.js for HTTP(S) server and routing
  - Implement RESTful API endpoints for non-real-time communication
  - Use middleware for request processing, authentication, and error handling
- Socket.IO for real-time bidirectional event-based communication
  - Implement custom events for game-specific actions
  - Use chat channels for efficient broadcasting to subsets of connected clients

### 2. Configuration
- External configuration file (`config.js`) for easy management of server settings
  - Includes server host, port, SSL paths, log settings, file paths, and game-specific parameters
- `ConfigurationSystem` class for managing and validating configuration
  - Implements methods to get, set, and retrieve all configuration values
  - Updates configuration from environment variables
  - Validates configuration values, including required keys, numeric values, boolean values, and specific formats (e.g., REGEN_RATES as a Map)

### 3. Security
- HTTPS support for encrypted connections
  - Implement HTTPS for security
- Fallback to HTTP when HTTPS is not available
  - Provide clear warnings to users about unsecured connections
- SSL/TLS certificate management
  - Use Let's Encrypt for free, automated certificate renewal
  - Implement proper certificate rotation and monitoring

### 4. Networking
- Client connection management
  - Implement connection pooling for efficient resource utilization
  - Handle reconnection attempts gracefully
- Event dispatching
  - Create a robust event system for game actions and updates
  - Implement event queuing for handling high-load situations

### 5. Scalability and Performance
- Asynchronous I/O operations leveraging Node.js event loop
  - Use async/await for clean asynchronous code
  - Implement proper error handling for asynchronous operations
- Efficient handling of concurrent connections
  - Implement connection limits and timeout mechanisms
  - Use worker threads for CPU-intensive tasks

### 6. Extensibility
- Modular architecture for easy addition of new features
  - Use dependency injection for loose coupling between modules
- Event-driven design for flexible game mechanics implementation
  - Create a robust event emitter system
  - Allow for dynamic register and deregister of event listeners

## II. Configuration System

The Configuration System is implemented through the `ConfigurationSystem` class and the `config.js` file. It provides a centralized and flexible way to manage server settings and game parameters.

### 1. Configuration File (`config.js`)

The `config.js` file contains all the configuration constants for the server and game. It includes:

- Console output color codes
- Core server settings (HOST, PORT, SSL paths)
- Logging configuration
- File paths for game data
- Game-specific parameters (health, attack power, regeneration rates, etc.)
- Security settings (password salting, session configuration)
- Timing constants (tick rate, event intervals)

All these settings are exported as a single `CONFIG` object.

### 2. ConfigurationSystem Class

The `ConfigurationSystem` class provides methods to manage and validate the configuration:

#### Key Features:
- Singleton pattern implementation for global access
- Methods to get, set, and retrieve all configuration values
- Ability to update configuration from environment variables
- Comprehensive configuration validation

#### Methods:
- `constructor(config)`: Initializes the configuration system with the provided config object.
- `get(key)`: Retrieves a specific configuration value.
- `set(key, value)`: Sets a specific configuration value.
- `getAll()`: Returns a copy of the entire configuration object.
- `updateFromEnvironment()`: Updates configuration values from environment variables.
- `validate()`: Performs comprehensive validation of the configuration.

#### Configuration Validation:
The `validate()` method checks for:
- Required keys
- Numeric values
- Boolean values
- Specific formats (e.g., REGEN_RATES as a Map)
- Valid log levels
- Valid cookie settings

### 3. Usage in Server Initialization

The configuration system is used in the server initialization process:

1. The `CONFIG` object is imported from `config.js`.
2. A new `CoreServerSystem` instance is created with the `CONFIG` object.
3. The `initialize()` method of `CoreServerSystem` sets up the configuration system.
4. Configuration values are used throughout the server code to customize behavior.

### 4. Environment Variable Override

The configuration system allows for easy override of settings through environment variables. This feature enables different configurations for development, testing, and production environments without changing the code.

### 5. Extensibility

The configuration system is designed to be easily extensible. New configuration parameters can be added to the `config.js` file and will automatically be managed by the `ConfigurationSystem` class.

This robust configuration system ensures that the server and game settings are centralized, easily manageable, and can be adjusted for different environments without code changes.

## III. Log System

The Log System provides robust logging functionality for the game server. It implements a Singleton pattern to ensure a single, globally accessible logging instance.

### 1. Key Features:
- Singleton pattern implementation for global access
- Configurable log levels with color-coded output
- Conditional logging based on severity thresholds
- File logging with rotation based on file size

### 2. Log Levels:
The system supports four log levels, each associated with a numeric value:
- 'DEBUG': 0
- 'INFO': 1
- 'WARN': 2
- 'ERROR': 3

### 3. Color-Coded Output:
The system uses color-coded output for enhanced readability:
- DEBUG: Orange
- INFO: Default console color
- WARN: Magenta
- ERROR: Red

### 4. Implementation Details:
- Utilizes the Singleton pattern to ensure a single instance of the logger
- Configurable through the central configuration file
- Supports both console output and file logging
- Implements conditional logging based on the configured log level
- Provides methods for each log level (debug, info, warn, error)
- Formats log messages with appropriate color coding and timestamps
- Implements file rotation based on configurable max file size

### 5. Usage:
The Log System can be easily integrated into various parts of the server code, allowing for consistent and centralized logging across the entire application.

## IV. Database System
- The database consists of multiple json files stored in the following directories as defined in the external configuration file (`config.js`):

  - `PLAYER_DATA_PATH = './source code/world data/players';`
  - `LOCATIONS_DATA_PATH = './source code/world data/locations';`
  - `NPCS_DATA_PATH = './source code/world data/npcs';`
  - `ITEMS_DATA_PATH = './source code/world data/items';`
  - `GAME_DATA_PATH = './source code/world data/game data.json';`

### 1. Database Manager
- The `DatabaseManager` class handles data persistence and retrieval.
  - Implements methods for querying, loading, and saving JSON data
  - Provides specific methods for player data management (getPlayer, savePlayer)
  - Handles world state persistence (getWorldState, saveWorldState)
  - Manages game data loading and saving for various entity types

### 2. Game Data Manager
- The `GameDataManager` class is responsible for loading, parsing, checking, and storing data from JSON files.
  - Loads location data, parses it, checks for duplicate IDs and logs an error if any are found, then stores it in the `locations` collection as `Map` objects.
  - Utilizes the `LocationCoordinateManager` class, which is responsible for assigning (x,y,z) coordinates to locations.
  - Loads NPC data, parses it, checks for duplicate IDs and logs an error if any are found, then stores it in the `npcs` collection as `Map` objects.
  - Creates separate maps of NPCs based on their type (mobile, merchant, quest)
  - Loads item data, parses it, checks for duplicate IDs and logs an error if any are found, generates a unique ID for each item using the `generateUID()` method, then stores it in the `items` collection as `Map` objects.

## V. Game World System

### 1. World Map
- Location system
  - Implemented through the `LocationSystem` class
  - Manages a map of `Location` objects
  - Handles player movement between locations
- Coordinate system
  - Implemented through the `LocationCoordinateManager` class
  - Assigns (x,y,z) coordinates to locations
- Zone system
  - Implemented in the `Location` class as a `zone` property

### 2. Time System
- In-game time tracking
  - Implemented through the `TimeSystem` class
  - Tracks current time and updates based on delta time
  - Provides methods to check if it's daytime

## VI. Entity System

### 1. Base Entity Class
- Common properties (ID, name, description)
  - Implemented in the `Entity` class
- State management
  - Basic update method provided in `Entity` class

### 2. Character System
- Player characters
  - Implemented through the `Player` class, extending `Character`
  - Includes inventory and quest log
- Non-Player Characters (NPCs)
  - Implemented through the `NPC` class, extending `Character`
  - Includes type, dialogue tree, inventory, and AI state
  - Supports different NPC types: mobile, merchant, and quest
  - Mobile NPCs have movement capabilities
- Attributes (health, strength, etc.)
  - Not explicitly implemented in the current code, but can be added to the `Character` class
- Inventory management
  - Basic inventory system implemented in `Character` class

### 3. NPC Movement System
- Implemented through the `NPCManager` class
- Moves NPCs based on a configurable interval (`NPC_MOVEMENT_INTERVAL`)
- Random movement with a 33% chance to move during each interval
- Utilizes `zones` property to restrict NPC movement to specific areas
- Utilizes `currentLocation` to track the NPC's current position
- Utilizes `aiState` to manage different NPC behaviors (e.g., 'idle', 'patrolling', 'combat')
- Updates NPC location in the game world
- Notifies players in affected locations about NPC movements

#### NPC Movement Process:
1. The `WorldManager` class triggers NPC movement checks at regular intervals
2. The `NPCManager` iterates through all mobile NPCs
3. For each NPC, there's a 33% chance to initiate movement
4. If movement is initiated:
   - Retrieves connected locations for the NPC's current location
   - Filters locations based on the NPC's allowed zones (if specified)
   - Randomly selects a valid destination from available locations
   - Updates the NPC's location in the game world
   - Removes the NPC from the old location and adds it to the new location
   - Broadcasts messages to players in both the old and new locations

#### Integration with World Manager:
- The `WorldManager` class includes an `NPCManager` instance
- NPC movement checks are integrated into the world update cycle
- Utilizes the `LocationSystem` to manage NPC positions within the game world

This system provides a foundation for more complex NPC behaviors, such as:
- Adding time-based or event-triggered movements
- Expanding AI states to include more diverse behaviors (e.g., fleeing, following players)

### 4. Item System
- Item types (consumables, weapons, etc.)
  - Basic `Item` class implemented
  - `Weapon` and `Consumable` classes extending `Item`
- Item properties and effects
  - Basic properties implemented (id, name, description, type)
  - Effects can be implemented in the `use` method of each item type

## VII. Game Mechanics

### 1. Combat System
- Real-time combat
  - Implement turn-based or action-point systems for balanced gameplay
  - Support for different combat styles (melee, ranged, magic)
- Damage calculation
  - Implement a flexible formula system for damage calculation
  - Support for critical hits, dodges, and blocks
- Status effects
  - Implement a wide range of status effects (e.g., poison, stun, buff)
  - Support for stacking and duration management of effects

### 2. Skill System
- Skill definitions
  - Implement a flexible skill tree or skill book system
  - Support for passive and active skills
- Skill usage and cooldowns
  - Implement resource costs (e.g., mana, stamina) for skill usage
  - Support for global and skill-specific cooldowns
- Skill progression
  - Implement experience-based or usage-based skill improvement
  - Support for skill masteries and specializations

### 3. Quest System
- Basic `QuestSystem` and `Quest` classes implemented
- Methods for registering quests, assigning quests, updating progress, and completing quests

### 4. Economy
- Currency system
  - Implement multiple currency types if needed
  - Support for currency exchange and inflation mechanics
- Trading mechanisms
  - Implement player-to-player trading
  - Support for auction houses or marketplaces
- Merchant NPCs
  - Implement dynamic pricing based on supply and demand
  - Support for unique or rare item offerings

## VIII. Communication System

### 1. Chat System
- Global chat
  - Implement spam protection and moderation tools
- Private messaging
  - Support for offline messaging and message history
- Channel system
  - Implement custom channels for guilds, groups, or topics
  - Support for channel moderation and permissions

### 2. Emote System
- Predefined emotes
  - Implement a wide range of common emotes
  - Support for emote animations or special effects
- Custom emote support
  - Allow players to create custom emotes
  - Implement filtering and moderation for custom emotes

## IX. Command Processing System

### 1. Command Parser
- Input sanitization
  - Implement robust input validation and sanitization
  - Support for command aliases and shortcuts
- Command recognition
  - Implement fuzzy matching for command recognition
  - Support for context-sensitive commands

### 2. Command Handlers
- Movement commands
  - Implement smooth and responsive movement
  - Support for different movement types (walk, run, teleport)
- Interaction commands
  - Implement a wide range of interaction commands (examine, use, talk)
  - Support for context-sensitive interactions
- Admin commands
  - Implement powerful admin tools for game management
  - Support for different levels of admin permissions

## X. Game State Management System

### 1. Player Session Handling
- Login/logout processes
  - Implement secure authentication and session management
  - Support for handling disconnects and reconnects gracefully
- Character creation
  - Implement a flexible character creation system
  - Support for race/class selection and customization

### 2. World State Updates
- Entity position tracking
  - Implement efficient algorithms for spatial partitioning
  - Support for handling large numbers of moving entities
- Dynamic world changes
  - Implement support for world events and environmental changes
  - Support for persistent changes to the game world

## XI. Scripting System

### 1. World Event System
- Trigger system for world events
  - Implement time-based, player-action-based, and random event triggers
  - Support for complex event chains and storylines
- Custom event creation and handling
  - Allow admins to create and manage custom events
  - Support for event scheduling and recurrence

## XII. Admin Tools

### 1. Server Management
- Player moderation tools
  - Implement tools for muting, kicking, and banning players
  - Support for temporary and permanent punishments
- World editing capabilities
  - Implement in-game tools for editing the world map
  - Support for spawning and managing NPCs and items

### 2. Monitoring and Logging
- Server performance metrics
  - Implement real-time monitoring of server resources
  - Support for performance profiling and optimization
- Player activity logs
  - Log detailed player actions for analysis and moderation
  - Implement tools for analyzing player behavior patterns
- Error logging and reporting
  - Implement comprehensive error logging and stack traces
  - Support for automatic error reporting and notifications

## XIII. Networking and Security

### 1. Connection Handling
- Secure socket layer (SSL/TLS)
  - Implement proper certificate management and rotation
  - Support for the latest secure protocols and ciphers
- Connection pooling
  - Implement efficient connection reuse
  - Support for connection limits and timeout handling

### 2. Authentication System
- Secure login process
  - Implement multi-factor authentication options
- Password hashing and salting
  - Use strong, adaptive hashing algorithms (e.g., bcrypt, Argon2)
  - Implement proper salt generation and storage
- Password recovery
  - Implement secure password recovery system

### 3. Anti-Cheat Measures
- Input validation
  - Implement server-side validation for all client inputs
  - Support for detecting and preventing client-side tampering
- Rate limiting
  - Implement intelligent rate limiting for actions and requests
  - Support for temporary IP bans for repeated violations
- Encryption of sensitive data
  - Implement end-to-end encryption for sensitive communications
  - Support for secure storage of player credentials and payment info

## XIV. Performance Optimization

### 1. Concurrency Management
- Multi-threading for heavy operations
  - Utilize worker threads for CPU-intensive tasks
  - Implement proper synchronization and race condition prevention
- Asynchronous processing
  - Leverage Node.js's asynchronous nature for I/O operations
  - Implement queuing systems for managing high loads

### 2. Caching System
- Frequently accessed data caching
  - Implement multi-level caching (memory, distributed cache, database)
  - Support for cache warming and preloading
- Cache invalidation strategies
  - Implement efficient cache invalidation mechanisms
  - Support for partial cache updates and versioning

## XV. Client Communication Protocol

### 1. Message Formatting
- Standardized message structure
  - Define a clear and extensible message format
  - Support for versioning and backwards compatibility
- Efficient data serialization (e.g., Protocol Buffers)
  - Implement binary serialization for reduced network overhead
  - Support for schema evolution and compatibility checks

### 2. Real-time Updates
- Implementation for live updates

## XVI. Extensibility

### 1. Content Management System
- Tools for easy content creation and management
  - Implement a user-friendly interface for content creators
  - Support for version control and collaborative editing
- Import/export functionality for game data
  - Support common data formats (JSON, CSV, XML)
  - Implement data validation and error checking for imports

## XVII. Testing and Quality Assurance

### 1. Unit Testing
- Test suite for core functionalities
  - Implement comprehensive unit tests for all core modules
  - Support for automated test running and reporting
- Mocking of external dependencies
  - Use mocking libraries to isolate units for testing
  - Implement proper dependency injection for testability

### 2. Integration Testing
- End-to-end testing of game scenarios
  - Implement automated play-through of key game features
  - Support for regression testing and smoke tests
- Load testing and stress testing
  - Implement tools for simulating high player loads
  - Support for identifying and resolving performance bottlenecks

## XVIII. Documentation

### 1. Code Documentation
- Inline comments
  - Follow consistent documentation standards (e.g., JSDoc)
  - Keep documentation up-to-date with code changes
- API documentation generation
  - Use tools like Swagger for REST API documentation
  - Implement interactive API explorers for developers

### 2. User Documentation
- Server setup and configuration guide
  - Provide detailed instructions for server deployment
  - Include troubleshooting guides and FAQs
- Game master/admin documentation
  - Create comprehensive guides for game management
  - Include best practices for moderation and event creation

## XIX. Deployment and Maintenance

### 1. Deployment Scripts
- Automated deployment process
  - Implement CI/CD pipelines for automated testing and deployment
  - Support for rolling updates and zero-downtime deployments

### 2. Backup System
- Regular data backups
  - Implement automated, scheduled backups
  - Support for incremental and full backups
- Backup restoration procedures
  - Create detailed guides for data restoration
  - Implement tools for partial data recovery

### 3. Update Mechanism
- Live update capabilities
  - Implement mechanisms for updating game content without restarts
  - Support for player notifications of upcoming updates
- Rollback procedures
  - Implement version control for all game data
  - Support for quick rollbacks in case of critical issues

## XX. Appendix

### 1. Class List
1. ConfigurationManager
2. LogSystem
3. CoreServerSystem
4. SocketEventSystem
5. ClientManager
6. DatabaseManager
7. GameDataManager
8. LocationSystem
9. Location
10. WorldEventSystem
11. WorldManager
12. TimeSystem
13. Entity
14. Character
15. Player
16. NPC
17. Merchant
18. NPCManager
19. Item
20. Weapon
21. Consumable
22. SkillSystem
23. Skill
24. QuestSystem
25. Quest
26. EconomicSystem
27. ChatChannel
28. ChatSystem
29. EmoteSystem
30. CommandParser
31. Command
32. GameStateManager
33. ScriptEngine
34. AdminTools
35. MonitoringSystem
36. AuthenticationSystem
37. AntiCheatSystem
38. CacheManager
39. MessageProtocol
40. LocationCoordinateManager
41. QuestLog
42. DialogueTree
