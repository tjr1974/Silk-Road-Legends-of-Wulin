// Server *****************************************************************************************
/*
 * The Server class is the main entry point for the game server. It is responsible for initializing
 * the server environment, setting up middleware, and managing the game loop.
*/
class Server {
  constructor({ config, logger, moduleImporter }) {
    this.config = config; // Add config dependency
    this.logger = logger; // Ensure logger is available
    this.moduleImporter = moduleImporter;
    this.databaseManager = null; // Initialize as null
    this.socketEventManager = null; // Initialize as null
    this.serverConfigurator = null; // Initialize as null
    this.fs = null; // Initialize fs as null
    this.activeSessions = new Map(); // Use Map for efficient session management
  }
  async init() {
    try {
      await this.moduleImporter.loadModules();
      this.fs = await import('fs').then(module => module.promises); // Import fs here
      this.databaseManager = new DatabaseManager({ server: this, logger: this.logger }); // Pass logger
      this.socketEventManager = new SocketEventManager({ server: this, logger: this.logger }); // Pass logger
      this.serverConfigurator = new ServerConfigurator({ server: this, logger: this.logger, socketEventManager: this.socketEventManager, config: this.config }); // Pass logger
      await this.serverConfigurator.configureServer();
    } catch (error) {
      this.logger.error(`ERROR during server initialization: ${error.message}`, { error });
    }
  }
  async setupHttpServer() { // Renamed from 'initializeHttpServer' to 'setupHttpServer'
    const sslOptions = { key: null, cert: null };
    try {
      sslOptions.cert = await this.fs.readFile(this.config.SSL_CERT_PATH); // Use config
    } catch (error) {
      this.logger.warn(`${this.logger.CONFIG.MAGENTA}- - WARNING: Read SSL cert: ${error.message}${this.logger.CONFIG.RESET}`, { error });
    }
    try {
      sslOptions.key = await this.fs.readFile(this.config.SSL_KEY_PATH); // Use config
    } catch (error) {
      this.logger.warn(`${this.logger.CONFIG.MAGENTA}- - WARNING: Read SSL  key: ${error.message}${this.logger.CONFIG.RESET}`, { error });
    }
    const isHttps = sslOptions.key && sslOptions.cert;
    const http = isHttps ? await import('https') : await import('http');
    this.server = http.createServer(isHttps ? { key: sslOptions.key, cert: sslOptions.cert } : this.app);
    this.logger.info(`- Server configured using ${isHttps ? 'https' : 'http'}://${this.config.HOST}:${this.config.PORT}`);
    return this.server;
  }
}
// Socket Event Manager ***************************************************************************
/*
 * The SocketEventManager class handles socket events for real-time communication between the server
 * and connected clients. It manages user connections and disconnections.
*/
class SocketEventManager {
  constructor({ server, logger }) {
    this.server = server;
    this.logger = logger;
    this.socketListeners = new Map(); // Store listeners for efficient management
  }
  initializeSocketEvents() { // Renamed from 'setupSocketEvents' to 'initializeSocketEvents'
    this.logger.info(`Setting up Socket.IO events.`); // New log message
    this.server.io.on('connection', (socket) => {
      this.logger.info(`A new socket connection established: ${socket.id}`); // New log message
      const sessionId = socket.handshake.query.sessionId;
      if (this.server.activeSessions.has(sessionId)) {
        this.logger.warn(`${this.logger.CONFIG.MAGENTA}User with session ID ${sessionId} is already connected.${this.logger.CONFIG.RESET}`, { sessionId });
        socket.emit('sessionError', 'You are already connected.');
        socket.disconnect();
        return;
      }
      this.server.activeSessions.set(sessionId, socket.id);
      this.logger.info(`A user connected: ${socket.id} with session ID ${sessionId}`, { sessionId, socketId: socket.id });
      this.initializeSocketListeners(socket, sessionId);
    });
  }
  initializeSocketListeners(socket, sessionId) { // Renamed from 'setupSocketListeners' to 'initializeSocketListeners'
    const listeners = {
      playerAction: (actionData) => this.handlePlayerAction(socket, actionData),
      sendMessage: (messageData) => this.handleMessage(socket, messageData),
      disconnect: () => {
        this.logger.info(`User disconnected: ${socket.id}`, { socketId: socket.id });
        this.server.activeSessions.delete(sessionId);
      }
    };
    for (const [event, listener] of Object.entries(listeners)) {
      socket.on(event, listener);
      this.socketListeners.set(socket.id, listener); // Store listener for cleanup
    }
  }
  handleMessage(socket, { type, content, targetId }) {
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
  }
  handlePlayerAction(socket, actionData) {
    const { actionType, payload } = actionData;
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
}
// Module Importer ********************************************************************************
/*
 * The ModuleImporter class is responsible for importing necessary modules and dependencies for the
 * server to function. It ensures that all required modules are loaded before the server starts.
*/
class ModuleImporter {
  constructor({ logger, server }) { // Add server to the constructor
    this.logger = logger;
    this.server = server; // Store server reference
  }
  async loadModules() { // Renamed from 'importModules' to 'loadModules'
    try {
      this.logger.info(`\n`);
      this.logger.info(`STARTING MODULE IMPORTS:`);
      this.logger.info(`- Importing File System Module`);
      this.fs = await import('fs').then(module => module.promises);
      this.logger.info(`- Importing Express Module`);
      this.express = (await import('express')).default; // Ensure express is imported correctly
      this.server.app = this.express(); // Initialize app here
      this.logger.info(`- Importing Socket.IO Module`);
      this.SocketIOServer = (await import('socket.io')).Server;
      this.logger.info(`- Importing Queue Module`);
      this.queue = new (await import('queue')).default();
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
class ServerConfigurator {
  constructor({ config, logger, server, socketEventManager  }) {
    this.config = config; // Add config dependency
    this.logger = logger;
    this.server = server;
    this.socketEventManager = socketEventManager;
    this.server.app = null; // Ensure app is initialized
    this.server.express = null; // Ensure express is initialized
  }
  async configureServer() { // Renamed from 'setupServer' to 'configureServer'
    this.logger.info(`\n`);
    this.logger.info(`STARTING SERVER CONFIGURATION:`);
    try {
      await this.setupExpressApp(); // Ensure Express is initialized first
      this.configureExpressMiddleware(); // Now setup Express
      await this.server.setupHttpServer();
      if (!this.server.server) {
        this.logger.error('Server configuration unsuccessful!!!');
      }
    } catch (error) {
      this.logger.error(`ERROR during Server configuration: ${error.message}`, { error });
    }
    try {
      this.logger.log('INFO', '- Configuring Queue Manager');
      this.server.queueManager = new QueueManager();
      if (!this.server.queueManager) {
        this.logger.error('Queue Manager configuration unsuccessful!!!');
      }
    } catch (error) {
      this.logger.error(`ERROR during Queue Manager configuration: ${error.message}`, { error });
    }
    try {
      this.logger.log('INFO', '- Configuring Game Component Initializer');
      this.gameComponentInitializer = new GameComponentInitializer(this);
      if (!this.gameComponentInitializer) {
        this.logger.error('Game Component Initializer configuration unsuccessful!!!');
      }
    } catch (error) {
      this.logger.error(`ERROR during Game Component Initializer configuration: ${error.message}`, { error });
    }
    this.logger.info(`SERVER CONFIGURATION FINISHED.`);
  }
  async setupExpressApp() { // Renamed from 'initializeExpress' to 'setupExpressApp'
    this.logger.log('INFO', '- Initializing Express');
    this.server.express = (await import('express')).default; // Ensure express is imported correctly
    this.server.app = this.server.express(); // Initialize app here
  }
  configureExpressMiddleware() { // Renamed from 'setupExpress' to 'configureExpressMiddleware'
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
  log(level, message, context = {}) {}
  debug(message, context) {}
  info(message, context) {}
  warn(message, context) {}
  error(message, context) {}
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
  log(level, message, context = {}, indentLevel = 0) {
    const logString = level === 'ERROR' ? `${this.CONFIG.RED}${message}${this.CONFIG.RESET}` : `${message}`;
    if (level === 'WARN') {
      message = `${this.CONFIG.MAGENTA}${message}${this.CONFIG.RESET}`;
    }
    this.writeToConsole(logString);
  }
  writeToConsole(logString) {
    console.log(logString.trim());
  }
  debug(message, context) {
    this.log('DEBUG', message, context);
  }
  info(message, context) {
    this.log('INFO', message, context);
  }
  warn(message, context) {
    this.log('WARN', message, context);
  }
  error(message, context) {
    this.log('ERROR', message, context);
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
class DatabaseManager extends IDatabaseManager {
  constructor({ server, logger }) {
    super();
    this.server = server;
    this.logger = logger;
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
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => `${directoryPath}/${file}`);
  }
  async loadLocationData() {
    try {
      const files = await this.getFilesInDirectory(this.DATA_PATHS.LOCATIONS);
      const locationData = [];
      for (const file of files) {
        const data = await this.fs.readFile(file, 'utf-8');
        locationData.push(JSON.parse(data));
      }
      return locationData;
    } catch (error) {
      this.logger.error(`ERROR loading location data: ${error.message}`, { error });
      throw error;
    }
  }
  async loadNpcData() {
    try {
      const files = await this.getFilesInDirectory(this.DATA_PATHS.NPCS);
      const npcData = [];
      for (const file of files) {
        const data = await this.fs.readFile(file, 'utf-8');
        npcData.push(JSON.parse(data));
      }
      return npcData;
    } catch (error) {
      this.logger.error(`ERROR loading NPC data: ${error.message}`, { error });
      throw error;
    }
  }
  async loadItemData() {
    try {
      const files = await this.getFilesInDirectory(this.DATA_PATHS.ITEMS);
      const itemData = [];
      for (const file of files) {
        const data = await this.fs.readFile(file, 'utf-8');
        itemData.push(JSON.parse(data));
      }
      return itemData;
    } catch (error) {
      this.logger.error(`ERROR loading item data: ${error.message}`, { error });
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
}
// GameComponentInitializer Class ******************************************************************
class GameComponentInitializer {
  constructor({ server, logger }) {
    this.server = server;
    this.logger = logger;
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
    this.locations = new Map();
    this.npcs = new Map();
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
      this.server.socketEventManager.server.io.close(() => { // Close all socket connections
        this.server.logger.info('All socket connections closed.');
        process.exit(0); // Exit the program
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
    if (newLocation) {
      newLocation.addEntity(entity, "players");
      MessageManager.notifyEnteringLocation(entity, newLocationId);
      const direction = DirectionManager.getDirectionFrom(oldLocationId);
      MessageManager.notify(entity, `${entity.getName()} arrives ${direction}.`);
    }
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
      player.checkAndRemoveExpiredAffects();
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
    this.server.logger.info(`\nStarting game data loading.`);
    const DATA_TYPES = { LOCATION: 'location', NPC: 'npc', ITEM: 'item' };
    const loadData = async (loadFunction, type) => {
      try {
        const data = await loadFunction();
        this.server.logger.info(`${type} data loaded.`, { type });
        return { type, data };
      } catch (error) {
        this.server.logger.error(`ERROR loading ${type} data: ${error.message}`, { error, type });
        return { type, error };
      }
    };
    const results = await Promise.allSettled([
      loadData(this.server.databaseManager.loadLocationData.bind(this.server.databaseManager), DATA_TYPES.LOCATION),
      loadData(this.server.databaseManager.loadNpcData.bind(this.server.databaseManager), DATA_TYPES.NPC),
      loadData(this.server.databaseManager.loadItemData.bind(this.server.databaseManager), DATA_TYPES.ITEM),
    ]);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.server.logger.error(`Failed to load data at index ${index}: ${result.reason.message}`, { error: result.reason, index });
      }
    });
    this.server.logger.info(`Finished loading game data.`);
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
    if (this.isProcessing) return;
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      try {
        task.run();
      } catch (error) {
        console.error(`ERROR processing task: ${error.message}`);
      }
    }
    this.isProcessing = false;
    this.cleanup();
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
    this.objectPool = null;
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
const server = new Server({ logger, moduleImporter: null, config }); // Initialize server with null moduleImporter
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