/**************************************************************************************************
Import Dependencies
***************************************************************************************************/
import { promises as fs } from 'fs';
import path from 'path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
// @ todo: implement queue
import Queue from 'queue';
import http from 'http';
import https from 'https';
import { exit } from 'process';
import CONFIG from './config.js';
// @ todo: implement bcrypt
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
  flow() {}
  info() {}
  warn() {}
  error() {}
}
/**************************************************************************************************
Event Emitter Interface Class
The ISocketEventEmitter class defines an abstract interface for event emission and handling within the game
system. It outlines methods for registering listeners, emitting events, and removing listeners
without specifying the underlying implementation. This abstraction allows for flexible
implementation of event handling strategies across different parts of the application.
Key features:
1. Abstract method definitions for event emission and handling
2. Standardized interface for event management
3. Separation of concerns between event emission and handling
By providing a common interface, ISocketEventEmitter ensures that event handling can be consistently
implemented and easily modified or extended across the entire game system.
***************************************************************************************************/

class ISocketEventEmitter {
  on() {}
  emit() {}
  off() {}
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
  constructor(config) {
    if (Logger.instance) {
      return Logger.instance;
    }
    super();
    this.CONFIG = config;
    this.logLevel = config.LOG_LEVEL;
    this.logLevels = {
      'DEBUG': 0,
      'FLOW': 1,
      'INFO': 1,
      'WARN': 2,
      '- ERROR': 4
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
        case 'FLOW':
          coloredMessage = `${this.CONFIG.BLUE}${message}${this.CONFIG.RESET}`;
          break;
        case 'WARN':
          coloredMessage = `${this.CONFIG.MAGENTA}${message}${this.CONFIG.RESET}`;
          break;
        case '- ERROR':
          coloredMessage = `${this.CONFIG.RED}${message}${this.CONFIG.RESET}`;
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
  error(message) {
    this.log('- ERROR', message);
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
  constructor({ logger }) {
    if (ConfigManager.instance) {
      return ConfigManager.instance;
    }
    this.logger = logger;
    ConfigManager.instance = this;
  }
  static getInstance({ logger }) {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager({ logger });
    }
    return ConfigManager.instance;
  }
  async loadConfig() {
    try {
      const { HOST, PORT, SSL_CERT_PATH, SSL_KEY_PATH, LOG_LEVEL, LOCATIONS_DATA_PATH, NPCS_DATA_PATH, ITEMS_DATA_PATH, TICK_RATE, NPC_MOVEMENT_INTERVAL, WORLD_EVENT_INTERVAL } = CONFIG;
      // Validate required configuration values
      const requiredConfigs = { HOST, PORT, LOG_LEVEL, LOCATIONS_DATA_PATH, NPCS_DATA_PATH, ITEMS_DATA_PATH, TICK_RATE, NPC_MOVEMENT_INTERVAL, WORLD_EVENT_INTERVAL };
      for (const [key, value] of Object.entries(requiredConfigs)) {
        if (value === undefined || value === null) {
          this.logger.error(`- ERROR: Missing Required Configuration: ${key}`);
          return false;
        }
      }
      // Validate SSL configuration
      if ((SSL_CERT_PATH && !SSL_KEY_PATH) || (!SSL_CERT_PATH && SSL_KEY_PATH)) {
        this.logger.warn('- WARNING: Both SSL_CERT_PATH and SSL_KEY_PATH must be provided for SSL configuration');
        return false;
      }
      ConfigManager.config = { HOST, PORT, SSL_CERT_PATH, SSL_KEY_PATH, LOG_LEVEL, LOCATIONS_DATA_PATH, NPCS_DATA_PATH, ITEMS_DATA_PATH, TICK_RATE, NPC_MOVEMENT_INTERVAL, WORLD_EVENT_INTERVAL };
      return true;
    } catch (error) {
      this.logger.error(`- ERROR: Failed To Load Configuration: ${error.message}`);
      return false;
    }
  }
  get(key) {
    return ConfigManager.config[key];
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
    this.itemManager = new ItemManager({ logger, configManager });
    Server.instance = this;
  }
  static getInstance({ logger, configManager }) {
    if (!Server.instance) {
      Server.instance = new Server({ logger, configManager });
    }
    return Server.instance;
  }
  async init() {
    try {
      await this.configManager.loadConfig();
      this.socketEventManager = new SocketEventManager({ server: this, logger: this.logger });
      this.serverConfigurator = new ServerConfigurator({
        server: this,
        logger: this.logger,
        socketEventManager: this.socketEventManager,
        config: this.configManager
      });
      await this.serverConfigurator.configureServer();
      this.SocketEventEmitter.on('playerConnected', this.handlePlayerConnected.bind(this));
      this.gameManager = new GameManager({ SocketEventEmitter: this.SocketEventEmitter, logger: this.logger, server: this });
      this.gameComponentInitializer = new GameComponentInitializer({ server: this, logger: this.logger });
      await this.gameComponentInitializer.setupGameComponents();
      if (this.gameManager) {
        this.gameManager.startGame();
      } else {
        this.logger.error('- ERROR: GameManager Not Initialized. Check GameManager Initialization In Server.init()');
      }
    } catch (error) {
      this.logger.error(`- ERROR: Initializing Server: ${error.message}`);
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
      this.logger.info(`- Configuring Server using ${this.isHttps ? 'https' : 'http'}://${this.configManager.get('HOST')}:${this.configManager.get('PORT')}`);
      return this.server;
    } catch (error) {
      this.logger.error(`- ERROR: During Http Server Configuration: ${error.message}`, { error });
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
        this.logger.error('- ERROR: Both SSL_CERT_PATH & SSL_KEY_PATH Must Be Provided For SSL Configuration');
      }
    } catch (error) {
      this.logger.warn(`- WARNING: Failed To Load SSL Options: ${error.message}`, { error });
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
    if (this.isGameRunning()) {
      this.logger.debug('- Game Is Already Running.');
      return;
    }
    try {
      this.gameManager.startGameLoop();
      this.isRunning = true;
      this.logServerRunningMessage();
    } catch (error) {
      this.logger.error(`- ERROR: Starting Game Manager: ${error.message}`);
    }
  }
  logServerRunningMessage() {
    const protocol = this.isHttps ? 'https' : 'http';
    const host = this.configManager.get('HOST');
    const port = this.configManager.get('PORT');
    this.logger.debug(``);
    this.logger.info(`SERVER IS RUNNING AT: ${protocol}://${host}:${port}`);
  }
  isGameRunning() {
    return this.isRunning;
  }
  processTasks() {
    this.queueManager.processQueue();
  }
  addTask(task) {
    this.queueManager.enqueue(task);
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
  constructor({ config }) {
    if (ServerInitializer.instance) {
      return ServerInitializer.instance;
    }
    const { LOG_LEVEL, ORANGE, MAGENTA, RED, RESET } = config;
    this.logger = new Logger({ LOG_LEVEL, ORANGE, MAGENTA, RED, RESET });
    this.configManager = ConfigManager.getInstance({ logger: this.logger }); // Pass the logger here
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
      await this.server.init();
    } catch (error) {
      this.logger.error(`- ERROR: Initializing Server: ${error.message}`);
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
3. Socket.IO integration for real-time communication
4. Error handling middleware setup
5. Queue manager initialization for task management
The ServerConfigurator plays a crucial role in establishing the server's infrastructure,
enabling secure and efficient communication between clients and the game server.
***************************************************************************************************/
class ServerConfigurator extends IBaseManager {
  constructor({ logger, config, server, socketEventManager }) {
    super({ server, logger });
    this.config = config;
    this.socketEventManager = socketEventManager;
    this.server.app = null;
  }
  async configureServer() {
    const { logger, server } = this;
    logger.info(``);
    logger.info(`STARTING SERVER CONFIGURATION:`);
    logger.info(`- Configuring Express`);
    try {
      await this.setupExpress();
    } catch (error) {
      logger.error(`- ERROR: During Express Configuration: ${error.message}`, { error });
      logger.error(error.stack);
    }
    logger.info(`- Configuring Server`);
    try {
      await server.setupHttpServer();
    } catch (error) {
      logger.error(`- ERROR: During Http Server Configuration: ${error.message}`, { error });
    }
    logger.info(`- Configuring Middleware`);
    try {
      this.configureMiddleware();
    } catch (error) {
      logger.error(`- ERROR: During Middleware Configuration: ${error.message}`, { error });
      logger.error(error.stack);
    }
    logger.info('- Configuring Queue Manager');
    try {
      server.queueManager = new QueueManager();
    } catch (error) {
      logger.error(`- ERROR: During Queue Manager Configuration: ${error.message}`, { error });
    }
    logger.info(`SERVER CONFIGURATION FINISHED.`);
  }
  async setupExpress() {
    this.server.app = express();
  }
  configureMiddleware() {
    this.server.app.use(express.static('public'));
    this.server.app.use((err, res ) => {
      this.logger.error(err.message, { error: err });
      res.status(500).send('An Unexpected Error Occurred. Please Try Again Later.');
    });
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
  constructor({ logger, server, gameCommandManager }) {
    super({ server, logger });
    this.io = null;
    this.gameCommandManager = gameCommandManager;
  }
  initializeSocketEvents() {
    this.io = new SocketIOServer(this.server.httpServer);
    this.io.on('connection', (socket) => {
      this.logger.info(`New client connected: ${socket.id}`);
      // Set up event listeners for this socket
      this.setupSocketListeners(socket);
    });
  }
  setupSocketListeners(socket) {
    socket.on('playerAction', (data) => {
      const { actionType, payload } = data;
      this.gameCommandManager.handleCommand(socket, actionType, payload);
    });
    socket.on('disconnect', () => this.handleDisconnect(socket));
    // Add more event listeners as needed
  }
  handlePlayerAction(socket, data) {
    // Process the player action and update game state
    // Emit updates to relevant clients
  }
  handleDisconnect(socket) {
    this.logger.info(`Client disconnected: ${socket.id}`);
    // Clean up any necessary game state
  }
}
/**************************************************************************************************
SocketEvent Emitter Class
The SocketEventEmitter class provides a robust implementation of the publish-subscribe pattern,
facilitating event-driven communication within the game system. It allows components to register
listeners for specific events and emit events to trigger those listeners. This class serves as
a cornerstone for decoupled, event-based interactions between various parts of the game.
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
    this.events = {};
  }
  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
  }
  emit(event, ...args) {
    if (this.events[event]) this.events[event].forEach(listener => listener(...args));
  }
  off(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
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
  constructor() {
    this.queue = [];
    this.runningTasks = new Set();
    this.maxConcurrentTasks = 5;
  }
  enqueue(task) {
    this.queue.push(task);
    this.processQueue();
  }
  dequeue() {
    return this.queue.shift();
  }
  async processQueue() {
    while (this.queue.length > 0 && this.runningTasks.size < this.maxConcurrentTasks) {
      const task = this.dequeue();
      this.runningTasks.add(task);
      try {
        await task.run();
        task.onComplete();
      } catch (error) {
        task.onError(error);
      } finally {
        this.runningTasks.delete(task);
      }
    }
  }
  cleanup() {
    this.queue = [];
    this.runningTasks.clear();
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
  constructor({ name, execute }) {
    this.name = name;
    this.execute = execute;
    this.status = 'pending';
  }
  async run() {
    this.status = 'running';
    try {
      await this.execute();
      this.status = 'completed';
    } catch (error) {
      this.status = 'failed';
      this.logger.error(`- ERROR: Task Execution Failed: ${error.message}`);
    }
  }
  cancel() {
    if (this.status === 'pending') {
      this.status = 'canceled';
    }
  }
  onComplete(callback) {
    this.completeCallback = callback;
  }
  onError(callback) {
    this.errorCallback = callback;
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
    try {
      await this.server.messageManager.sendMessage(message.recipient, message.content, message.type);
    } catch (error) {
      this.server.logger.error(`- ERROR: Processing Message: ${error.message}`);
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
1. Loading and saving game data (locations, NPCs, items)
2. File system interactions for data persistence
3. Data validation and error handling during loading and saving operations
4. Management of data paths and configuration settings
The DatabaseManager is essential for maintaining the integrity of game data and ensuring
consistent access to game state information.
***************************************************************************************************/
class DatabaseManager extends IDatabaseManager {
  constructor({ logger, server }) {
    super({ logger, server });
    this.configManager = server.configManager;
    this.DATA_PATHS = {
      LOCATIONS: this.configManager.get('LOCATIONS_DATA_PATH'),
      NPCS: this.configManager.get('NPCS_DATA_PATH'),
      ITEMS: this.configManager.get('ITEMS_DATA_PATH')
    };
  }
  async initialize() {
    for (const [key, path] of Object.entries(this.DATA_PATHS)) {
      if (!path) {
        this.logger.error(`- ERROR: ${key}_DATA_PATH Is Not Defined In The Configuration`);
      }
    }
  }
  async loadLocationData() {
    const locationDataPath = this.DATA_PATHS.LOCATIONS;
    if (!locationDataPath) {
      this.logger.error('- ERROR: LOCATIONS_DATA_PATH Is Not Defined In The Configuration');
      return;
    }
    try {
      this.logger.info('');
      this.logger.info('STARTING LOAD GAME DATA:');
      this.logger.info('- Starting Load Locations');
      this.logger.debug(`- Loading Locations Data From: ${locationDataPath}`);
      const allLocationData = await this.loadData(locationDataPath, 'locations');
      return this.validateAndParseLocationData(allLocationData);
    } catch (error) {
      this.logger.error(`- ERROR: Failed To Load Locations Data: ${error.message}`);
    }
  }
  async loadData(folderPath, dataType = 'default') {
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
      this.logger.error(`- ERROR: Loading Data From: ${folderPath} - ${error.message}`);
    }
  }
  customJsonParse(jsonString, duplicateIds, allData, fileName, dataType) {
    const regex = /"(\d+)":\s*(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/g;
    let match;
    while ((match = regex.exec(jsonString)) !== null) {
      const [, id, data] = match;
      if (id in allData) {
        duplicateIds.add(id);
        this.logger.error(`- ERROR: Duplicate ${this.getEntityType(dataType)} Detected - ID: ${id}`);
        this.logger.error(`- Detected In File: ${fileName}`);
      } else {
        try {
          allData[id] = JSON.parse(data);
        } catch (error) {
          this.logger.error(`- ERROR: Parsing ${this.getEntityType(dataType)} Data - ID: ${id} in file ${fileName}: ${error.message}`);
        }
      }
    }
  }
  getEntityType(dataType) {
    switch (dataType) {
      case 'npcs': return 'NPC';
      case 'items': return 'Item';
      default: return 'Location';
    }
  }
  validateAndParseLocationData(data) {
    this.logger.debug('- Validate Locations Data');
    if (typeof data !== 'object' || Array.isArray(data)) {
      this.logger.error('- ERROR: Locations Data Must Be An Object');
      return new Map();
    }
    const locationData = new Map();
    const referencedLocations = new Set();
    for (const [id, location] of Object.entries(data)) {
      this.logger.debug(`- Validate Location - ID: ${id}`);
      //this.logger.debug(`- Locations Data:`);
      //this.logger.debug(`${JSON.stringify(location, null, 2)}`);
      //this.logger.debug(``);
      if (!this.isValidLocation(location)) {
        this.logger.error(`- ERROR: Invalid Locations Object${JSON.stringify(location)}`);
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
        this.logger.error(`- ERROR: Referenced Location Is Missing From Location Data - ID: ${refId} `);
      }
    });
    this.logger.debug(`- Total Locations Validated: ${locationData.size}`);
    return locationData;
  }
  isValidLocation(location) {
    return location && typeof location.name === 'string' && typeof location.description === 'string' &&
           typeof location.exits === 'object' && Array.isArray(location.zone);
  }
  async loadNpcData() {
    const npcDataPath = this.DATA_PATHS.NPCS;
    if (!npcDataPath) {
      this.logger.error('- ERROR: NPCS_DATA_PATH Is Not Defined In The Configuration');
      return;
    }
    try {
      this.logger.info(`- Starting Load Npcs`);
      this.logger.debug(`- Loading Npcs Data From: ${npcDataPath}`);
      const allNpcData = await this.loadData(npcDataPath, 'npcs');
      return this.validateAndParseNpcData(allNpcData);
    } catch (error) {
      this.logger.error(`- ERROR: Failed To Load Npcs Data: ${error.message}`);
    }
  }
  validateAndParseNpcData(data) {
    this.logger.debug('- Validate Npcs Data');
    if (typeof data !== 'object' || Array.isArray(data)) {
      this.logger.error('- ERROR: Npcs Data Must Be An Object');
      return new Map();
    }
    const npcData = new Map();
    for (const [id, npc] of Object.entries(data)) {
      this.logger.debug(`- Validate Npc - ID: ${id}`);
      if (!this.isValidNpc(npc)) {
        this.logger.error(`- ERROR: Invalid Npc Object: ${JSON.stringify(npc)}`);
        continue;
      }
      npcData.set(id, npc);
    }
    this.logger.debug(`- Total Npcs Validated: ${npcData.size}`);
    return npcData;
  }
  isValidNpc(npc) {
    return npc && typeof npc.name === 'string' && typeof npc.sex === 'string' &&
           typeof npc.currHealth === 'number' && typeof npc.maxHealth === 'number' &&
           typeof npc.attackPower === 'number' && typeof npc.csml === 'number' &&
           typeof npc.aggro === 'boolean' && typeof npc.assist === 'boolean' &&
           typeof npc.status === 'string' && typeof npc.currentLocation === 'string' &&
           Array.isArray(npc.aliases) && typeof npc.type === 'string';
  }
  async loadItemData() {
    const itemDataPath = this.DATA_PATHS.ITEMS;
    if (!itemDataPath) {
      this.logger.error('- ERROR: ITEMS_DATA_PATH Is Not Defined In The Configuration');
      return;
    }
    try {
      this.logger.info('- Starting Load Items');
      this.logger.debug(`- Loading Items Data From: ${itemDataPath}`);
      const allItemData = await this.loadData(itemDataPath, 'items');
      return this.validateAndParseItemData(allItemData);
    } catch (error) {
      this.logger.error(`- ERROR: Failed To Load Items Data: ${error.message}`);
    }
  }
  validateAndParseItemData(data) {
    this.logger.debug('- Validate Items Data');
    if (typeof data !== 'object' || Array.isArray(data)) {
      this.logger.error('- ERROR: Items Data Must Be An Object');
      return new Map();
    }
    const itemData = new Map();
    for (const [id, item] of Object.entries(data)) {
      this.logger.debug(`- Validate Item - ID: ${id}`);
      if (!this.isValidItem(item)) {
        this.logger.error(`- ERROR: Invalid Item Object: ${JSON.stringify(item)}`);
        continue;
      }
      itemData.set(id, item);
    }
    this.logger.debug(`- Total Items Validated: ${itemData.size}`);
    return itemData;
  }
  isValidItem(item) {
    return item && typeof item.name === 'string' && typeof item.description === 'string' &&
           Array.isArray(item.aliases) && typeof item.type === 'string';
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
  constructor({ server }) {
    const { configManager, logger } = server;
    this.server = server;
    this.config = configManager.config;
    this.logger = logger;
  }
  async fetchGameData() {
    const { logger, databaseManager } = this.server;
    const DATA_TYPES = { LOCATION: 'Location', NPC: 'Npc', ITEM: 'Item' };
    try {
      // Load location data
      const locationData = await this.loadData(databaseManager.loadLocationData.bind(databaseManager), DATA_TYPES.LOCATION);
      // Assign coordinates to locations
      if (locationData instanceof Map) {
        const locationCoordinateManager = LocationCoordinateManager.getInstance({ logger: this.logger, server: this.server, locationData });
        await locationCoordinateManager.assignCoordinates(locationData);
        this.server.gameManager.locations = locationData;
      } else {
        logger.error(`Invalid Location Data Format: ${JSON.stringify(locationData)}`);
      }
      // Load Npc data
      const npcData = await this.loadData(databaseManager.loadNpcData.bind(databaseManager), DATA_TYPES.NPC);
      if (npcData instanceof Map) {
        this.server.gameManager.npcs = await this.createNpcs(npcData);
      } else {
        logger.error(`Invalid Npc Data Format: ${JSON.stringify(npcData)}`);
      }
      // Load item data
      const itemData = await this.loadData(databaseManager.loadItemData.bind(databaseManager), DATA_TYPES.ITEM);
      if (itemData instanceof Map) {
        this.server.items = await this.createItems(itemData);
      } else {
        logger.error(`Invalid item data format: ${JSON.stringify(itemData)}`);
      }
      logger.info(`LOADING GAME DATA FINISHED.`);
      return [locationData, npcData, itemData];
    } catch (error) {
      logger.error(`Error fetching game data: ${error.message}`);
      logger.error(error.stack);
    }
  }
  async loadData(loadFunction, type) {
    const { logger } = this.server;
    try {
      const data = await loadFunction();
      return data;
    } catch (error) {
      logger.error(`Error loading ${type} data: ${error.message}`);
      logger.error(error.stack);
    }
  }
  async createNpcs(npcData) {
    const npcs = new Map();
    const npcPromises = [];
    this.server.logger.debug(`- Creating Npcs From Data:`);
    for (const [id, npcInfo] of npcData) {
      if (this.server.gameManager.npcIds.has(id)) {
        this.server.logger.error(`- ERROR: Duplicate Npc ID Detected: ${id}`);
        continue;
      }
      this.server.gameManager.npcIds.add(id);
      const npc = this.server.gameManager.createNpc(id, npcInfo);
      if (npc) {
        npcs.set(id, npc);
        this.server.logger.debug(`- - Creating Npc: ${npc.name}`);
        this.server.logger.debug(`- - - ID: ${id}`);
        this.server.logger.debug(`- - - Type: ${npc.type}`);
      }
    }
    return Promise.all(npcPromises).then(() => {
      this.server.logger.debug(`- Total Npcs Created: ${npcs.size}`);
      this.server.logger.debug(``);
      return npcs;
    });
  }
  async createItems(itemData) {
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
  static async generateUid() {
    try {
      const { hash } = await import('bcrypt');
      const uniqueValue = Date.now() + Math.random();
      return hash(uniqueValue.toString(), 5);
    } catch (error) {
      this.logger.error(`- ERROR: Generating UID - ${error.message}`);
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
class GameManager {
  constructor({ SocketEventEmitter, logger, server }) {
    if (GameManager.instance) {
      return GameManager.instance;
    }
    this.players = new Map();
    this.locations = new Map();
    this.npcs = new Map();
    this.mobileNpcs = new Map();
    this.questNpcs = new Map();
    this.SocketEventEmitter = SocketEventEmitter;
    this.logger = logger;
    this.server = server;
    this.gameLoopInterval = null;
    this.gameTime = 0;
    this.isRunning = false;
    this.configManager = server.configManager;
    this.tickRate = this.configManager.get('TICK_RATE');
    this.lastTickTime = Date.now();
    this.tickCount = 0;
    this.items = new Set();
    this.npcMovementManager = new NpcMovementManager({
      gameManager: this,
      logger: logger,
      configManager: server.configManager
    });
    this.npcIds = new Set();
    this.setupEventListeners();
    GameManager.instance = this;
  }
  setupEventListeners() {
    this.SocketEventEmitter.on("tick", this.gameTick.bind(this));
    this.SocketEventEmitter.on("newDay", this.newDayHandler.bind(this));
    this.SocketEventEmitter.on('tick', this.handleTick.bind(this));
  }
  startGame() {
    if (this.isGameRunning()) {
      this.logger.debug('Game Is Already Running');
      return;
    }
    try {
      this.startGameLoop();
      this.logger.debug('');
      this.logger.debug('- Initializing Mobile Movement');
      this.npcMovementManager.startMovement();
      this.isRunning = true;
      this.logServerRunningMessage();
    } catch (error) {
      this.logger.error(`- ERROR: Starting Game: ${error.message}`);
    }
  }
  logServerRunningMessage() {
    const { isHttps } = this.server;
    const protocol = isHttps ? 'https' : 'http';
    const host = this.configManager.get('HOST');
    const port = this.configManager.get('PORT');
    this.logger.debug(``);
    this.logger.info(`SERVER IS RUNNING AT: ${protocol}://${host}:${port}`);
    this.logger.debug(``);
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
      this.logger.error(`- ERROR: Shutting Down Game: ${error.message}`);
    }
  }
  async shutdownServer() {
    try {
      await this.server.socketEventManager.server.io.close();
      this.logger.info('All socket connections closed.');
      exit(0);
    } catch (error) {
      this.logger.error(`- ERROR: Shutting Down Server: ${error.message}`, { error });
    }
  }
  startGameLoop() {
    const TICK_RATE = this.configManager.get('TICK_RATE');
    this.gameLoopInterval = setInterval(() => {
      try {
        this.SocketEventEmitter.emit('tick');
      } catch (error) {
        this.logger.error(`- ERROR: Game Tick: ${error.message}`);
      }
    }, TICK_RATE);
  }
  stopGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }
  handleTick() {
    this.gameTick();
    this.sendTickMessageToClients();
  }
  gameTick() {
    const currentTime = Date.now();
    this.tickCount++;
    if (currentTime - this.lastTickTime >= this.tickRate) {
      this.lastTickTime = currentTime;
      this.tickCount = 0;
    }
  }
  sendTickMessageToClients() {
 // @ todo: implement tick
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
  moveEntity(entity, newLocationId) {
    const oldLocationId = entity.currentLocation;
    const oldLocation = this.getLocation(oldLocationId);
    const newLocation = this.getLocation(newLocationId);
    if (oldLocation) {
      this.notifyLeavingLocation(entity, oldLocationId, newLocationId);
      if (entity instanceof Npc) {
        oldLocation.npcs.delete(entity.id);
      } else if (entity instanceof Player) {
        oldLocation.removePlayer(entity);
      }
    }
    entity.currentLocation = newLocationId;
    if (newLocation) {
      this.notifyEnteringLocation(entity, oldLocationId, newLocationId);
      if (entity instanceof Npc) {
        newLocation.npcs.add(entity.id);
      } else if (entity instanceof Player) {
        newLocation.addPlayer(entity);
      }
    }
  }
  notifyLeavingLocation(entity, oldLocationId, newLocationId) {
    MessageManager.notifyLeavingLocation(entity, oldLocationId, newLocationId);
    const direction = DirectionManager.getDirectionTo(newLocationId);
    MessageManager.notify(entity, `${entity.getName()} travels ${direction}.`);
  }
  notifyEnteringLocation(entity, oldLocationId, newLocationId) {
    const newLocation = this.getLocation(newLocationId);
    if (newLocation) {
      newLocation.addEntity(entity, "players");
      MessageManager.notifyEnteringLocation(entity, newLocationId);
      const direction = DirectionManager.getDirectionFrom(oldLocationId);
      MessageManager.notify(entity, `${entity.getName()} arrives ${direction}.`);
    } else {
      this.logger.debug(`- Cannot Notify Entering - Location: ${newLocationId} - Not Found.`);
    }
  }
  updateNpcs() {
    this.npcs.forEach(npc => {
      if (npc.hasChangedState()) {
        MessageManager.notifyNpcStateChange(npc);
      }
    });
  }
  updatePlayerAffects() {
    this.players.forEach(player => {
      if (player.hasChangedState()) {
        player.checkAndRemoveExpiredAffects();
  }
    });
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
      this.logger.info(`Player ${uid} Disconnected.`);
    } else {
      this.logger.debug(`- Player: ${uid} - Not Found For Disconnection.`);
    }
  }
  createNpc(id, npcData) {
    try {
      const { name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, type } = npcData;
      let npc;
      if (type === 'mobile') {
        npc = new MobileNpc({
          id,
          name,
          sex,
          currHealth,
          maxHealth,
          attackPower,
          csml,
          aggro,
          assist,
          status,
          currentLocation,
          zones: npcData.zones || [],
          aliases,
          config: this.server.configManager,
          server: this.server
        });
        this.mobileNpcs.set(id, npc);
      } else if (type === 'quest') {
        npc = new QuestNpc({
          id,
          name,
          sex,
          currHealth,
          maxHealth,
          attackPower,
          csml,
          aggro,
          assist,
          status,
          currentLocation,
          questId: npcData.questId,
          zones: npcData.zones || [],
          aliases,
          server: this.server
        });
        this.questNpcs.set(id, npc);
      } else {
        npc = new Npc({
          id,
          name,
          sex,
          currHealth,
          maxHealth,
          attackPower,
          csml,
          aggro,
          assist,
          status,
          currentLocation,
          aliases,
          type,
          server: this.server
        });
      }
      this.npcs.set(id, npc);
      return npc;
    } catch (error) {
      this.logger.error(`- ERROR: Creating Npc With ID ${id}: ${error.message}`, { error });
      return null;
    }
  }
  getNpc(npcId) {
    return this.npcs.get(npcId);
  }
  getLocation(locationId) {
    const location = this.locations.get(locationId);
    if (!location) {
      this.logger.error(`- ERROR: Location Not Found - ID : ${locationId}`);
      return null;
    }
    return location;
  }
  handlePlayerAction(action) {
    const task = new TaskManager({ name: 'PlayerAction', execute: () => {
      // Logic for handling player action
      this.logger.debug(`- Handling Action: ${action}`);
    }});
    this.server.addTask(task);
  }
  cleanup() {
    this.npcs.clear();
    this.mobileNpcs.clear();
    this.questNpcs.clear();
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
  constructor({ logger, server }) {
    super({ server, logger });
  }
  async setupGameComponents() {
    try {
      await this.initializeDatabaseManager();
      await this.initializeGameManager();
      await this.initializeGameDataLoader();
    } catch (error) {
      this.handleSetupError(error);
    }
  }
  async initializeDatabaseManager() {
    this.server.databaseManager = new DatabaseManager({
      logger: this.server.logger,
      server: this.server
    });
    await this.server.databaseManager.initialize();
  }
  async initializeGameManager() {
    this.server.gameManager = new GameManager({
      SocketEventEmitter: this.server.SocketEventEmitter,
      logger: this.server.logger,
      server: this.server
    });
  }
  async initializeGameDataLoader() {
    this.server.gameDataLoader = new GameDataLoader({ server: this.server });
    await this.server.gameDataLoader.fetchGameData();
  }
  handleSetupError(error) {
    this.logger.error(`- ERROR: Setting Up Game Components: ${error.message}`);
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
    this.name = name; // Ensure name is assigned if needed
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
  constructor({ uid, name, bcrypt, gameCommandManager, server }) {
    super({ name, health: 100 });
    this.uid = uid;
    this.bcrypt = bcrypt;
    this.inventory = new Set();
    this.healthRegenerator = new HealthRegenerator({ player: this });
    this.gameCommandManager = gameCommandManager;
    this.server = server;
    this.configManager = server.configManager;
    this.initializePlayerAttributes();
    this.inventoryManager = new InventoryManager(this);
  }
  initializePlayerAttributes() {
    const INITIAL_HEALTH = this.configManager.get('INITIAL_HEALTH');
    const INITIAL_ATTACK_POWER = this.configManager.get('INITIAL_ATTACK_POWER');
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
  authenticate(password) {
    const isPasswordValid = this.bcrypt.compare(password, this.password);
    if (isPasswordValid) {
      this.resetFailedLoginAttempts();
      return true;
    }
    this.incrementFailedLoginAttempts();
    return false;
  }
  attackNpc(target) {
    this.actions.attackNpc(target);
  }
  incrementFailedLoginAttempts() {
    this.failedLoginAttempts++;
    this.consecutiveFailedAttempts++;
    if (this.consecutiveFailedAttempts >= 3) {
      this.server.messageManager.notifyDisconnectionDueToFailedAttempts(this);
      this.server.gameManager.disconnectPlayer(this.uid);
    }
  }
  showInventory() {
    const inventoryList = this.getInventoryList();
    this.server.messageManager.sendMessage(this, inventoryList, 'inventoryList');
  }
  lootSpecifiedNpc(target) {
    const location = this.server.gameManager.getLocation(this.currentLocation);
    if (!location) return;
    const targetLower = target.toLowerCase();
    const targetEntity = location.entities.find(entity => entity.name.toLowerCase() === targetLower);
    if (targetEntity) {
      this.server.messageManager.sendMessage(this, `${this.getName()} loots ${targetEntity.name}.`, 'lootMessage');
      return;
    }
    this.server.messageManager.sendMessage(this, `${this.getName()} doesn't see ${target} here.`, 'errorMessage');
  }
  moveToLocation(newLocationId) {
    try {
      const { gameManager } = this.server;
      const newLocation = gameManager.getLocation(newLocationId);
      if (newLocation) {
        const oldLocation = gameManager.getLocation(this.currentLocation);
        if (oldLocation) oldLocation.removePlayer(this);
        this.currentLocation = newLocationId;
        newLocation.addPlayer(this);
        const message = `${this.getName()} moved to ${newLocation.getName()}.`;
        this.server.messageManager.sendMessage(this, message, 'movementMessage');
      }
    } catch (error) {
      this.server.logger.error(`- ERROR: Moving to location: ${error.message}`, { error });
      this.server.logger.error(error.stack);
    }
  }
  notifyPlayer(message, type = '') {
    this.server.messageManager.sendMessage(this, message, type);
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
      this.hashedUid = await this.bcrypt.hash(this.uid, 5);
    } catch (error) {
      console.error('Failed to hash UID:', error);
      console.error(error.stack);
    }
  }
  async login(inputPassword) {
    const isAuthenticated = await this.authenticate(inputPassword);
    if (isAuthenticated) {
      this.server.messageManager.notifyLoginSuccess(this);
      return true;
    }
    this.server.messageManager.notifyIncorrectPassword(this);
    return false;
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
  meditate() {
    if (this.status !== "sitting") {
      this.startHealthRegeneration();
      this.server.messageManager.sendMessage(this, `${this.getName()} starts meditating.`, 'meditationMessage');
      return;
    }
    this.status = "meditating";
    this.server.messageManager.sendMessage(this, `${this.getName()} continues meditating.`, 'meditationMessage');
  }
  sleep() {
    this.startHealthRegeneration();
    this.status = "sleeping";
    this.server.messageManager.sendMessage(this, `${this.getName()} lies down and falls asleep.`, 'sleepMessage');
  }
  sit() {
    if (this.status === "sitting") {
      this.server.messageManager.sendMessage(this, `${this.getName()} is already sitting.`, 'sittingMessage');
      return;
    }
    if (this.status === "standing") {
      this.startHealthRegeneration();
      this.status = "sitting";
      this.server.messageManager.sendMessage(this, `${this.getName()} sits down.`, 'sittingMessage');
      return;
    }
    this.server.messageManager.sendMessage(this, `${this.getName()} stops meditating and stands up.`, 'standingMessage');
  }
  stand() {
    if (this.status === "lying unconscious") {
      this.status = "standing";
      this.server.messageManager.sendMessage(this, `${this.getName()} stands up.`, 'standingMessage');
    } else {
      this.server.messageManager.sendMessage(this, `${this.getName()} is already standing.`, 'standingMessage');
    }
  }
  wake() {
    if (this.status === "lying unconscious") {
      this.status = "standing";
      this.server.messageManager.sendMessage(this, `${this.getName()} stands up.`, 'standingMessage');
      return;
    }
    if (this.status === "sleeping") {
      this.status = "standing";
      this.server.messageManager.sendMessage(this, `${this.getName()} wakes up.`, 'wakeMessage');
      return;
    }
    this.server.messageManager.sendMessage(this, `${this.getName()} is already awake.`, 'wakeMessage');
  }
  autoLootToggle() {
    this.autoLoot = !this.autoLoot;
    this.server.messageManager.sendMessage(this, `${this.getName()} auto-loot is now ${this.autoLoot ? 'enabled' : 'disabled'}.`, 'autoLootMessage');
  }
  lookIn(containerName) {
    const { gameManager, items } = this.server;
    const location = gameManager.getLocation(this.currentLocation);
    if (!location) return;
    const containerId = this.getContainerId(containerName) || this.findEntity(containerName, location.items, 'item');
    if (!containerId) {
      this.server.messageManager.sendMessage(this, `${this.getName()} doesn't see ${containerName} here.`, 'errorMessage');
      return;
    }
    const container = items[containerId];
    if (container instanceof ContainerItem) {
      const itemsInContainer = container.inventory.map(itemId => items[itemId].name);
      this.server.messageManager.sendMessage(this, `Inside ${container.name}: ${itemsInContainer.join(', ')}.`, 'lookInContainerMessage');
    } else {
      this.server.messageManager.sendMessage(this, `${container.name} is not a container.`, 'errorMessage');
    }
  }
  hasChangedState() {
    const hasChanged = this.health !== this.previousState.health || this.status !== this.previousState.status;
    if (hasChanged) {
      this.previousState = { health: this.health, status: this.status };
    }
    return hasChanged;
  }
  getInventoryList() {
    return Array.from(this.inventory).map(item => item.name).join(", ");
  }
  describeCurrentLocation() {
    new DescribeLocationManager(this).describe();
  }
  LookAtCommandHandler(target) {
    new LookAtCommandHandler({ player: this }).look(target);
  }
  addWeapon(weapon) {
    if (weapon instanceof WeaponItem) {
      this.weapons.add(weapon);
      this.server.messageManager.notifyPickupItem(this, weapon.name);
    }
  }
  removeWeapon(weapon) {
    this.weapons.delete(weapon);
  }
  static async createNewPlayer({ name, age }) {
    return new CreateNewPlayer({ name, age });
  }
  performAction(actionType, payload) {
    this.gameCommandManager.handleCommand(this.socket, actionType, payload);
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
  constructor({ server }) {
    this.server = server; // Injecting the server instance
  }
  handleCommand(socket, actionType, payload) {
    const handler = this.commandHandlers[actionType] || this.commandHandlers.simpleAction;
    handler.execute(socket, payload);
  }
}
/**************************************************************************************************
Move Command Handler Class
The MoveCommandHandler class is responsible for handling player movement commands. It processes
the direction input from the player and updates the player's position accordingly.
Key features:
1. Command execution for player movement
2. Integration with game state for location updates
3. Error handling for invalid movement inputs
This class ensures that player movement is processed correctly, maintaining the game's spatial
integrity and player experience.
***************************************************************************************************/
class MoveCommandHandler {
  constructor({ logger }) {
    this.logger = logger;
  }
  execute(socket, { direction }) { // Destructured payload
    this.logger.debug(`- Player ${socket.id} Moved ${direction}`);
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
    this.server = player.server; // Add this line to access the server
  }
  look(target) {
    const { currentLocation } = this.player; // Change this line
    const location = this.server.gameManager.getLocation(currentLocation);
    if (!location) return;
    const targetLower = target.toLowerCase();
    const playerNameLower = this.player.getName().toLowerCase(); // Change this line
    if (this.isSelfLook(targetLower, playerNameLower)) {
      this.lookAtSelfCommandHandler();
      return;
    }
    const lookTargets = [
      { check: () => this.player.inventory.find(item => item.aliases.includes(targetLower)), notify: this.server.messageManager.notifyLookAtCommandHandlerItemInInventory },
      { check: () => location.items.find(item => item.aliases.includes(targetLower)), notify: this.server.messageManager.notifyLookAtCommandHandlerItemInLocation },
      { check: () => this.findNpc(location, targetLower), notify: this.server.messageManager.notifyLookAtCommandHandlerNpc },
      { check: () => location.playersInLocation.find(p => p.name.toLowerCase() === targetLower), notify: this.server.messageManager.notifyLookAtCommandHandlerOtherPlayer }
    ];
    for (const { check, notify } of lookTargets) {
      const result = check();
      if (result) {
        notify(this.player, result);
        return;
      }
    }
    this.server.messageManager.notifyTargetNotFoundInLocation(this.player, target);
  }
  isSelfLook(targetLower, playerNameLower) {
    return targetLower === 'self' || targetLower === playerNameLower || playerNameLower.startsWith(targetLower);
  }
  findNpc(location, targetLower) {
    const npcId = location.npcs.find(id => {
      const npc = this.server.gameManager.getNpc(id);
      return npc && npc.aliases.includes(targetLower);
    });
    return npcId ? this.server.gameManager.getNpc(npcId) : null;
  }
  lookAtSelfCommandHandler() {
    this.server.messageManager.notifyLookAtSelfCommandHandler(this.player);
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
  constructor({ server }) {
    this.server = server;
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
  }
  initiateCombatWithNpc({ npcId, player, playerInitiated = false }) {
    try {
      this.logger.debug(`- Initiating Combat With - Npc: ${npcId} - For - Player: ${player.getName()}`);
      this.startCombat({ npcId, player, playerInitiated });
    } catch (error) {
      this.logger.error(`- ERROR: Initiating Combat With - Npc: ${npcId} - For - Player: ${player.getName()}:`, error);
    }
  }
  endCombatForPlayer({ player }) {
    this.endCombat(player);
  }
  startCombat({ npcId, player, playerInitiated }) {
    try {
      this.logger.debug(`- Starting Combat Between - Player: ${player.getName()} - And - Npc: ${npcId}`);
      const npc = this.gameManager.getNpc(npcId);
      if (!npc || this.combatOrder.has(npcId)) {
        this.logger.debug(`- Npc: ${npcId} - Not Found Or Already In Combat`);
        return;
      }
      this.combatOrder.set(npcId, { state: 'engaged' });
      player.status !== "in combat"
        ? this.initiateCombat({ player, npc, playerInitiated })
        : this.notifyCombatJoin({ npc, player });
      npc.status = "engaged in combat";
    } catch (error) {
      this.logger.error(`- ERROR: Starting Combat Between - Player: ${player.getName()} - And - Npc: ${npcId}:`, error);
    }
  }
  initiateCombat({ player, npc, playerInitiated }) {
    player.status = "in combat";
    const message = playerInitiated
      ? MessageManager.getCombatInitiationTemplate(player.getName(), npc.getName())
      : MessageManager.getCombatInitiationTemplate(npc.getName(), player.getName());
    this.notifyPlayersInLocation(player.currentLocation, message);
    if (!playerInitiated) {
      player.lastAttacker = npc.id;
      this.combatInitiatedNpcs.add(npc.id);
    }
    this.startCombatLoop(player);
  }
  notifyCombatJoin({ npc, player }) {
    this.notifyPlayersInLocation(player.currentLocation,
      MessageManager.getCombatJoinTemplate(npc.getName())
    );
    this.combatInitiatedNpcs.add(npc.id);
  }
  startCombatLoop(player) {
    if (player.status === "in combat" && !player.combatInterval) {
      player.combatInterval = setInterval(() => {
        if (player.status !== "in combat") {
          this.endCombat(player);
          return;
        }
        const npc = this.getNextNpcInCombatOrder();
        if (npc) {
          const action = this.objectPool.acquire(); // Reuse combat action objects from a pool
          action.perform({ attacker: player, defender: npc });
          this.objectPool.release(action);
          this.notifyHealthStatus(player, npc);
          const result = this.performCombatAction(player, npc, true);
          MessageManager.notifyCombatResult(player, result);
          if (npc.health <= 0) {
            this.handleNpcDefeat(npc, player);
          }
        }
        if (player.health <= 0) {
          this.handlePlayerDefeat(npc, player);
        }
      }, CombatManager.COMBAT_INTERVAL);
    }
  }
  handlePlayerDefeat({ defeatingNpc, player }) {
    player.status = "lying unconscious";
    this.endCombat(player);
    this.logger.info(`${player.getName()} has been defeated by ${defeatingNpc.getName()}.`, { playerId: player.getId(), npcId: defeatingNpc.id });
  }
  handleNpcDefeat(npc, player) {
    npc.status = player.killer ? "lying dead" : "lying unconscious";
    player.status = "standing";
    player.experience += npc.experienceReward;
    const messages = this.generateDefeatMessages(player, npc);
    this.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), messages);
  }
  generateDefeatMessages(player, npc) {
    const messages = [MessageManager.getVictoryTemplate(player.getName(), npc.getName())];
    const levelUpMessage = this.gameManager.checkLevelUp(player);
    if (levelUpMessage) {
      messages.push(levelUpMessage);
      this.logger.info(`${player.getName()} leveled up after defeating ${npc.getName()}.`, {
        playerId: player.getId(),
        npcId: npc.id,
        newLevel: player.level
      });
    }
    if (player.autoLoot) {
      const lootMessage = this.gameManager.autoLootNpc(npc, player);
      if (lootMessage) {
        messages.push(lootMessage);
        this.logger.info(`${player.getName()} auto-looted ${npc.getName()}.`, {
          playerId: player.getId(),
          npcId: npc.id
        });
      }
    }
    this.combatOrder.delete(npc.id);
    this.defeatedNpcs.add(npc.id);
    return messages.join("<br>");
  }
  endCombat(player) {
    if (player.combatInterval) {
      clearInterval(player.combatInterval);
      player.combatInterval = null;
    }
    this.combatOrder.clear();
    this.defeatedNpcs.clear();
    this.combatInitiatedNpcs.clear();
    player.status = "standing";
    this.gameManager.fullStateSync(player);
    this.checkAggressiveNpcs(player);
  }
  checkForAggressiveNpcs(player) {
    if (player.health > 0) {
      const location = this.gameManager.getLocation(player.currentLocation);
      if (location && location.npcs) {
        location.npcs.forEach(npcId => {
          const npc = this.gameManager.getNpc(npcId);
          if (this.isAggressiveNpc(npc, player)) {
            this.startCombat({ npcId, player, playerInitiated: false });
          }
        });
      }
    }
  }
  isAggressiveNpc(npc, player) {
    return npc && npc.aggressive &&
      npc.status !== "lying unconscious" &&
      npc.status !== "lying dead" &&
      player.status !== "lying unconscious" &&
      !this.defeatedNpcs.has(npc.id);
  }
  performCombatAction(attacker, defender, isPlayer) {
    const outcome = this.calculateAttackOutcome(attacker, defender);
    const technique = CombatManager.getRandomElement(CombatManager.TECHNIQUES);
    let damage = attacker.attackPower;
    let resistDamage = defender.defensePower;
    let description = this.getCombatDescription(outcome, attacker, defender, technique);
    if (outcome === "critical success") {
      damage *= 2;
    }
    if (damage > resistDamage) {
      defender.health -= damage - resistDamage;
    }
    return FormatMessageManager.createMessageData(`${isPlayer ? "player" : "npc"}">${description}`);
  }
  getCombatDescription(outcome, attacker, defender, technique) {
    const descriptionFunc = this.outcomeDescriptions.get(outcome) ||
      (({ attacker, defender, technique }) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}.`);
    return FormatMessageManager.createMessageData(descriptionFunc({ attacker, defender, technique }));
  }
  attackNpc({ player, target1 }) {
    const location = player.server.gameManager.getLocation(player.currentLocation);
    if (!location) return;
    const npcId = target1 ? this.getNpcIdFromLocation(target1, location.npcs) : this.getAvailableNpcId(location.npcs);
    if (!npcId) {
      if (target1) {
        player.server.messageManager.sendMessage(player,
          MessageManager.getTargetNotFoundTemplate(player.getName(), target1),
          'errorMessage'
        );
      } else {
        player.server.messageManager.sendMessage(player,
          MessageManager.getNoConsciousEnemiesTemplate(player.getName()),
          'errorMessage'
        );
      }
      return;
    }
    const npc = player.server.gameManager.getNpc(npcId);
    if (!npc) return;
    if (npc.isUnconsciousOrDead()) {
      player.server.messageManager.sendMessage(player,
        MessageManager.getNpcAlreadyInStatusTemplate(npc.getName(), npc.status),
        'errorMessage'
      );
    } else {
      this.startCombat({ npcId, player, playerInitiated: true });
    }
  }
  getAvailableNpcId(npcs) {
    return Array.from(npcs).find(id => {
      const npc = this.gameManager.getNpc(id);
      return npc && !npc.isUnconsciousOrDead();
    });
  }
  getCombatOrder() {
    return this.combatOrder;
  }
  getNextNpcInCombatOrder() {
    return Array.from(this.combatOrder.keys())[0];
  }
  notifyPlayersInLocation(locationId, content) {
    MessageManager.notifyPlayersInLocation(this.gameManager.getLocation(locationId), content);
  }
  notifyHealthStatus(player, npc) {
    const playerHealthPercentage = this.calculateHealthPercentage(player.health, player.maxHealth);
    const npcHealthPercentage = this.calculateHealthPercentage(npc.health, npc.maxHealth);
    const healthMessage = MessageManager.getCombatHealthStatusTemplate(
      player.getName(),
      playerHealthPercentage,
      npc.getName(),
      npcHealthPercentage
    );
    this.server.messageManager.notifyPlayersInLocation(player.currentLocation, healthMessage, 'combatMessageHealth');
  }
  calculateHealthPercentage(currentHealth, maxHealth) {
    return (currentHealth / maxHealth) * 100;
  }
  calculateAttackValue(attacker, defender, roll) {
    if (attacker.level === defender.level) {
      return roll + attacker.csml;
    } else if (attacker.level < defender.level) {
      return (roll + attacker.csml) - (defender.level - attacker.level);
    } else {
      return (roll + attacker.csml) + (attacker.level - defender.level);
    }
  }
  calculateAttackOutcome(attacker, defender) {
    const roll = Math.floor(Math.random() * 20) + 1;
    let value = this.calculateAttackValue(attacker, defender, roll);
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
    return Array.from(array)[Math.floor(Math.random() * array.size)];
  }
}
/**************************************************************************************************
Combat Action Class
The CombatAction class encapsulates the logic for executing combat actions between characters
within the game. It calculates damage, handles combat notifications, and manages the state
of combat interactions. This class serves as a fundamental component of the combat system.
Key features:
1. Damage calculation based on attacker and defender attributes
2. Notification management for combat results
3. Handling of character defeat and status changes
This class plays a critical role in facilitating combat interactions, ensuring that combat
mechanics are executed consistently and effectively.
***************************************************************************************************/
class CombatAction {
  constructor({ logger }) {
    this.logger = logger;
  }
  perform({ attacker, defender }) {
    try {
      const damage = this.calculateDamage(attacker, defender);
      defender.health = Math.max(0, defender.health - damage);
      this.notifyCombatResult(attacker, defender, damage);
      if (defender.health <= 0) {
        this.handleDefeat(defender);
      }
    } catch (error) {
      this.logger.error(`- ERROR: During Combat Action: ${error.message}`, { error });
    }
  }
  calculateDamage(attacker, defender) {
    return Math.max(attacker.attackPower - defender.defensePower, 0);
  }
  notifyCombatResult(attacker, defender, damage) {
    this.logger.info(`${attacker.getName()} attacks ${defender.getName()} for ${damage} damage.`);
  }
  handleDefeat(defender) {
    this.logger.info(`${defender.getName()} has been defeated!`);
    defender.status = "lying unconscious";
    // Additional logic for handling defeat (e.g., removing from game, notifying players)
  }
}
/**************************************************************************************************
Location Class
The Location class is intended to be used with OLC (online creation system).
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
class Location {
  constructor({ name, description }) {
    this.name = name;
    this.description = description;
    this.exits = new Map();
    this.items = new Set();
    this.npcs = new Set();
    this.playersInLocation = new Set();
    this.zone = [];
  }
  addExit(direction, linkedLocation) {
    this.exits.set(direction, linkedLocation);
  }
  addItem(item) {
    this.items.add(item);
  }
  addNpc(npc) {
    this.npcs.add(npc.id);
  }
  addPlayer(player) {
    this.playersInLocation.add(player);
  }
  removePlayer(player) {
    this.playersInLocation.delete(player);
  }
  getDescription() {
    return this.description;
  }
  getName() {
    return this.name;
  }
  getNpcs() {
    return Array.from(this.npcs).map(npcId => this.gameManager.getNpc(npcId));
  }
}
/**************************************************************************************************
Location Coordinate Manager Class
The LocationCoordinateManager class is responsible for managing and assigning coordinates
to game locations, creating a spatial representation of the game world.
Key features:
1. Coordinate assignment algorithms
2. Recursive coordinate calculation
3. Location data validation and processing
4. Logging of coordinate assignment process
This class ensures that each location in the game has a unique set of coordinates, facilitating
spatial relationships between different areas of the game world. It works closely with the
GameDataLoader to process and enhance location data.
***************************************************************************************************/
class LocationCoordinateManager {
  static instance;
  constructor({ logger, server, locationData }) {
    if (LocationCoordinateManager.instance) {
      return LocationCoordinateManager.instance;
    }
    this.server = server;
    this.logger = logger;
    this.locations = new Map();
    this.parsedData = locationData instanceof Map ? locationData : new Map();
    this.checkLocationDataForDuplicateIds(locationData);
    LocationCoordinateManager.instance = this;
  }
  static getInstance({ logger, server, locationData }) {
    if (!LocationCoordinateManager.instance) {
      LocationCoordinateManager.instance = new LocationCoordinateManager({ logger, server, locationData });
    }
    return LocationCoordinateManager.instance;
  }
  checkLocationDataForDuplicateIds(locationData) {
    this.logger.debug(`- Process Location Data`);
    if (!locationData || typeof locationData !== 'object') {
      this.logger.error(`- ERROR: Invalid Or Missing Location Data`);
      return;
    }
    const topLevelKeys = Object.keys(locationData);
    const uniqueKeys = new Set(topLevelKeys);
    if (topLevelKeys.length !== uniqueKeys.size) {
      for (const key of topLevelKeys) {
        if (topLevelKeys.indexOf(key) !== topLevelKeys.lastIndexOf(key)) {
          this.logger.error(`- ERROR: Duplicate Key Detected: ${key}`);
        }
      }
      this.logger.error(`- ERROR: Duplicate Location IDs Detected`);
    } else {
      for (const [id, location] of Object.entries(locationData)) {
        this.locations.set(id, location);
      }
      this.logger.debug(`- Total Locations Processed: ${this.locations.size}`);
    }
  }
  async assignCoordinates(locationData) {
    if (!(locationData instanceof Map)) {
      this.logger.error(`- ERROR: Invalid Location Data Format: Expected Map.`);
      return;
    }
    this.locations = locationData;
    this.logLocationLoadStatus();
    const coordinates = this.initializeCoordinates();
    this._assignCoordinatesRecursively("100", coordinates);
    this.logCoordinateAssignmentStatus(coordinates);
    this._updateLocationsWithCoordinates(coordinates);
  }
  logLocationLoadStatus() {
    this.logger.debug(``);
    this.logger.debug(`- Assign Coordinates:`);
  }
  initializeCoordinates() {
    const coordinates = new Map([["100", { x: 0, y: 0, z: 0 }]]);
    return coordinates;
  }
  logCoordinateAssignmentStatus(coordinates) {
    this.logger.debug(``);
    this.logger.debug(`- Assign Coordinates Recursively:`);
    this.logger.debug(`${JSON.stringify(Array.from(coordinates.entries()))}`);
  }
  _assignCoordinatesRecursively(locationId, coordinates, x = 0, y = 0, z = 0) {
    this.logger.debug(`- Assign Coordinates To Location: ${locationId} - (${x}, ${y}, ${z})`);
    const location = this.locations.get(locationId);
    if (!location) {
      this.logger.error(`- ERROR: Referenced Location Is Missing From Location Data - ID: ${locationId}`);
      return;
    }
    location.coordinates = { x, y, z };
    if (!location.exits) {
      this.logger.debug(`- No Exits Found For Location: ${locationId}`);
      return;
    }
    for (const [direction, exitId] of Object.entries(location.exits)) {
      let newX = x, newY = y, newZ = z;
      switch (direction) {
        case 'north': newY += 1; break;
        case 'south': newY -= 1; break;
        case 'east': newX += 1; break;
        case 'west': newX -= 1; break;
        case 'up': newZ += 1; break;
        case 'down': newZ -= 1; break;
      }
      if (!coordinates.has(exitId)) {
        this.logger.debug(`- Assign Coordinates To Exit: ${exitId} in direction ${direction}`);
        coordinates.set(exitId, { x: newX, y: newY, z: newZ });
        this._assignCoordinatesRecursively(exitId, coordinates, newX, newY, newZ);
      } else {
        this.logger.debug(`- Coordinates Already Assigned To Exit: ${exitId}`);
      }
    }
  }
  _updateLocationsWithCoordinates(coordinates) {
    this.logger.debug(``);
    this.logger.debug('- Update Location Coordinates:');
    for (const [id, coord] of coordinates) {
      const location = this.locations.get(id);
      if (location) {
        location.coordinates = coord;
        this.logger.debug(`- Location ${id} (${location.name}) - Coordinates: x=${coord.x}, y=${coord.y}, z=${coord.z}`);
      } else {
        this.logger.error(`- ERROR: Referenced Location Is Missing From Location Data - ID: 101`);
      }
    }
    this.logger.debug(`- Total Locations Updated: ${coordinates.size}`);
    this.logger.debug(``)
  }
  validateAndParseLocationData(data) {
    if (typeof data !== 'object' || Array.isArray(data)) {
      this.logger.error('- ERROR: Locations Data Must Be An Object');
      return new Map();
    }
    const locationData = new Map();
    for (const [id, location] of Object.entries(data)) {
      if (!this.isValidLocation(location)) {
        this.logger.error(`- ERROR:Invalid Locations Object: ${JSON.stringify(location)}`);
        continue;
      }
      locationData.set(id, location);
    }
    return locationData;
  }
  isValidLocation(location) {
    return (
      typeof location === 'object' &&
      typeof location.name === 'string' &&
      typeof location.description === 'string' &&
      typeof location.exits === 'object' &&
      !Array.isArray(location.exits)
    );
  }
}
/**************************************************************************************************
Describe Location Manager Class
The DescribeLocationManager class is responsible for providing detailed descriptions of
locations within the game world. It formats and sends location information to players,
enhancing their understanding of their surroundings.
Key features:
1. Location description formatting and management
2. Integration with the server's message manager for communication
3. Handling of exits, items, Npcs, and players in the description
This class enhances player immersion by providing rich, contextual information about
the game world, allowing players to engage more deeply with their environment.
***************************************************************************************************/
class DescribeLocationManager {
  constructor({ player, server }) {
    this.player = player;
    this.server = server;
    this.logger = server.logger;
    this.description = {};
  }
  describe() {
    try {
      const location = this.server.gameManager.getLocation(this.player.currentLocation);
      if (!location) {
        this.server.messageManager.sendMessage(this.player,
          MessageManager.getUnknownLocationTemplate(this.player.getName()),
          'errorMessage'
        );
        return;
      }
      this.description = this.formatDescription(location);
      this.server.messageManager.sendMessage(this.player, this.description, 'locationDescription');
    } catch (error) {
      this.logger.error(`- ERROR: Describing Location For - Player: ${this.player.getName()}:`, error);
    }
  }
  formatDescription(location) {
    return {
      title: { cssid: `location-title`, text: location.getName() },
      desc: { cssid: `location-description`, text: location.getDescription() },
      exits: { cssid: `location-exits`, text: 'Exits:' },
      exitsList: this.getExitsDescription(location),
      items: this.getItemsDescription(location),
      npcs: this.getNpcsDescription(location),
      players: this.getPlayersDescription(location),
    };
  }
  getExitsDescription(location) {
    return Array.from(location.exits.entries()).map(([direction, linkedLocation]) => ({
      cssid: `exit-${direction}`,
      text: `${direction.padEnd(6, ' ')} - ${linkedLocation.getName()}`,
    }));
  }
  getItemsDescription(location) {
    return Array.from(location.items).map(item => ({
      cssid: `item-${item.uid}`,
      text: `A ${item.name} is lying here.`,
    }));
  }
  getNpcsDescription(location) {
    return Array.from(location.npcs).map(npcId => {
      const npc = this.server.gameManager.getNpc(npcId);
      return npc ? { cssid: `npc-${npc.id}`, text: `${npc.getName()} is ${npc.status} here.` } : null;
    }).filter(npc => npc);
  }
  getPlayersDescription(location) {
    return Array.from(location.playersInLocation).map(otherPlayer => ({
      cssid: `player`,
      text: `${otherPlayer.getName()} is ${otherPlayer.getStatus()} here.`,
    }));
  }
}
/**************************************************************************************************
Direction Manager Class
The DirectionManager class provides utility methods for managing directional movements
within the game world. It includes mappings for directions and methods for determining
movement directions based on location.
Key features:
1. Direction mappings for movement
2. Utility methods for determining movement direction
This class enhances navigation within the game by providing consistent direction management
for entities and players.
***************************************************************************************************/
class DirectionManager {
  static getDirectionTo(newLocationId) {
    const directionMap = { 'north': 'northward', 'east': 'eastward', 'west': 'westward', 'south': 'southward', 'up': 'upward', 'down': 'downward' };
    return directionMap[newLocationId] || 'unknown direction';
  }
  static getDirectionFrom(oldLocationId) {
    const directionMap = { 'north': 'from the north', 'east': 'from the east', 'west': 'from the west', 'south': 'from the south', 'up': 'from above', 'down': 'from below' };
    return directionMap[oldLocationId] || 'from an unknown direction';
  }
}
/**************************************************************************************************
Npc Class
The Npc class represents non-player characters within the game. It includes properties and
methods specific to Npc behavior, interactions, and state management.
Key features:
1. Properties for managing Npc attributes (health, status, location)
2. Methods for Npc actions and interactions
This class provides a foundation for all Npc types, ensuring that their behavior and
interactions are managed consistently within the game.
***************************************************************************************************/
class Npc extends Character {
  constructor({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, type, server }) {
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
    this.previousState = { currHealth, status };
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
  constructor({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, zones = [], aliases, config, server }) {
    super({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, type: 'mobile', server });
    this.zones = zones;
    this.config = config;
    this.logger = server.logger;
  }
  canMove() {
    return !["engaged in combat", "lying dead", "lying unconscious"].includes(this.status);
  }
  moveRandomly() {
    if (!this.canMove()) return;
    const location = this.server.gameManager.getLocation(this.currentLocation);
    if (!location) {
      this.logger.debug(`- Invalid Location For:`);
      this.logger.debug(`- Mobile: ${this.name} - ID: ${this.id} - Current Location: ${this.currentLocation}`);
      return;
    }
    const validDirections = this.getValidDirections(location);
    if (validDirections.length > 0) {
      const randomDirection = this.getRandomDirection(validDirections);
      this.moveToNewLocation(location, randomDirection);
    } else {
      this.logger.debug(`- - No Valid Directions For:`);
      this.logger.debug(`- - Mobile: ${this.name} - ID: ${this.id} - At Location: ${this.currentLocation}`);
    }
  }
  getValidDirections(location) {
    const validDirections = Object.keys(location.exits || {}).filter(direction => {
      const exitLocationId = location.exits[direction];
      const exitLocation = this.server.gameManager.getLocation(exitLocationId);
      const isValidZone = exitLocation && (this.zones.length === 0 || this.zones.includes(exitLocation.zone[0]));
      this.logger.debug(`- - Checking Directions: ${direction} - Exit Location - ID: ${exitLocationId} - Valid Zone: ${isValidZone}`);
      return isValidZone;
    });
    this.logger.debug(`- - Valid Directions For:`);
    this.logger.debug(`- - Mobile: ${this.name} - ID: ${this.id} - ${validDirections.join(', ')}`);
    return validDirections;
  }
  getRandomDirection(validDirections) {
    return validDirections[Math.floor(Math.random() * validDirections.length)];
  }
  moveToNewLocation(location, direction) {
    const newLocationId = location.exits[direction];
    const newLocation = this.server.gameManager.getLocation(newLocationId);
    if (this.zones.length > 0 && !this.zones.includes(newLocation.zone[0])) {
      this.logger.debug(`- Mobile:${this.name} Cannot Move To:`);
      this.logger.debug(`- ${newLocation.name} - Due To Zone Restrictions.`);
      return; // Prevent movement if the zone is not allowed
    }
    MessageManager.notifyNpcMovement(this, DirectionManager.getDirectionTo(direction), false);
    this.currentLocation = newLocationId;
    MessageManager.notifyNpcMovement(this, DirectionManager.getDirectionFrom(direction), true);
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
  constructor({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, questId, zones = [], aliases, server }) {
    super({ id, name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases, type: 'quest', server });
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
  static instance;
  constructor({ gameManager, logger, configManager }) {
    if (NpcMovementManager.instance) {
      return NpcMovementManager.instance;
    }
    this.gameManager = gameManager;
    this.logger = logger;
    this.configManager = configManager;
    this.movementInterval = null;
    NpcMovementManager.instance = this;
  }
  static getInstance({ gameManager, logger, configManager }) {
    if (!this.instance) {
      this.instance = new NpcMovementManager({ gameManager, logger, configManager });
    }
    return this.instance;
  }
  startMovement() {
    if (this.movementInterval) {
      this.logger.debug('NPC movement is already running.');
      return;
    }
    const NPC_MOVEMENT_INTERVAL = CONFIG.NPC_MOVEMENT_INTERVAL;
    this.logger.debug(`- Starting Npc Movement With Interval: ${NPC_MOVEMENT_INTERVAL}ms`);
    this.movementInterval = setInterval(() => {
      this.moveAllNpcs();
    }, NPC_MOVEMENT_INTERVAL);
    this.logger.debug('- Npc Movement Started Successfully');
  }
  moveAllNpcs() {
    let movedNpcs = 0;
    let totalMobileNpcs = this.gameManager.mobileNpcs.size;
    this.gameManager.mobileNpcs.forEach((npc, id) => {
      this.logger.debug(`- Checking Mobile:`);
      this.logger.debug(`- - ${npc.name} - ID: ${id}`);
      if (npc.canMove()) {
        try {
          npc.moveRandomly();
          movedNpcs++;
          this.logger.debug(`- - Mobile: ${npc.name} - ID: ${id} - Moved Successfully`);
        } catch (error) {
          this.logger.error(`- - ERROR: Moving Mobile: ${npc.name} - ID: ${id}: ${error.message}`, { error });
        }
      } else {
        this.logger.debug(`- - Mobile: ${npc.name} - ID: ${id} - Cannot Move`);
      }
    });
    this.logger.debug(`- Moved: ${movedNpcs} of ${totalMobileNpcs} Total Mobiles`);
    const now = new Date();
    const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    this.logger.debug(`- Mobiles Moved - [${timestamp}]`);
    this.logger.debug(``);
  }
  stopMovement() {
    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = null;
      this.logger.debug('- Stopped Npc movement');
    }
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
  constructor({ id, name, description, aliases, type, server }) {
    super({ name, description, aliases });
    this.id = id;
    this.type = type;
    this.server = server;
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
  constructor({ logger, configManager }) {
    this.logger = logger;
    this.configManager = configManager;
    this.items = new Map();
  }
  async initialize(itemData) {
    this.checkItemsForDuplicateIds(itemData);
    await this.assignUidsToItems(itemData);
  }
  checkItemsForDuplicateIds(itemData) {
    this.logger.debug(`- Process Item Data`);
    if (!itemData || typeof itemData !== 'object') {
      this.logger.error(`- ERROR: Invalid Or Missing Item Data`);
      return;
    }
    const itemIds = Object.keys(itemData);
    const uniqueIds = new Set(itemIds);
    if (itemIds.length !== uniqueIds.size) {
      for (const id of itemIds) {
        if (itemIds.indexOf(id) !== itemIds.lastIndexOf(id)) {
          this.logger.error(`- ERROR: Duplicate Item ID Detected: ${id}`);
        }
      }
      this.logger.error(`- ERROR: Duplicate Item IDs Detected`);
    } else {
      this.logger.debug(`- Total Items Processed: ${itemIds.length}`);
    }
  }
  async assignUidsToItems(itemData) {
    this.logger.debug(`- Assigning UIDs to Items`);
    const SALT_ROUNDS = 1;
    for (const [id, item] of Object.entries(itemData)) {
      try {
        const uid = await bcrypt.hash(id, SALT_ROUNDS);
        item.uid = uid;
        this.items.set(uid, item);
        this.logger.debug(`- Assigned UID to Item: ${id} -> ${uid}`);
      } catch (error) {
        this.logger.error(`- ERROR: Assigning UID to Item ${id}: ${error.message}`);
      }
    }
    this.logger.debug(`- Total Items with UIDs: ${this.items.size}`);
  }
  getItem(uid) {
    return this.items.get(uid);
  }
  getAllItems() {
    return Array.from(this.items.values());
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
***************************************************************************************************/
class InventoryManager {
  constructor({ player }) {
    this.player = player;
    this.messageManager = MessageManager.getInstance();
    this.itemTypeMap = new Map();
  }
  // Create an item instance from the item data
  async createItemFromData(itemId) {
    const itemData = this.player.server.items[itemId];
    if (!itemData) {
      this.player.server.logger.error(`Item with ID ${itemId} not found`);
      return null;
    }
    try {
      const uniqueId = await UidGenerator.generateUid();
      return new Item({ id: itemId, name: itemData.name, description: itemData.description, aliases: itemData.aliases, type: itemData.type, server: this.player.server });
    } catch (error) {
      this.player.server.logger.error(`- ERROR: Creating Item From Data: ${error.message}`);
      return null;
    }
  }
  addToInventory(item) {
    try {
      if (item instanceof Item) {
        this.player.inventory.add(item);
        this.messageManager.notifyPickupItem(this.player, item.name);
        if (item.type === 'weapon') {
          this.player.weapons.add(item);
        }
      }
    } catch (error) {
      this.messageManager.notifyError(this.player, `- ERROR: Adding item to inventory: ${error.message}`);
      this.player.server.logger.error(error.stack);
    }
  }
  removeFromInventory(item) {
    this.player.inventory.delete(item);
    if (item.type === 'weapon') {
      this.player.weapons.delete(item);
    }
  }
  getAllItemsFromSource(source, sourceType, containerName) {
    if (!source || source.size === 0) {
      MessageManager.notifyNoItemsHere(this.player);
      return;
    }
    const itemsTaken = Array.from(source).map(itemId => this.player.server.items[itemId]);
    itemsTaken.forEach(item => this.player.inventory.add(item));
    if (sourceType === 'location') {
      this.player.server.location[this.player.currentLocation].items.clear();
    } else {
      this.player.server.items[containerName].inventory.clear();
    }
    MessageManager.notifyItemsTaken(this.player, itemsTaken);
  }
  getAllItemsFromLocation() {
    const currentLocation = this.player.server.location[this.player.currentLocation];
    this.getAllItemsFromSource(currentLocation.items, 'location');
  }
  getAllItemsFromContainer(containerName) {
    const container = this.getContainer(containerName);
    if (!container) return;
    const items = new Set(Array.from(container.inventory).filter(i => this.player.server.items[i]));
    this.getAllItemsFromSource(items, 'container', container.name);
  }
  getSingleItemFromContainer(itemName, containerName) {
    const container = this.getContainer(containerName);
    if (!container) return;
    const itemId = this.getItemIdFromContainer(itemName, container);
    if (itemId) {
      this.transferItem(itemId, container, 'container');
    } else {
      MessageManager.notifyNoItemInContainer(this.player, itemName, container.name);
    }
  }
  getSingleItemFromLocation(target) {
    const currentLocation = this.player.server.location[this.player.currentLocation];
    const itemId = this.getItemIdFromLocation(target, currentLocation.items);
    if (itemId) {
      this.transferItem(itemId, currentLocation, 'location');
    } else {
      MessageManager.notifyNoItemHere(this.player, target);
    }
  }
  dropAllItems() {
    this.dropItems(this.player.inventory, 'all');
  }
  dropAllSpecificItems(itemType) {
    const itemsToDrop = new Set(Array.from(this.player.inventory).filter(item => this.itemMatchesType(item, itemType)));
    this.dropItems(itemsToDrop, 'specific', itemType);
  }
  dropSingleItem(target) {
    const item = Array.from(this.player.inventory).find(i => i.name.toLowerCase() === target.toLowerCase());
    if (item) {
      this.transferItem(item, this.player.server.location[this.player.currentLocation], 'drop');
    } else {
      this.messageManager.notifyNoItemToDrop(this.player, target);
    }
  }
  putSingleItem(itemName, containerName) {
    const item = this.getItemFromInventory(itemName);
    if (!item) return;
    const container = this.getContainer(containerName);
    if (!container) return;
    container.inventory.add(item.uid);
    this.player.inventory.delete(item);
    MessageManager.notifyItemPutInContainer(this.player, item.name, container.name);
  }
  putAllItems(containerName) {
    const container = this.getContainer(containerName);
    if (!container) return;
    const itemsToPut = new Set(Array.from(this.player.inventory).filter(item => item !== container));
    if (itemsToPut.size === 0) {
      MessageManager.notifyNoItemsToPut(this.player, container.name);
      return;
    }
    itemsToPut.forEach(item => {
      container.inventory.add(item.uid);
      this.player.inventory.delete(item);
    });
    MessageManager.notifyItemsPutInContainer(this.player, Array.from(itemsToPut), container.name);
  }
  putAllSpecificItemsIntoContainer(itemType, containerName) {
    const container = this.getContainer(containerName);
    if (!container) return;
    const itemsToPut = new Set(Array.from(this.player.inventory).filter(item => item !== container && this.itemMatchesType(item, itemType)));
    if (itemsToPut.size === 0) {
      MessageManager.notifyNoSpecificItemsToPut(this.player, itemType, container.name);
      return;
    }
    itemsToPut.forEach(item => {
      container.inventory.add(item.uid);
      this.player.inventory.delete(item);
    });
    MessageManager.notifyItemsPutInContainer(this.player, Array.from(itemsToPut), container.name);
  }
  getAllSpecificItemsFromLocation(itemType) {
    const currentLocation = this.player.server.location[this.player.currentLocation];
    if (currentLocation.items && currentLocation.items.size > 0) {
      const itemsTaken = new Set(Array.from(currentLocation.items).filter(itemId => this.itemMatchesType(this.player.server.items[itemId], itemType)));
      if (itemsTaken.size > 0) {
        itemsTaken.forEach(itemId => {
          this.player.inventory.add(this.player.server.items[itemId]);
          currentLocation.items.delete(itemId);
        });
        MessageManager.notifyItemsTaken(this.player, Array.from(itemsTaken));
      } else {
        MessageManager.notifyNoSpecificItemsHere(this.player, itemType);
      }
    } else {
      MessageManager.notifyNoItemsHere(this.player);
    }
  }
  getAllSpecificItemsFromContainer(itemType, containerName) {
    const container = this.getContainer(containerName);
    if (!container) return;
    const itemsTaken = new Set(Array.from(container.inventory).filter(itemId => this.itemMatchesType(this.player.server.items[itemId], itemType)));
    if (itemsTaken.size > 0) {
      itemsTaken.forEach(itemId => {
        this.player.inventory.add(this.player.server.items[itemId]);
        container.inventory.delete(itemId);
      });
      MessageManager.notifyItemsTakenFromContainer(this.player, Array.from(itemsTaken), container.name);
    } else {
      MessageManager.notifyNoSpecificItemsInContainer(this.player, itemType, container.name);
    }
  }
  autoLootNpc(npc) {
    if (npc.inventory && npc.inventory.size > 0) {
      const lootedItems = new Set(npc.inventory);
      lootedItems.forEach(itemId => this.player.inventory.add(this.player.server.items[itemId]));
      npc.inventory.clear();
      return MessageManager.createAutoLootMessage(this.player, npc, Array.from(lootedItems));
    }
    return null;
  }
  lootNpc(target) {
    const npcId = this.getNpcIdFromLocation(target, this.player.server.location[this.player.currentLocation].npcs);
    if (npcId) {
      const npc = this.player.server.npcs[npcId];
      if (npc.status === "lying unconscious" || npc.status === "lying dead") {
        if (npc.inventory && npc.inventory.size > 0) {
          const lootedItems = new Set(npc.inventory);
          lootedItems.forEach(itemId => this.player.inventory.add(this.player.server.items[itemId]));
          npc.inventory.clear();
          this.messageManager.sendMessage(this.player,
            MessageManager.getLootedNpcTemplate(this.player.getName(), npc.getName(), Array.from(lootedItems)),
            'lootMessage'
          );
        } else {
          this.messageManager.sendMessage(this.player,
            MessageManager.getNoLootTemplate(this.player.getName(), npc.getName()),
            'lootMessage'
          );
        }
      } else {
        this.messageManager.sendMessage(this.player,
          MessageManager.getCannotLootNpcTemplate(this.player.getName(), npc.getName()),
          'errorMessage'
        );
      }
    } else {
      this.messageManager.sendMessage(this.player,
        MessageManager.getNoNpcToLootTemplate(this.player.getName(), target),
        'errorMessage'
      );
    }
  }
  lootAllNpcs() {
    const currentLocation = this.player.server.location[this.player.currentLocation];
    if (!currentLocation.npcs || currentLocation.npcs.size === 0) {
      this.messageManager.sendMessage(this.player,
        MessageManager.getNoNpcsToLootTemplate(this.player.getName()),
        'errorMessage'
      );
      return;
    }
    const lootedItems = new Set();
    const lootedNpcs = new Set();
    currentLocation.npcs.forEach(npcId => {
      const npc = this.player.server.npcs[npcId];
      if ((npc.status === "lying unconscious" || npc.status === "lying dead") && npc.inventory && npc.inventory.size > 0) {
        npc.inventory.forEach(itemId => {
          lootedItems.add(itemId);
          this.player.inventory.add(this.player.server.items[itemId]);
        });
        lootedNpcs.add(npc.name);
        npc.inventory.clear();
      }
    });
    if (lootedItems.size > 0) {
      this.messageManager.sendMessage(this.player,
        MessageManager.getLootedAllNpcsTemplate(this.player.getName(), Array.from(lootedNpcs), Array.from(lootedItems)),
        'lootMessage'
      );
    } else {
      this.messageManager.sendMessage(this.player,
        MessageManager.getNothingToLootFromNpcsTemplate(this.player.getName()),
        'lootMessage'
      );
    }
  }
  dropItems(itemsToDrop, type, itemType) {
    if (itemsToDrop.size === 0) {
      this.messageManager.notifyNoItemsToDrop(this.player, type, itemType);
      return;
    }
    const currentLocation = this.player.server.location[this.player.currentLocation];
    currentLocation.items = currentLocation.items || new Set();
    itemsToDrop.forEach(item => {
      currentLocation.items.add(item.uid);
      this.player.inventory.delete(item);
    });
    this.messageManager.notifyItemsDropped(this.player, Array.from(itemsToDrop));
  }
  getContainer(containerName) {
    const container = Array.from(this.player.inventory).find(item =>
      item.name.toLowerCase() === containerName.toLowerCase() && item.inventory
    );
    if (!container) {
      MessageManager.notifyNoContainer(this.player, containerName);
      return null;
    }
    return container;
  }
  getItemFromInventory(itemName) {
    const item = Array.from(this.player.inventory).find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!item) {
      MessageManager.notifyItemNotInInventory(this.player, itemName);
    }
    return item;
  }
  transferItem(itemId, source, sourceType) {
    this.player.server.transferItem(itemId, source, sourceType, this.player);
  }
  getNpcIdFromLocation(npcName, npcs) {
    return Array.from(npcs).find(npcId => this.player.server.npcs[npcId].name.toLowerCase() === npcName.toLowerCase());
  }
  getItemIdFromLocation(target, items) {
    return Array.from(items).find(item => item.name.toLowerCase() === target.toLowerCase())?.uid;
  }
  getItemIdFromContainer(itemName, container) {
    return Array.from(container.inventory).find(itemId => this.player.server.items[itemId].name.toLowerCase() === itemName.toLowerCase());
  }
  itemMatchesType(item, itemType) {
    if (!this.itemTypeMap.has(item.uniqueId)) {
      this.itemTypeMap.set(item.uniqueId, item.type);
    }
    return this.itemTypeMap.get(item.uniqueId) === itemType;
  }
}
/**************************************************************************************************
Message Manager Class
The MessageManager class is responsible for handling message-related operations within the
game. It provides methods for sending messages to players, notifying them of events, and
formatting messages for different types of game interactions.
Key features:
1. Player notification management for various events
2. Integration with the socket for real-time communication
3. Templated messages for common game events
The MessageManager is essential for facilitating communication between the server and players,
ensuring that important information is conveyed effectively and promptly.
***************************************************************************************************/
class FormatMessageManager {
  static createMessageData({ cssid = '', message }) {
    return { cssid, content: message };
  }
  static getIdForMessage(type) {
    const messageIds = {
      /* CSS for location title
        any message sent to a client that contains
        a location title must include this */
      locationTitle: 'location-title',
      /* CSS for location description
        any message sent to a client that contains
        a location description must include this */
      locationDescription: 'location-description',
      /* CSS for item names
        any message sent to a client that contains
        an item name must include this */
      itemName: 'item-name',
      /* CSS for exit to location
        any message sent to a client that contains
        an exit to location must include this */
      exitToLocation: 'exit-to-location',
      /* CSS for exits list
        any message sent to a client that contains
        an exits list must include this */
      exitsList: 'exits-list',
      /* CSS for inventory list
        any message sent to a client that contains
        an inventory list must include this */
      inventoryList: 'inventory-list',
      /* CSS for items list
        any message sent to a client that contains
        an items list must include this */
      itemsList: 'items-list',
      /* CSS for npc name
        any message sent to a client that contains
        an npc name must include this */
      npcName: 'npc-name',
      /* CSS for npc description
        any message sent to a client that contains
        an npc description must include this */
      npcDescription: 'npc-description',
      /* CSS for npc stats
        any message sent to a client that contains
        npc stats must include this */
      npcStats: 'npc-stats',
      /* CSS for player names
        any message sent to a client that contains
        a player name must include this */
      playerName: 'player-name',
      /* CSS for combat message player actions
        any message sent to a client during combat
        that contains a player action must include this */
      combatMessagePlayer: 'combat-message-player',
      /* CSS for combat message npc actions
        any message sent to a client during combat
        that contains an npc action must include this */
      combatMessageNpc: 'combat-message-npc',
      /* CSS for combat message health
        any message sent to a client during combat
        that contains health status must include this */
      combatMessageHealth: 'combat-message-health',
      /* CSS for combat messages
        any message sent to a client during combat
        must include this */
      combatMessage: 'combat-message',
      /* CSS for error messages
        any message sent to a client that contains
        an error message must include this */
      errorMessage: 'error-message'
    };
    return messageIds[type] || '';
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
  // Get the singleton instance of MessageManager
  static getInstance() {
    if (!this.instance) {
      this.instance = new MessageManager();
    }
    return this.instance;
  }
  // Set the socket instance
  static socket;
  static setSocket(socketInstance) {
    this.socket = socketInstance;
  }
  // Notify a player with a message
  static notify({ player, message, type = '' }) {
    try {
      player.server.logger.info(`Message to ${player.getName()}: ${message}`);
      const cssid = FormatMessageManager.getIdForMessage(type);
      const messageData = FormatMessageManager.createMessageData({ cssid, message });
      if (this.socket) {
        this.socket.emit('message', { playerId: player.getId(), messageData });
      }
      return messageData;
    } catch (error) {
      player.server.logger.error(`- ERROR: Notifying player ${player.getName()}:`, error, error.stack);
    }
  }
  // Notify all players in a specific location with a message
  static notifyPlayersInLocation({ location, message, type = '' }) {
    if (!location || !location.playersInLocation) return;
    Array.from(location.playersInLocation).forEach(player => this.notify({ player, message, type }));
  }
  // Notify a player about a specific action performed on a target
  static notifyAction({ player, action, targetName, type }) {
    return this.notify({ player, message: `${player.getName()} ${action} ${targetName}.`, type });
  }
  // Notify a player of a successful login
  static notifyLoginSuccess({ player }) {
    return this.notifyAction({ player, action: 'has logged in successfully!', targetName: '', type: 'loginSuccess' });
  }
  // Notify a player of an incorrect password attempt
  static notifyIncorrectPassword({ player }) {
    return this.notify({ player, message: `Incorrect password. Please try again.`, type: 'incorrectPassword' });
  }
  // Notify a player of disconnection due to too many failed login attempts
  static notifyDisconnectionDueToFailedAttempts({ player }) {
    return this.notify({ player, message: `${player.getName()} has been disconnected due to too many failed login attempts.`, type: 'disconnectionFailedAttempts' });
  }
  // Notify a player when they pick up an item
  static notifyPickupItem({ player, itemName }) {
    return this.notifyAction({ player, action: 'picks up', targetName: itemName, type: 'pickupItem' });
  }
  // Notify a player when they drop an item
  static notifyDropItem({ player, itemName }) {
    return this.notifyAction({ player, action: 'drops', targetName: itemName, type: 'dropItem' });
  }
  // Notify players in a location about an Npc's movement
  static notifyNpcMovement(npc, direction, isArrival) {
    const action = isArrival ? 'arrives' : 'leaves';
    const message = `${npc.name} ${action} ${DirectionManager.getDirectionTo(direction)}.`;
    this.notifyPlayersInLocation(npc.currentLocation, message, 'npcMovement');
  }
  // Get a template message for combat initiation
  static getCombatInitiationTemplate({ initiatorName, targetName }) {
    return `${initiatorName} initiates combat with ${targetName}!`;
  }
  // Get a template message for an Npc joining combat
  static getCombatJoinTemplate({ npcName }) {
    return `${npcName} joins the combat!`;
  }
  // Get a template message for a victory announcement
  static getVictoryTemplate({ playerName, defeatedName }) {
    return `${playerName} has defeated ${defeatedName}!`;
  }
  // Get a template message for a target not found
  static getTargetNotFoundTemplate({ playerName, target }) {
    return `${playerName} doesn't see ${target} here.`;
  }
  // Get a template message for no conscious enemies
  static getNoConsciousEnemiesTemplate({ playerName }) {
    return `${playerName} doesn't see any conscious enemies here.`;
  }
  // Get a template message for an Npc already in a specific status
  static getNpcAlreadyInStatusTemplate({ npcName, status }) {
    return `${npcName} is already ${status}.`;
  }
  // Get a template message for an unknown location
  static getUnknownLocationTemplate({ playerName }) {
    return `${playerName} is in an unknown location.`;
  }
  // Get a template message for looting an Npc
  static getLootedNpcTemplate({ playerName, npcName, lootedItems }) {
    return `${playerName} looted ${npcName} and found: ${lootedItems.map(item => item.name).join(', ')}.`;
  }
  // Get a template message for finding nothing to loot from an Npc
  static getNoLootTemplate({ playerName, npcName }) {
    return `${playerName} found nothing to loot from ${npcName}.`;
  }
  // Get a template message for being unable to loot an Npc
  static getCannotLootNpcTemplate({ playerName, npcName }) {
    return `${playerName} cannot loot ${npcName} as they are not unconscious or dead.`;
  }
  // Get a template message for no Npc to loot
  static getNoNpcToLootTemplate({ playerName, target }) {
    return `${playerName} doesn't see ${target} here to loot.`;
  }
  // Get a template message for no Npcs to loot
  static getNoNpcsToLootTemplate({ playerName }) {
    return `${playerName} doesn't see any Npcs to loot here.`;
  }
  // Get a template message for finding nothing to loot from any Npcs
  static getNothingToLootFromNpcsTemplate({ playerName }) {
    return `${playerName} found nothing to loot from any Npcs here.`;
  }
  // Get a template message for looting all Npcs
  static getLootedAllNpcsTemplate({ playerName, lootedNpcs, lootedItems }) {
    return `${playerName} looted ${lootedNpcs.join(', ')} and found: ${lootedItems.join(', ')}.`;
  }
  // Notify a player that they have no items to drop
  static notifyNoItemsToDrop({ player, type, itemType }) {
    return this.notify({ player, message: `${player.getName()} has no ${type === 'specific' ? itemType + ' ' : ''}items to drop.`, type: 'errorMessage' });
  }
  // Notify a player about items they dropped
  static notifyItemsDropped({ player, items }) {
    return this.notify({ player, message: `${player.getName()} dropped: ${items.map(item => item.name).join(', ')}.`, type: 'dropMessage' });
  }
  // Notify a player about items they took
  static notifyItemsTaken({ player, items }) {
    return this.notify({ player, message: `${player.getName()} took: ${items.map(item => item.name).join(', ')}.`, type: 'takeMessage' });
  }
  // Notify a player that there are no items here
  static notifyNoItemsHere({ player }) {
    return this.notify({ player, message: `There are no items here.`, type: 'errorMessage' });
  }
  // Notify a player about items taken from a container
  static notifyItemsTakenFromContainer({ player, items, containerName }) {
    return this.notify({ player, message: `${player.getName()} took ${items.map(item => item.name).join(', ')} from ${containerName}.`, type: 'takeMessage' });
  }
  // Notify a player that there are no specific items in a container
  static notifyNoSpecificItemsInContainer({ player, itemType, containerName }) {
    return this.notify({ player, message: `There are no ${itemType} items in ${containerName}.`, type: 'errorMessage' });
  }
  // Notify a player that there is no item in a container
  static notifyNoItemInContainer({ player, itemName, containerName }) {
    return this.notify({ player, message: `There is no ${itemName} in ${containerName}.`, type: 'errorMessage' });
  }
  // Notify a player that there is no item here
  static notifyNoItemHere({ player, itemName }) {
    return this.notify({ player, message: `There is no ${itemName} here.`, type: 'errorMessage' });
  }
  // Notify a player that they don't have a specific container
  static notifyNoContainer({ player, containerName }) {
    return this.notify({ player, message: `${player.getName()} doesn't have a ${containerName}.`, type: 'errorMessage' });
  }
  // Notify a player that an item is not in their inventory
  static notifyItemNotInInventory({ player, itemName }) {
    return this.notify({ player, message: `${player.getName()} doesn't have a ${itemName} in their inventory.`, type: 'errorMessage' });
  }
  // Notify a player that they put an item in a container
  static notifyItemPutInContainer({ player, itemName, containerName }) {
    return this.notify({ player, message: `${player.getName()} put ${itemName} in ${containerName}.`, type: 'putMessage' });
  }
  // Notify a player that they have no items to put in a container
  static notifyNoItemsToPut({ player, containerName }) {
    return this.notify({ player, message: `${player.getName()} has no items to put in ${containerName}.`, type: 'errorMessage' });
  }
  // Notify a player about items put in a container
  static notifyItemsPutInContainer({ player, items, containerName }) {
    return this.notify({ player, message: `${player.getName()} put ${items.map(item => item.name).join(', ')} in ${containerName}.`, type: 'putMessage' });
  }
  // Notify a player that they have no specific items to put in a container
  static notifyNoSpecificItemsToPut({ player, itemType, containerName }) {
    return this.notify({ player, message: `${player.getName()} has no ${itemType} items to put in ${containerName}.`, type: 'errorMessage' });
  }
  // Notify a player that there are no specific items here
  static notifyNoSpecificItemsHere({ player, itemType }) {
    return this.notify({ player, message: `There are no ${itemType} items here.`, type: 'errorMessage' });
  }
  // Get a template message for auto-looting items from an Npc
  static getAutoLootTemplate({ playerName, npcName, lootedItems }) {
    return `${playerName} auto-looted ${lootedItems.map(item => item.name).join(', ')} from ${npcName}.`;
  }
}
/**************************************************************************************************
Start Server Code
***************************************************************************************************/
const serverInitializer = new ServerInitializer({ config: CONFIG });
serverInitializer.initialize();