// Server *****************************************************************************************
/*
 * The Server class is the main entry point for the game server. It is responsible for initializing
 * the server environment, setting up middleware, and managing the game loop.
*/
class Server {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.databaseManager = null;
    this.socketEventManager = null;
    this.serverConfigurator = null;
    this.fs = null;
    this.activeSessions = new Map();
  }
  async init() {
    try {
      await this.moduleImporter.loadModules();
      this.fs = await import('fs').then(module => module.promises);
      this.databaseManager = new DatabaseManager({ server: this, logger: this.logger });
      this.socketEventManager = new SocketEventManager({ server: this, logger: this.logger });
      this.serverConfigurator = new ServerConfigurator({ server: this, logger: this.logger, socketEventManager: this.socketEventManager, config: this.config });
      await this.serverConfigurator.configureServer();
    } catch (error) {
      this.logger.error(`ERROR during server initialization: ${error.message}`, { error });
    }
  }
  async setupHttpServer() { // Kept async
    const sslOptions = { key: null, cert: null };
    const { SSL_CERT_PATH, SSL_KEY_PATH } = this.config; // Destructure config
    try {
      sslOptions.cert = await this.fs.readFile(SSL_CERT_PATH); // Keep await here
    } catch (error) {
      this.logger.warn(`${this.logger.CONFIG.MAGENTA}- - WARNING: Read SSL cert: ${error.message}${this.logger.CONFIG.RESET}`, { error });
    }
    try {
      sslOptions.key = await this.fs.readFile(SSL_KEY_PATH); // Keep await here
    } catch (error) {
      this.logger.warn(`${this.logger.CONFIG.MAGENTA}- - WARNING: Read SSL  key: ${error.message}${this.logger.CONFIG.RESET}`, { error });
    }
    const isHttps = sslOptions.key && sslOptions.cert;
    const http = isHttps ? await import('https') : await import('http'); // Keep await here
    this.server = http.createServer(isHttps ? { key: sslOptions.key, cert: sslOptions.cert } : this.app);
    this.logger.info(`- Server configured using ${isHttps ? 'https' : 'http'}://${this.config.HOST}:${this.config.PORT}`);
    return this.server;
  }
  cleanup() {
    this.databaseManager = null;
    this.socketEventManager = null;
    this.serverConfigurator = null;
    this.fs = null;
    this.activeSessions.clear(); // Clear active sessions
  }
}
// Base Manager Class ******************************************************************************
/*
 * The BaseManager class serves as a base class for all manager classes, providing common functionality
 * and access to the server and logger instances.
*/
class BaseManager {
  constructor({ server, logger }) {
    this.server = server; // Store server reference
    this.logger = logger; // Store logger reference
  }
}
// Socket Event Manager ***************************************************************************
/*
 * The SocketEventManager class handles socket events for real-time communication between the server
 * and connected clients. It manages user connections and disconnections.
*/
class SocketEventManager extends BaseManager {
  constructor({ server, logger }) {
    super({ server, logger });
    this.socketListeners = new Map(); // Store listeners for efficient management
    this.activeSessions = new Set(); // Use Set for unique session IDs
    this.actionData = {}; // Reusable object for action data
  }
  initializeSocketEvents() { // Renamed from 'setupSocketEvents' to 'initializeSocketEvents'
    this.logger.info(`Setting up Socket.IO events.`); // New log message
    this.server.io.on('connection', (socket) => {
      this.logger.info(`A new socket connection established: ${socket.id}`); // New log message
      const sessionId = socket.handshake.query.sessionId;
      if (this.activeSessions.has(sessionId)) { // Check if sessionId is already connected
        this.logger.warn(`${this.logger.CONFIG.MAGENTA}User with session ID ${sessionId} is already connected.${this.logger.CONFIG.RESET}`, { sessionId });
        socket.emit('sessionError', 'You are already connected.');
        socket.disconnect();
        return;
      }
      this.activeSessions.add(sessionId); // Add sessionId to Set
      this.logger.info(`A user connected: ${socket.id} with session ID ${sessionId}`, { sessionId, socketId: socket.id });
      this.initializeSocketListeners(socket, sessionId);
    });
  }
  initializeSocketListeners(socket, sessionId) { // Renamed from 'setupSocketListeners' to 'initializeSocketListeners'
    const listeners = {
      playerAction: (actionData) => this.handleAction(socket, { ...actionData }),
      sendMessage: (messageData) => this.handleAction(socket, { ...messageData }),
      disconnect: () => {
        this.logger.info(`User disconnected: ${socket.id}`, { socketId: socket.id });
        this.activeSessions.delete(sessionId);
      }
    };
    for (const [event, listener] of Object.entries(listeners)) {
      socket.on(event, listener);
      this.socketListeners.set(socket.id, listener); // Store listener for cleanup
    }
  }
  handleAction(socket, { type, content, targetId, actionType, payload }) {
    if (type) {
      switch (type) {
        case 'public':
          this.server.io.emit('receiveMessage', { senderId: socket.id, content });
          break;
        case 'semiPublic':
          const locationId = this.server.gameManager.getPlayerLocation(socket.id);
          this.server.io.to(locationId).emit('receiveMessage', { senderId: socket.id, content });
          break;
        case 'private':
          this.server.io.to(targetId).emit('receiveMessage', { senderId: socket.id, content });
          break;
        default:
          this.logger.error(`Unknown message type: ${type}`, { type });
      }
    } else if (actionType) {
      this.actionData.type = actionType; // Reuse actionData object
      switch (actionType) {
        case 'move':
          this.movePlayer(socket, payload);
          break;
        case 'attack':
          this.attackNpc(socket, payload);
          break;
        default:
          this.logger.error(`Unknown action type: ${actionType}`, { actionType });
      }
    }
  }
  movePlayer(socket, { playerId, newLocationId }) {
    const player = this.server.gameManager.getPlayerById(playerId);
    if (player) {
      player.moveToLocation(newLocationId);
      this.server.io.emit('playerMoved', { playerId, newLocationId });
    }
  }
  attackNpc(socket, { playerId, targetId }) {
    const player = this.server.gameManager.getPlayerById(playerId);
    if (player) {
      player.attackNpc(targetId);
      this.server.io.emit('npcAttacked', { playerId, targetId });
    }
  }
  cleanup() {
    this.socketListeners.clear(); // Clear socket listeners
    this.activeSessions.clear(); // Clear active sessions
    this.actionData = {}; // Reset action data
  }
}
// Module Importer ********************************************************************************
/*
 * The ModuleImporter class is responsible for importing necessary modules and dependencies for the
 * server to function. It ensures that all required modules are loaded before the server starts.
*/
class ModuleImporter extends BaseManager {
  constructor({ logger, server }) {
    super({ server, logger });
  }
  async loadModules() {
    try {
      this.logger.info(`\n`);
      this.logger.info(`STARTING MODULE IMPORTS:`);
      this.logger.info(`- Importing File System Module`);
      try {
        const fsModule = await import('fs'); // Corrected import
        this.fs = fsModule.promises; // Access promises property correctly
      } catch (error) {
        this.logger.error(`ERROR importing File System Module: ${error.message}`, { error });
      }
      this.logger.info(`- Importing Express Module`);
      try {
        this.express = (await import('express')).default;
      } catch (error) {
        this.logger.error(`ERROR importing Express Module: ${error.message}`, { error });
      }
      this.logger.info(`- Importing Socket.IO Module`);
      try {
        this.SocketIOServer = (await import('socket.io')).Server;
      } catch (error) {
        this.logger.error(`ERROR importing Socket.IO Module: ${error.message}`, { error });
      }
      this.logger.info(`- Importing Queue Module`);
      try {
        this.queue = new (await import('queue')).default();
      } catch (error) {
        this.logger.error(`ERROR importing Queue Module: ${error.message}`, { error });
      }
      this.logger.info(`MODULE IMPORTS FINISHED.`);
    } catch (error) {
      this.logger.error(`ERROR during module imports: ${error.message}`, { error });
    }
  }
}
// Server Configurator ***********************************************************************************
/*
 * The ServerConfigurator class is responsible for configuring the server environment.
*/
class ServerConfigurator extends BaseManager { // Extend BaseManager
  constructor({ config, logger, server, socketEventManager }) {
    super({ server, logger }); // Call the parent constructor
    const { SSL_CERT_PATH, SSL_KEY_PATH } = config; // Destructure config
    this.config = config;
    this.socketEventManager = socketEventManager;
    this.server.app = null;
    this.server.express = null;
  }
  async configureServer() {
    const { logger, server } = this; // Destructure this
    logger.info(`\n`);
    logger.info(`STARTING SERVER CONFIGURATION:`);
    try {
      await this.setupExpressApp();
      this.configureExpressMiddleware();
      await server.setupHttpServer();
      if (!server.server) {
        logger.error('Server configuration unsuccessful!!!');
      }
    } catch (error) {
      logger.error(`ERROR during Server configuration: ${error.message}`, { error });
    }
    try {
      logger.log('INFO', '- Configuring Queue Manager');
      server.queueManager = new QueueManager();
      if (!server.queueManager) {
        logger.error('Queue Manager configuration unsuccessful!!!');
      }
    } catch (error) {
      logger.error(`ERROR during Queue Manager configuration: ${error.message}`, { error });
    }
    try {
      logger.log('INFO', '- Configuring Game Component Initializer');
      this.gameComponentInitializer = new GameComponentInitializer(this);
      if (!this.gameComponentInitializer) {
        logger.error('Game Component Initializer configuration unsuccessful!!!');
      }
    } catch (error) {
      logger.error(`ERROR during Game Component Initializer configuration: ${error.message}`, { error });
    }
    logger.info(`SERVER CONFIGURATION FINISHED.`);
  }
  async setupExpressApp() { // Renamed from 'initializeExpress' to 'setupExpressApp'
    this.logger.log('INFO', '- Initializing Express');
    this.server.express = (await import('express')).default; // Ensure express is imported correctly
    this.server.app = this.server.express(); // Initialize app here
  }
  configureExpressMiddleware() { // Removed async
    this.logger.log('INFO', '- Configuring Express');
    if (!this.server.app) {
      this.logger.error('Express app is not initialized.');
      return;
    }
    this.server.app.use(this.server.express.static('public'));
    this.server.app.use((err, req, res, next) => {
      this.logger.error(err.message, { error: err });
      res.status(500).send('An unexpected error occurred. Please try again later.');
    });
  }
}
// Logger Interface ********************************************************************************
class ILogger {
  log(level, message) {}
  debug(message) {}
  info(message) {}
  warn(message) {}
  error(message) {}
}
// Database Manager Interface ************************************************************************
class IDatabaseManager {
  async loadLocationData() {}
  async loadNpcData() {}
  async loadItemData() {}
  async saveData(filePath, key, data) {}
}
// Event Emitter Interface *************************************************************************
class IEventEmitter {
  on(event, listener) {}
  emit(event, ...args) {}
  off(event, listener) {}
}
// Logger Class ************************************************************************************
class Logger extends ILogger {
  constructor(config) {
    super();
    this.CONFIG = config; // Initialize CONFIG here
    this.setLogLevel(this.CONFIG.LOG_LEVEL); // Ensure this method is defined
  }
  setLogLevel(level) { // Add this method
    this.logLevel = level; // Store the log level
  }
  log(level, message) {
    const logString = level === 'ERROR' ? `${this.CONFIG.RED}${message}${this.CONFIG.RESET}` : `${message}`;
    if (level === 'WARN') {
      message = `${this.CONFIG.MAGENTA}${message}${this.CONFIG.RESET}`;
    }
    this.writeToConsole(logString);
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
    this.log('ERROR', message);
  }
}
// EventEmitter Class ******************************************************************************
class EventEmitter extends IEventEmitter {
  constructor() {
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
// DatabaseManager Class ****************************************************************************
class DatabaseManager extends BaseManager {
  constructor({ server, logger }) {
    super({ server, logger });
    this.DATA_PATHS = {
      LOCATIONS: this.server.config.LOCATION_DATA_PATH,
      NPCS: this.server.config.NPC_DATA_PATH,
      ITEMS: this.server.config.ITEM_DATA_PATH,
    };
  }
  async initialize() {
    this.fs = await import('fs').then(module => module.promises);
  }
  async getFilesInDirectory(directoryPath) {
    const files = await this.fs.readdir(directoryPath);
    return files.filter(file => file.endsWith('.json')).map(file => `${directoryPath}/${file}`);
  }
  async loadLocationData() {
    return this.loadData(this.DATA_PATHS.LOCATIONS, 'location');
  }
  async loadNpcData() {
    return this.loadData(this.DATA_PATHS.NPCS, 'npc');
  }
  async loadItemData() {
    return this.loadData(this.DATA_PATHS.ITEMS, 'item');
  }
  async loadData(dataPath, type) { // New utility method
    try {
      const files = await this.getFilesInDirectory(dataPath);
      const data = await Promise.all(files.map(file => this.fs.readFile(file, 'utf-8').then(data => JSON.parse(data))));
      return data;
    } catch (error) {
      this.logger.error(`ERROR loading ${type} data: ${error.message}`, { error });
      throw error;
    }
  }
  async saveData(filePath, key, data) {
    try {
      const existingData = await this.fs.readFile(filePath, 'utf-8');
      const parsedData = JSON.parse(existingData);
      parsedData[key] = data;
      await this.fs.writeFile(filePath, JSON.stringify(parsedData, null, 2));
      this.logger.info(`Data saved for ${key} to ${filePath}`, { filePath, key });
    } catch (error) {
      this.logger.error(`ERROR saving data for ${key} to ${filePath}: ${error.message}`, { error, filePath, key });
    }
  }
  cleanup() {
    this.fs = null; // Clear fs reference
  }
}
// GameComponentInitializer Class ******************************************************************
class GameComponentInitializer extends BaseManager {
  constructor({ server, logger }) {
    super({ server, logger });
  }
  async setupGameComponents() { // Renamed from 'initializeGameComponents' to 'setupGameComponents'
    this.logger.info(`\n`);
    this.logger.info(`STARTING INITIALIZE GAME COMPONENTS:`);
    try {
      this.logger.log('INFO', '- Starting Database Manager');
      this.server.databaseManager = new DatabaseManager({ server: this.server, logger: this.logger });
      await this.server.databaseManager.initialize();
      if (!this.server.databaseManager) throw new Error('DatabaseManager initialization failed!!!');
      this.logger.log('INFO', '- Loading Game Data');
      this.server.gameDataLoader = new GameDataLoader(this.server);
      if (!this.server.gameDataLoader) throw new Error('GameDataLoader is not initialized!');
      this.logger.log('DEBUG', '\n');
      if (this.logger.logLevel === 'DEBUG') { // Check if log level is DEBUG
        this.logger.log('DEBUG', 'VERIFYING GAME DATA:');
        const gameDataVerifier = new GameDataVerifier(this.server.databaseManager);
        const verifiedData = await gameDataVerifier.validateGameData();
        this.logger.log('DEBUG', '\n');
      }
      this.logger.log('INFO', '- Starting Game Manager');
      this.server.gameManager = new GameManager({ eventEmitter: this.server.eventEmitter });
      if (!this.server.gameManager) throw new Error('GameManager initialization failed!!!');
    } catch (error) {
      this.logger.error(`ERROR during game component initialization: ${error.message} - ${error.stack}`, { error });
    }
    this.logger.info(`GAME COMPONENTS INITIALIZED.`);
  }
}
// GameManager Class ********************************************************************************
class GameManager {
  #gameLoopInterval = null;
  #gameTime = 0;
  #isRunning = false;
  #combatManager;
  constructor({ eventEmitter }) {
    this.players = new Map(); // Use Map for efficient player management
    this.locations = new Map(); // Efficient location management
    this.npcs = new Map(); // Efficient NPC management
    this.#combatManager = new CombatManager(this);
    this.eventEmitter = eventEmitter;
    this.eventEmitter.on("tick", this._gameTick.bind(this));
    this.eventEmitter.on("newDay", this._newDayHandler.bind(this));
  }
  startGame() {
    try {
      this.startGameLoop();
      this.#isRunning = true;
    } catch (error) {
      console.log(`ERROR Start game: ${error}`);
    }
  }
  shutdownGame() {
    try {
      this.stopGameLoop();
      for (const player of this.players.values()) {
        player.save();
      }
      this.server.socketEventManager.cleanup(); // Call cleanup on SocketEventManager
      this.server.databaseManager.cleanup(); // Call cleanup on DatabaseManager
      this.server.queueManager.cleanup(); // Call cleanup on QueueManager
      this.server.socketEventManager.server.io.close(() => {
        this.server.logger.info('All socket connections closed.');
        process.exit(0);
      });
      MessageManager.notifyGameShutdownSuccess(this);
    } catch (error) {
      console.log(`ERROR shutting down game: ${error}`);
      MessageManager.notifyError(this, `ERROR shutting down game: ${error}`);
      throw error;
    }
  }
  startGameLoop() {
    this.#gameLoopInterval = setInterval(() => this._gameTick(), TICK_RATE);
  }
  stopGameLoop() {
    if (this.#gameLoopInterval) {
      clearInterval(this.#gameLoopInterval);
      this.#gameLoopInterval = null;
    }
  }
  _gameTick() {
    this._updateNpcs();
    this._updatePlayerAffects();
    this._updateWorldEvents();
    this.eventEmitter.emit("tick", this.#gameTime);
  }
  _updateGameTime() {
    this.setGameTime(this.getGameTime() + Math.floor((Date.now() - this.#gameTime) / 1000));
    this.#gameTime = Date.now();
    if (this.getGameTime() >= 1440) {
      this.setGameTime(0);
      this.eventEmitter.emit("newDay");
    }
  }
  moveEntity(entity, newLocationId) {
    const oldLocationId = entity.currentLocation;
    const oldLocation = this.getLocation(oldLocationId);
    const newLocation = this.getLocation(newLocationId);
    if (oldLocation) {
      MessageManager.notifyLeavingLocation(entity, oldLocationId, newLocationId);
      const direction = DirectionManager.getDirectionTo(newLocationId);
      MessageManager.notify(entity, `${entity.getName()} travels ${direction}.`);
    }
    entity.currentLocation = newLocationId;
    if (!newLocation) return; // Early return if newLocation is not found
    newLocation.addEntity(entity, "players");
    MessageManager.notifyEnteringLocation(entity, newLocationId);
    const direction = DirectionManager.getDirectionFrom(oldLocationId);
    MessageManager.notify(entity, `${entity.getName()} arrives ${direction}.`);
  }
  _updateNpcs() {
    this.npcs.forEach(npc => {
      if (npc.hasChangedState()) {
        MessageManager.notifyNpcStateChange(npc);
      }
    });
  }
  _updatePlayerAffects() {
    this.players.forEach(player => {
      if (player.hasChangedState()) { // Check if player has changed state
        player.checkAndRemoveExpiredAffects();
      }
    });
  }
  _updateWorldEvents() {
    if (this.isTimeForWorldEvent()) {
      this.triggerWorldEvent();
    }
  }
  isTimeForWorldEvent() {
    return this.#gameTime % WORLD_EVENT_INTERVAL === 0;
  }
  triggerWorldEvent() {
    console.log(`A world event has occurred!`);
  }
  _newDayHandler() {
    console.log("A new day has started!");
  }
}
// GameDataLoader Class ******************************************************************************
/*
 * The GameDataLoader class is responsible for loading game data from the database, ensuring that
 * all necessary data is loaded before the game starts.
*/
class GameDataLoader {
  constructor(server) {
    this.server = server;
  }
  async fetchGameData() { // Renamed from 'loadGameData' to 'fetchGameData'
    const { logger, databaseManager } = this.server; // Destructure server
    logger.info(`\nStarting game data loading.`);
    const DATA_TYPES = { LOCATION: 'location', NPC: 'npc', ITEM: 'item' };
    const loadData = async (loadFunction, type) => {
      try {
        const data = await loadFunction();
        logger.info(`${type} data loaded.`, { type });
        return { type, data };
      } catch (error) {
        logger.error(`ERROR loading ${type} data: ${error.message}`, { error, type });
        return { type, error };
      }
    };
    const results = await Promise.allSettled([
      loadData(databaseManager.loadLocationData.bind(databaseManager), DATA_TYPES.LOCATION),
      loadData(databaseManager.loadNpcData.bind(databaseManager), DATA_TYPES.NPC),
      loadData(databaseManager.loadItemData.bind(databaseManager), DATA_TYPES.ITEM),
    ]);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`Failed to load data at index ${index}: ${result.reason.message}`, { error: result.reason, index });
      }
    });
    logger.info(`Finished loading game data.`);
    return results.map(result => result.value).filter(value => value && !value.error);
  }
}
// GameDataVerifier Class *******************************************************************************
/*
 * The GameDataVerifier class is responsible for verifying that all game data has been loaded.
 * It displays the contents of all loaded game data in the server console for debugging and testing.
*/
class GameDataVerifier {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
  }
  async validateGameData() { // Renamed from 'verifyData' to 'validateGameData'
    const locationData = await this.databaseManager.loadLocationData();
    const npcData = await this.databaseManager.loadNpcData();
    const itemData = await this.databaseManager.loadItemData();
    const verifiedData = { locationData, npcData, itemData };
    this.databaseManager.logger.debug(`Game Data: ${JSON.stringify(verifiedData, null, 2)}`); // Updated to stringify
  }
}
// Object Pool ************************************************************************************
/*
 * The ObjectPool class manages a pool of reusable objects to optimize memory usage and performance
 * by reducing the overhead of object creation and garbage collection.
*/
class ObjectPool {
  constructor(createFunc, size) {
    this.createFunc = createFunc;
    this.pool = Array.from({ length: size }, this.createFunc);
    this.available = [];
  }
  acquire() {
    return this.available.length > 0 ? this.available.pop() : this.pool.pop();
  }
  release(object) {
    this.available.push(object);
  }
}
// Task Class ************************************************************************************
/*
 * The Task class represents a unit of work that can be executed. It encapsulates the task's name
 * and execution logic, allowing for flexible task management.
*/
class Task {
  constructor(name) {
    this.name = name;
    this.execute = null;
  }
  run() {
    if (this.execute) this.execute();
  }
}
// Queue Manager *********************************************************************************
/*
 * The QueueManager class manages a queue of tasks to be executed. It handles task addition,
 * processing, and execution, ensuring that tasks are run in a controlled manner.
*/
class QueueManager {
  constructor(objectPool) {
    this.objectPool = objectPool;
    this.queue = [];
    this.isProcessing = false;
  }
  addTask(task) {
    console.log(`Adding task: ${task.name}`);
    this.queue.push(task);
    this.processQueue();
  }
  processQueue() {
    if (this.isProcessing || this.queue.length === 0) return; // Check if already processing or queue is empty
    this.isProcessing = true;
    const processNextTask = async () => {
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        try {
          await task.run(); // Ensure task.run() is awaited
        } catch (error) {
          console.error(`ERROR processing task: ${error.message}`);
        }
      }
      this.isProcessing = false; // Reset processing state after all tasks are done
      this.cleanup();
    };
    processNextTask(); // Start processing tasks
  }
  addDataLoadTask(filePath, key) {
    const task = this.objectPool.acquire();
    task.name = 'Data Load Task';
    task.execute = async () => {
      const data = await this.databaseManager.loadData(filePath, key);
      this.objectPool.release(task);
    };
    this.addTask(task);
  }
  addDataSaveTask(filePath, key, data) {
    const task = this.objectPool.acquire();
    task.name = 'Data Save Task';
    task.execute = async () => {
      await this.databaseManager.saveData(filePath, key, data);
      this.objectPool.release(task);
    };
    this.addTask(task);
  }
  addCombatActionTask(player, target) {
    const task = this.objectPool.acquire();
    task.name = 'Combat Action Task';
    task.execute = () => {
      player.attackNpc(target);
      this.objectPool.release(task);
    };
    this.addTask(task);
  }
  addEventProcessingTask(event) {
    const task = this.objectPool.acquire();
    task.name = 'Event Processing Task';
    task.execute = () => {
      this.objectPool.release(task);
    };
    this.addTask(task);
  }
  addHealthRegenerationTask(player) {
    const task = this.objectPool.acquire();
    task.name = 'Health Regeneration Task';
    task.execute = () => {
      player.startHealthRegeneration();
      this.objectPool.release(task);
    };
    this.addTask(task);
  }
  addInventoryManagementTask(player, action, item) {
    const task = this.objectPool.acquire();
    task.name = 'Inventory Management Task';
    task.execute = () => {
      action === 'pickup' ? player.addToInventory(item) : player.removeFromInventory(item);
      this.objectPool.release(task);
    };
    this.addTask(task);
  }
  addNotificationTask(player, message) {
    const task = this.objectPool.acquire();
    task.name = 'Notification Task';
    task.execute = () => {
      MessageManager.notify(player, message);
      this.objectPool.release(task);
    };
    this.addTask(task);
  }
  cleanup() {
    this.queue = [];
    this.isProcessing = false;
    this.objectPool = null; // Clear object pool reference
  }
}
// Config Class ************************************************************************************
class Config {
  async loadConfig() {
    console.log(`\nSTARTING LOAD CONFIGURATION SETTINGS:`);
    try {
      this.CONFIG = await import('./config.js').then(module => module.default); // Ensure CONFIG is loaded correctly
      console.log(`LOAD CONFIGURATION SETTINGS FINISHED.`);
      //console.log('Loaded CONFIG:', this.CONFIG); // Debugging log
    } catch (error) {
      console.error(`ERROR LOADING CONFIG: ${error.message}`); // Log the error
    }
  }
  get SSL_KEY_PATH() {
    return this.CONFIG?.SSL_KEY_PATH; // Use optional chaining
  }
  get SSL_CERT_PATH() {
    return this.CONFIG?.SSL_CERT_PATH; // Use optional chaining
  }
  get HOST() {
    return this.CONFIG?.HOST; // Use optional chaining
  }
  get PORT() {
    return this.CONFIG?.PORT; // Use optional chaining
  }
  get LOG_LEVEL() {
    if (!this.CONFIG) throw new Error('CONFIG is not loaded');
    return this.CONFIG?.LOG_LEVEL;
  }
  get LOG_FILE_PATH() {
    return this.CONFIG?.LOG_FILE_PATH; // Use optional chaining
  }
  get LOG_MAX_FILE_SIZE() {
    return this.CONFIG?.LOG_MAX_FILE_SIZE; // Use optional chaining
  }
  get PLAYER_DATA_PATH() {
    return this.CONFIG?.PLAYER_DATA_PATH; // Use optional chaining
  }
  get LOCATION_DATA_PATH() {
    return this.CONFIG?.LOCATION_DATA_PATH; // Use optional chaining
  }
  get NPC_DATA_PATH() {
    return this.CONFIG?.NPC_DATA_PATH; // Use optional chaining
  }
  get ITEM_DATA_PATH() {
    return this.CONFIG?.ITEM_DATA_PATH; // Use optional chaining
  }
  get GAME_DATA_PATH() {
    return this.CONFIG?.GAME_DATA_PATH; // Use optional chaining
  }
  get TICK_RATE() {
    return this.CONFIG?.TICK_RATE; // Use optional chaining
  }
  get NPC_MOVEMENT_INTERVAL() {
    return this.CONFIG?.NPC_MOVEMENT_INTERVAL; // Use optional chaining
  }
  get REGEN_INTERVAL() {
    return this.CONFIG?.REGEN_INTERVAL; // Use optional chaining
  }
  get REGEN_RATES() {
    return this.CONFIG?.REGEN_RATES; // Use optional chaining
  }
  get LEVEL_UP_XP() {
    return this.CONFIG?.LEVEL_UP_XP; // Use optional chaining
  }
  get INVENTORY_CAPACITY() {
    return this.CONFIG?.INVENTORY_CAPACITY; // Use optional chaining
  }
  get RESET() {
    return this.CONFIG?.RESET; // Use optional chaining
  }
  get RED() {
    return this.CONFIG?.RED; // Use optional chaining
  }
  get MAGENTA() {
    return this.CONFIG?.MAGENTA; // Use optional chaining
  }
}
// Start the server *******************************************************************************
const config = new Config();
await config.loadConfig(); // Load config first
const logger = new Logger(config.CONFIG); // Pass the loaded CONFIG to logger
const server = new Server({ logger, config }); // Initialize server without moduleImporter
const moduleImporter = new ModuleImporter({ logger, server }); // Pass server instance
server.moduleImporter = moduleImporter; // Assign moduleImporter to server
// Ensure modules are imported before initializing the server
await server.init(); // Now initialize the server
const gameComponentInitializer = new GameComponentInitializer({ server, logger });
await gameComponentInitializer.setupGameComponents();
// Start listening for incoming connections
server.server.listen(server.config.PORT, server.config.HOST, () => {
    server.logger.info(`Server is running on ${server.config.HOST}:${server.config.PORT}`);
});