/**************************************************************************************************
Import Dependencies
***************************************************************************************************/
import { promises as fs } from 'fs';
import path from 'path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import https from 'https';
import { exit } from 'process';
import CONFIG from './config.js';
import bcrypt from 'bcrypt';
/**************************************************************************************************
Logger Interface Class
The ILogger class defines an abstract interface for logging operations within the game system.
It establishes a contract for implementing various logging levels (debug, info, warn, error)
without specifying the underlying logging mechanism. This abstraction allows for flexible
implementation of logging strategies across different parts of the application.
Key features:
1. Abstract method definitions for different log levels
2. Standardized logging interface for consistent usage throughout the codebase
3. Extensibility for custom logging implementations
By providing a common interface, ILogger ensures that logging can be uniformly applied and
easily modified or extended across the entire game system.
***************************************************************************************************/
class ILogger {
  log() {}
  debug() {}
  info() {}
  warn() {}
  error() {}
}
/**************************************************************************************************
Event Emitter Interface Class
The ISocketEventEmitter class defines an abstract interface for event emission and handling within
the game system. It outlines methods for registering listeners, emitting events, and removing
listeners without specifying the underlying implementation. This abstraction allows for flexible
implementation of event handling strategies across different parts of the application.
Key features:
1. Abstract method definitions for event emission and handling
2. Standardized interface for event management
3. Separation of concerns between event emission and handling
By providing a common interface, ISocketEventEmitter ensures that event handling can be consistently
implemented and easily modified or extended across the entire game system.
***************************************************************************************************/
class ISocketEventEmitter {
  on(event, callback) {}
  emit(event, ...args) {}
  off(event, callback) {}
}
/**************************************************************************************************
Base Manager Interface Class
The IBaseManager class is an abstract base class that provides a common interface for managing
various components of the game server. It outlines methods for initializing and managing
components without specifying the underlying implementation. This abstraction allows for
flexible implementation of component management strategies.
Key features:
1. Abstract method definitions for component initialization and management
2. Standardized interface for component management
3. Separation of concerns between component management and game logic
By providing a common interface, IBaseManager ensures that component management can be consistently
implemented and easily modified or extended across the entire game system.
***************************************************************************************************/
class IBaseManager {
  constructor({ logger, server }) {
    this.server = server;
    this.logger = logger;
  }
}
/**************************************************************************************************
Database Manager Interface Class
The IDatabaseManager class defines an abstract interface for database operations within the game
system. It outlines methods for loading and saving various types of game data (locations, Npcs,
items) without specifying the underlying database technology. This abstraction allows for
flexible implementation of data persistence strategies.
Key features:
1. Abstract method definitions for data loading and saving operations
2. Standardized interface for database interactions
3. Separation of concerns between data access and game logic
By providing a common interface, IDatabaseManager ensures that database operations can be
consistently implemented and easily modified or extended across the entire game system.
***************************************************************************************************/
class IDatabaseManager {
  constructor({ logger, server }) {
    this.server = server;
    this.logger = logger;
  }
  async loadLocationData() {}
  async loadNpcData() {}
  async loadItemData() {}
  async saveData() {}
  async initialize() {}
}
/**************************************************************************************************
Game Manager Interface Class
The IGameManager class defines an abstract interface for managing game entities and locations within
the game system. It outlines methods for retrieving and moving entities, as well as accessing
specific locations without specifying the underlying implementation. This abstraction allows
for flexible implementation of game entity management strategies.
Key features:
1. Abstract method definitions for entity retrieval and movement
2. Standardized interface for game entity management
3. Separation of concerns between game entity management and game logic
***************************************************************************************************/
class IGameManager {
  getLocation(locationId) {}
  moveEntity(entity, newLocationId) {}
  getNpc(npcId) {}
}
/**************************************************************************************************
Logger Class
The Logger class is a concrete implementation of the ILogger interface, providing robust logging
functionality for the game system. It implements a Singleton pattern to ensure a single, globally
accessible logging instance. This class handles formatting, prioritization, and output of log
messages across various severity levels.
Key features:
1. Singleton pattern implementation for global access
2. Configurable log levels with color-coded output
3. Conditional logging based on severity thresholds
4. Formatted log output with timestamps and log level indicators
The Logger class plays a critical role in system diagnostics, error tracking, and runtime
monitoring, facilitating easier debugging and maintenance of the game system.
***************************************************************************************************/
class Logger extends ILogger {
  static instance;
  static getInstance() {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  constructor(config) {
    super();
    if (Logger.instance) {
      return Logger.instance;
    }
    this.CONFIG = config;
    this.logLevel = config.LOG_LEVEL;
    this.logLevels = {
      'DEBUG': 0,
      'INFO': 1,
      'WARN': 2,
      'ERROR': 3
    };
    Logger.instance = this;
  }
  log(level, message) {
    if (this.shouldLog(level)) {
      let coloredMessage = message;
      switch (level) {
        case 'DEBUG':
          coloredMessage = `${this.CONFIG.ORANGE}${message}${this.CONFIG.RESET}`;
          break;
        case 'WARN':
          coloredMessage = `${this.CONFIG.MAGENTA}WARNING: ${message}${this.CONFIG.RESET}`;
          break;
        case 'ERROR':
          coloredMessage = `${this.CONFIG.RED}ERROR: ${message}${this.CONFIG.RESET}`;
          break;
      }
      this.writeToConsole(coloredMessage);
    }
  }
  shouldLog(level) {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }
  writeToConsole(logString) {
    console.log(logString.trim());
  }
  debug(message) {
    this.log('DEBUG', message);
  }
  info(message) {
    this.log('INFO', message);
  }
  warn(message) {
    this.log('WARN', message);
  }
  error(message, { error }) {
    this.log('ERROR', `${message} - ${error.message}`);
    this.log('ERROR', error.stack);
  }
}
/**************************************************************************************************
Config Manager Class
The ConfigManager class is responsible for managing the game's configuration settings. It implements
the Singleton pattern to ensure a single, globally accessible instance of configuration data.
This class handles loading configuration from external sources, providing access to configuration
values, and maintaining the integrity of the game's settings.
Key features:
1. Singleton pattern implementation for global access
2. Configuration loading from external sources (e.g., JSON files)
3. Getter methods for accessing specific configuration values
4. Error handling for configuration loading failures
The ConfigManager plays a crucial role in centralizing and standardizing access to game settings,
facilitating easier maintenance and modification of game parameters.
***************************************************************************************************/
class ConfigManager {
  static instance;
  static config;
  static getInstance(config) {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(config);
    }
    return ConfigManager.instance;
  }
  constructor(config) {
    if (ConfigManager.instance) {
      return ConfigManager.instance;
    }
    ConfigManager.config = config;
    ConfigManager.instance = this;
  }
  get(key) {
    if (!(key in ConfigManager.config)) {
      throw new Error(`Configuration key "${key}" not found`);
    }
    return ConfigManager.config[key];
  }
  set(key, value) {
    ConfigManager.config[key] = value;
  }
  // Add this new method
  async loadConfig() {
    // If config is already loaded, just return
    if (Object.keys(ConfigManager.config).length > 0) {
      return;
    }
    try {
      // Assuming config is imported from a separate file
      const importedConfig = await import('./config.js');
      ConfigManager.config = importedConfig.default;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }
  // Add this method to get multiple config values at once
  getMultiple(keys) {
    const values = {};
    for (const key of keys) {
      values[key] = this.get(key);
    }
    return values;
  }
}
/**************************************************************************************************
Server Class
The Server class serves as the central orchestrator for the game server application. It initializes
and manages core components of the server, including database connections, socket communications,
game state management, and player sessions. This class implements a modular architecture to
coordinate various subsystems and ensure smooth operation of the game server.
Key features:
1. Initialization of core server components (database, sockets, game manager)
2. Management of active player sessions
3. Coordination of game loops and event processing
4. SSL/TLS support for secure communications
5. Error handling and graceful shutdown procedures
The Server class acts as the backbone of the game system, providing a robust foundation for
multiplayer gameplay and server-side game logic execution.
***************************************************************************************************/
class Server {
  static instance;
  static getInstance({ logger, configManager }) {
    if (!Server.instance) {
      Server.instance = new Server({ logger, configManager });
    }
    return Server.instance;
  }
  constructor({ logger, configManager }) {
    if (Server.instance) {
      return Server.instance;
    }
    this.SocketEventEmitter = new SocketEventEmitter();
    this.configManager = configManager || ConfigManager.getInstance();
    this.logger = logger;
    this.databaseManager = null;
    this.socketEventManager = null;
    this.serverConfigurator = null;
    this.activeSessions = new Map();
    this.gameManager = null;
    this.isHttps = false;
    this.app = null;
    this.queueManager = new QueueManager();
    this.messageManager = new MessageManager();
    this.messageQueueSystem = new MessageQueueSystem(this);
    this.gameComponentInitializer = null;
    this.itemManager = new ItemManager({ logger, configManager, bcrypt });
    this.transactionManager = new TransactionManager(this);
    this.replicationManager = new ReplicationManager(this);
    this.setupReplicationFilters();
    this.authManager = new AuthenticationManager(this, bcrypt);
    this.sessionManager = new SessionManager(this, bcrypt);
    this.npcMovementManager = null;
    Server.instance = this;
  }
  async init() {
    const initSteps = [
      { name: 'Configure Server Components', action: this.configureServerComponents.bind(this) },
      { name: 'Initialize Socket Event Manager', action: this.initializeSocketEventManager.bind(this) },
      { name: 'Configure Server', action: this.serverConfigurator.configureServer.bind(this.serverConfigurator) },
      { name: 'Initialize Game Manager', action: this.initializeGameManager.bind(this) },
      { name: 'Setup Game Components', action: this.setupGameComponents.bind(this) },
      { name: 'Start Game', action: this.startGame.bind(this) }
    ];
    for (const step of initSteps) {
      try {
        this.logger.info(`- ${step.name.toUpperCase()} STARTED`);
        await step.action();
        this.logger.info(`- ${step.name.toUpperCase()} FINISHED`);
      } catch (error) {
        this.logger.error(`Error during ${step.name}: ${error.message}`, { error });
        // Depending on the severity, you might want to exit the process here
        // process.exit(1);
      }
    }
  }
  handlePlayerConnected(player) {
    this.logger.info(`Player connected: ${player.getName()}`);
  }
  async setupHttpServer() {
    try {
      const sslOptions = await this.loadSslOptions();
      this.isHttps = sslOptions.key && sslOptions.cert;
      const httpModule = this.isHttps ? https : http;
      this.server = httpModule.createServer(this.isHttps ? sslOptions : this.app);
      this.logger.info(`- Configure Server As - ${this.isHttps ? 'https' : 'http'}://${this.configManager.get('HOST')}:${this.configManager.get('PORT')}`);
      return this.server;
    } catch (error) {
      this.logger.error(`Error during HTTP server configuration: ${error.message}`, { error });
      throw error; // Re-throw the error to be handled by the caller
    }
  }
  async loadSslOptions() {
    const sslOptions = { key: null, cert: null };
    const SSL_CERT_PATH = this.configManager.get('SSL_CERT_PATH');
    const SSL_KEY_PATH = this.configManager.get('SSL_KEY_PATH');
    try {
      if (SSL_CERT_PATH && SSL_KEY_PATH) {
        sslOptions.cert = await fs.readFile(SSL_CERT_PATH);
        sslOptions.key = await fs.readFile(SSL_KEY_PATH);
      } else if (SSL_CERT_PATH || SSL_KEY_PATH) {
        this.logger.error(`Both SSL_CERT_PATH & SSL_KEY_PATH Must Be Provided For SSL Configuration`);
      }
    } catch (error) {
      this.logger.warn(`Failed To Load SSL Options: ${error.message}`, { error });
    }
    return sslOptions;
  }
  cleanup() {
    this.databaseManager = null;
    this.socketEventManager = null;
    this.serverConfigurator = null;
    this.activeSessions.clear();
  }
  startGame() {
    try {
      if (this.isGameRunning()) {
        this.logger.debug('Game Is Already Running.');
        return;
      }
      this.gameManager.startGameLoop();
      this.isRunning = true;
    } catch (error) {
      this.logger.error(`Error Starting Game Manager: ${error.message}`, { error });
    }
  }
  logServerRunningMessage() {
    const protocol = this.isHttps ? 'https' : 'http';
    const host = this.configManager.get('HOST');
    const port = this.configManager.get('PORT');
    this.logger.info(`SERVER IS RUNNING AT: ${protocol}://${host}:${port}`);
  }
  isGameRunning() {
    return this.isRunning;
  }
  processTasks() {
    this.queueManager.processQueue();
  }
  async addTask(task) {
    await this.queueManager.enqueue(task);
  }
  setupReplicationFilters() {
    // Filter for items
    this.replicationManager.addFilter('item', (item, player) => {
      const baseInfo = {
        id: item.id,
        name: item.name,
        description: item.description,
      };
      // Only send detailed info if the player owns the item
      if (player.inventory.has(item.id)) {
        return {
          ...baseInfo,
          type: item.type,
          price: item.price,
          // Add other properties as needed
        };
      }
      return baseInfo;
    });
    // Filter for Npcs
    this.replicationManager.addFilter('npc', (npc, player) => {
      const baseInfo = {
        id: npc.id,
        name: npc.name,
        status: npc.status,
        currentLocation: npc.currentLocation
      };
      // Only send detailed info if the Npc is in the same location as the player
      if (npc.currentLocation === player.currentLocation) {
        return {
          ...baseInfo,
          health: npc.health,
          maxHealth: npc.maxHealth,
          // Add other properties as needed
        };
      }
      return baseInfo;
    });
    // Filter for locations
    this.replicationManager.addFilter('location', (location, player) => {
      const baseInfo = {
        id: location.id,
        name: location.name,
        description: location.description,
        exits: location.exits,
      };
      // Only send detailed info if it's the player's current location
      if (location.id === player.currentLocation) {
        return {
          ...baseInfo,
          items: Array.from(location.items),
          npcs: Array.from(location.npcs),
          // Add other properties as needed
        };
      }
      return baseInfo;
    });
  }
  // Update this method to use replication filters
  fullStateSync(player) {
    const playerData = this.replicationManager.applyFilters('player', player, player);
    const locationData = this.replicationManager.applyFilters('location', this.getLocation(player.currentLocation), player);
    const inventoryData = Array.from(player.inventory).map(itemId =>
      this.replicationManager.applyFilters('item', this.getItem(itemId), player)
    );
    const nearbyNpcs = this.getNpcsInLocation(player.currentLocation);
    const npcData = nearbyNpcs.map(npc => this.replicationManager.applyFilters('npc', npc, player));
    this.socket.emit('fullStateSync', {
      playerId: player.getId(),
      playerData,
      locationData,
      inventoryData,
      npcData
    });
  }
  // Use this method when updating specific entities
  updateEntity(entityType, entityData) {
    this.players.forEach(player => {
      this.replicationManager.replicateToPlayer(player, entityType, entityData);
    });
  }
  handleConnection(socket) {
    socket.on('message', async (message) => {
      const data = JSON.parse(message);
      switch (data.type) {
        case 'login':
          const authResult = await this.authManager.authenticateCharacter(data.characterName, data.password);
          if (authResult.success) {
            const sessionToken = this.sessionManager.createSession(authResult.characterData.id);
            socket.send(JSON.stringify({ type: 'loginResult', success: true, sessionToken }));
          } else {
            socket.send(JSON.stringify({ type: 'loginResult', success: false, message: authResult.message }));
          }
          break;
        case 'restoreSession':
          const session = this.sessionManager.getSession(data.token);
          if (session) {
            this.sessionManager.updateSessionActivity(data.token);
            // Restore player state and send to client
          } else {
            socket.send(JSON.stringify({ type: 'sessionExpired' }));
          }
          break;
        case 'logout':
          this.sessionManager.removeSession(data.token);
          socket.send(JSON.stringify({ type: 'logoutConfirmation' }));
          break;
        // ... handle other message types
      }
    });
  }
}
/**************************************************************************************************
Server Initializer Class
The ServerInitializer class is responsible for initializing and configuring the game server.
It implements the Singleton pattern to ensure only one instance of the server is created.
Key features:
1. Singleton instance management
2. Logger initialization
3. Server instance creation
4. Server configuration
5. Game component initialization
This class serves as the entry point for setting up the entire game environment, coordinating
the initialization of various subsystems and managers. It handles potential errors during
the initialization process and ensures proper logging of the server's startup sequence.
***************************************************************************************************/
class ServerInitializer {
  static instance;
  static getInstance({ config }) {
    if (!ServerInitializer.instance) {
      ServerInitializer.instance = new ServerInitializer({ config });
    }
    return ServerInitializer.instance;
  }
  constructor({ config }) {
    if (ServerInitializer.instance) {
      return ServerInitializer.instance;
    }
    this.logger = new Logger({ LOG_LEVEL, ORANGE, MAGENTA, RED, RESET });
    this.configManager = ConfigManager.getInstance(config);
    this.server = new Server({ logger: this.logger, configManager: this.configManager });
    this.serverConfigurator = new ServerConfigurator({
      logger: this.logger,
      config: this.server.configManager,
      server: this.server,
      socketEventManager: this.server.socketEventManager
    });
    this.gameComponentInitializer = new GameComponentInitializer({ logger: this.logger, server: this.server });
    ServerInitializer.instance = this;
  }
  async initialize() {
    try {
      this.logger.info("");
      this.logger.info("INITIALIZE SERVER STARTED");
      this.logger.debug("- Initialize Server Instance");
      await this.server.init();
      this.logger.debug("- Initialize Server Instance Finished");
      this.logger.info("INITIALIZE SERVER FINISHED");
      this.server.logServerRunningMessage();
    } catch (error) {
      this.logger.error(`Initializing Server: ${error.message}`, { error });
    }
  }
  async cleanup() {
    try {
      // Cleanup NpcMovementManager
      if (this.server.npcMovementManager) {
        this.server.npcMovementManager.cleanup();
      }
      // Cleanup ItemManager
      if (this.server.itemManager) {
        this.server.itemManager.cleanup();
      }
      // Cleanup TransactionManager
      if (this.server.transactionManager) {
        this.server.transactionManager.cleanup();
      }
      // Cleanup MessageManager
      MessageManager.cleanup();
      // Cleanup player inventories
      for (const player of this.server.players.values()) {
        if (player.inventoryManager) {
          player.inventoryManager.cleanup();
        }
      }
      // Close database connection
      if (this.server.db) {
        await this.server.db.close();
        this.logger.info('Database connection closed');
      }
      // Close socket connection
      if (this.server.io) {
        await new Promise(resolve => this.server.io.close(resolve));
        this.logger.info('Socket connection closed');
      }
      this.logger.info('Server cleanup completed');
    } catch (error) {
      this.logger.error('Error during server cleanup:', error);
    }
  }
}
/**************************************************************************************************
Server Configurator Class
The ServerConfigurator class is responsible for setting up and configuring the game server
environment. It handles the initialization of various server components, including Express
middleware, HTTP/HTTPS server setup, and socket connections. This class ensures that all
necessary server configurations are properly applied before the game server becomes operational.
Key features:
1. Express application setup and middleware configuration
2. HTTP/HTTPS server initialization with SSL/TLS support
3. Socket.io integration for real-time communication
4. Error handling middleware setup
5. Queue manager initialization for task management
The ServerConfigurator plays a crucial role in establishing the server's infrastructure,
enabling secure and efficient communication between clients and the game server.
***************************************************************************************************/
class ServerConfigurator extends IBaseManager {
  static instance;
  static getInstance({ logger, config, server, socketEventManager }) {
    if (!ServerConfigurator.instance) {
      ServerConfigurator.instance = new ServerConfigurator({ logger, config, server, socketEventManager });
    }
    return ServerConfigurator.instance;
  }
  constructor({ logger, config, server, socketEventManager }) {
    super({ server, logger });
    this.config = config;
    this.socketEventManager = socketEventManager;
    this.server.app = null;
  }
  async configureServer() {
    const { logger, server } = this;
    try {
      await this.setupExpress();
    } catch (error) {
      logger.error(`During Express Configuration: ${error.message}`, { error });
      logger.error(error.stack);
    }
    try {
      await server.setupHttpServer();
    } catch (error) {
      logger.error(`During Http Server Configuration: ${error.message}`, { error });
    }
    try {
      this.configureMiddleware();
    } catch (error) {
      logger.error(`During Middleware Configuration: ${error.message}`, { error });
      logger.error(error.stack);
    }
    try {
      server.queueManager = new QueueManager();
    } catch (error) {
      logger.error(`During Queue Manager Configuration: ${error.message}`, { error });
    }
  }
  async setupExpress() {
    try {
      this.server.app = express();
    } catch (error) {
      this.logger.error(`Error Setting Up Express: ${error.message}`, { error });
      throw error;
    }
  }
  configureMiddleware() {
    try {
      this.server.app.use(express.static('public'));
      this.server.app.use((err, req, res, next) => {
        this.logger.error(`Middleware Error: ${err.message}`, { error: err });
        res.status(500).send('An Unexpected Error Occurred. Please Try Again Later.');
      });
    } catch (error) {
      this.logger.error(`Error Configuring Middleware: ${error.message}`, { error });
      throw error;
    }
  }
  async cleanup() {
    this.logger.info("Starting server cleanup...");
    try {
      // Stop the game loop
      if (this.gameManager) {
        this.gameManager.stopGameLoop();
      }
      // Cleanup GameManager
      if (this.gameManager) {
        await this.gameManager.cleanup();
      }
      // Cleanup DatabaseManager
      if (this.databaseManager) {
        await this.databaseManager.cleanup();
      }
      // Cleanup SocketEventManager
      if (this.socketEventManager) {
        await this.socketEventManager.cleanup();
      }
      // Cleanup QueueManager
      if (this.queueManager) {
        await this.queueManager.cleanup();
      }
      // Cleanup MessageManager
      MessageManager.cleanup();
      // Cleanup ItemManager
      if (this.itemManager) {
        await this.itemManager.cleanup();
      }
      // Cleanup TransactionManager
      if (this.transactionManager) {
        await this.transactionManager.cleanup();
      }
      // Cleanup ReplicationManager
      if (this.replicationManager) {
        await this.replicationManager.cleanup();
      }
      // Cleanup AuthManager
      if (this.authManager) {
        await this.authManager.cleanup();
      }
      // Cleanup SessionManager
      if (this.sessionManager) {
        await this.sessionManager.cleanup();
      }
      // Cleanup NpcMovementManager
      if (this.npcMovementManager) {
        await this.npcMovementManager.cleanup();
      }
      // Close database connection
      if (this.db) {
        await this.db.close();
        this.logger.info('Database connection closed');
      }
      // Close socket connection
      if (this.io) {
        await new Promise(resolve => this.io.close(resolve));
        this.logger.info('Socket connection closed');
      }
      // Clear all active sessions
      this.activeSessions.clear();
      this.logger.info("Server cleanup completed successfully.");
    } catch (error) {
      this.logger.error(`Error during server cleanup: ${error.message}`, { error });
    }
  }
}
/**************************************************************************************************
Socket Event Manager Class
The SocketEventManager class is responsible for managing socket events and interactions within
the game server. It handles the setup and configuration of socket.io, including event listeners
and dispatchers for various socket events. This class ensures that all socket-related
interactions are properly managed and executed.
Key features:
1. Socket.io setup and configuration
2. Event listener setup for socket events
3. Socket event dispatching and handling
4. Integration with the GameCommandManager for command processing
The SocketEventManager plays a crucial role in facilitating real-time interactions between
clients and the game server, ensuring that all socket-related functionality operates smoothly.
***************************************************************************************************/
class SocketEventManager extends IBaseManager {
  static instance;
  static getInstance({ logger, server, gameCommandManager }) {
    if (!SocketEventManager.instance) {
      SocketEventManager.instance = new SocketEventManager({ logger, server, gameCommandManager });
    }
    return SocketEventManager.instance;
  }
  constructor({ logger, server, gameCommandManager }) {
    super({ server, logger });
    this.io = null;
    this.gameCommandManager = gameCommandManager;
    this.queueManager = QueueManager.getInstance();
    this.taskManager = TaskManager.getInstance({ server });
  }
  initializeSocketEvents() {
    try {
      this.io = new SocketIOServer(this.server.httpServer);
      this.io.on('connection', (socket) => {
        this.logger.info(`New client connected: ${socket.id}`);
        this.setupSocketListeners(socket);
      });
    } catch (error) {
      this.logger.error(`Error Initializing Socket Events: ${error.message}`, { error });
    }
  }
  setupSocketListeners(socket) {
    try {
      socket.on('playerAction', (data) => {
        const { actionType, payload } = data;
        const task = new TaskManager({
          server: this.server,
          execute: async () => {
            try {
              await this.gameCommandManager.handleCommand(socket, actionType, payload);
            } catch (error) {
              this.logger.error(`Error Handling Player Action: ${error.message}`, { error });
            }
          }
        });
        this.queueManager.enqueue(task);
      });
      socket.on('disconnect', () => this.handleDisconnect(socket));
    } catch (error) {
      this.logger.error(`Error Setting Up Socket Listeners: ${error.message}`, { error });
    }
  }
  handleDisconnect(socket) {
    try {
      this.logger.info(`Client disconnected: ${socket.id}`);
      // Clean up any necessary game state
    } catch (error) {
      this.logger.error(`Error Handling Disconnect: ${error.message}`, { error });
    }
  }
}
/**************************************************************************************************
SocketEvent Emitter Class
The SocketEventEmitter class provides a robust implementation of the publish-subscribe pattern,
facilitating event-driven communication within the game system. It allows components to register
listeners for specific events and emit events to trigger those listeners. This class serves
as a cornerstone for decoupled, event-based interactions between various parts of the game.
Key features:
1. Event registration and listener management
2. Asynchronous event emission with multiple argument support
3. Listener removal functionality
4. Support for multiple listeners per event type
The SocketEventEmitter class enables flexible and scalable communication between game components,
promoting loose coupling and enhancing the overall modularity of the system.
***************************************************************************************************/
class SocketEventEmitter extends ISocketEventEmitter {
  constructor() {
    super();
    this.listeners = new Map();
  }
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }
  emit(event, ...args) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        callback(...args);
      }
    }
  }
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }
}
/**************************************************************************************************
Replication Manager Class
The ReplicationManager class is responsible for managing data replication between the server
and clients. It ensures that only the necessary data is sent to each client, optimizing network
traffic and reducing server resource usage.
Key features:
1. Data filtering and replication
2. Integration with the SocketEventEmitter for real-time data updates
3. Efficient data management for game state synchronization
This class is essential for maintaining a responsive and synchronized game environment,
ensuring that all clients have up-to-date information about the game state.
***************************************************************************************************/
class ReplicationManager {
  constructor(server) {
    this.server = server;
    this.filters = new Map();
  }
  addFilter(entityType, filterFunction) {
    this.filters.set(entityType, filterFunction);
  }
  applyFilters(entityType, data, player) {
    const filter = this.filters.get(entityType);
    return filter ? filter(data, player) : data;
  }
  replicateToPlayer(player, entityType, data) {
    const filteredData = this.applyFilters(entityType, data, player);
    this.server.socket.emit('replicateData', { playerId: player.getId(), entityType, data: filteredData });
  }
  replicateToAllPlayers(entityType, data) {
    this.server.players.forEach(player => {
      this.replicateToPlayer(player, entityType, data);
    });
  }
}
/**************************************************************************************************
AsyncLock Class
The AsyncLock class provides a mechanism to manage asynchronous locks, ensuring that
concurrent access to shared resources is properly synchronized.
Key features:
1. Lock management using Promises
2. Asynchronous lock acquisition and release
3. Support for nested lock acquisition
4. Error handling during lock operations
***************************************************************************************************/
class AsyncLock {
  constructor() {
    this.lock = Promise.resolve();
  }
  async acquire() {
    const release = await this.lock;
    let releaseFn;
    this.lock = new Promise(resolve => {
      releaseFn = resolve;
    });
    return () => {
      release();
      releaseFn();
    };
  }
}
/**************************************************************************************************
Queue Manager Class
The QueueManager class is responsible for managing a queue of tasks, ensuring orderly
execution of game operations and preventing system overload.
Key features:
1. Task queue management
2. Concurrent task execution control
3. Dynamic queue processing
4. Task cleanup and error handling
This class works in conjunction with the TaskManager to provide a robust system for
handling multiple game tasks efficiently, maintaining system stability and performance.
***************************************************************************************************/
class QueueManager {
  static instance;
  static getInstance({ logger } = {}) {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager({ logger });
    }
    return QueueManager.instance;
  }
  constructor({ logger, capacity = 1000 } = {}) {
    this.logger = logger || console;
    this.buffer = new Array(capacity);
    this.capacity = capacity;
    this.size = 0;
    this.head = 0;
    this.tail = 0;
    this.runningTasks = new Set();
    this.maxConcurrentTasks = 5;
    this.asyncLock = new AsyncLock();
  }
  async enqueue(task) {
    const release = await this.asyncLock.acquire();
    try {
      if (this.size === this.capacity) {
        this.resize();
      }
      this.buffer[this.tail] = task;
      this.tail = (this.tail + 1) % this.capacity;
      this.size++;
      await this.processQueue();
    } catch (error) {
      this.logger.error(`Error enqueueing task: ${error.message}`, { error });
    } finally {
      release();
    }
  }
  dequeue() {
    try {
      if (this.size === 0) return null;
      const item = this.buffer[this.head];
      this.head = (this.head + 1) % this.capacity;
      this.size--;
      return item;
    } catch (error) {
      this.logger.error(`Error dequeuing task: ${error.message}`, { error });
      return null;
    }
  }
  resize() {
    try {
      const newCapacity = this.capacity * 2;
      const newBuffer = new Array(newCapacity);
      for (let i = 0; i < this.size; i++) {
        newBuffer[i] = this.buffer[(this.head + i) % this.capacity];
      }
      this.buffer = newBuffer;
      this.capacity = newCapacity;
      this.head = 0;
      this.tail = this.size;
    } catch (error) {
      this.logger.error(`Error resizing queue: ${error.message}`, { error });
    }
  }
  async processQueue() {
    while (this.size > 0 && this.runningTasks.size < this.maxConcurrentTasks) {
      const task = this.dequeue();
      if (!task) continue;
      this.runningTasks.add(task);
      try {
        await task.run();
        task.onComplete();
      } catch (error) {
        this.logger.error(`Error processing task: ${error.message}`, { error });
        task.onError(error);
      } finally {
        this.runningTasks.delete(task);
      }
    }
  }
  cleanup() {
    try {
      this.buffer = new Array(this.capacity);
      this.size = 0;
      this.head = 0;
      this.tail = 0;
      this.runningTasks.clear();
    } catch (error) {
      this.logger.error(`Error cleaning up queue: ${error.message}`, { error });
    }
  }
}
/**************************************************************************************************
Object Pool Class
The ObjectPool class provides a reusable pool of objects to improve performance and reduce
memory allocation overhead. It manages the creation and reuse of objects, particularly
useful for frequently created and destroyed objects like combat actions.
Key features:
1. Object creation and management
2. Efficient reuse of objects
3. Customizable object initialization and reset
This class enhances performance by reducing the need for frequent object creation and
garbage collection, particularly beneficial in high-frequency operations like combat.
***************************************************************************************************/
class ObjectPool {
  constructor(createFunc, initialSize = 10) {
    this.createFunc = createFunc;
    this.pool = [];
    this.initialize(initialSize);
  }
  initialize(size) {
    for (let i = 0; i < size; i++) {
      this.pool.push(this.createFunc());
    }
  }
  acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return this.createFunc();
  }
  release(obj) {
    // Optionally reset the object here if needed
    this.pool.push(obj);
  }
}
/**************************************************************************************************
Task Manager Class
The TaskManager class is responsible for managing individual tasks within the game system.
It provides a structure for creating, executing, and monitoring the status of various game-related
tasks.
Key features:
1. Task creation and naming
2. Asynchronous task execution
3. Task status tracking
4. Error handling and callback management
This class allows for better organization and management of game operations, enabling the
system to handle complex sequences of actions in a controlled and monitored manner.
***************************************************************************************************/
class TaskManager {
  static instance;
  static getInstance({ server }) {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager({ server });
    }
    return TaskManager.instance;
  }
  constructor({ server }) {
    if (TaskManager.instance) {
      return TaskManager.instance;
    }
    this.server = server;
    this.logger = server.logger;
    this.tasks = new Map();
    TaskManager.instance = this;
  }
  async run() {
    this.status = 'running';
    try {
      await this.execute();
      this.status = 'completed';
    } catch (error) {
      this.status = 'failed';
      this.logger.error(`Task '${this.name}' execution failed: ${error.message}`, { error });
      if (this.errorCallback) {
        this.errorCallback(error);
      }
    } finally {
      if (this.status === 'completed' && this.completeCallback) {
        this.completeCallback();
      }
    }
  }
  cancel() {
    if (this.status === 'pending') {
      this.status = 'canceled';
    }
  }
  onComplete(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    this.completeCallback = callback;
  }
  onError(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    this.errorCallback = callback;
  }
  cleanup() {
    this.tasks.clear();
    // Add any other necessary cleanup tasks
  }
}
/**************************************************************************************************
Message Queue System Class
The MessageQueueSystem class is responsible for managing a priority-based queue of messages
within the game system, ensuring efficient and orderly processing of game communications.
Key features:
1. Priority-based message queuing (high, medium, low)
2. Asynchronous message processing
3. Integration with server's message manager
4. Error handling and logging
This class plays a crucial role in managing the flow of information within the game,
prioritizing critical messages and ensuring smooth communication between different
components of the system.
***************************************************************************************************/
class MessageQueueSystem {
  static instance;
  static getInstance({ server }) {
    if (!MessageQueueSystem.instance) {
      MessageQueueSystem.instance = new MessageQueueSystem({ server });
    }
    return MessageQueueSystem.instance;
  }
  constructor({ server }) {
    this.server = server;
    this.queues = {
      high: [],
      medium: [],
      low: []
    };
    this.isProcessing = false;
  }
  addMessage(message, priority = 'medium') {
    if (typeof message !== 'object' || message === null) {
      throw new TypeError('Message must be an object');
    }
    if (typeof priority !== 'string' || !['high', 'medium', 'low'].includes(priority)) {
      throw new TypeError('Priority must be one of: high, medium, low');
    }
    this.queues[priority].push(message);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  async processQueue() {
    this.isProcessing = true;
    while (this.hasMessages()) {
      const message = this.getNextMessage();
      if (message) {
        await this.processMessage(message);
      }
    }
    this.isProcessing = false;
  }
  hasMessages() {
    return Object.values(this.queues).some(queue => queue.length > 0);
  }
  getNextMessage() {
    for (const priority of ['high', 'medium', 'low']) {
      if (this.queues[priority].length > 0) {
        return this.queues[priority].shift();
      }
    }
    return null;
  }
  async processMessage(message) {
    if (typeof message !== 'object' || message === null) {
      throw new TypeError('Message must be an object');
    }
    try {
      await this.server.messageManager.sendMessage(message.recipient, message.content, message.type);
    } catch (error) {
      this.server.logger.error(`Processing Message: ${error.message}`, { error });
    }
  }
}
/**************************************************************************************************
Database Manager Class
The DatabaseManager class is a concrete implementation of the IDatabaseManager interface,
providing methods for loading and saving game data. It handles interactions with the file system
to read and write game data, ensuring data persistence across game sessions. This class is
responsible for managing the data lifecycle, including validation and error handling.
Key features:
1. Loading and saving game data (locations, Npcs, items)
2. File system interactions for data persistence
3. Data validation and error handling during loading and saving operations
4. Management of data paths and configuration settings
The DatabaseManager is essential for maintaining the integrity of game data and ensuring
consistent access to game state information.
***************************************************************************************************/
class DatabaseManager extends IDatabaseManager {
  static instance;
  static getInstance({ logger, server }) {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager({ logger, server });
    }
    return DatabaseManager.instance;
  }
  constructor({ logger, server }) {
    super({ logger, server });
    this.configManager = server.configManager;
    this.DATA_PATHS = {
      LOCATIONS: this.configManager.get('LOCATIONS_DATA_PATH'),
      NPCS: this.configManager.get('NPCS_DATA_PATH'),
      ITEMS: this.configManager.get('ITEMS_DATA_PATH')
    };
    this.asyncLock = new AsyncLock();
  }
  async initialize() {
    for (const [key, path] of Object.entries(this.DATA_PATHS)) {
      if (!path) {
        this.logger.error(`${key}_DATA_PATH is not defined in the configuration`, { error: new Error(`${key}_DATA_PATH is not defined in the configuration`) });
      }
    }
  }
  async loadLocationData() {
    const locationDataPath = this.DATA_PATHS.LOCATIONS;
    if (!locationDataPath) {
      this.logger.error(`LOCATIONS_DATA_PATH is not defined in the configuration`, { error: new Error(`LOCATIONS_DATA_PATH is not defined in the configuration`) });
      return;
    }
    try {
      this.logger.info('- LOAD GAME DATA STARTED');
      this.logger.info('- Load Locations Data');
      this.logger.debug(`- Load Locations Data From: ${locationDataPath}`);
      const allLocationData = await this.loadData(locationDataPath, 'locations');
      return this.validateAndParseLocationData(allLocationData);
    } catch (error) {
      this.logger.error(`Failed to load locations data: ${error.message}`, { error });
    }
  }
  async loadData(folderPath, dataType = 'default') {
    if (typeof folderPath !== 'string') {
      throw new TypeError('Folder path must be a string');
    }
    if (typeof dataType !== 'string') {
      throw new TypeError('Data type must be a string');
    }
    const release = await this.asyncLock.acquire();
    try {
      const files = await fs.readdir(folderPath);
      const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');
      if (dataType === 'locations' || dataType === 'npcs' || dataType === 'items') {
        let allData = {};
        let duplicateIds = new Set();
        for (const file of jsonFiles) {
          const filePath = path.join(folderPath, file);
          const fileContent = await fs.readFile(filePath, 'utf8');
          this.customJsonParse(fileContent, duplicateIds, allData, file, dataType);
        }
        return allData;
    } else {
        const fileContents = await Promise.all(
          jsonFiles.map(async file => {
            const filePath = path.join(folderPath, file);
            const fileContent = await fs.readFile(filePath, 'utf8');
            return JSON.parse(fileContent);
          })
        );
        return fileContents.reduce((acc, content) => ({ ...acc, ...content }), {});
      }
    } catch (error) {
      this.logger.error(`Loading data from: ${folderPath} - ${error.message}`, { error });
    } finally {
      release();
    }
  }
  customJsonParse(jsonString, duplicateIds, allData, fileName, dataType) {
    if (typeof jsonString !== 'string') {
      throw new TypeError('JSON string must be a string');
    }
    if (!(duplicateIds instanceof Set)) {
      throw new TypeError('Duplicate IDs must be a Set');
    }
    if (typeof allData !== 'object' || allData === null) {
      throw new TypeError('All data must be an object');
    }
    if (typeof fileName !== 'string') {
      throw new TypeError('File name must be a string');
    }
    if (typeof dataType !== 'string') {
      throw new TypeError('Data type must be a string');
    }
    const regex = /"(\d+)":\s*(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/g;
    let match;
    while ((match = regex.exec(jsonString)) !== null) {
      const [, id, data] = match;
      if (id in allData) {
        duplicateIds.add(id);
        this.logger.error(`Duplicate ${this.getEntityType(dataType)} detected - ID: ${id}`, { error: new Error(`Duplicate ${this.getEntityType(dataType)} detected - ID: ${id}`) });
        this.logger.error(`- Detected in file: ${fileName}`, { error: new Error(`- Detected in file: ${fileName}`) });
      } else {
        try {
          allData[id] = JSON.parse(data);
        } catch (error) {
          this.logger.error(`Parsing ${this.getEntityType(dataType)} data - ID: ${id} in file ${fileName}: ${error.message}`, { error });
        }
      }
    }
  }
  getEntityType(dataType) {
    if (typeof dataType !== 'string') {
      throw new TypeError('Data type must be a string');
    }
    switch (dataType) {
      case 'npcs': return 'NPC';
      case 'items': return 'Item';
      default: return 'Location';
    }
  }
  validateAndParseLocationData(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      this.logger.error(`Locations data must be an object`, { error: new Error(`Locations data must be an object`) });
      return new Map();
    }
    const locationData = new Map();
    const referencedLocations = new Set();
    for (const [id, location] of Object.entries(data)) {
      this.logger.debug(`- Validate Location - ID: ${id}`);
      //this.logger.debug(`- Locations Data:`);
      //this.logger.debug(`${JSON.stringify(location, null, 2)}`);
      if (!this.isValidLocation(location)) {
        this.logger.error(`Invalid locations object${JSON.stringify(location)}`, { error: new Error(`Invalid locations object${JSON.stringify(location)}`) });
        continue;
      }
      locationData.set(id, location);
      // Collect referenced locations from exits
      if (location.exits) {
        Object.values(location.exits).forEach(exitId => referencedLocations.add(exitId));
      }
    }
    // Check for missing referenced locations
    referencedLocations.forEach(refId => {
      if (!locationData.has(refId)) {
        this.logger.error(`Validating locations data - referenced location is missing - ID: ${refId} `, { error: new Error(`Validating locations data - referenced location is missing - ID: ${refId} `) });
      }
    });
    this.logger.debug(`- Total Locations Validated: ${locationData.size}`);
    return locationData;
  }
  isValidLocation(location) {
    if (typeof location !== 'object' || location === null) {
      return false;
    }
    return typeof location.name === 'string' && typeof location.description === 'string' &&
           typeof location.exits === 'object' && Array.isArray(location.zone);
  }
  async loadNpcData() {
    const npcDataPath = this.DATA_PATHS.NPCS;
    if (!npcDataPath) {
      this.logger.error(`NPCS_DATA_PATH is not defined in the configuration`, { error: new Error(`NPCS_DATA_PATH is not defined in the configuration`) });
      return;
    }
    try {
      this.logger.info(`- Load Npcs Data`);
      this.logger.debug(`- Load Npcs Data From: ${npcDataPath}`);
      const allNpcData = await this.loadData(npcDataPath, 'npcs');
      return this.validateAndParseNpcData(allNpcData);
    } catch (error) {
      this.logger.error(`Failed to load npcs data: ${error.message}`, { error });
    }
  }
  validateAndParseNpcData(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      this.logger.error(`Npcs data must be an object`, { error: new Error(`Npcs data must be an object`) });
      return new Map();
    }
    const npcData = new Map();
    for (const [id, npc] of Object.entries(data)) {
      this.logger.debug(`- Validate Npc - ID: ${id}`);
      if (!this.isValidNpc(npc)) {
        this.logger.error(`Invalid npc object: ${JSON.stringify(npc)}`, { error: new Error(`Invalid npc object: ${JSON.stringify(npc)}`) });
        continue;
      }
      npcData.set(id, npc);
    }
    this.logger.debug(`- Total Npcs Validated: ${npcData.size}`);
    return npcData;
  }
  isValidNpc(npc) {
    if (typeof npc !== 'object' || npc === null) {
      return false;
    }
    return typeof npc.name === 'string' && typeof npc.sex === 'string' &&
           typeof npc.currHealth === 'number' && typeof npc.maxHealth === 'number' &&
           typeof npc.attackPower === 'number' && typeof npc.csml === 'number' &&
           typeof npc.aggro === 'boolean' && typeof npc.assist === 'boolean' &&
           typeof npc.status === 'string' && typeof npc.currentLocation === 'string' &&
           Array.isArray(npc.aliases) && typeof npc.type === 'string';
  }
  async loadItemData() {
    const itemDataPath = this.DATA_PATHS.ITEMS;
    if (!itemDataPath) {
      this.logger.error(`ITEMS_DATA_PATH is not defined in the configuration`, { error: new Error(`ITEMS_DATA_PATH is not defined in the configuration`) });
      return;
    }
    try {
      this.logger.info('- Load Items Data');
      this.logger.debug(`- Load Items Data From: ${itemDataPath}`);
      const allItemData = await this.loadData(itemDataPath, 'items');
      return this.validateAndParseItemData(allItemData);
    } catch (error) {
      this.logger.error(`Failed to load items data: ${error.message}`, { error });
    }
  }
  validateAndParseItemData(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      this.logger.error(`Items data must be an object`, { error: new Error(`Items data must be an object`) });
      return new Map();
    }
    const itemData = new Map();
    for (const [id, item] of Object.entries(data)) {
      this.logger.debug(`- Validate Item - ID: ${id}`);
      if (!this.isValidItem(item)) {
        this.logger.error(`Invalid item object: ${JSON.stringify(item)}`, { error: new Error(`Invalid item object: ${JSON.stringify(item)}`) });
        continue;
      }
      itemData.set(id, item);
    }
    this.logger.debug(`- Total Items Validated: ${itemData.size}`);
    return itemData;
  }
  isValidItem(item) {
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    return typeof item.name === 'string' && typeof item.description === 'string' &&
           Array.isArray(item.aliases) && typeof item.type === 'string';
  }
  async cleanup() {
    this.logger.info("Cleaning up DatabaseManager...");
    // Close any open database connections
    // Reset any internal state
    this.locations.clear();
    this.npcs.clear();
    this.items.clear();
    this.logger.info("DatabaseManager cleanup completed.");
  }
}
/**************************************************************************************************
Game Data Loader Class
The GameDataLoader class is responsible for loading and managing game data from the database.
It handles the retrieval and initialization of crucial game elements such as locations, Npcs,
and items.
Key features:
1. Asynchronous data fetching
2. Location data processing and coordinate assignment
3. Npc and item data loading and instantiation
4. Error handling and logging during data loading
This class plays a critical role in populating the game world with the necessary entities and
ensuring that all game data is properly loaded and structured for use by other game systems.
***************************************************************************************************/
class GameDataLoader {
  static instance;
  static getInstance({ server }) {
    if (!GameDataLoader.instance) {
      GameDataLoader.instance = new GameDataLoader({ server });
    }
    return GameDataLoader.instance;
  }
  constructor({ server }) {
    if (GameDataLoader.instance) {
      return GameDataLoader.instance;
    }
    const { configManager, logger } = server;
    this.server = server;
    this.config = configManager.config;
    this.logger = logger;
  }
  async fetchGameData() {
    const { logger, databaseManager } = this.server;
    const DATA_TYPES = { LOCATION: 'Location', NPC: 'Npc', ITEM: 'Item' };
    try {
      const loadData = async (loadFunction, type) => {
        try {
          const data = await loadFunction();
          return { type, data };
        } catch (error) {
          logger.error(`Error loading ${type} data: ${error.message}`, { error });
          return { type, data: null };
        }
      };
      const [locationData, npcData, itemData] = await Promise.all([
        loadData(databaseManager.loadLocationData.bind(databaseManager), DATA_TYPES.LOCATION),
        loadData(databaseManager.loadNpcData.bind(databaseManager), DATA_TYPES.NPC),
        loadData(databaseManager.loadItemData.bind(databaseManager), DATA_TYPES.ITEM)
      ]);
      await this.processLoadedData(locationData, npcData, itemData);
      return [locationData.data, npcData.data, itemData.data];
    } catch (error) {
      logger.error(`Error fetching game data: ${error.message}`, { error });
    }
  }
  async processLoadedData({ type: locationType, data: locationData },
                          { type: npcType, data: npcData },
                          { type: itemType, data: itemData }) {
    if (locationData instanceof Map) {
      const locationCoordinateManager = LocationCoordinateManager.getInstance({
        logger: this.logger,
        server: this.server,
        locationData
      });
      await locationCoordinateManager.assignCoordinates(locationData);
      this.server.gameManager.locations = locationData;
    } else {
      this.logger.error(`Invalid ${locationType} data format: ${JSON.stringify(locationData)}`);
    }
    if (npcData instanceof Map) {
      this.server.gameManager.npcs = await this.createNpcsFromData(npcData);
    } else {
      this.logger.error(`Invalid ${npcType} data format: ${JSON.stringify(npcData)}`);
    }
    if (itemData instanceof Map) {
      this.server.items = await this.createItems(itemData);
    } else {
      this.logger.error(`Invalid ${itemType} data format: ${JSON.stringify(itemData)}`);
    }
  }
  async createNpcsFromData(npcData) {
    const createNpc = async ([id, npcInfo]) => {
      if (this.server.gameManager.npcIds.has(id)) {
        this.logger.error(`Duplicate npc ID detected: ${id}`);
        return null;
      }
      this.server.gameManager.npcIds.add(id);
      try {
        const npc = await this.createNpc(id, npcInfo);
        if (npc) {
          this.logger.debug(`- Create Npc: ${npc.name}`);
          this.logger.debug(`- - ID: ${id}`);
          this.logger.debug(`- - Type: ${npc.type}`);
        }
        return [id, npc];
      } catch (error) {
        this.logger.error(`Error creating npc with ID ${id}: ${error.message}`, { error });
        return null;
      }
    };
    const npcEntries = await Promise.all(Array.from(npcData.entries()).map(createNpc));
    return new Map(npcEntries.filter(entry => entry !== null));
  }
  async createNpc(id, npcInfo) {
    if (typeof id !== 'string') {
      throw new TypeError('NPC ID must be a string');
    }
    if (typeof npcInfo !== 'object' || npcInfo === null) {
      throw new TypeError('NPC data must be an object');
    }
    try {
      const { type, ...npcData } = npcInfo;
      let npc;
      switch (type) {
        case 'mobile':
          npc = new MobileNpc({ id, ...npcData, server: this.server });
          this.server.gameManager.mobileNpcs.set(id, npc);
          if (this.server.gameManager.npcMovementManager) {
            this.server.gameManager.npcMovementManager.registerMobileNpc(npc);
          } else {
            this.logger.error(`NpcMovementManager not available for Npc: ${id}. Unable to register.`, { error: new Error(`NpcMovementManager not available for Npc: ${id}. Unable to register.`) });
          }
          break;
        case 'quest':
          npc = new QuestNpc({ id, ...npcData, server: this.server });
          this.server.gameManager.questNpcs.set(id, npc);
          break;
        case 'merchant':
          npc = new MerchantNpc({ id, ...npcData, server: this.server });
          this.server.gameManager.merchantNpcs.set(id, npc);
          break;
        default:
          npc = new Npc({ id, ...npcData, server: this.server });
      }
      this.server.gameManager.npcs.set(id, npc);
      await npc.initialize();
      return npc;
    } catch (error) {
      this.logger.error(`Creating Npc with ID: ${id} - ${error.message}`, { error });
      return null;
    }
  }
  async createItems(itemData) {
    if (!(itemData instanceof Map)) {
      throw new TypeError('Item data must be an instance of Map');
    }
    const items = new Map();
    const itemPromises = [];
    for (const [id, itemInfo] of itemData) {
      let item;
      switch (itemInfo.type) {
        case 'consumable':
          item = new ConsumableItem({ id, name: itemInfo.name, description: itemInfo.description, aliases: itemInfo.aliases, server: this.server });
          break;
        case 'container':
          item = new ContainerItem({ id, name: itemInfo.name, description: itemInfo.description, aliases: itemInfo.aliases, server: this.server });
          break;
        case 'weapon':
          item = new WeaponItem({ id, name: itemInfo.name, description: itemInfo.description, aliases: itemInfo.aliases, damage: itemInfo.damage, server: this.server });
          break;
        default:
          item = new Item({ id, name: itemInfo.name, description: itemInfo.description, aliases: itemInfo.aliases, type: itemInfo.type, server: this.server });
      }
      itemPromises.push(item.initialize().then(() => items.set(item.id, item)));
    }
    return Promise.all(itemPromises).then(() => items);
  }
}
/**************************************************************************************************
UID Generator Class
The UidGenerator class provides functionality for generating unique identifiers for game
entities. It includes methods for creating hashed UIDs to ensure uniqueness and security.
Key features:
1. Unique identifier generation logic
2. Hashing for security and uniqueness
This class ensures that all game entities have unique identifiers, facilitating proper
management and interaction within the game.
***************************************************************************************************/
class UidGenerator {
  static instance;
  static getInstance() {
    if (!UidGenerator.instance) {
      UidGenerator.instance = new UidGenerator();
    }
    return UidGenerator.instance;
  }
  static async generateUid() {
    try {
      const { hash } = await import('bcrypt');
      const uniqueValue = Date.now() + Math.random();
      return hash(uniqueValue.toString(), CONFIG.ITEM_UID_SALT_ROUNDS);
    } catch (error) {
      this.logger.error(`Generating UID - ${error.message}`, { error });
      return null;
    }
  }
}
/**************************************************************************************************
Game Manager Class
The GameManager class is responsible for managing the overall game state and player interactions.
It coordinates game loops, event processing, and player actions, ensuring that the game world
remains consistent and responsive. This class serves as the central hub for game logic and
state management.
Key features:
1. Management of active players and Npcs
2. Game loop execution and event handling
3. Coordination of game state updates and notifications
4. Integration with the SocketEventEmitter for event-driven architecture
The GameManager is crucial for maintaining the flow of the game and ensuring that player
actions have meaningful impacts on the game world.
***************************************************************************************************/
class GameManager extends IGameManager {
  static instance;
  static getInstance({ SocketEventEmitter, logger, server, configManager, combatManager }) {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager({
        SocketEventEmitter,
        logger,
        server,
        configManager,
        combatManager
      });
    }
    return GameManager.instance;
  }
  constructor({ SocketEventEmitter, logger, server, configManager, combatManager }) {
    super();
    if (GameManager.instance) {
      return GameManager.instance;
    }
    this.players = new Map();
    this.locations = new Map();
    this.npcs = new Map();
    this.mobileNpcs = new Map();
    this.questNpcs = new Map();
    this.merchantNpcs = new Map();
    this.SocketEventEmitter = SocketEventEmitter;
    this.logger = logger;
    this.server = server;
    this.gameLoopInterval = null;
    this.gameTime = 0;
    this.isRunning = false;
    this.configManager = configManager;
    this.tickRate = this.configManager.get('TICK_RATE');
    this.lastTickTime = Date.now();
    this.tickCount = 0;
    this.items = new Set();
    this.npcIds = new Set();
    this.combatManager = combatManager;
    this.queueManager = QueueManager.getInstance();
    this.taskManager = TaskManager.getInstance({ server });
    this.npcMovementManager = NpcMovementManager.getInstance({ logger, configManager, gameManager: this });
    this.setupEventListeners();
    GameManager.instance = this;
    this.asyncLock = new AsyncLock();
  }
  setupEventListeners() {
    if (this.SocketEventEmitter) {
      this.SocketEventEmitter.on("tick", this.gameTick.bind(this));
      this.SocketEventEmitter.on("newDay", this.newDayHandler.bind(this));
      this.SocketEventEmitter.on('tick', this.handleTick.bind(this));
    } else {
      this.logger.error('SocketEventEmitter is not initialized', { error: new Error('SocketEventEmitter is not initialized') });
    }
  }
  startGame() {
    if (this.isGameRunning()) {
      this.logger.debug('Game is already running');
      return;
    }
    try {
      this.startGameLoop();
      this.logger.debug('- Initialize Npc Movement');
      this.npcMovementManager.startMovement();
      this.isRunning = true;
    } catch (error) {
      this.logger.error(`Starting game: ${error.message}`, { error });
    }
  }
  isGameRunning() {
    return this.isRunning;
  }
  shutdownGame() {
    try {
      this.stopGameLoop();
      this.npcMovementManager.stopMovement();
      for (const player of this.players.values()) {
        player.save();
      }
      this.server.socketEventManager.cleanup();
      this.server.databaseManager.cleanup();
      this.server.queueManager.cleanup();
      this.server.socketEventManager.server.io.close(() => {
        this.logger.info('All socket connections closed.');
        this.shutdownServer();
      });
      MessageManager.notifyGameShutdownSuccess(this);
    } catch (error) {
      this.logger.error(`Shutting down game: ${error.message}`, { error });
    }
  }
  async shutdownServer() {
    try {
      await this.server.socketEventManager.server.io.close();
      this.logger.info('All socket connections closed.');
      exit(0);
    } catch (error) {
      this.logger.error(`Shutting down server: ${error.message}`, { error });
    }
  }
  startGameLoop() {
    try {
      const TICK_RATE = this.configManager.get('TICK_RATE');
      this.gameLoopInterval = setInterval(() => {
        try {
          const tickTask = new TaskManager({
            name: 'GameTick',
            execute: async () => {
              await this.handleTick();
            }
          });
          this.queueManager.enqueue(tickTask);
        } catch (error) {
          this.logger.error(`Error In Game Tick: ${error.message}`, { error });
        }
      }, TICK_RATE);
    } catch (error) {
      this.logger.error(`Error Starting Game Loop: ${error.message}`, { error });
    }
  }
  stopGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }
  async handleTick() {
    const release = await this.asyncLock.acquire();
    try {
      await this.gameTick();
      await this.sendTickMessageToClients();
    } catch (error) {
      this.logger.error(`Error Handling Game Tick: ${error.message}`, { error });
    } finally {
      release();
    }
  }
  async gameTick() {
    try {
      const currentTime = Date.now();
      this.tickCount++;
      if (currentTime - this.lastTickTime >= this.tickRate) {
        this.lastTickTime = currentTime;
        this.tickCount = 0;
      }
    } catch (error) {
      this.logger.error(`Error In Game Tick Logic: ${error.message}`, { error });
    }
  }
  async sendTickMessageToClients() {
    const sendTickTask = new TaskManager({
      name: 'SendTickMessage',
      execute: async () => {
        // Implement tick message sending logic here
        // Use this.server.socketEventManager.io to emit messages to clients
      }
    });
    await this.queueManager.enqueue(sendTickTask);
  }
  updateGameTime() {
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - this.gameTime) / 1000);
    this.gameTime += elapsedSeconds;
    if (this.gameTime >= 1440) {
      this.gameTime %= 1440;
      this.SocketEventEmitter.emit("newDay");
    }
  }
  async moveEntity(entity, newLocationId) {
    try {
      const oldLocationId = entity.currentLocation;
      const oldLocation = await this.getLocation(oldLocationId);
      const newLocation = await this.getLocation(newLocationId);
      if (!oldLocation || !newLocation) {
        throw new Error(`Invalid location for entity movement: oldLocation=${oldLocationId}, newLocation=${newLocationId}`);
      }
      // Ensure npcs is a Set
      if (!TypeChecker.isSet(oldLocation.npcs)) {
        oldLocation.npcs = new Set(oldLocation.npcs);
      }
      if (!TypeChecker.isSet(newLocation.npcs)) {
        newLocation.npcs = new Set(newLocation.npcs);
      }
      // Remove entity from old location
      if (TypeChecker.isPlayer(entity)) {
        oldLocation.playersInLocation.delete(entity);
      } else if (TypeChecker.isNpc(entity)) {
        oldLocation.npcs.delete(entity.id);
      }
      // Add entity to new location
      if (TypeChecker.isPlayer(entity)) {
        newLocation.playersInLocation.add(entity);
      } else if (TypeChecker.isNpc(entity)) {
        newLocation.npcs.add(entity.id);
      }
      // Update entity's current location
      entity.currentLocation = newLocationId;
      // Notify about the movement
      MessageManager.notifyLeavingLocation(entity, oldLocationId, newLocationId);
      // If the entity is a player, send them the new location description
      if (TypeChecker.isPlayer(entity)) {
        const describeLocationManager = new DescribeLocationManager({ player: entity, server: this.server });
        await describeLocationManager.describe();
      }
      return true;
    } catch (error) {
      this.logger.error(`Error moving entity: ${error.message}`, { error });
      return false;
    }
  }
  notifyLeavingLocation(entity, oldLocationId, newLocationId) {
    const direction = DirectionManager.getDirectionTo(newLocationId);
    let message;
    if (TypeChecker.isPlayer(entity)) {
      message = `${entity.getName()} travels ${direction}.`;
    } else if (TypeChecker.isNpc(entity)) {
      message = `${entity.name} leaves ${direction}.`;
    } else {
      this.logger.error(`Unknown entity type in notifyLeavingLocation: ${entity}`, { error: new Error(`Unknown entity type in notifyLeavingLocation: ${entity}`) });
      return;
    }
    MessageManager.notify(entity, message);
  }
  notifyEnteringLocation(entity, oldLocationId, newLocationId) {
    const newLocation = this.getLocation(newLocationId);
    if (newLocation) {
      newLocation.addEntity(entity, TypeChecker.isPlayer(entity) ? "players" : "npcs");
      const direction = DirectionManager.getDirectionFrom(oldLocationId);
      let message;
      if (TypeChecker.isPlayer(entity)) {
        message = `${entity.getName()} arrives from ${direction}.`;
      } else if (TypeChecker.isNpc(entity)) {
        message = `${entity.name} arrives from ${direction}.`;
      } else {
        this.logger.error(`Unknown entity type in notifyEnteringLocation: ${entity}`, { error: new Error(`Unknown entity type in notifyEnteringLocation: ${entity}`) });
        return;
      }
      MessageManager.notify(entity, message);
    } else {
      this.logger.error(`ERROR: Cannot notify entering - location: ${newLocationId} - not found.`, { error: new Error(`ERROR: Cannot notify entering - location: ${newLocationId} - not found.`) });
    }
  }
  applyToEntities(entityMap, action) {
    for (const entity of entityMap.values()) {
      action(entity);
    }
  }
  updateEntities() {
    const updateEntity = (entity) => {
      if (entity.hasChangedState()) {
        MessageManager.notifyEntityStateChange(entity);
      }
    };
    this.applyToEntities(this.npcs, updateEntity);
    this.applyToEntities(this.players, updateEntity);
  }
  checkAndRemoveExpiredAffects() {
    const removeExpiredAffects = (entity) => {
      entity.checkAndRemoveExpiredAffects();
    };
    this.applyToEntities(this.players, removeExpiredAffects);
    this.applyToEntities(this.npcs, removeExpiredAffects);
  }
  updateWorldEvents() {
    const WORLD_EVENT_INTERVAL = this.configManager.get('WORLD_EVENT_INTERVAL');
    if (this.gameTime % WORLD_EVENT_INTERVAL === 0) {
      this.triggerWorldEvent();
    }
  }
  triggerWorldEvent() {
    const eventTypes = ['weather', 'economy', 'politics'];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    this.logger.info(`A ${eventType} world event has occurred!`);
  }
  newDayHandler() {
    this.logger.info("A new day has started!");
  }
  disconnectPlayer(uid) {
    const player = this.players.get(uid);
    if (player) {
      player.status = "disconnected";
      this.players.delete(uid);
      this.logger.info(`Player ${uid} disconnected.`);
    } else {
      this.logger.error(`ERROR: Player: ${uid} - not found for disconnection.`, { error: new Error(`ERROR: Player: ${uid} - not found for disconnection.`) });
    }
  }
  createNpc(id, npcData) {
    try {
      const { name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, type, lootTable = [] } = npcData;
      let npc;
      switch (type) {
        case 'mobile':
          npc = new MobileNpc({
            id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status,
            currentLocation, zones: npcData.zones || [], aliases, config: this.server.configManager,
            server: this.server, lootTable
          });
          this.mobileNpcs.set(id, npc);
          if (this.npcMovementManager) {
            this.npcMovementManager.registerMobileNpc(npc);
          } else {
            this.logger.error(`NpcMovementManager not available for Npc: ${id}. Unable to register.`, { error: new Error(`NpcMovementManager not available for Npc: ${id}. Unable to register.`) });
          }
          break;
        case 'quest':
          npc = new QuestNpc({
            id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status,
            currentLocation, questId: npcData.questId, zones: npcData.zones || [], aliases,
            server: this.server, lootTable
          });
          this.questNpcs.set(id, npc);
          break;
        case 'merchant':
          npc = new MerchantNpc({
            id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status,
            currentLocation, aliases, server: this.server, lootTable,
            inventory: npcData.inventory || []
          });
          this.merchantNpcs.set(id, npc);
          break;
        default:
          npc = new Npc({
            id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status,
            currentLocation, aliases, type, server: this.server, lootTable
          });
      }
      this.npcs.set(id, npc);
      return npc;
    } catch (error) {
      this.logger.error(`Creating npc with ID ${id}: ${error.message}`, { error });
      return null;
    }
  }
  removeNpc(id) {
    const npc = this.npcs.get(id);
    if (TypeChecker.isNpc(npc) && npc instanceof MobileNpc) {
      this.npcMovementManager.unregisterMobileNpc(npc);
    }
    // Remove from type-specific maps
    this.mobileNpcs.delete(id);
    this.questNpcs.delete(id);
    this.merchantNpcs.delete(id);
    // Remove from general npcs map
    this.npcs.delete(id);
  }
  getNpc(npcId) {
    return this.npcs.get(npcId);
  }
  async getLocation(locationId) {
    const location = await this.locations.get(locationId);
    if (!location) {
      this.logger.error(`Location not found - ID : ${locationId}`, { error: new Error(`Location not found - ID : ${locationId}`) });
      return null;
    }
    if (!TypeChecker.isSet(location.npcs)) {
      location.npcs = new Set(location.npcs);
    }
    return location;
  }
  async handlePlayerAction(action) {
    await this.server.addTask(new TaskManager({
      name: 'PlayerAction',
      execute: async () => {
        try {
          await this.gameCommandManager.handleCommand(action.actionType, action.payload);
        } catch (error) {
          this.logger.error(`Error Handling Player Action: ${error.message}`, { error });
        }
      }
    }));
  }
  initiateCombat(combatData) {
    this.combatManager.initiateCombat(combatData);
  }
  endCombat(player) {
    this.combatManager.endCombatForPlayer({ player });
  }
  cleanup() {
    try {
      this.logger.info("Cleaning up GameManager...");
      // Clear NPC collections
      this.npcs.clear();
      this.mobileNpcs.clear();
      this.questNpcs.clear();
      this.merchantNpcs.clear();
      this.npcIds.clear();
      // Stop NPC movement
      if (this.npcMovementManager) {
        this.npcMovementManager.stopMovement();
      }
      // Stop game loop
      this.stopGameLoop();
      // Clear player data
      this.players.clear();
      // Clear location data
      this.locations.clear();
      // Clear items
      this.items.clear();
      // Reset game time and tick count
      this.gameTime = 0;
      this.tickCount = 0;
      // Clear event listeners
      if (this.SocketEventEmitter) {
        this.SocketEventEmitter.removeAllListeners();
      }
      // Clear combat manager
      if (this.combatManager) {
        this.combatManager.cleanup();
      }
      // Clear queue and task managers
      if (this.queueManager) {
        this.queueManager.cleanup();
      }
      if (this.taskManager) {
        this.taskManager.cleanup();
      }
      // Reset running state
      this.isRunning = false;
      this.logger.info("GameManager cleanup completed.");
    } catch (error) {
      this.logger.error(`Error during GameManager cleanup: ${error.message}`, { error });
    }
  }
}
/**************************************************************************************************
Game Component Initializer Class
The GameComponentInitializer class is responsible for setting up and initializing various
game components and subsystems required for the game to function properly.
Key features:
1. Database initialization
2. Game manager setup
3. Location coordinate management
4. Game data loading
This class works closely with the ServerInitializer to ensure all game-specific components
are properly set up and ready for use. It handles the sequential initialization of interdependent
components and manages potential errors during the setup process.
***************************************************************************************************/
class GameComponentInitializer extends IBaseManager {
  static instance;
  static getInstance({ logger, server }) {
    if (!GameComponentInitializer.instance) {
      GameComponentInitializer.instance = new GameComponentInitializer({ logger, server });
    }
    return GameComponentInitializer.instance;
  }
  constructor({ logger, server }) {
    super({ server, logger });
  }
  async setupGameComponents() {
    try {
      await this.initializeDatabaseManager();
      await this.initializeSocketEventEmitter();
      await this.initializeGameManager();
      await this.initializeGameDataLoader();
      this.logger.info('- LOAD GAME DATA FINISHED');
      await this.setupGameManagerEventListers();
    } catch (error) {
      this.handleSetupError(error);
    }
  }
  async initializeDatabaseManager() {
    this.server.databaseManager = DatabaseManager.getInstance({
      logger: this.server.logger,
      server: this.server
    });
    this.logger.debug('- Initialize Database Manager');
    await this.server.databaseManager.initialize();
    this.logger.debug('- Initialize Database Manager Finished');
  }
  async initializeSocketEventEmitter() {
    try {
      this.logger.debug('- Initialize Socket Event Emitter');
      this.server.SocketEventEmitter = new SocketEventEmitter();
      this.logger.debug('- Initialize Socket Event Emitter Finished');
    } catch (error) {
      this.logger.error(`Initialize Socket Event Emitter: ${error.message}`, { error });
      throw error;
    }
  }
  async initializeGameManager() {
    try {
      this.logger.debug('- Initialize Game Manager');
      if (!this.server.SocketEventEmitter) {
        throw new Error('SocketEventEmitter not initialized before GameManager');
      }
      this.server.gameManager = GameManager.getInstance({
        SocketEventEmitter: this.server.SocketEventEmitter,
        logger: this.server.logger,
        server: this.server,
        configManager: this.server.configManager,
        combatManager: new CombatManager({ server: this.server, config: this.server.configManager })
      });
      this.server.npcMovementManager = await NpcMovementManager.getInstance({
        logger: this.server.logger,
        configManager: this.server.configManager,
        gameManager: this.server.gameManager
      });
      this.logger.debug('- Initialize Game Manager Finished');
    } catch (error) {
      this.logger.error(`Error Initialize Game Manager: ${error.message}`, { error });
      throw error;
    }
  }
  async initializeGameDataLoader() {
    this.server.gameDataLoader = GameDataLoader.getInstance({ server: this.server });
    await this.server.gameDataLoader.fetchGameData();
  }
  async setupGameManagerEventListers() {
    try {
      if (this.server.gameManager) {
        this.logger.debug('- Initialize Game Manager Event Listeners');
        await this.server.gameManager.setupEventListeners();
        this.logger.debug('- Initialize Game Manager Event Listeners Finished');
      } else {
        throw new error(`Game Manager Not Initialized`);
      }
    } catch (error) {
      this.logger.error(`Initialize Game Manager Event Listeners: ${error.message}`, { error });
      throw error;
    }
  }
  handleSetupError(error) {
    this.logger.error(`Setting up game components: ${error.message}`, { error });
  }
}
/**************************************************************************************************
Entity Class
The Entity class serves as a base class for all entities within the game, providing common
properties and methods for managing entity state and behavior. It includes functionality for
tracking health and status changes.
Key features:
1. Common properties for all entities (name, health, status)
2. State change detection for health and status
3. Base functionality for derived entity classes
This class provides a foundation for all game entities, ensuring consistent management of
entity state and behavior across the game.
***************************************************************************************************/
class Entity {
  constructor(name) {
    this.name = name;
    this.currHealth = 0;
    this.status = '';
    this.previousState = { currHealth: 0, status: '' };
  }
  hasChangedState() {
    const { currHealth, status } = this;
    const hasChanged = currHealth !== this.previousState.currHealth || status !== this.previousState.status;
    if (hasChanged) {
      this.previousState = { currHealth, status };
    }
    return hasChanged;
  }
}
/**************************************************************************************************
Character Class
The Character class serves as a base class for all characters within the game, providing
common properties and methods for managing character state and behavior. It includes
functionality for tracking health and status changes.
Key features:
1. Common properties for all characters (name, health)
2. State change detection for health and status
3. Base functionality for derived character classes
This class provides a foundation for all character types, ensuring consistent management of
character state and behavior across the game.
***************************************************************************************************/
class Character extends Entity {
  constructor({ name, health }) {
    super(name);
    this.health = health;
  }
}
/**************************************************************************************************
Create New Player Class
The CreateNewPlayer class is responsible for encapsulating the creation of new player instances.
It provides methods for initializing player data and updating player attributes as needed.
Key features:
1. Player instance creation with specified attributes
2. Static method for creating a player from existing data
3. Asynchronous updates to player attributes
This class facilitates the creation and management of player instances within the game,
ensuring that player data is correctly initialized and maintained.
***************************************************************************************************/
class CreateNewPlayer {
  constructor({ name, age }) {
    this.name = name;
    this.age = age;
  }
  static fromPlayerData({ uid, playerData, bcrypt }) {
    const player = new Player({ uid, name: playerData.name, bcrypt });
    player.updateData(playerData);
    return player;
  }
  async updateData(updatedData) {
    if (updatedData.health !== undefined) await this.setHealth(updatedData.health);
    if (updatedData.experience !== undefined) await this.setExperience(updatedData.experience);
    if (updatedData.level !== undefined) await this.setLevel(updatedData.level);
  }
}
/**************************************************************************************************
Player Class
The Player class is a concrete implementation of the Character class, representing player
characters within the game. It includes properties specific to players, such as inventory
and experience, and provides methods for player actions and interactions.
Key features:
1. Specific properties for player characters (UID, inventory, experience)
2. Methods for player actions (movement, combat, inventory management)
3. Integration with game systems for player interactions
This class serves as the primary representation of players within the game, ensuring that
player actions and state are managed effectively.
***************************************************************************************************/
class Player extends Character {
  constructor({ uid, name, bcrypt, server, configManager, inventoryManager, gameCommandManager }) {
    super({ name, health: 100 });
    this.uid = uid;
    this.bcrypt = bcrypt;
    this.inventory = new Map();
    this.healthRegenerator = new HealthRegenerator({ player: this });
    this.server = server;
    this.configManager = configManager;
    this.initializePlayerAttributes();
    this.inventoryManager = inventoryManager;
    this.gameCommandManager = gameCommandManager;
    this.inCombat = false;
    this.describeLocationManager = new DescribeLocationManager({ player: this, server });
    this.currency = new Currency();
    this.currentTrade = null;
  }
  initializePlayerAttributes() {
    const { INITIAL_HEALTH, INITIAL_ATTACK_POWER } = this.configManager.getMultiple(['INITIAL_HEALTH', 'INITIAL_ATTACK_POWER']);
    Object.assign(this, {
      CONFIG: null,
      password: "",
      description: "",
      title: "",
      reputation: "",
      profession: "",
      sex: "",
      age: 0,
      maxHealth: INITIAL_HEALTH,
      level: 0,
      csml: 0,
      attackPower: INITIAL_ATTACK_POWER,
      defensePower: 0,
      experience: 0,
      currentLocation: "100",
      coordinates: {},
      skills: [],
      status: "standing",
      affects: [],
      killer: true,
      autoLoot: true,
      lastRegenTime: Date.now(),
      failedLoginAttempts: 0,
      consecutiveFailedAttempts: 0,
      lastLoginTime: Date.now(),
      totalPlayingTime: 0,
      colorPreferences: {},
      previousState: { health: INITIAL_HEALTH, status: "standing" },
      weapons: new Set()
    });
  }
  getId() {
    return this.uid;
  }
  getPossessivePronoun() {
    return this.sex === 'male' ? 'his' : 'her';
  }
  canAddToInventory(item) {
    const INVENTORY_CAPACITY = this.configManager.get('INVENTORY_CAPACITY');
    return this.inventory.size < INVENTORY_CAPACITY && item.isValid();
  }
  getInventoryCapacity() {
    return this.configManager.get('INVENTORY_CAPACITY');
  }
  async authenticate(password) {
    const isPasswordValid = await this.bcrypt.compare(password, this.password);
    if (isPasswordValid) {
      this.resetFailedLoginAttempts();
      return true;
    }
    this.incrementFailedLoginAttempts();
    return false;
  }
  incrementFailedLoginAttempts() {
    this.failedLoginAttempts++;
    this.consecutiveFailedAttempts++;
    if (this.consecutiveFailedAttempts >= 3) {
      this.server.messageManager.notifyDisconnectionDueToFailedAttempts(this);
      this.server.gameManager.disconnectPlayer(this.uid);
    }
  }
  resetFailedLoginAttempts() {
    this.failedLoginAttempts = 0;
    this.consecutiveFailedAttempts = 0;
    this.lastLoginTime = Date.now();
  }
  save() {
    const playerData = this.collectPlayerData();
    QueueManager.addDataSaveTask(DatabaseManager.PLAYER_DATA_PATH, this.getId(), playerData);
  }
  collectPlayerData() {
    const { name, age, health, experience, level } = this;
    return { name, age, health, experience, level };
  }
  static async loadBatch(playerIds) {
    const playerDataArray = await DatabaseManager.loadPlayersData(playerIds);
    return playerDataArray.map(data => new Player({ uid: data.uid, name: data.name, bcrypt: data.bcrypt }));
  }
  score() {
    const stats = `Level: ${this.level}, XP: ${this.experience}, Health: ${this.health}/${this.maxHealth}`;
    this.server.messageManager.sendMessage(this, stats, 'statsMessage');
  }
  updateData(updatedData) {
    const { health, experience, level } = updatedData;
    if (health != null) this.setHealth(health);
    if (experience != null) this.setExperience(experience);
    if (level != null) this.setLevel(level);
  }
  async hashUid() {
    try {
      this.hashedUid = await this.bcrypt.hash(this.uid, CONFIG.ITEM_UID_SALT_ROUNDS);
    } catch (error) {
      this.server.logger.error('Failed to hash UID:', { error });
    }
  }
  async login(inputPassword) {
    try {
      const isAuthenticated = await this.authenticate(inputPassword);
      if (isAuthenticated) {
        this.server.messageManager.notifyLoginSuccess(this);
        return true;
      }
      this.server.messageManager.notifyIncorrectPassword(this);
      return false;
    } catch (error) {
      this.server.logger.error(`Error During Player Login: ${error.message}`, { error });
      return false;
    }
  }
  startHealthRegeneration() {
    this.healthRegenerator.start();
  }
  checkAndRemoveExpiredAffects() {
    const now = Date.now();
    this.affects = this.affects.filter(affect => {
      if (affect.endTime && affect.endTime <= now) {
        affect.remove(this);
        return false;
      }
      return true;
    });
  }
  addWeapon(weapon) {
    this.weapons.add(weapon);
    this.server.messageManager.notifyPickupItem(this, weapon.name);
  }
  removeWeapon(weapon) {
    this.weapons.delete(weapon);
  }
  static async createNewPlayer({ name, age }) {
    return new CreateNewPlayer({ name, age });
  }
  async moveToLocation(direction) {
    await this.gameCommandManager.executeCommand(this, 'move', [direction]);
  }
  async attack(target) {
    await this.gameCommandManager.executeCommand(this, 'attack', [target]);
  }
  receiveDamage(damage) {
    this.health -= damage;
    if (this.health <= 0) {
      this.die();
    }
  }
  die() {
    this.status = "lying unconscious";
    this.server.gameManager.endCombat(this);
    this.server.messageManager.notifyPlayerDeath(this);
  }
  async showInventory() {
    await this.gameCommandManager.executeCommand(this, 'showInventory');
  }
  lootSpecifiedNpc(target) {
    this.gameCommandManager.executeCommand(this, 'lootSpecifiedNpc', [target]);
  }
  meditate() {
    this.gameCommandManager.executeCommand(this, 'meditate');
  }
  sleep() {
    this.gameCommandManager.executeCommand(this, 'sleep');
  }
  sit() {
    this.gameCommandManager.executeCommand(this, 'sit');
  }
  stand() {
    this.gameCommandManager.executeCommand(this, 'stand');
  }
  wake() {
    this.gameCommandManager.executeCommand(this, 'wake');
  }
  autoLootToggle() {
    this.gameCommandManager.executeCommand(this, 'autoLootToggle');
  }
  lookIn(containerName) {
    this.gameCommandManager.executeCommand(this, 'lookIn', [containerName]);
  }
  async describeCurrentLocation() {
    await this.describeLocationManager.describe();
  }
  LookAtCommandHandler(target) {
    this.gameCommandManager.executeCommand(this, 'lookAt', [target]);
  }
  hasChangedState() {
    const hasChanged = this.health !== this.previousState.health || this.status !== this.previousState.status;
    if (hasChanged) {
      this.previousState = { health: this.health, status: this.status };
    }
    return hasChanged;
  }
  getInventoryList() {
    return Array.from(this.inventory.values()).map(item => item.name).join(", ");
  }
  addItemToInventory(item) {
    try {
      if (this.canAddToInventory(item)) {
        const itemInstance = item.createInstance();
        this.inventory.set(itemInstance.uid, itemInstance);
        this.server.messageManager.notifyPickupItem(this, itemInstance.name);
        return true;
      }
      return false;
    } catch (error) {
      this.server.logger.error(`Error Adding Item To Inventory: ${error.message}`, { error });
      return false;
    }
  }
  removeItemFromInventory(itemUid) {
    if (this.inventory.has(itemUid)) {
      const item = this.inventory.get(itemUid);
      this.inventory.delete(itemUid);
      this.server.messageManager.notifyDropItem(this, item.name);
      return item;
    }
    return null;
  }
  getCurrency() {
    return this.currency.getAmount();
  }
  addCurrency(amount) {
    this.currency.add(amount);
  }
  subtractCurrency(amount) {
    return this.currency.subtract(amount);
  }
  initiateTrade(targetPlayer) {
    const tradeSession = this.server.transactionManager.createTradeSession(this, targetPlayer);
    this.server.messageManager.notifyTradeInitiated(this, targetPlayer);
    return tradeSession;
  }
  acceptTrade() {
    const tradeSession = this.server.transactionManager.getTradeSession(this.getId());
    if (tradeSession) {
      tradeSession.acceptTrade(this);
    } else {
      this.server.messageManager.sendMessage(this, "No active trade session.", 'error');
    }
  }
  declineTrade() {
    const tradeSession = this.server.transactionManager.getTradeSession(this.getId());
    if (tradeSession) {
      tradeSession.declineTrade(this);
    } else {
      this.server.messageManager.sendMessage(this, "No active trade session.", 'error');
    }
  }
  addItemToTrade(itemName) {
    const tradeSession = this.server.transactionManager.getTradeSession(this.getId());
    if (tradeSession) {
      const item = this.getItemFromInventory(itemName);
      if (item) {
        tradeSession.addItem(this, item);
      } else {
        this.server.messageManager.sendMessage(this, `You don't have ${itemName} in your inventory.`, 'error');
      }
    } else {
      this.server.messageManager.sendMessage(this, "No active trade session.", 'error');
    }
  }
  removeItemFromTrade(itemName) {
    const tradeSession = this.server.transactionManager.getTradeSession(this.getId());
    if (tradeSession) {
      const item = Array.from(tradeSession.player1Items.values()).concat(Array.from(tradeSession.player2Items.values()))
        .find(i => i.getName().toLowerCase() === itemName.toLowerCase());
      if (item) {
        tradeSession.removeItem(this, item.getId());
      } else {
        this.server.messageManager.sendMessage(this, `${itemName} is not in the trade.`, 'error');
      }
    } else {
      this.server.messageManager.sendMessage(this, "No active trade session.", 'error');
    }
  }
  setTradeGold(amount) {
    const tradeSession = this.server.transactionManager.getTradeSession(this.getId());
    if (tradeSession) {
      if (amount > this.getCurrency()) {
        this.server.messageManager.sendMessage(this, "You don't have that much gold.", 'error');
      } else {
        tradeSession.setGold(this, amount);
      }
    } else {
      this.server.messageManager.sendMessage(this, "No active trade session.", 'error');
    }
  }
  confirmTrade() {
    const tradeSession = this.server.transactionManager.getTradeSession(this.getId());
    if (tradeSession) {
      tradeSession.confirmTrade(this);
    } else {
      this.server.messageManager.sendMessage(this, "No active trade session.", 'error');
    }
  }
  addExperience(amount) {
    this.experience += amount;
  }
  async executeCommand(command, args) {
    const commandHandlers = {
      'move': this.handleMove.bind(this),
      'look': this.handleLook.bind(this),
      'inventory': this.handleInventory.bind(this),
      'take': this.handleTake.bind(this),
      'drop': this.handleDrop.bind(this),
      'attack': this.handleAttack.bind(this),
      // Add more command handlers here
    };
    const handler = commandHandlers[command];
    if (handler) {
      try {
        await handler(args);
      } catch (error) {
        this.server.logger.error(`Error executing command ${command}: ${error.message}`, { error });
        await this.server.messageManager.sendMessage(this, `Error executing command: ${command}`, 'error');
      }
    } else {
      await this.server.messageManager.sendMessage(this, `Unknown command: ${command}`, 'errorMessage');
    }
  }
  async handleMove(args) {
    const direction = args[0];
    await this.server.gameManager.moveEntity(this, direction);
  }
  async handleLook(args) {
    const target = args.join(' ');
    await this.server.gameManager.lookAt(this, target);
  }
  async handleInventory() {
    await this.server.inventoryManager.displayInventory(this);
  }
  async handleTake(args) {
    const itemName = args.join(' ');
    await this.server.inventoryManager.takeItem(this, itemName);
  }
  async handleDrop(args) {
    const itemName = args.join(' ');
    await this.server.inventoryManager.dropItem(this, itemName);
  }
  async handleAttack(args) {
    const targetName = args.join(' ');
    await this.server.combatManager.attackNpc({ player: this, target1: targetName });
  }
}
/**************************************************************************************************
Authentication Manager Class
The AuthenticationManager class is responsible for handling user authentication and character
management. It includes methods for creating new characters, authenticating users, and managing
session tokens. This class plays a crucial role in ensuring secure access to the game and
maintaining player data integrity.
Key features:
1. Character creation with password hashing
2. Character authentication using password comparison
3. Session token management for security
***************************************************************************************************/
class AuthenticationManager {
  constructor(server, bcrypt) {
    this.server = server;
    this.bcrypt = bcrypt;
    this.SALT_ROUNDS = CONFIG.PASSWORD_SALT_ROUNDS;
  }
  async createNewCharacter(characterData) {
    const hashedPassword = await this.bcrypt.hash(characterData.password, this.SALT_ROUNDS);
    characterData.password = hashedPassword;
    await this.server.databaseManager.saveCharacter(characterData);
    return { success: true, message: 'Character created successfully' };
  }
  async authenticateCharacter(characterName, password) {
    const characterData = await this.server.databaseManager.getCharacter(characterName);
    if (!characterData) {
      return { success: false, message: 'Character not found' };
    }
    const isPasswordValid = await this.bcrypt.compare(password, characterData.password);
    if (!isPasswordValid) {
      return { success: false, message: 'Invalid password' };
    }
    return { success: true, characterData };
  }
}
/**************************************************************************************************
Session Manager Class
The SessionManager class is responsible for managing user sessions and ensuring secure access
to the game. It includes methods for creating sessions, retrieving sessions, updating session
activity, and removing sessions. This class plays a crucial role in maintaining player
connections and ensuring secure access to the game.
Key features:
1. Session creation with unique tokens
2. Session storage and retrieval
3. Session activity updates
4. Session removal for logout
This class ensures that players remain connected and secure while playing the game,
enhancing the overall gaming experience.
***************************************************************************************************/
class SessionManager {
  constructor(server, bcrypt) {
    this.server = server;
    this.sessions = new Map();
    this.bcrypt = bcrypt;
  }
  createSession(characterId) {
    const token = this.generateSessionToken();
    this.sessions.set(token, { characterId, lastActivity: Date.now() });
    return token;
  }
  getSession(token) {
    return this.sessions.get(token);
  }
  updateSessionActivity(token) {
    const session = this.sessions.get(token);
    if (session) {
      session.lastActivity = Date.now();
    }
  }
  removeSession(token) {
    this.sessions.delete(token);
  }
  async generateSessionToken() {
    const randomBytes = await this.bcrypt.genSalt(16);
    return this.bcrypt.hash(randomBytes, 10);
  }
  cleanupInactiveSessions() {
    const now = Date.now();
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
    for (const [token, session] of this.sessions.entries()) {
      if (now - session.lastActivity > inactivityThreshold) {
        this.sessions.delete(token);
      }
    }
  }
}
/**************************************************************************************************
Health Regenerator Class
The HealthRegenerator class is responsible for managing the health regeneration process for
player characters. It includes logic for determining regeneration rates and applying health
restoration over time.
Key features:
1. Health regeneration logic based on player status
2. Interval management for regeneration timing
3. Integration with player health management
This class ensures that player health is restored appropriately based on game mechanics,
enhancing the gameplay experience.
***************************************************************************************************/
class HealthRegenerator {
  constructor({ player }) {
    this.player = player;
    this.configManager = player.configManager;
    this.regenInterval = null;
  }
  start() {
    if (!this.regenInterval) {
      const REGEN_INTERVAL = this.configManager.get('REGEN_INTERVAL');
      this.regenInterval = setInterval(() => this.regenerate(), REGEN_INTERVAL);
    }
  }
  regenerate() {
    const { health, maxHealth } = this.player;
    const now = Date.now();
    const timeSinceLastRegen = (now - this.player.lastRegenTime) / 1000;
    const regenAmount = (this.getRegenAmountPerMinute() / 60) * timeSinceLastRegen;
    if (regenAmount > 0 && health < maxHealth) {
      this.player.health = Math.min(health + regenAmount, maxHealth);
      this.player.lastRegenTime = now;
    }
    if (health >= maxHealth) {
      this.stop();
    }
  }
  getRegenAmountPerMinute() {
    const regenRates = new Map([
      ["in combat", this.configManager.get('REGEN_RATES').IN_COMBAT],
      ["standing", this.configManager.get('REGEN_RATES').STANDING],
      ["sitting", this.configManager.get('REGEN_RATES').SITTING],
      ["sleeping", this.configManager.get('REGEN_RATES').SLEEPING],
      ["unconscious", this.configManager.get('REGEN_RATES').UNCONSCIOUS],
      ["meditating", this.configManager.get('REGEN_RATES').MEDITATING]
    ]);
    return (regenRates.get(this.player.status) || 0) * this.player.maxHealth;
  }
  stop() {
    if (this.regenInterval) {
      clearInterval(this.regenInterval);
      this.regenInterval = null;
    }
  }
}
/**************************************************************************************************
Game Command Manager Class
The GameCommandManager class is responsible for processing and executing player-initiated game commands.
It utilizes a command pattern to handle various types of actions such as movement, combat, item
manipulation, and character state changes. This class acts as a central hub for routing player
inputs to the appropriate handler methods, ensuring proper execution of game mechanics and
maintaining game state consistency.
Key features:
1. Command routing based on action type
2. Extensible architecture for adding new command types
3. Integration with the game's core systems (e.g., combat, inventory)
4. Error handling for invalid or unauthorized commands
This class plays a crucial role in translating player intentions into game world effects, serving
as a bridge between the user interface and the game's internal logic.
***************************************************************************************************/
class GameCommandManager {
  static instance;
  static getInstance({ server }) {
    if (!GameCommandManager.instance) {
      GameCommandManager.instance = new GameCommandManager({ server });
    }
    return GameCommandManager.instance;
  }
  constructor({ server }) {
    this.server = server;
    this.logger = server.logger;
    this.commandHandlers = {
      move: this.handleMove.bind(this),
      attack: this.handleAttack.bind(this),
      showInventory: this.handleShowInventory.bind(this),
      lootSpecifiedNpc: this.handleLootSpecifiedNpc.bind(this),
      meditate: this.handleMeditate.bind(this),
      sleep: this.handleSleep.bind(this),
      sit: this.handleSit.bind(this),
      stand: this.handleStand.bind(this),
      wake: this.handleWake.bind(this),
      autoLootToggle: this.handleAutoLootToggle.bind(this),
      lookIn: this.handleLookIn.bind(this),
      describeLocation: this.handleDescribeLocation.bind(this),
      lookAt: this.handleLookAt.bind(this),
      buy: this.handleBuy.bind(this),
      sell: this.handleSell.bind(this),
      listMerchantItems: this.handleListMerchantItems.bind(this),
      initiateTrade: this.handleInitiateTrade.bind(this),
      addItemToTrade: this.handleAddItemToTrade.bind(this),
      removeItemFromTrade: this.handleRemoveItemFromTrade.bind(this),
      setTradeGold: this.handleSetTradeGold.bind(this),
      confirmTrade: this.handleConfirmTrade.bind(this),
    };
  }
  async executeCommand(player, command, args = []) {
    const handler = this.commandHandlers[command];
    if (handler) {
      try {
        await handler(player, ...args);
      } catch (error) {
        this.logger.error(`Error executing command ${command}: ${error.message}`, { error });
        await this.server.messageManager.sendMessage(player, `Error executing command: ${command}`, 'error');
      }
    } else {
      this.logger.error(`Unknown command: ${command}`);
      await this.server.messageManager.sendMessage(player, `Unknown command: ${command}`, 'errorMessage');
    }
  }
  async handleMove(player, direction) {
    if (typeof direction !== 'string') {
      throw new TypeError('Direction must be a string');
    }
    const validDirections = ['n', 'e', 'w', 's', 'u', 'd'];
    if (!validDirections.includes(direction)) {
      await this.server.messageManager.sendMessage(player, `Invalid direction: ${direction}`, 'error');
      return;
    }
    await this.server.gameManager.moveEntity(player, direction);
  }
  async handleAttack(player, target) {
    if (!(target instanceof Character)) {
      throw new TypeError('Target must be a Character instance');
    }
    const npc = await this.server.gameManager.getNpc(target);
    if (npc) {
      await player.attack(npc.id);
    } else {
      await this.server.messageManager.sendMessage(player, `You don't see ${target} here.`, 'error');
    }
  }
  async handleShowInventory(player) {
    const inventoryList = player.getInventoryList();
    await this.server.messageManager.sendMessage(player, `Your inventory: ${inventoryList}`, 'inventory');
  }
  async handleLookAt(player, target) {
    const lookAtHandler = new LookAtCommandHandler({ player });
    await lookAtHandler.execute(target);
  }
  async handleDescribeLocation(player) {
    await player.describeCurrentLocation();
  }
  async handleBuy(player, itemName) {
    if (!(player instanceof Player)) {
      throw new TypeError('Player must be an instance of Player');
    }
    if (typeof itemName !== 'string') {
      throw new TypeError('Item name must be a string');
    }
    const merchant = await this.findMerchantInLocation(player.currentLocation);
    if (!merchant) {
      await this.server.messageManager.sendMessage(player, "There's no merchant here.", 'errorMessage');
      return;
    }
    const item = merchant.getInventory().find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!item) {
      await this.server.messageManager.sendMessage(player, `The merchant doesn't have ${itemName}.`, 'errorMessage');
      return;
    }
    if (merchant.sellItem(item.id, player)) {
      await this.server.messageManager.sendMessage(player, `You bought ${item.name} for ${item.price} coins.`, 'buyMessage');
    } else {
      await this.server.messageManager.sendMessage(player, `You don't have enough money to buy ${item.name}.`, 'errorMessage');
    }
  }
  async handleSell(player, itemName) {
    const merchant = await this.findMerchantInLocation(player.currentLocation);
    if (!merchant) {
      await this.server.messageManager.sendMessage(player, "There's no merchant here.", 'errorMessage');
      return;
    }
    const item = player.inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!item) {
      await this.server.messageManager.sendMessage(player, `You don't have ${itemName} in your inventory.`, 'errorMessage');
      return;
    }
    if (merchant.buyItem(item, player)) {
      const sellPrice = Math.floor(item.price * 0.5);
      await this.server.messageManager.sendMessage(player, `You sold ${item.name} for ${sellPrice} coins.`, 'sellMessage');
    } else {
      await this.server.messageManager.sendMessage(player, `Failed to sell ${item.name}.`, 'errorMessage');
    }
  }
  async handleListMerchantItems(player) {
    const merchant = await this.findMerchantInLocation(player.currentLocation);
    if (!merchant) {
      await this.server.messageManager.sendMessage(player, "There's no merchant here.", 'errorMessage');
      return;
    }
    const itemList = merchant.getInventory().map(item => `${item.name} - ${item.price} coins`).join('\n');
    await this.server.messageManager.sendMessage(player, `Merchant's inventory:\n${itemList}`, 'merchantInventory');
  }
  async findMerchantInLocation(locationId) {
    const location = await this.server.gameManager.getLocation(locationId);
    if (!location || !location.npcs) return null;
    for (const npcId of location.npcs) {
      const npc = await this.server.gameManager.getNpc(npcId);
      if (npc instanceof MerchantNpc) return npc;
    }
    return null;
  }
  async handleInitiateTrade(player, targetPlayerName) {
    const targetPlayer = await this.server.gameManager.getPlayerByName(targetPlayerName);
    if (!targetPlayer) {
      await this.server.messageManager.sendMessage(player, `Player ${targetPlayerName} not found.`, 'error');
      return;
    }
    player.initiateTrade(targetPlayer);
  }
  async handleAddItemToTrade(player, itemName) {
    player.addItemToTrade(itemName);
  }
  async handleRemoveItemFromTrade(player, itemName) {
    player.removeItemFromTrade(itemName);
  }
  async handleSetTradeGold(player, amount) {
    player.setTradeGold(amount);
  }
  async handleConfirmTrade(player) {
    player.confirmTrade();
  }
  async cleanupInactiveSessions() {
    const now = Date.now();
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
    const inactiveSessions = [];
    for (const [token, session] of this.sessions.entries()) {
      if (now - session.lastActivity > inactivityThreshold) {
        inactiveSessions.push(token);
      }
    }
    for (const token of inactiveSessions) {
      await this.removeSession(token);
    }
    this.logger.info(`Cleaned up ${inactiveSessions.length} inactive sessions`);
  }
  async removeSession(token) {
    const session = this.sessions.get(token);
    if (session) {
      const player = await this.server.gameManager.getPlayer(session.characterId);
      if (player) {
        await this.server.gameManager.removePlayerFromGame(player);
      }
      this.sessions.delete(token);
      this.logger.debug(`Removed session for token: ${token}`);
    }
  }
}
/**************************************************************************************************
Look At Command HandlerClass
The LookAtCommandHandler class provides functionality for players to examine their surroundings and
interact with objects and entities within the game world. It includes methods for looking
at specific targets and determining their properties.
Key features:
1. Target examination logic for players
2. Interaction with game entities and items
3. Notification management for look actions
This class enhances player immersion by allowing them to interact meaningfully with the
game world through examination and observation.
***************************************************************************************************/
class LookAtCommandHandler {
  constructor({ player }) {
    this.player = player;
    this.server = player.server;
  }
  async look(target) {
    const { currentLocation } = this.player;
    const location = await this.server.gameManager.getLocation(currentLocation);
    if (!location) return;
    const targetLower = target.toLowerCase();
    const playerNameLower = this.player.getName().toLowerCase();
    if (this.isSelfLook(targetLower, playerNameLower)) {
      await this.lookAtSelfCommandHandler();
      return;
    }
    const lookTargets = [
      { check: () => Array.from(this.player.inventory.values()).find(item => item.aliases.includes(targetLower)), notify: this.server.messageManager.notifyLookAtCommandHandlerItemInInventory },
      { check: () => location.items.find(item => item.aliases.includes(targetLower)), notify: this.server.messageManager.notifyLookAtCommandHandlerItemInLocation },
      { check: () => this.findNpc(location, targetLower), notify: this.server.messageManager.notifyLookAtCommandHandlerNpc },
      { check: () => location.playersInLocation.find(p => p.name.toLowerCase() === targetLower), notify: this.server.messageManager.notifyLookAtCommandHandlerOtherPlayer }
    ];
    for (const { check, notify } of lookTargets) {
      const result = check();
      if (result) {
        await notify(this.player, result);
        return;
      }
    }
    await this.server.messageManager.notifyTargetNotFoundInLocation(this.player, target);
  }
  isSelfLook(targetLower, playerNameLower) {
    return targetLower === 'self' || targetLower === playerNameLower || playerNameLower.startsWith(targetLower);
  }
  async findNpc(location, targetLower) {
    const npcId = location.npcs.find(id => {
      const npc = this.server.gameManager.getNpc(id);
      return npc && npc.aliases.includes(targetLower);
    });
    return npcId ? await this.server.gameManager.getNpc(npcId) : null;
  }
  async lookAtSelfCommandHandler() {
    await this.server.messageManager.notifyLookAtSelfCommandHandler(this.player);
  }
  async execute(player, target) {
    await this.look(target);
  }
}
/**************************************************************************************************
Combat Manager Class
The CombatManager class is responsible for managing combat interactions between players and Npcs.
It coordinates combat turns, handles combat actions, and tracks combat state. This class
ensures that combat mechanics are applied correctly and efficiently.
Key features:
1. Turn-based combat management for players and Npcs
2. Combat action execution and outcome determination
3. Integration with the logger for combat event tracking
The CombatManager is essential for maintaining the integrity of combat interactions,
ensuring that all combat-related actions are processed in a structured manner.
***************************************************************************************************/
class CombatManager {
  static COMBAT_INTERVAL = 1500;
  static TECHNIQUES = new Set([
    "axe kick", "back kick", "back-fist", "butterfly kick", "butterfly twist kick", "canon fist",
    "crushing elbow", "crushing fist", "crushing hammer fist", "crushing hand", "crushing knee",
    "crushing kick", "crushing palm", "crushing shoulder strike", "crushing strike",
    "crouching leg-sweep kick", "crouching spinning leg-sweep kick", "cut kick", "dagger fingers",
    "dagger hand", "dagger kick", "diagonal knee", "double front kick", "double side kick",
    "downward roundhouse kick", "eagle claw", "falling elbow", "falling knee", "flying back kick",
    "flying drop kick", "flying front kick", "flying knee", "flying side kick", "front kick",
    "hammer fist", "headbutt", "hook kick", "inverted roundhouse kick", "inward elbow",
    "inside crescent kick", "jumping axe kick", "jumping back kick", "jumping double front kick",
    "jumping double roundhouse kick", "jumping double side kick", "jumping knee",
    "jumping reverse hook kick", "jumping roundhouse kick", "jumping spinning crescent kick",
    "jumping spinning hook kick", "knife hand", "knee-sweep kick", "leopard fist",
    "leg-sweep kick", "mantis fist", "oblique kick", "one knuckle fist", "outside crescent kick",
    "piercing elbow", "piercing fingers", "piercing fist", "piercing hand", "piercing knee",
    "piercing kick", "piercing palm", "piercing shoulder strike", "piercing strike",
    "reverse elbow", "ridge hand", "rising elbow", "rising knee", "roundhouse knee",
    "roundhouse kick", "scissor kick", "scoop kick", "scorpion kick", "shin kick",
    "shoulder strike", "side kick", "smashing elbow", "smashing fist", "smashing hammer fist",
    "smashing hand", "smashing knee", "smashing kick", "smashing palm", "smashing shoulder strike",
    "smashing strike", "snapping back-fist", "snapping elbow", "snapping fist",
    "snapping hammer fist", "snapping hand", "snapping knee", "snapping kick",
    "snapping palm", "snapping shoulder strike", "snapping strike", "spinning axe kick",
    "spinning back kick", "spinning crescent kick", "spinning elbow", "spinning heel kick",
    "spinning hook kick", "spinning leg-sweep kick", "spinning roundhouse kick",
    "spinning side kick", "stretch kick", "stomp kick", "stop kick", "switch kick",
    "thrusting fingers", "thrusting fist", "thrusting hand", "thrusting kick",
    "thrusting knee", "thrusting palm", "thrusting shoulder strike", "thrusting strike",
    "toe kick", "tornado axe kick", "tornado kick", "triple front kick", "triple side kick",
    "twisting kick", "two knuckle fist", "wheel kick", "whipping back-fist",
    "whipping elbow", "whipping fist", "whipping hammer fist", "whipping hand",
    "whipping knee", "whipping kick", "whipping palm", "whipping shoulder strike",
    "whipping strike"
  ]);
  constructor({ server, config }) {
    this.server = server;
    this.config = config;
    this.logger = server.logger;
    this.objectPool = new ObjectPool(() => new CombatAction({ logger: this.logger }), 10);
    this.gameManager = server.gameManager;
    this.combatOrder = new Map();
    this.defeatedNpcs = new Set();
    this.combatInitiatedNpcs = new Set();
    this.outcomeDescriptions = new Map([
      ["attack is evaded", ({ attacker, defender, technique }) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} evades the strike!`],
      ["attack is trapped", ({ attacker, defender, technique }) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} traps the strike!`],
      ["attack is parried", ({ attacker, defender, technique }) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} parries the strike!`],
      ["attack is blocked", ({ attacker, defender, technique }) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} blocks the strike!`],
      ["attack hits", ({ attacker, defender, technique }) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}. The strike successfully hits ${defender.getName()}!`],
      ["critical success", ({ attacker, defender, technique }) => `${attacker.getName()} attacks ${defender.getName()} with a devastatingly catastrophic ${technique}.<br>The strike critically hits ${defender.getName()}!`],
      ["knockout", ({ attacker, defender, technique }) => `${attacker.getName()} strikes ${defender.getName()} with a spectacularly phenomenal blow!<br>${defender.getName()}'s body goes limp and collapses to the ground!`],
    ]);
    this.combatParticipants = new Map();
    this.combatActions = {
      initiateCombat: this.createCombatAction(this.initiateCombat.bind(this)),
      performCombatAction: this.createCombatAction(this.performCombatAction.bind(this)),
      endCombat: this.createCombatAction(this.endCombat.bind(this)),
    };
    this.combatSteps = [
      this.checkCombatStatus,
      this.getNextNpcInCombatOrder,
      this.performCombatAction,
      this.notifyHealthStatus,
      this.handleDefeat,
    ].map(step => this.createCombatStep(step.bind(this)));
  }
  createCombatAction(actionFn) {
    return async (...args) => {
      try {
        return await actionFn(...args);
      } catch (error) {
        this.logger.error(`Error in combat action: ${error.message}`, { error });
        throw error;
      }
    };
  }
  createCombatStep(stepFn) {
    return async (state) => {
      try {
        return await stepFn(state);
      } catch (error) {
        this.logger.error(`Error in combat step: ${error.message}`, { error });
        return { ...state, error };
      }
    };
  }
  async initiateCombatWithNpc({ npcId, player, playerInitiated = false }) {
    return this.combatActions.initiateCombat({ npcId, player, playerInitiated });
  }
  async performCombatAction(attacker, defender, isPlayer) {
    return this.combatActions.performCombatAction(attacker, defender, isPlayer);
  }
  async endCombatForPlayer({ player }) {
    return this.combatActions.endCombat(player);
  }
  async startCombat({ npc, player, playerInitiated }) {
    try {
      this.logger.debug(`- Starting Combat Between - Player: ${player.getName()} - And - Npc: ${npc.getName()}`);
      if (this.combatOrder.has(npc.id)) {
        this.logger.debug(`- Npc: ${npc.id} - Already In Combat`);
        return;
      }
      this.combatOrder.set(npc.id, { state: 'engaged' });
      player.status !== "in combat"
        ? await this.initiateCombat({ player, npc, playerInitiated })
        : await this.notifyCombatJoin({ npc, player });
      npc.status = "engaged in combat";
    } catch (error) {
      this.logger.error(`Starting Combat Between - Player: ${player.getName()} - And - Npc: ${npc.getName()}:`, { error });
    }
  }
  async initiateCombat({ player, npc, playerInitiated }) {
    player.status = "in combat";
    const message = playerInitiated
      ? MessageManager.getCombatInitiationTemplate(player.getName(), npc.getName())
      : MessageManager.getCombatInitiationTemplate(npc.getName(), player.getName());
    await this.notifyPlayersInLocation(player.currentLocation, message);
    if (!playerInitiated) {
      player.lastAttacker = npc.id;
      this.combatInitiatedNpcs.add(npc.id);
    }
    await this.startCombatLoop(player);
  }
  async notifyCombatJoin({ npc, player }) {
    await this.notifyPlayersInLocation(player.currentLocation,
      MessageManager.getCombatJoinTemplate(npc.getName())
    );
    this.combatInitiatedNpcs.add(npc.id);
  }
  async startCombatLoop(player) {
    if (player.status === "in combat" && !player.combatInterval) {
      player.combatInterval = setInterval(async () => {
        let state = { player, continue: true };
        for (const step of this.combatSteps) {
          state = await step(state);
          if (!state.continue) break;
        }
        if (state.error) {
          await this.handleCombatError(state);
        }
      }, this.config.COMBAT_INTERVAL);
    }
  }
  async checkCombatStatus({ player, ...state }) {
    if (player.status !== "in combat") {
      await this.endCombat(player);
      return { ...state, player, continue: false };
    }
    return { ...state, player, continue: true };
  }
  async getNextNpcInCombatOrder({ player, ...state }) {
    const npc = await this.getNextNpcInCombatOrder();
    return { ...state, player, npc, continue: !!npc };
  }
  async performCombatAction({ player, npc, ...state }) {
    const action = this.objectPool.acquire();
    action.perform({ attacker: player, defender: npc });
    this.objectPool.release(action);
    const result = await this.combatActions.performCombatAction(player, npc, true);
    return { ...state, player, npc, result, continue: true };
  }
  async notifyHealthStatus({ player, npc, result, ...state }) {
    await MessageManager.notifyCombatResult(player, result);
    await this.notifyHealthStatus(player, npc);
    return { ...state, player, npc, result, continue: true };
  }
  async handleDefeat({ player, npc, ...state }) {
    if (npc.health <= 0) {
      await this.handleNpcDefeat(npc, player);
      return { ...state, player, npc, continue: false };
    }
    if (player.health <= 0) {
      await this.handlePlayerDefeat(npc, player);
      return { ...state, player, npc, continue: false };
    }
    return { ...state, player, npc, continue: true };
  }
  async handleCombatError(state) {
    this.logger.error(`Combat error occurred`, { error: state.error, playerId: state.player.getId() });
    await this.endCombat(state.player);
  }
  async handlePlayerDefeat(npc, player) {
    player.status = "lying unconscious";
    await this.endCombat(player);
    this.logger.info(`${player.getName()} has been defeated by ${npc.getName()}.`, { playerId: player.getId(), npcId: npc.id });
  }
  async handleNpcDefeat(npc, player) {
    npc.status = player.killer ? "lying dead" : "lying unconscious";
    player.status = "standing";
    await this.distributeExperience(npc, player);
    const messages = await this.generateDefeatMessages(player, npc);
    await this.notifyPlayersInLocation(await this.gameManager.getLocation(player.currentLocation), messages);
    this.combatParticipants.delete(npc.id);
  }
  async distributeExperience(defeatedNpc, mainPlayer) {
    const participants = await this.getCombatParticipants(defeatedNpc.id);
    if (participants.length === 0) {
      await this.awardExperience(mainPlayer, defeatedNpc.experienceReward);
      return;
    }
    const experiencePerParticipant = Math.floor(defeatedNpc.experienceReward / participants.length);
    for (const participantId of participants) {
      const player = await this.gameManager.getPlayer(participantId);
      if (player) {
        await this.awardExperience(player, experiencePerParticipant);
      }
    }
    const remainingXP = defeatedNpc.experienceReward - (experiencePerParticipant * participants.length);
    if (remainingXP > 0) {
      await this.awardExperience(mainPlayer, remainingXP);
    }
  }
  async awardExperience(player, amount) {
    player.addExperience(amount);
    await this.server.messageManager.notifyExperienceGain(player, amount);
    const levelUpMessage = await this.gameManager.checkLevelUp(player);
    if (levelUpMessage) {
      await this.server.messageManager.sendMessage(player, levelUpMessage, 'levelUp');
    }
  }
  async generateDefeatMessages(player, npc) {
    const messages = [MessageManager.getVictoryTemplate(player.getName(), npc.getName())];
    const levelUpMessage = await this.gameManager.checkLevelUp(player);
    if (levelUpMessage) {
      messages.push(levelUpMessage);
      this.logger.info(`${player.getName()} leveled up after defeating ${npc.getName()}.`, {
        playerId: player.getId(),
        npcId: npc.id,
        newLevel: player.level
      });
    }
    if (player.autoLoot) {
      const loot = npc.getLoot();
      if (loot.length > 0) {
        const lootMessage = await this.gameManager.handleLoot(player, loot);
        if (lootMessage) {
          messages.push(lootMessage);
          this.logger.info(`${player.getName()} looted ${npc.getName()}.`, {
            playerId: player.getId(),
            npcId: npc.id,
            loot: loot.map(item => item.id)
          });
        }
      }
    }
    this.combatOrder.delete(npc.id);
    this.defeatedNpcs.add(npc.id);
    return messages.join("<br>");
  }
  async endCombat(player) {
    if (player.combatInterval) {
      clearInterval(player.combatInterval);
      player.combatInterval = null;
    }
    // Clear combat-related data
    this.combatOrder.clear();
    await this.cleanupDefeatedNpcs();
    this.combatInitiatedNpcs.clear();
    // Reset player status
    player.status = "standing";
    await this.gameManager.fullStateSync(player);
    // Remove player from all combat participants
    for (const [npcId, participants] of this.combatParticipants.entries()) {
      if (participants.has(player.getId())) {
        await this.removeCombatParticipant(await this.gameManager.getNpc(npcId), player);
      }
    }
    // Check for aggressive NPCs after combat ends
    await this.checkAggressiveNpcs(player);
    this.logger.info(`Combat ended for player: ${player.getName()}`);
  }
  async cleanupDefeatedNpcs() {
    for (const npcId of this.defeatedNpcs) {
      const npc = await this.server.gameManager.getNpc(npcId);
      if (npc) {
        await this.server.gameManager.removeNpcFromGame(npc);
        this.defeatedNpcs.delete(npcId);
        this.logger.debug(`Removed defeated NPC: ${npcId}`);
      }
    }
  }
  async checkForAggressiveNpcs(player) {
    if (player.health > 0) {
      const location = await this.gameManager.getLocation(player.currentLocation);
      if (location && location.npcs) {
        for (const npcId of location.npcs) {
          const npc = await this.gameManager.getNpc(npcId);
          if (await this.isAggressiveNpc(npc, player)) {
            await this.startCombat({ npcId, player, playerInitiated: false });
          }
        }
      }
    }
  }
  async isAggressiveNpc(npc, player) {
    return npc && npc.aggressive &&
      npc.status !== "lying unconscious" &&
      npc.status !== "lying dead" &&
      player.status !== "lying unconscious" &&
      !this.defeatedNpcs.has(npc.id);
  }
  async performCombatAction(attacker, defender, isPlayer) {
    const combatAction = this.objectPool.acquire();
    combatAction.initialize(attacker, defender);
    try {
      const outcome = await combatAction.execute();
      await this.processCombatOutcome(outcome, attacker, defender);
      const result = await this.getCombatDescription(outcome, attacker, defender, combatAction.technique);
      if (isPlayer && !(await this.isPlayerInCombatWithNpc(attacker.getId(), defender.getId()))) {
        this.addCombatParticipant(defender, attacker);
      }
      return result;
    } finally {
      this.objectPool.release(combatAction);
    }
  }
  async processCombatOutcome(outcome, attacker, defender) {
    let damage = attacker.attackPower;
    let resistDamage = defender.defensePower;
    if (outcome === "critical success") {
      damage *= 2;
    }
    if (damage > resistDamage) {
      defender.health -= damage - resistDamage;
    }
  }
  async getCombatDescription(outcome, attacker, defender, technique) {
    const descriptionFunc = this.outcomeDescriptions.get(outcome) ||
      (({ attacker, defender, technique }) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}.`);
    return FormatMessageManager.createMessageData(descriptionFunc({ attacker, defender, technique }));
  }
  async attackNpc({ player, target1 }) {
    const location = await player.server.gameManager.getLocation(player.currentLocation);
    if (!location) return;
    const npcId = target1 ? await this.getNpcIdFromLocation(target1, location.npcs) : await this.getAvailableNpcId(location.npcs);
    if (!npcId) {
      if (target1) {
        await player.server.messageManager.sendMessage(player,
          MessageManager.getTargetNotFoundTemplate(player.getName(), target1),
          'errorMessage'
        );
      } else {
        await player.server.messageManager.sendMessage(player,
          MessageManager.getNoConsciousEnemiesTemplate(player.getName()),
          'errorMessage'
        );
      }
      return;
    }
    const npc = await player.server.gameManager.getNpc(npcId);
    if (!npc) return;
    if (npc.isUnconsciousOrDead()) {
      await player.server.messageManager.sendMessage(player,
        MessageManager.getNpcAlreadyInStatusTemplate(npc.getName(), npc.status),
        'errorMessage'
      );
    } else {
      await this.startCombat({ npcId, player, playerInitiated: true });
    }
  }
  async getAvailableNpcId(npcs) {
    for (const id of npcs) {
      const npc = await this.gameManager.getNpc(id);
      if (npc && !npc.isUnconsciousOrDead()) {
        return id;
      }
    }
    return null;
  }
  getCombatOrder() {
    return this.combatOrder;
  }
  async getNextNpcInCombatOrder() {
    return this.combatOrder.keys().next().value;
  }
  async notifyPlayersInLocation(locationId, content) {
    const location = await this.gameManager.getLocation(locationId);
    await MessageManager.notifyPlayersInLocation(location, content);
  }
  async notifyHealthStatus(player, npc) {
    const playerHealthPercentage = await this.calculateHealthPercentage(player.health, player.maxHealth);
    const npcHealthPercentage = await this.calculateHealthPercentage(npc.health, npc.maxHealth);
    const healthMessage = MessageManager.getCombatHealthStatusTemplate(
      player.getName(),
      playerHealthPercentage,
      npc.getName(),
      npcHealthPercentage
    );
    await this.server.messageManager.notifyPlayersInLocation(player.currentLocation, healthMessage, 'combatMessageHealth');
  }
  async calculateHealthPercentage(currentHealth, maxHealth) {
    return (currentHealth / maxHealth) * 100;
  }
  async calculateAttackValue(attacker, defender, roll) {
    if (attacker.level === defender.level) {
      return roll + attacker.csml;
    } else if (attacker.level < defender.level) {
      return (roll + attacker.csml) - (defender.level - attacker.level);
    } else {
      return (roll + attacker.csml) + (attacker.level - defender.level);
    }
  }
  async calculateAttackOutcome(attacker, defender) {
    const roll = Math.floor(Math.random() * 20) + 1;
    let value = await this.calculateAttackValue(attacker, defender, roll);
    if (value >= 21 || value === 19) return "critical success";
    if (value === 20) return "knockout";
    if (value >= 13) return "attack hits";
    if (value >= 10) return "attack is blocked";
    if (value >= 7) return "attack is parried";
    if (value >= 4) return "attack is trapped";
    if (value >= 1) return "attack is evaded";
    return "attack hits";
  }
  static getRandomElement(array) {
    return [...array][Math.floor(Math.random() * array.size)];
  }
  addCombatParticipant(npc, player) {
    if (!this.combatParticipants.has(npc.id)) {
      this.combatParticipants.set(npc.id, new Set());
    }
    this.combatParticipants.get(npc.id).add(player.getId());
  }
  async removeCombatParticipant(npc, player) {
    if (this.combatParticipants.has(npc.id)) {
      this.combatParticipants.get(npc.id).delete(player.getId());
      if (this.combatParticipants.get(npc.id).size === 0) {
        this.combatParticipants.delete(npc.id);
      }
    }
  }
  async getCombatParticipants(npcId) {
    return [...(this.combatParticipants.get(npcId) || [])];
  }
  async isPlayerInCombatWithNpc(playerId, npcId) {
    return this.combatParticipants.has(npcId) && this.combatParticipants.get(npcId).has(playerId);
  }
}
/**************************************************************************************************
Combat Action Class
The CombatAction class is designed to handle the execution of combat actions between
attacker and defender entities. It includes methods for initializing the combat,
selecting a technique, calculating attack values, and determining outcomes.
Key features:
1. Initialization of combat action
2. Random selection of techniques
3. Calculation of attack values
***************************************************************************************************/
class CombatAction {
  constructor({ logger }) {
    this.logger = logger;
  }
  async initialize(attacker, defender) {
    this.attacker = attacker;
    this.defender = defender;
    this.technique = await this.selectTechnique();
    this.outcome = null;
  }
  async execute() {
    const roll = Math.floor(Math.random() * 20) + 1;
    let value = await this.calculateAttackValue(roll);
    this.outcome = await this.determineOutcome(value);
    return this.outcome;
  }
  async selectTechnique() {
    return CombatManager.getRandomElement(CombatManager.TECHNIQUES);
  }
  async calculateAttackValue(roll) {
    if (this.attacker.level === this.defender.level) {
      return roll + this.attacker.csml;
    } else if (this.attacker.level < this.defender.level) {
      return (roll + this.attacker.csml) - (this.defender.level - this.attacker.level);
    } else {
      return (roll + this.attacker.csml) + (this.attacker.level - this.defender.level);
    }
  }
  async determineOutcome(value) {
    if (value >= 21 || value === 19) return "critical success";
    if (value === 20) return "knockout";
    if (value >= 13) return "attack hits";
    if (value >= 10) return "attack is blocked";
    if (value >= 7) return "attack is parried";
    if (value >= 4) return "attack is trapped";
    if (value >= 1) return "attack is evaded";
    return "attack hits";
  }
}
/**************************************************************************************************
Locations Class
The Locations class is intended to be used with OLC (online creation system).
Each location represents a specific area within the game world. It includes properties
for managing exits, items, Npcs, and players within the location, facilitating interactions
and navigation.
Key features:
1. Properties for managing exits, items, and Npcs
2. Methods for adding and removing entities from the location
3. Description management for the location
This class serves as the foundation for all locations within the game, ensuring that
interactions and navigation are managed effectively.
***************************************************************************************************/
class Npc extends Character {
  constructor({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, type, server, lootTable = [] }) {
    super({ name, health: currHealth });
    this.id = id;
    this.sex = sex;
    this.currHealth = currHealth;
    this.maxHealth = maxHealth;
    this.attackPower = attackPower;
    this.csml = csml;
    this.aggro = aggro;
    this.assist = assist;
    this.status = status;
    this.currentLocation = String(currentLocation);
    this.aliases = aliases;
    this.type = type;
    this.server = server;
    this.gameManager = server.gameManager;
    this.previousState = { currHealth, status };
    this.lootTable = lootTable;
  }
  async initialize() {
    // Any additional initialization logic can go here
  }
  hasChangedState() {
    const hasChanged = this.currHealth !== this.previousState.currHealth || this.status !== this.previousState.status;
    if (hasChanged) {
      this.previousState = { currHealth: this.currHealth, status: this.status };
    }
    return hasChanged;
  }
  receiveDamage(damage) {
    this.currHealth -= damage;
    if (this.currHealth <= 0) {
      this.die();
    }
  }
  die() {
    this.status = "lying dead";
    this.server.messageManager.notifyNpcDeath(this);
    // Additional logic for Npc death (e.g., loot drop, respawn timer)
  }
  attack(target) {
    this.server.combatManager.performCombatAction(this, target);
  }
  getLoot() {
    return [...this.lootTable].filter(() => Math.random() < 0.5);
  }
}
/**************************************************************************************************
Mobile Npc Class
The MobileNpc class is a concrete implementation of the Npc class, representing Npcs that
can move within the game world. It includes logic for determining movement behavior and
interactions with the environment.
Key features:
1. Movement logic for mobile Npcs
2. Direction management for movement actions
This class enhances the game world by providing dynamic Npcs that can interact with players
and the environment through movement.
***************************************************************************************************/
class MobileNpc extends Npc {
  constructor({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, zones = [], aliases, config, server, lootTable = [] }) {
    super({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, type: 'mobile', server, lootTable });
    this.zones = new Set(zones);
    this.config = config;
    this.allowedZones = zones;
    this.level = 1;
  }
  canMove() {
    return !["engaged in combat", "lying dead", "lying unconscious"].includes(this.status);
  }
}
/**************************************************************************************************
Quest Npc Class
The QuestNpc class is a concrete implementation of the Npc class, representing Npcs that
offer quests to players. It includes logic for managing quest interactions and completions.
Key features:
1. Quest management for Npcs
2. Interaction logic for providing and completing quests
This class enriches the gameplay experience by providing players with quests and objectives
through Npc interactions.
***************************************************************************************************/
class QuestNpc extends Npc {
  constructor({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, questId, zones = [], aliases, server, lootTable = [] }) {
    super({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, type: 'quest', server, lootTable });
    this.questId = questId;
    this.zones = zones;
  }
  provideQuest() {
    // Logic to provide the quest to the player
    this.server.messageManager.sendMessage(this, `${this.getName()} has received a quest: ${this.quest.title}`, 'questMessage');
  }
  completeQuest(player) {
    // Logic to complete the quest
    if (this.quest.isCompleted(player)) {
      this.server.messageManager.sendMessage(player, `${player.getName()} has completed the quest: ${this.quest.title}`, 'questMessage');
      // Additional logic for rewards
    } else {
      this.server.messageManager.sendMessage(player, `${player.getName()} has not completed the quest: ${this.quest.title}`, 'questMessage');
    }
  }
}
class MerchantNpc extends Npc {
  constructor({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, zones = [], aliases, config, server, lootTable = [] }) {
    super({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, type: 'merchant', server, lootTable });
    this.inventory = new Map();
  }
  async sellItem(itemId, player) {
    try {
      const item = await this.server.transactionManager.executeBuyTransaction(player, this, itemId);
      this.server.messageManager.notifyItemPurchased(player, item);
      return true;
    } catch (error) {
      this.server.messageManager.notifyTransactionError(player, error.message);
      return false;
    }
  }
  async buyItem(itemUid, player) {
    try {
      const sellPrice = await this.server.transactionManager.executeSellTransaction(player, this, itemUid);
      this.server.messageManager.notifyItemSold(player, sellPrice);
      return true;
    } catch (error) {
      this.server.messageManager.notifyTransactionError(player, error.message);
      return false;
    }
  }
}
/**************************************************************************************************
Npc Movement Manager Class
The NpcMovementManager class is responsible for managing the movement of mobile Npcs within
the game world. It includes logic for determining movement intervals and executing movement
actions for all mobile Npcs.
Key features:
1. Movement interval management for Npcs
2. Logic for executing movement actions
This class enhances the game world by ensuring that mobile Npcs behave dynamically and
realistically, contributing to a more immersive gameplay experience.
***************************************************************************************************/
class NpcMovementManager {
  static #instance = null;
  static #instanceLock = new AsyncLock();
  static async getInstance({ logger, configManager, gameManager }) {
    if (!NpcMovementManager.#instance) {
      await NpcMovementManager.#instanceLock.acquire('instance', async () => {
        if (!NpcMovementManager.#instance) {
          NpcMovementManager.#instance = new NpcMovementManager({ logger, configManager, gameManager });
        }
      });
    }
    return NpcMovementManager.#instance;
  }
  constructor({ logger, configManager, gameManager }) {
    if (NpcMovementManager.#instance) {
      return NpcMovementManager.#instance;
    }
    this.logger = logger;
    this.configManager = configManager;
    this.gameManager = gameManager;
    this.movementInterval = null;
    this.mobileNpcs = new Map();
    NpcMovementManager.#instance = this;
  }
  setGameManager(gameManager) {
    this.gameManager = gameManager;
  }
  startMovement() {
    this.stopMovement();
    const MOVEMENT_INTERVAL = this.configManager.get('NPC_MOVEMENT_INTERVAL');
    this.movementInterval = setInterval(() => this.moveAllMobiles(), MOVEMENT_INTERVAL);
    this.logger.info(`- Start Mobile Movement With Interval: ${MOVEMENT_INTERVAL}ms`);
  }
  stopMovement() {
    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = null;
      this.logger.info('Npc movement stopped');
    }
  }
  registerMobileNpc(npc) {
    if (!this.gameManager) {
      this.logger.error(`Game Manager not set in Npc Movement Manager. Unable to register Npc ID: ${npc.id}`);
      return;
    }
    this.mobileNpcs.set(npc.id, npc);
    this.logger.debug(`- Register Npc: ${npc.id} - With Npc Movement Manager`);
  }
  unregisterMobileNpc(npc) {
    this.mobileNpcs.delete(npc.id);
  }
  async moveAllMobiles() {
    this.logger.debug(``);
    this.logger.debug(`Move Mobiles - Total Mobile Npcs: ${this.mobileNpcs.size}`);
    const moveNpc = async ([npcId, npc]) => {
      this.logger.debug(`- Processing Mobile: ${npcId} - ${npc.name}`);
      if (npc.canMove()) {
        this.logger.debug(`- - Mobile: ${npcId} can move. Current Location: ${npc.currentLocation}`);
        const moved = await this.moveMobile(npc);
        this.logger.debug(`- - Mobile: ${npcId} ${moved ? 'moved to' : 'stayed in place at'} Location: ${npc.currentLocation}`);
        return moved;
      } else {
        this.logger.debug(`- - Mobile: ${npcId} cannot move. Status: ${npc.status} - Location: ${npc.currentLocation}`);
        return false;
      }
    };
    const moveResults = await Promise.all([...this.mobileNpcs].map(moveNpc));
    const movedCount = moveResults.filter(Boolean).length;
    const stayedCount = moveResults.length - movedCount;
    this.logger.debug(`Mobiles Moved: ${movedCount}, Mobiles Stayed: ${stayedCount}`);
    this.logger.debug(`Move Mobiles Finished At: ${new Date().toLocaleString()}`);
  }
  async moveMobile(npc) {
    const currentLocation = await this.gameManager.getLocation(npc.currentLocation);
    if (!currentLocation) {
      this.logger.error(`Invalid location for Npc: ${npc.id} - Location: ${npc.currentLocation}`);
      return false;
    }
    const { direction, exitId } = await this.chooseRandomExit(npc);
    if (!direction || !exitId) return false;
    const newLocation = await this.gameManager.getLocation(exitId);
    if (!newLocation) {
      this.logger.error(`Invalid exit location for Npc: ${npc.id} - Exit ID: ${exitId}`);
      return false;
    }
    await this.gameManager.moveEntity(npc, exitId);
    await this.notifyNpcMovement(npc, currentLocation, newLocation, direction);
    return true;
  }
  async chooseRandomExit(npc) {
    const currentLocation = await this.gameManager.getLocation(npc.currentLocation);
    if (!currentLocation || !currentLocation.exits instanceof Map) return {};
    const isExitAllowed = async ([direction, exitId]) => {
      const exitLocation = await this.gameManager.getLocation(exitId);
      return await this.isExitAllowed(npc, exitLocation);
    };
    const availableExits = new Map(
      await Promise.all([...currentLocation.exits].filter(isExitAllowed))
    );
    if (availableExits.size === 0) return {};
    const randomIndex = Math.floor(Math.random() * availableExits.size);
    return {
      direction: [...availableExits.keys()][randomIndex],
      exitId: [...availableExits.values()][randomIndex]
    };
  }
  async isExitAllowed(npc, exitLocation) {
    if (!exitLocation) return false;
    if (npc.level < exitLocation.minLevel) return false;
    if (npc.allowedZones && npc.allowedZones.length > 0) {
      return npc.allowedZones.some(zone => exitLocation.zone.includes(zone));
    }
    return true;
  }
  async notifyNpcMovement(npc, fromLocation, toLocation, direction) {
    await MessageManager.notifyPlayersInLocation(fromLocation, `${npc.name} leaves ${direction}.`, 'npcMovement');
    await MessageManager.notifyPlayersInLocation(toLocation, `${npc.name} arrives from the ${DirectionManager.getOppositeDirection(direction)}.`, 'npcMovement');
  }
  cleanup() {
    this.stopNpcMovement();
    this.mobileNpcs.clear();
    this.logger.info('NpcMovementManager cleaned up');
  }
}
/**************************************************************************************************
Base Item Class
The BaseItem class serves as a foundational class for all item types within the game,
providing common properties and methods for item management. It includes functionality for
describing items and managing aliases.
Key features:
1. Common properties for all items (name, description, aliases)
2. Base functionality for derived item classes
This class provides a foundation for all item types, ensuring consistent management of
item properties and behavior across the game.
***************************************************************************************************/
class BaseItem {
  constructor({ name, description, aliases }) {
    this.name = name;
    this.description = description;
    this.aliases = aliases;
  }
}
/**************************************************************************************************
Item Class
The Item class is a concrete implementation of the BaseItem class, representing a generic
item within the game. It includes properties specific to items, such as type and server
reference, and provides methods for item initialization.
Key features:
1. Specific properties for items (type, server reference)
2. Initialization logic for item instances
3. Integration with the server for item management
This class serves as the base for all item types, ensuring that items are properly initialized
and managed within the game.
***************************************************************************************************/
class Item extends BaseItem {
  constructor({ id, name, description, aliases, type, price = 0, server }) {
    super({ name, description, aliases });
    this.id = id;
    this.type = type;
    this.price = price;
    this.server = server;
    this.uid = UidGenerator.generateUid();
  }
  createInstance() {
    return new this.constructor({ ...this, uid: UidGenerator.generateUid() });
  }
  async initialize() {
    // Any additional initialization logic can go here
  }
}
/**************************************************************************************************
Consumable Item Class
The ConsumableItem class is a concrete implementation of the Item class, representing items
that can be consumed by players. It includes methods for using consumable items and managing
their effects.
Key features:
1. Specific properties and behavior for consumable items
2. Logic for item usage and effect management
This class provides functionality for consumable items, ensuring that they can be used
effectively within the game.
***************************************************************************************************/
class ConsumableItem extends Item {
  constructor({ id, name, description, aliases, server }) {
    super({ id, name, description, aliases, type: 'consumable', server });
  }
  use(player) {
    // Implement consumable item usage logic here
    // After the item is consumed, remove it from the game
    this.server.itemManager.removeItem(this.uid);
  }
}
/**************************************************************************************************
Container Item Class
The ContainerItem class is a concrete implementation of the Item class, representing items
that can hold other items. It includes functionality for managing the inventory of contained
items.
Key features:
1. Specific properties and behavior for container items
2. Inventory management for contained items
This class provides functionality for container items, ensuring that they can hold and manage
other items effectively within the game.
***************************************************************************************************/
class ContainerItem extends Item {
  constructor({ id, name, description, aliases, server }) {
    super({ id, name, description, aliases, type: 'container', server });
    this.inventory = new Set();
  }
}
/**************************************************************************************************
Weapon Item Class
The WeaponItem class is a concrete implementation of the Item class, representing weapons
that can be used by characters in the game. It includes properties specific to weapons,
such as damage, and provides methods for weapon actions and interactions.
Key features:
1. Specific properties for weapon items (damage)
2. Methods for weapon actions (attack, defense)
3. Integration with game systems for weapon management
This class serves as the base for all weapon types, ensuring that weapons are properly
***************************************************************************************************/
class WeaponItem extends Item {
  constructor({ id, name, description, aliases, damage, server }) {
    super({ id, name, description, aliases, type: 'weapon', server });
    this.damage = damage;
  }
}
/**************************************************************************************************
Item Manager Class
The ItemManager class is responsible for managing items within the game. It includes functionality
for checking for duplicate IDs, assigning UIDs to items, and retrieving items by UID.
Key features:
1. Duplicate ID checking
2. UID assignment to items
3. Item retrieval by UID
This class ensures that items are properly managed and identified within the game.
***************************************************************************************************/
class ItemManager {
  static instance;
  static getInstance({ logger, configManager, bcrypt }) {
    if (!ItemManager.instance) {
      ItemManager.instance = new ItemManager({ logger, configManager, bcrypt });
    }
    return ItemManager.instance;
  }
  constructor({ logger, configManager, bcrypt }) {
    this.logger = logger;
    this.configManager = configManager;
    this.bcrypt = bcrypt;
    this.items = new Map();
    this.uidGenerator = new UidGenerator(bcrypt, this.configManager.get('ITEM_UID_SALT_ROUNDS'));
  }
  async initialize(itemData) {
    const initializationSteps = [
      this.checkItemsForDuplicateIds,
      this.assignUidsToItems,
    ].map(step => this.createInitializationStep(step.bind(this)));
    return this.executeInitializationSteps(initializationSteps, itemData);
  }
  createInitializationStep(stepFn) {
    return async (data) => {
      try {
        return await stepFn(data);
      } catch (error) {
        this.logger.error(`Error in initialization step: ${error.message}`, { error });
        throw error;
      }
    };
  }
  async executeInitializationSteps(steps, initialData) {
    return steps.reduce(async (acc, step) => {
      const data = await acc;
      return step(data);
    }, Promise.resolve(initialData));
  }
  async checkItemsForDuplicateIds(itemData) {
    const itemIds = Object.keys(itemData);
    const uniqueIds = new Set(itemIds);
    if (itemIds.length !== uniqueIds.size) {
      const findDuplicates = id => itemIds.filter(itemId => itemId === id).length > 1;
      const duplicateIds = itemIds.filter(findDuplicates);
      duplicateIds.forEach(id => {
        this.logger.error(`Duplicate Item ID Detected: ${id}`);
      });
      throw new Error('Duplicate Item IDs Detected');
    }
    this.logger.debug(`Total Items Processed: ${itemIds.length}`);
    return itemData;
  }
  async assignUidsToItems(itemData) {
    this.logger.debug(`Assigning UIDs to Items`);
    const assignUid = async ([id, item]) => {
      try {
        const uid = await this.uidGenerator.generateUid();
        item.uid = uid;
        return [uid, item];
      } catch (error) {
        this.logger.error(`Assigning UID to Item ${id}: ${error.message}`);
        return null;
      }
    };
    const itemEntries = await Promise.all(Object.entries(itemData).map(assignUid));
    this.items = new Map(itemEntries.filter(entry => entry !== null));
    this.logger.debug(`Total Items with UIDs: ${this.items.size}`);
    return this.items;
  }
  getItem(uid) {
    return this.items.get(uid);
  }
  getAllItems() {
    return [...this.items.values()];
  }
  createItemInstance(itemId) {
    const itemTemplate = this.items.get(itemId);
    if (!itemTemplate) {
      this.logger.error(`Item template not found for ID: ${itemId}`);
      return null;
    }
    return itemTemplate.createInstance();
  }
  transferItem(sourceInventory, targetInventory, itemUid) {
    const item = sourceInventory.get(itemUid);
    if (!item) {
      this.logger.error(`Item not found in source inventory: ${itemUid}`);
      return false;
    }
    sourceInventory.delete(itemUid);
    targetInventory.set(itemUid, item);
    return true;
  }
  removeItem(uid) {
    if (this.items.has(uid)) {
      this.items.delete(uid);
      this.logger.debug(`Removed item with UID: ${uid}`);
      return true;
    } else {
      this.logger.warn(`Attempted to remove non-existent item with UID: ${uid}`);
      return false;
    }
  }
  cleanup() {
    this.items.clear();
    this.logger.info('ItemManager cleaned up');
  }
}
/**************************************************************************************************
Inventory Manager Class
The InventoryManager class is responsible for managing a player's inventory within the game.
It includes methods for adding, removing, and interacting with items in the inventory.
Key features:
1. Inventory management for player items
2. Logic for adding and removing items
3. Interaction with game items and containers
This class ensures that players can effectively manage their inventory, enhancing the gameplay
experience through item interactions.
@ todo: explain how loot should work.
***************************************************************************************************/
class InventoryManager {
  static instance;
  static getInstance(player) {
    if (!InventoryManager.instance) {
      InventoryManager.instance = new InventoryManager(player);
    }
    return InventoryManager.instance;
  }
  constructor(player) {
    this.player = player;
    this.server = player.server;
    this.messageManager = this.server.messageManager;
    this.itemManager = this.server.itemManager;
    this.inventory = new Map();
  }
  async performInventoryAction(action, ...args) {
    try {
      return await this[action](...args);
    } catch (error) {
      this.server.logger.error(`Error in inventory action ${action}: ${error.message}`, { error });
      await this.messageManager.notifyError(this.player, `An error occurred while performing the inventory action.`);
    }
  }
  async addItem(item) {
    this.inventory.set(item.uid, item);
    await this.notifyItemAction(item, 'pickup');
  }
  async removeItem(itemUid) {
    const item = this.inventory.get(itemUid);
    if (item) {
      this.inventory.delete(itemUid);
      await this.notifyItemAction(item, 'drop');
      return item;
    }
    return null;
  }
  async notifyItemAction(item, action) {
    const actionMessages = {
      'pickup': `${this.player.getName()} picked up ${item.name}.`,
      'drop': `${this.player.getName()} dropped ${item.name}.`
    };
    await this.messageManager.notifyAction(this.player, actionMessages[action], 'itemAction');
  }
  async transferItemTo(targetInventory, itemUid) {
    const item = this.inventory.get(itemUid);
    if (item) {
      this.inventory.delete(itemUid);
      targetInventory.set(itemUid, item);
      return true;
    }
    return false;
  }
  async createItemFromData(itemId) {
    const itemData = this.server.items[itemId];
    if (!itemData) {
      this.server.logger.error(`Item with ID ${itemId} not found`);
      return null;
    }
    try {
      const uniqueId = await this.itemManager.uidGenerator.generateUid();
      return new Item({ id: itemId, name: itemData.name, description: itemData.description, aliases: itemData.aliases, type: itemData.type, server: this.server });
    } catch (error) {
      this.server.logger.error(`Creating Item From Data: ${error.message}`);
      return null;
    }
  }
  async getAllItemsFromSource(source, sourceType, containerName) {
    if (!source || source.size === 0) {
      await this.messageManager.notifyNoItemsHere(this.player);
      return;
    }
    const itemsTaken = await Promise.all(
      [...source].map(async itemId => {
        const item = this.server.items[itemId];
        if (item) {
          await this.addItem(item);
          return item;
        }
        return null;
      })
    ).then(items => items.filter(item => item !== null));
    if (sourceType === 'location') {
      this.server.location[this.player.currentLocation].items.clear();
    } else {
      this.server.items[containerName].inventory.clear();
    }
    await this.messageManager.notifyItemsTaken(this.player, itemsTaken);
  }
  async getAllItemsFromLocation() {
    const currentLocation = this.server.location[this.player.currentLocation];
    await this.getAllItemsFromSource(currentLocation.items, 'location');
  }
  async getAllItemsFromContainer(containerName) {
    const container = await this.getContainer(containerName);
    if (!container) return;
    const items = new Set([...container.inventory].filter(i => this.server.items[i]));
    await this.getAllItemsFromSource(items, 'container', container.name);
  }
  async dropItems(itemsToDrop, type, itemType) {
    if (itemsToDrop.size === 0) {
      await this.messageManager.notifyNoItemsToDrop(this.player, type, itemType);
      return;
    }
    const currentLocation = this.server.location[this.player.currentLocation];
    currentLocation.items = currentLocation.items || new Set();
    const droppedItems = await Promise.all(
      [...itemsToDrop].map(async item => {
        currentLocation.items.add(item.uid);
        await this.removeItem(item.uid);
        return item;
      })
    );
    await this.messageManager.notifyItemsDropped(this.player, droppedItems);
  }
  getContainer(containerName) {
    const container = [...this.inventory.values()].find(item =>
      item.name.toLowerCase() === containerName.toLowerCase() && item.inventory
    );
    if (!container) {
      this.messageManager.notifyNoContainer(this.player, containerName);
    }
    return container;
  }
  cleanup() {
    this.inventory.clear();
    this.server.logger.info('InventoryManager cleaned up');
  }
}
/**************************************************************************************************
Currency Class
The Currency class is responsible for managing the player's currency.
It provides methods to add, subtract, and get the current amount of currency.
Key features:
1. Currency management
2. Addition and subtraction of currency
3. Getter for the current amount of currency
This class is essential for handling the player's financial transactions within the game.
***************************************************************************************************/
class Currency {
  constructor(initialAmount = 0) {
    this.amount = initialAmount;
  }
  add(value) {
    this.amount += value;
  }
  subtract(value) {
    if (this.amount < value) {
      throw new Error('Insufficient funds');
    }
    this.amount -= value;
    return true;
  }
  getAmount() {
    return this.amount;
  }
}
/**************************************************************************************************
Transaction Manager Class
The TransactionManager class is responsible for managing transactions in the game.
It provides methods to create transactions, execute buy and sell transactions, and handle trade
sessions.
Key features:
1. Transaction management
2. Buy and sell transactions
3. Trade session management
This class is essential for ensuring that transactions are atomic and that trades are handled
correctly.
***************************************************************************************************/
class TransactionManager {
  constructor(server) {
    this.server = server;
    this.tradeSessions = new Map();
  }
  createTransaction() {
    return new AtomicTransaction(this.server);
  }
  async executeTransaction(operations) {
    const transaction = this.createTransaction();
    operations.forEach(operation => transaction.addOperation(operation));
    await transaction.commit();
  }
  async executeBuyTransaction(player, merchant, itemId) {
    const transactionOperations = await this.createBuyOperations(player, merchant, itemId);
    return this.executeTransactionWithErrorHandling(transactionOperations, 'buy');
  }
  async executeSellTransaction(player, merchant, itemUid) {
    const transactionOperations = await this.createSellOperations(player, merchant, itemUid);
    return this.executeTransactionWithErrorHandling(transactionOperations, 'sell');
  }
  async executeTransactionWithErrorHandling(transactionOperations, transactionType) {
    try {
      await this.executeTransaction(transactionOperations);
      return transactionOperations.result;
    } catch (error) {
      this.server.logger.error(`Error executing ${transactionType} transaction: ${error.message}`, { error });
      throw error;
    }
  }
  async createBuyOperations(player, merchant, itemId) {
    const item = merchant.inventory.get(itemId);
    if (!item) throw new Error("Item not found in merchant's inventory");
    if (player.getCurrency() < item.price) throw new Error("Insufficient funds");
    return {
      execute: () => {
        player.subtractCurrency(item.price);
        merchant.inventory.delete(itemId);
        player.addItemToInventory(item);
      },
      rollback: () => {
        player.addCurrency(item.price);
        merchant.inventory.set(itemId, item);
        player.removeItemFromInventory(item.uid);
      },
      result: item
    };
  }
  async createSellOperations(player, merchant, itemUid) {
    const item = player.getItemFromInventory(itemUid);
    if (!item) throw new Error("Item not found in player's inventory");
    const sellPrice = Math.floor(item.price * 0.5);
    return {
      execute: () => {
        player.removeItemFromInventory(itemUid);
        player.addCurrency(sellPrice);
        merchant.inventory.set(item.id, item);
        this.server.itemManager.removeItem(itemUid);
      },
      rollback: () => {
        player.addItemToInventory(item);
        player.subtractCurrency(sellPrice);
        merchant.inventory.delete(item.id);
        this.server.itemManager.items.set(itemUid, item);
      },
      result: sellPrice
    };
  }
  createTradeSession(player1, player2) {
    try {
      const tradeSession = new TradeSession(this.server, player1, player2);
      this.tradeSessions.set(player1.getId(), tradeSession);
      this.tradeSessions.set(player2.getId(), tradeSession);
      return tradeSession;
    } catch (error) {
      this.server.logger.error(`Error creating trade session: ${error.message}`, { error });
      throw error;
    }
  }
  getTradeSession(playerId) {
    return this.tradeSessions.get(playerId);
  }
  endTradeSession(playerId) {
    try {
      const tradeSession = this.tradeSessions.get(playerId);
      if (tradeSession) {
        this.tradeSessions.delete(tradeSession.player1.getId());
        this.tradeSessions.delete(tradeSession.player2.getId());
      }
    } catch (error) {
      this.server.logger.error(`Error ending trade session: ${error.message}`, { error });
      throw error;
    }
  }
  async executeTradeTransaction(tradeSession) {
    try {
      const transaction = this.createTransaction();
      const { player1, player2, player1Items, player2Items, player1Gold, player2Gold } = tradeSession;
      await this.addItemTransferOperations(transaction, player1Items, player1, player2);
      await this.addItemTransferOperations(transaction, player2Items, player2, player1);
      await this.addGoldTransferOperation(transaction, player1, player2, player1Gold);
      await this.addGoldTransferOperation(transaction, player2, player1, player2Gold);
      await transaction.commit();
      await this.server.messageManager.notifyTradeCompleted(player1, player2);
    } catch (error) {
      await this.server.messageManager.notifyTradeError(tradeSession.player1, tradeSession.player2, error.message);
      throw error;
    } finally {
      await this.endTradeSession(tradeSession.player1.getId());
    }
  }
  async addItemTransferOperations(transaction, items, fromPlayer, toPlayer) {
    const transferOperations = [...items].map(([itemId, item]) => ({
      execute: async () => {
        await fromPlayer.removeItemFromInventory(itemId);
        await toPlayer.addItemToInventory(item);
      },
      rollback: async () => {
        await toPlayer.removeItemFromInventory(itemId);
        await fromPlayer.addItemToInventory(item);
      }
    }));
    transferOperations.forEach(operation => transaction.addOperation(operation));
  }
  async addGoldTransferOperation(transaction, fromPlayer, toPlayer, amount) {
    transaction.addOperation({
      execute: async () => {
        await fromPlayer.subtractCurrency(amount);
        await toPlayer.addCurrency(amount);
      },
      rollback: async () => {
        await toPlayer.subtractCurrency(amount);
        await fromPlayer.addCurrency(amount);
      }
    });
  }
  cleanup() {
    this.tradeSessions.clear();
    this.server.logger.info('TransactionManager cleaned up');
  }
}
/**************************************************************************************************
Trade Session Class
The TradeSession class is responsible for managing trade sessions between players.
It provides methods to add items to the trade, remove items from the trade, set gold amounts,
and confirm the trade. It also handles the rollback of transactions if the trade is declined.
Key features:
1. Trade session management
2. Item addition and removal
3. Gold setting and confirmation
4. Trade acceptance and decline
This class is essential for managing trades between players.
***************************************************************************************************/
class TradeSession {
  constructor(server, player1, player2) {
    this.server = server;
    this.player1 = player1;
    this.player2 = player2;
    this.player1Items = new Map();
    this.player2Items = new Map();
    this.player1Gold = 0;
    this.player2Gold = 0;
    this.player1Confirmed = false;
    this.player2Confirmed = false;
    this.accepted = false;
  }
  async performTradeAction(action, player, ...args) {
    if (!this.isValidTradeAction(action)) {
      throw new Error(`Invalid trade action: ${action}`);
    }
    return this[action](player, ...args);
  }
  isValidTradeAction(action) {
    return ['acceptTrade', 'declineTrade', 'addItem', 'removeItem', 'setGold', 'confirmTrade'].includes(action);
  }
  async acceptTrade(player) {
    if (this.accepted) return;
    if (player !== this.player2) {
      await this.server.messageManager.sendMessage(player, "You can't accept this trade.", 'error');
      return;
    }
    this.accepted = true;
    await this.server.messageManager.notifyTradeAccepted(this.player1, this.player2);
  }
  async declineTrade(player) {
    await this.server.messageManager.notifyTradeDeclined(this.player1, this.player2);
    await this.server.transactionManager.endTradeSession(this.player1.getId());
  }
  async addItem(player, item) {
    if (!await this.canModifyTrade(player)) return;
    const itemList = this.getPlayerItemList(player);
    itemList.set(item.id, item);
    await this.resetConfirmations();
    await this.server.messageManager.notifyTradeItemAdded(player, item);
  }
  async removeItem(player, itemName) {
    if (!await this.canModifyTrade(player)) return;
    const itemList = this.getPlayerItemList(player);
    const item = this.findItemByName(itemList, itemName);
    if (item) {
      itemList.delete(item.id);
      await this.resetConfirmations();
      await this.server.messageManager.notifyTradeItemRemoved(player, itemName);
    } else {
      await this.server.messageManager.sendMessage(player, `${itemName} is not in the trade.`, 'error');
    }
  }
  async setGold(player, amount) {
    if (!await this.canModifyTrade(player)) return;
    if (!this.isValidGoldAmount(player, amount)) {
      await this.server.messageManager.sendMessage(player, "Invalid gold amount.", 'error');
      return;
    }
    this.setPlayerGold(player, amount);
    await this.resetConfirmations();
    await this.server.messageManager.notifyTradeGoldSet(player, amount);
  }
  async confirmTrade(player) {
    if (!this.accepted) {
      await this.server.messageManager.sendMessage(player, "The trade hasn't been accepted yet.", 'error');
      return;
    }
    this.setPlayerConfirmation(player, true);
    await this.server.messageManager.notifyTradeConfirmed(player);
    if (this.areBothPlayersConfirmed()) {
      await this.completeTrade();
    }
  }
  async completeTrade() {
    await this.server.transactionManager.executeTradeTransaction(this);
  }
  async resetConfirmations() {
    this.player1Confirmed = false;
    this.player2Confirmed = false;
  }
  async canModifyTrade(player) {
    if (!this.accepted) {
      await this.server.messageManager.sendMessage(player, "The trade hasn't been accepted yet.", 'error');
      return false;
    }
    return true;
  }
  getPlayerItemList(player) {
    return player === this.player1 ? this.player1Items : this.player2Items;
  }
  findItemByName(itemList, itemName) {
    return [...itemList.values()].find(i => i.name.toLowerCase() === itemName.toLowerCase());
  }
  isValidGoldAmount(player, amount) {
    return amount >= 0 && amount <= player.getCurrency();
  }
  setPlayerGold(player, amount) {
    if (player === this.player1) {
      this.player1Gold = amount;
    } else {
      this.player2Gold = amount;
    }
  }
  setPlayerConfirmation(player, confirmed) {
    if (player === this.player1) {
      this.player1Confirmed = confirmed;
    } else if (player === this.player2) {
      this.player2Confirmed = confirmed;
    }
  }
  areBothPlayersConfirmed() {
    return this.player1Confirmed && this.player2Confirmed;
  }
}
/**************************************************************************************************
Atomic Transaction Class
The AtomicTransaction class is responsible for managing atomic transactions in the game.
It provides methods to add operations to the transaction, commit the transaction, and rollback
if an error occurs during the commit.
Key features:
1. Atomic transaction management
2. Operation addition
3. Commit and rollback functionality
This class is essential for ensuring that transactions are atomic and that trades are handled
correctly.
***************************************************************************************************/
class AtomicTransaction {
  constructor(server) {
    this.server = server;
    this.operations = [];
    this.isCommitted = false;
    this.logger = server.logger;
  }
  addOperation(operation) {
    if (this.isCommitted) {
      throw new Error("Cannot add operations to a committed transaction");
    }
    this.operations.push(operation);
  }
  async commit() {
    if (this.isCommitted) {
      throw new Error("Transaction already committed");
    }
    this.logger.debug("Starting atomic transaction commit");
    try {
      await this.executeOperations();
      this.isCommitted = true;
      this.logger.debug("Atomic transaction committed successfully");
    } catch (error) {
      this.logger.error("Error during transaction commit, rolling back", { error });
      await this.rollback();
      throw error;
    }
  }
  async executeOperations() {
    for (const operation of this.operations) {
      await this.executeOperation(operation);
    }
  }
  async executeOperation(operation) {
    if (typeof operation.execute !== 'function') {
      throw new Error("Invalid operation: execute method is not a function");
    }
    await operation.execute();
  }
  async rollback() {
    this.logger.debug("Rolling back atomic transaction");
    const rollbackPromises = this.operations.reverse().map(operation => this.rollbackOperation(operation));
    await Promise.allSettled(rollbackPromises);
    this.logger.debug("Atomic transaction rolled back");
  }
  async rollbackOperation(operation) {
    if (typeof operation.rollback !== 'function') {
      this.logger.warn("Operation does not have a rollback method", { operation });
      return;
    }
    try {
      await operation.rollback();
    } catch (rollbackError) {
      this.logger.error("Error during operation rollback", { error: rollbackError });
    }
  }
  async withTransaction(callback) {
    try {
      await callback(this);
      await this.commit();
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}
/**************************************************************************************************
Format Message Manager Class
The FormatMessageManager class is responsible for formatting messages for different types of game
events.It provides methods for creating message data with appropriate CSS identifiers and content.
Key features:
1. Message formatting for different types of game events
2. Integration with the socket for real-time communication
3. Templated messages for common game events
The FormatMessageManager is essential for ensuring that messages are displayed correctly
***************************************************************************************************/
class FormatMessageManager {
  static messageIds = {
    locationTitle: 'location-title',
    locationDescription: 'location-description',
    itemName: 'item-name',
    exitToLocation: 'exit-to-location',
    exitsList: 'exits-list',
    inventoryList: 'inventory-list',
    itemsList: 'items-list',
    npcName: 'npc-name',
    npcDescription: 'npc-description',
    npcStats: 'npc-stats',
    playerName: 'player-name',
    combatMessagePlayer: 'combat-message-player',
    combatMessageNpc: 'combat-message-npc',
    combatMessageHealth: 'combat-message-health',
    combatMessage: 'combat-message',
    errorMessage: 'error-message',
    buyMessage: 'buy-message',
    sellMessage: 'sell-message',
    merchantInventory: 'merchant-inventory',
  };
  static createMessageData({ cssid = '', message }) {
    return { cssid, content: message };
  }
  static getIdForMessage(type) {
    return this.messageIds[type] || '';
  }
  static formatMessage(message, type) {
    const cssid = this.getIdForMessage(type);
    return this.createMessageData({ cssid, message });
  }
  static formatCompoundMessage(messageParts) {
    return messageParts.map(({ message, type }) => this.formatMessage(message, type));
  }
  static wrapWithColor(message, color) {
    return `<span style="color: ${color}">${message}</span>`;
  }
  static formatList(items, type) {
    const formattedItems = items.map(item => this.formatMessage(item, type));
    return this.createMessageData({
      cssid: this.getIdForMessage(`${type}List`),
      message: formattedItems.map(item => item.content).join(', ')
    });
  }
  static formatLocationDescription(title, description, exits) {
    const titleMessage = this.formatMessage(title, 'locationTitle');
    const descriptionMessage = this.formatMessage(description, 'locationDescription');
    const exitsMessage = this.formatList(exits, 'exitToLocation');
    return [titleMessage, descriptionMessage, exitsMessage];
  }
  static formatCombatMessage(attacker, defender, action, outcome) {
    const attackerName = this.formatMessage(attacker.getName(), attacker.isPlayer ? 'playerName' : 'npcName');
    const defenderName = this.formatMessage(defender.getName(), defender.isPlayer ? 'playerName' : 'npcName');
    const actionMessage = this.formatMessage(action, 'combatMessage');
    const outcomeMessage = this.formatMessage(outcome, 'combatMessage');
    return this.formatCompoundMessage([
      { message: attackerName.content, type: 'combatMessage' },
      { message: actionMessage.content, type: 'combatMessage' },
      { message: defenderName.content, type: 'combatMessage' },
      { message: outcomeMessage.content, type: 'combatMessage' }
    ]);
  }
  static formatInventory(items) {
    return this.formatList(items.map(item => item.name), 'itemName');
  }
  static formatErrorMessage(message) {
    return this.formatMessage(message, 'errorMessage');
  }
  static formatBuyMessage(item, price) {
    const itemName = this.formatMessage(item.name, 'itemName');
    return this.formatCompoundMessage([
      { message: 'You bought ', type: 'buyMessage' },
      { message: itemName.content, type: 'itemName' },
      { message: ` for ${price} gold.`, type: 'buyMessage' }
    ]);
  }
  static formatSellMessage(item, price) {
    const itemName = this.formatMessage(item.name, 'itemName');
    return this.formatCompoundMessage([
      { message: 'You sold ', type: 'sellMessage' },
      { message: itemName.content, type: 'itemName' },
      { message: ` for ${price} gold.`, type: 'sellMessage' }
    ]);
  }
}
/**************************************************************************************************
Message Manager Class
The MessageManager class is responsible for handling message-related operations.
It provides methods for sending messages to players, notifying players of various events,
and formatting messages for different types of game events. This class uses the Singleton pattern
to ensure a single instance is used throughout the application.
Key features:
1. Singleton instance management
2. Socket integration for message sending
3. Player and location-based notifications
4. Templated messages for common game events
5. Error handling and logging
The class works closely with the FormatMessageManager to ensure consistent message formatting
and styling across the game. It also interacts with the server's logger for error tracking and
debugging purposes.***************************************************************************************************/
class MessageManager {
  static instance;
  static logger;
  static getInstance(logger) {
    if (!MessageManager.instance) {
      MessageManager.instance = new MessageManager();
      MessageManager.logger = logger;
    }
    return MessageManager.instance;
  }
  // Set the socket instance
  static socket;
  static setSocket(socketInstance) {
    try {
      this.socket = socketInstance;
    } catch (error) {
      this.logger.error('Error setting socket instance:', error);
    }
  }
  // Notify a player with a message
  static async notify(entity, message, type) {
    try {
      if (entity instanceof Player) {
        this.logger.info(`Notifying Player: ${entity.getName()} - ${message}`);
      } else if (entity instanceof Npc) {
        this.logger.info(`Notifying about Npc: ${entity.name} - ${message}`);
      } else {
        this.logger.info(`Notification: ${message}`);
      }
      // Implement actual notification logic here
    } catch (error) {
      this.logger.error('Error in MessageManager.notify:', error);
    }
  }
  // Notify all players in a specific location with a message
  static async notifyPlayersInLocation({ location, message, type = '' }) {
    if (!location || !location.playersInLocation) return;
    const notifyPlayer = player => this.notify(player, message, type);
    await Promise.all([...location.playersInLocation].map(notifyPlayer));
  }
  // Notify a player about a specific action performed on a target
  static async notifyAction({ player, action, targetName, type }) {
    return await this.notify(player, `${player.getName()} ${action} ${targetName}.`, type);
  }
  // Notify a player of a successful login
  static async notifyLoginSuccess({ player }) {
    try {
      return await this.notifyAction({ player, action: 'has logged in!', targetName: '', type: 'loginSuccess' });
    } catch (error) {
      this.logger.error('Error notifying login success:', error);
    }
  }
  // Notify a player of an incorrect password attempt
  static async notifyIncorrectPassword({ player }) {
    try {
      return await this.notify(player, `Incorrect password. Please try again.`, 'incorrectPassword');
    } catch (error) {
      this.logger.error('Error notifying incorrect password:', error);
    }
  }
  // Notify a player of disconnection due to too many failed login attempts
  static async notifyDisconnectionDueToFailedAttempts({ player }) {
    try {
      return await this.notify(player, `${player.getName()} has been disconnected due to too many failed login attempts.`, 'disconnectionFailedAttempts');
    } catch (error) {
      this.logger.error('Error notifying disconnection due to failed attempts:', error);
    }
  }
  // Notify a player when they pick up an item
  static async notifyPickupItem({ player, itemName }) {
    try {
      return await this.notifyAction({ player, action: 'picks up', targetName: itemName, type: 'pickupItem' });
    } catch (error) {
      this.logger.error('Error notifying pickup item:', error);
    }
  }
  // Notify a player when they drop an item
  static async notifyDropItem({ player, itemName }) {
    try {
      return await this.notifyAction({ player, action: 'drops', targetName: itemName, type: 'dropItem' });
    } catch (error) {
      this.logger.error('Error notifying drop item:', error);
    }
  }
  // Notify players in a location about an Npc's movement
  static async notifyNpcMovement(npc, direction, isArrival) {
    try {
      const action = isArrival ? 'arrives' : 'leaves';
      const message = `${npc.name} ${action} ${DirectionManager.getDirectionTo(direction)}.`;
      await this.notifyPlayersInLocation(npc.currentLocation, message, 'npcMovement');
    } catch (error) {
      this.logger.error('Error notifying Npc movement:', error);
    }
  }
  // Get a template message for combat initiation
  static getCombatInitiationTemplate({ initiatorName, targetName }) {
    try {
      return `${initiatorName} initiates combat with ${targetName}!`;
    } catch (error) {
      this.logger.error('Error getting combat initiation template:', error);
    }
  }
  // Get a template message for an Npc joining combat
  static getCombatJoinTemplate({ npcName }) {
    try {
      return `${npcName} joins the combat!`;
    } catch (error) {
      this.logger.error('Error getting combat join template:', error);
    }
  }
  // Get a template message for a victory announcement
  static getVictoryTemplate({ playerName, defeatedName }) {
    try {
      return `${playerName} has defeated ${defeatedName}!`;
    } catch (error) {
      this.logger.error('Error getting victory template:', error);
    }
  }
  // Get a template message for a target not found
  static getTargetNotFoundTemplate({ playerName, target }) {
    try {
      return `${playerName} doesn't see ${target} here.`;
    } catch (error) {
      this.logger.error('Error getting target not found template:', error);
    }
  }
  // Get a template message for no conscious enemies
  static getNoConsciousEnemiesTemplate({ playerName }) {
    try {
      return `${playerName} doesn't see any conscious enemies here.`;
    } catch (error) {
      this.logger.error('Error getting no conscious enemies template:', error);
    }
  }
  // Get a template message for an Npc already in a specific status
  static getNpcAlreadyInStatusTemplate({ npcName, status }) {
    try {
      return `${npcName} is already ${status}.`;
    } catch (error) {
      this.logger.error('Error getting Npc already in status template:', error);
    }
  }
  // Get a template message for an unknown location
  static getUnknownLocationTemplate({ playerName }) {
    try {
      return `${playerName} is in an unknown location.`;
    } catch (error) {
      this.logger.error('Error getting unknown location template:', error);
    }
  }
  // Get a template message for looting an Npc
  static getLootedNpcTemplate({ playerName, npcName, lootedItems }) {
    try {
      return `${playerName} looted ${npcName} and found: ${[...lootedItems].map(item => item.name).join(', ')}.`;
    } catch (error) {
      this.logger.error('Error getting looted Npc template:', error);
    }
  }
  // Get a template message for finding nothing to loot from an Npc
  static getNoLootTemplate({ playerName, npcName }) {
    try {
      return `${playerName} found nothing to loot from ${npcName}.`;
    } catch (error) {
      this.logger.error('Error getting no loot template:', error);
    }
  }
  // Get a template message for being unable to loot an Npc
  static getCannotLootNpcTemplate({ playerName, npcName }) {
    try {
      return `${playerName} cannot loot ${npcName} as they are not unconscious or dead.`;
    } catch (error) {
      this.logger.error('Error getting cannot loot Npc template:', error);
    }
  }
  // Get a template message for no Npc to loot
  static getNoNpcToLootTemplate({ playerName, target }) {
    try {
      return `${playerName} doesn't see ${target} here to loot.`;
    } catch (error) {
      this.logger.error('Error getting no Npc to loot template:', error);
    }
  }
  // Get a template message for no Npcs to loot
  static getNoNpcsToLootTemplate({ playerName }) {
    try {
      return `${playerName} doesn't see any Npcs to loot here.`;
    } catch (error) {
      this.logger.error('Error getting no Npcs to loot template:', error);
    }
  }
  // Get a template message for finding nothing to loot from any Npcs
  static getNothingToLootFromNpcsTemplate({ playerName }) {
    try {
      return `${playerName} found nothing to loot from any Npcs here.`;
    } catch (error) {
      this.logger.error('Error getting nothing to loot from Npcs template:', error);
    }
  }
  // Get a template message for looting all Npcs
  static getLootedAllNpcsTemplate({ playerName, lootedNpcs, lootedItems }) {
    try {
      return `${playerName} looted ${[...lootedNpcs].join(', ')} and found: ${[...lootedItems].join(', ')}.`;
    } catch (error) {
      this.logger.error('Error getting looted all Npcs template:', error);
    }
  }
  // Notify a player that they have no items to drop
  static async notifyNoItemsToDrop({ player, type, itemType }) {
    try {
      return await this.notify(player, `${player.getName()} has no ${type === 'specific' ? itemType + ' ' : ''}items to drop.`, 'errorMessage');
    } catch (error) {
      this.logger.error('Error notifying no items to drop:', error);
    }
  }
  // Notify a player about items they dropped
  static async notifyItemsDropped({ player, items }) {
    const itemNames = items.map(item => item.name).join(', ');
    return await this.notify(player, `${player.getName()} dropped: ${itemNames}.`, 'dropMessage');
  }
  // Notify a player about items they took
  static async notifyItemsTaken({ player, items }) {
    const itemNames = items.map(item => item.name).join(', ');
    return await this.notify(player, `${player.getName()} took: ${itemNames}.`, 'takeMessage');
  }
  // Notify a player that there are no items here
  static async notifyNoItemsHere({ player }) {
    try {
      return await this.notify(player, `There are no items here.`, 'errorMessage');
    } catch (error) {
      this.logger.error('Error notifying no items here:', error);
    }
  }
  // Notify a player about items taken from a container
  static async notifyItemsTakenFromContainer({ player, items, containerName }) {
    try {
      return await this.notify(player, `${player.getName()} took ${[...items].map(item => item.name).join(', ')} from ${containerName}.`, 'takeMessage');
    } catch (error) {
      this.logger.error('Error notifying items taken from container:', error);
    }
  }
  // Notify a player that there are no specific items in a container
  static async notifyNoSpecificItemsInContainer({ player, itemType, containerName }) {
    try {
      return await this.notify(player, `There are no ${itemType} items in ${containerName}.`, 'errorMessage');
    } catch (error) {
      this.logger.error('Error notifying no specific items in container:', error);
    }
  }
  // Notify a player that there is no item in a container
  static async notifyNoItemInContainer({ player, itemName, containerName }) {
    try {
      return await this.notify(player, `There is no ${itemName} in ${containerName}.`, 'errorMessage');
    } catch (error) {
      this.logger.error('Error notifying no item in container:', error);
    }
  }
  // Notify a player that there is no item here
  static async notifyNoItemHere({ player, itemName }) {
    try {
      return await this.notify(player, `There is no ${itemName} here.`, 'errorMessage');
    } catch (error) {
      this.logger.error('Error notifying no item here:', error);
    }
  }
  // Notify a player that they don't have a specific container
  static async notifyNoContainer({ player, containerName }) {
    try {
      return await this.notify(player, `${player.getName()} doesn't have a ${containerName}.`, 'errorMessage');
    } catch (error) {
      this.logger.error('Error notifying no container:', error);
    }
  }
  // Notify a player that an item is not in their inventory
  static async notifyItemNotInInventory({ player, itemName }) {
    try {
      return await this.notify(player, `${player.getName()} doesn't have a ${itemName} in their inventory.`, 'errorMessage');
    } catch (error) {
      this.logger.error('Error notifying item not in inventory:', error);
    }
  }
  // Notify a player that they put an item in a container
  static async notifyItemPutInContainer({ player, itemName, containerName }) {
    try {
      return await this.notify(player, `${player.getName()} put ${itemName} in ${containerName}.`, 'putMessage');
    } catch (error) {
      this.logger.error('Error notifying item put in container:', error);
    }
  }
  // Notify a player that they have no items to put in a container
  static async notifyNoItemsToPut({ player, containerName }) {
    try {
      return await this.notify(player, `${player.getName()} has no items to put in ${containerName}.`, 'errorMessage');
    } catch (error) {
      this.logger.error('Error notifying no items to put:', error);
    }
  }
  // Notify a player about items put in a container
  static async notifyItemsPutInContainer({ player, items, containerName }) {
    try {
      return await this.notify(player, `${player.getName()} put ${[...items].map(item => item.name).join(', ')} in ${containerName}.`, 'putMessage');
    } catch (error) {
      this.logger.error('Error notifying items put in container:', error);
    }
  }
  // Notify a player that they have no specific items to put in a container
  static async notifyNoSpecificItemsToPut({ player, itemType, containerName }) {
    try {
      return await this.notify(player, `${player.getName()} has no ${itemType} items to put in ${containerName}.`, 'errorMessage');
    } catch (error) {
      this.logger.error('Error notifying no specific items to put:', error);
    }
  }
  // Notify a player that there are no specific items here
  static async notifyNoSpecificItemsHere({ player, itemType }) {
    try {
      return await this.notify(player, `There are no ${itemType} items here.`, 'errorMessage');
    } catch (error) {
      this.logger.error('Error notifying no specific items here:', error);
    }
  }
  // Get a template message for auto-looting items from an Npc
  static getAutoLootTemplate({ playerName, npcName, lootedItems }) {
    try {
      return `${playerName} auto-looted ${[...lootedItems].map(item => item.name).join(', ')} from ${npcName}.`;
    } catch (error) {
      this.logger.error('Error getting auto-loot template:', error);
    }
  }
  // Notify a player about the result of a combat
  static async notifyCombatResult(player, result) {
    try {
      player.server.messageManager.sendMessage(player, result, 'combatMessage');
    } catch (error) {
      this.logger.error('Error notifying combat result:', error);
    }
  }
  // Notify a player about the start of a combat
  static async notifyCombatStart(player, npc) {
    try {
      player.server.messageManager.sendMessage(player, `You engage in combat with ${npc.getName()}!`, 'combatMessage');
    } catch (error) {
      this.logger.error('Error notifying combat start:', error);
    }
  }
  // Notify a player about the end of a combat
  static async notifyCombatEnd(player) {
    try {
      player.server.messageManager.sendMessage(player, `Combat has ended.`, 'combatMessage');
    } catch (error) {
      this.logger.error('Error notifying combat end:', error);
    }
  }
  // Send a message to a player
  static async sendMessage(player, messageData, type) {
    if (typeof messageData === 'string') {
      await this.notify(player, messageData, type);
    } else {
      const sendMessagePart = async ([key, value]) => {
        if (typeof value === 'string') {
          await this.notify(player, value, key);
        } else if (Array.isArray(value)) {
          await Promise.all(value.map(item => this.notify(player, item.text, item.cssid)));
        } else if (typeof value === 'object') {
          await this.notify(player, value.text, value.cssid);
        }
      };
      await Promise.all(Object.entries(messageData).map(sendMessagePart));
    }
  }
  // Notify a player about currency changes
  static async notifyCurrencyChange(player, amount, isAddition) {
    try {
      const action = isAddition ? 'gained' : 'spent';
      return await this.notify(player, `You ${action} ${Math.abs(amount)} coins.`, 'currencyChange');
    } catch (error) {
      this.logger.error('Error notifying currency change:', error);
    }
  }
  // Notify a player about experience gain
  static async notifyExperienceGain(player, amount) {
    try {
      return await this.notify(player, `You gained ${amount} experience points.`, 'experienceGain');
    } catch (error) {
      this.logger.error('Error notifying experience gain:', error);
    }
  }
  static async notifyLeavingLocation(entity, oldLocationId, newLocationId) {
    try {
      const oldLocation = await entity.server.gameManager.getLocation(oldLocationId);
      const newLocation = await entity.server.gameManager.getLocation(newLocationId);
      const direction = DirectionManager.getDirectionTo(newLocationId);
      if (entity instanceof Player) {
        await this.notifyPlayersInLocation(oldLocation,
          `${entity.getName()} leaves ${direction}.`,
          'playerMovement'
        );
        await this.notify(entity,
          `You leave ${oldLocation.getName()} and move ${direction} to ${newLocation.getName()}.`,
          'playerMovement'
        );
      } else if (entity instanceof Npc) {
        await this.notifyPlayersInLocation(oldLocation,
          `${entity.name} leaves ${direction}.`,
          'npcMovement'
        );
      }
    } catch (error) {
      this.logger.error('Error notifying leaving location:', error);
    }
  }
  static cleanup() {
    MessageManager.instance = null;
    MessageManager.logger = null;
    MessageManager.socket = null;
    console.log('MessageManager cleaned up');
  }
}
/**************************************************************************************************
Start Server Code
***************************************************************************************************/
const serverInitializer = ServerInitializer.getInstance({ config: CONFIG });
serverInitializer.initialize().catch(error => {
  console.error("Failed to initialize server:", error);
});
