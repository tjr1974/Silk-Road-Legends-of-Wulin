// Server *****************************************************************************************
/*
 * The Server class is the main entry point for the game server. It is responsible for initializing
 * the server environment, setting up middleware, and managing the game loop.
*/
class Server {
  constructor({ logger, moduleImporter, config }) {
    this.logger = logger;
    this.moduleImporter = moduleImporter;
    this.config = config; // Add config dependency
    this.databaseManager = null; // Initialize as null
    this.socketEventManager = null; // Initialize as null
    this.serverSetup = null; // Initialize as null
  }
  async init() {
    try {
      await this.moduleImporter.importModules();
      this.databaseManager = new DatabaseManager({ server: this, logger: this.logger });
      this.socketEventManager = new SocketEventManager({ server: this, logger: this.logger });
      this.serverSetup = new ServerSetup({ server: this, logger: this.logger, socketEventManager: this.socketEventManager, config: this.config }); // Pass config
      await this.serverSetup.setupServer();
    } catch (error) {
      this.logger.error(`ERROR during server initialization: ${error.message}`, { error });
    }
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
  }
  setupSocketEvents() {
    this.server.io.on('connection', (socket) => {
      const sessionId = socket.handshake.query.sessionId;
      if (this.server.activeSessions.has(sessionId)) {
        this.logger.warn(`${this.logger.CONFIG.MAGENTA}User with session ID ${sessionId} is already connected.${this.logger.CONFIG.RESET}`, { sessionId });
        socket.emit('sessionError', 'You are already connected.');
        socket.disconnect();
        return;
      }
      this.server.activeSessions.set(sessionId, socket.id);
      this.logger.info(`A user connected: ${socket.id} with session ID ${sessionId}`, { sessionId, socketId: socket.id });
      this.setupSocketListeners(socket, sessionId);
    });
  }
  setupSocketListeners(socket, sessionId) {
    socket.on('playerAction', (actionData) => this.handlePlayerAction(socket, actionData));
    socket.on('sendMessage', (messageData) => this.handleMessage(socket, messageData));
    socket.on('disconnect', () => {
      this.logger.info(`User disconnected: ${socket.id}`, { socketId: socket.id });
      this.server.activeSessions.delete(sessionId);
    });
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
  constructor({ logger }) {
    this.logger = logger;
  }
  async importModules() {
    try {
      this.logger.info(`STARTING MODULE IMPORTS:`);
      this.logger.info(`  - Importing Config Module...`);
      this.CONFIG = await import('./config.js');
      this.logger.info(`  - Config module imported successfully.`);
      this.logger.info(`  - Importing File System Module...`);
      this.fs = await import('fs').then(module => module.promises);
      this.logger.info(`  - File System module imported successfully.`);
      this.logger.info(`  - Importing Express Module...`);
      this.express = (await import('express')).default;
      this.logger.info(`  - Express module imported successfully.`);
      this.logger.info(`  - Importing Socket.IO Module...`);
      this.SocketIOServer = (await import('socket.io')).Server;
      this.logger.info(`  - Socket.IO module imported successfully.`);
      this.logger.info(`  - Importing Queue Module...`);
      this.queue = new (await import('queue')).default();
      this.logger.info(`  - Queue module imported successfully.`);
      this.logger.info(`MODULE IMPORTS COMPLETED SUCCESSFULLY.`);
    } catch (error) {
      this.logger.error(`ERROR during module imports: ${error.message}`, { error });
    }
  }
}
// Server Setup ***********************************************************************************
/*
 * The ServerSetup class is responsible for configuring the server environment, including setting up
 * the Express application, initializing the Socket.IO server, and managing middleware.
*/
class ServerSetup {
  constructor({ server, logger, socketEventManager, config }) {
    this.server = server;
    this.logger = logger;
    this.socketEventManager = socketEventManager;
    this.config = config; // Add config dependency
    this.server.app = null; // Ensure app is initialized
    this.server.express = null; // Ensure express is initialized
  }
  async setupServer() {
    this.logger.info(`\nSTARTING SERVER SETUP:`);
    try {
      this.logger.info(`  - Starting Express...`);
      this.server.express = (await import('express')).default; // Ensure this is correctly assigned
      this.server.app = this.server.express(); // Ensure this is correctly assigned
      this.server.app.use(this.server.express.static('public'));
      this.server.app.use((err, req, res, next) => {
        this.logger.error(err.message, { error: err });
        res.status(500).send('An unexpected error occurred. Please try again later.');
      });
      this.logger.info(`  - Start Express completed successfully.`);
      this.logger.info(`  - Starting Server...`);
      await this.createServer();
      if (!this.server.server) throw new Error('Start Server unsuccessful!!!');
      this.logger.info(`  - Server started successfully.`);
      this.logger.info(`  - Starting Logger...`);
      this.logger = new Logger();
      this.logger.info(`  - Logger started successfully.`);
      this.logger.info(`  - Starting Socket.IO...`);
      this.server.io = new this.server.SocketIOServer(this.server.server);
      if (!this.server.io) throw new Error('Start Socket.IO unsuccessful!!!');
      this.logger.info(`  - Socket.IO started successfully.`);
      this.logger.info(`  - Starting Socket Events...`);
      this.server.socketEventManager = new SocketEventManager(this.server);
      await this.server.socketEventManager.setupSocketEvents();
      if (!this.server.socketEventManager) throw new Error('Start Socket Events unsuccessful!!!');
      this.logger.info(`  - Socket Events started successfully.`);
      this.logger.info(`  - Starting Queue Manager...`);
      this.server.queueManager = new QueueManager();
      if (!this.server.queueManager) throw new Error('Start queue manager unsuccessful!!!');
      this.logger.info(`  - Queue Manager started successfully.`);
      this.logger.info(`  - Starting Game Component Initializer...`);
      this.gameComponentInitializer = new GameComponentInitializer(this);
      if (!this.gameComponentInitializer) throw new Error('Start Game Component Initializer unsuccessful!!!');
      this.logger.info(`  - Game Component Initializer started successfully.`);
      this.logger.info(`SERVER SETUP COMPLETED SUCCESSFULLY.`);
    } catch (error) {
      this.logger.error(`ERROR during server setup: ${error.message}`, { error });
    }
  }
  async createServer() {
    const sslOptions = { key: null, cert: null };
    try {
      sslOptions.key = await this.server.fs.readFile(this.config.SSL_KEY_PATH); // Use config
    } catch (error) {
      this.logger.warn(`    - WARNING: Read SSL key: ${error.message}...`, { error });
    }
    try {
      sslOptions.cert = await this.server.fs.readFile(this.config.SSL_CERT_PATH); // Use config
    } catch (error) {
      this.logger.warn(`    - WARNING: Read SSL cert: ${error.message}...`, { error });
    }
    const isHttps = sslOptions.key && sslOptions.cert;
    const http = isHttps ? await import('https') : await import('http');
    this.server.server = http.createServer(isHttps ? { key: sslOptions.key, cert: sslOptions.cert } : this.server.app);
    this.logger.info(`    - Server created using ${isHttps ? 'https' : 'http'}.`);
    this.logger.info(`    - Starting server on ${isHttps ? 'https' : 'http'}://${this.config.HOST}:${this.config.PORT}...`);
    return this.server.server;
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
  log(level, message, context = {}) {
    const logString = level === 'ERROR' ? `${this.CONFIG.RED}${message}${this.CONFIG.RESET}` : message; // Change here for error messages
    if (level === 'WARN') {
      message = `${this.CONFIG.MAGENTA}${message}${this.CONFIG.RESET}`; // Add magenta for warnings
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
  async initializeGameComponents() {
    this.logger.info(`\nSTARTING GAME COMPONENTS:`);
    try {
      this.logger.info(`  - Starting Database Manager...`);
      this.server.databaseManager = new DatabaseManager({ server: this.server, logger: this.logger });
      await this.server.databaseManager.initialize();
      if (!this.server.databaseManager) throw new Error('DatabaseManager initialization failed!!!');
      this.logger.info(`  - Database Manager started successfully.`);
      this.logger.info(`  - Loading Game Data...`);
      this.server.gameDataLoader = new GameDataLoader(this.server);
      if (!this.server.gameDataLoader) throw new Error('GameDataLoader is not initialized!');
      this.logger.info(`  - Game Data loaded successfully.`);
      this.logger.debug(`  - Verifying Game Data...`);
      const gameDataVerifier = new GameDataVerifier(this.server.databaseManager);
      const verifiedData = await gameDataVerifier.verifyData();
      this.logger.debug(`  - Game Data verified successfully.`);
      this.logger.info(`  - Starting Game Manager...`);
      this.server.gameManager = new GameManager({ eventEmitter: this.server.eventEmitter });
      if (!this.server.gameManager) throw new Error('GameManager initialization failed!!!');
      this.logger.info(`  - Game Manager started successfully.`);
    } catch (error) {
      this.logger.error(`ERROR during game component initialization: ${error.message} - ${error.stack}`, { error });
    }
    this.logger.info(`STARTING GAME COMPONENTS COMPLETED SUCCESSFULLY...`);
  }
}
// GameManager Class ********************************************************************************
class GameManager {
  #gameLoopInterval = null;
  #gameTime = 0;
  #isRunning = false;
  #combatManager;
  constructor({ eventEmitter }) {
    this.players = new Map();
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
  async loadGameData() {
    this.server.logger.info(`\nStarting game data loading...`);
    const DATA_TYPES = { LOCATION: 'location', NPC: 'npc', ITEM: 'item' };
    const loadData = async (loadFunction, type) => {
      try {
        const data = await loadFunction();
        this.server.logger.info(`${type} data loaded successfully.`, { type });
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
  async verifyData() {
    const locationData = await this.databaseManager.loadLocationData();
    const npcData = await this.databaseManager.loadNpcData();
    const itemData = await this.databaseManager.loadItemData();
    const verifiedData = { locationData, npcData, itemData };
    this.databaseManager.logger.debug(`Game Data:`, JSON.stringify(verifiedData, null, 2));
    return verifiedData;
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
    console.log('Loading configuration...');
    try {
      this.CONFIG = await import('./config.js').then(module => module.default); // Ensure CONFIG is loaded correctly
      console.log('Loaded CONFIG:', this.CONFIG); // Debugging log
    } catch (error) {
      console.error(`Failed to load config: ${error.message}`); // Log the error
      throw new Error(`Failed to load config: ${error.message}`);
    }
  }
  get SSL_KEY_PATH() {
    return this.CONFIG.SSL_KEY_PATH;
  }
  get SSL_CERT_PATH() {
    return this.CONFIG.SSL_CERT_PATH;
  }
  get HOST() {
    return this.CONFIG.HOST;
  }
  get PORT() {
    return this.CONFIG.PORT;
  }
  get LOG_LEVEL() {
    if (!this.CONFIG) throw new Error('CONFIG is not loaded');
    return this.CONFIG.LOG_LEVEL;
  }
  get LOG_FILE_PATH() {
    return this.CONFIG.LOG_FILE_PATH;
  }
  get LOG_MAX_FILE_SIZE() {
    return this.CONFIG.LOG_MAX_FILE_SIZE;
  }
  get PLAYER_DATA_PATH() {
    return this.CONFIG.PLAYER_DATA_PATH;
  }
  get LOCATION_DATA_PATH() {
    return this.CONFIG.LOCATION_DATA_PATH;
  }
  get NPC_DATA_PATH() {
    return this.CONFIG.NPC_DATA_PATH;
  }
  get ITEM_DATA_PATH() {
    return this.CONFIG.ITEM_DATA_PATH;
  }
  get GAME_DATA_PATH() {
    return this.CONFIG.GAME_DATA_PATH;
  }
  get TICK_RATE() {
    return this.CONFIG.TICK_RATE;
  }
  get NPC_MOVEMENT_INTERVAL() {
    return this.CONFIG.NPC_MOVEMENT_INTERVAL;
  }
  get REGEN_INTERVAL() {
    return this.CONFIG.REGEN_INTERVAL;
  }
  get REGEN_RATES() {
    return this.CONFIG.REGEN_RATES;
  }
  get LEVEL_UP_XP() {
    return this.CONFIG.LEVEL_UP_XP;
  }
  get INVENTORY_CAPACITY() {
    return this.CONFIG.INVENTORY_CAPACITY;
  }
  get RESET() {
    return this.CONFIG.RESET;
  }
  get RED() {
    return this.CONFIG.RED;
  }
  get MAGENTA() {
    return this.CONFIG.MAGENTA;
  }
}

// Start the server *******************************************************************************
const config = new Config();
await config.loadConfig(); // Load config first
console.log('Config after loading:', config.CONFIG); // Debugging log
const logger = new Logger(config.CONFIG); // Pass the loaded CONFIG to logger
const moduleImporter = new ModuleImporter({ logger });
const server = new Server({ logger, moduleImporter, config });
await server.init();
const gameComponentInitializer = new GameComponentInitializer({ server, logger });
await gameComponentInitializer.initializeGameComponents();