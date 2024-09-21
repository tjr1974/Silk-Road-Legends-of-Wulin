// Interfaces
class ILogger {
  log() { }
  debug() { }
  info() { }
  warn() { }
  error() { }
}
class IDatabaseManager {
  constructor({ server, logger }) {
    this.server = server; // Store server reference
    this.logger = logger; // Store logger reference
  }
  async loadLocationData() { } // Method to load location data
  async loadNpcData() { } // Method to load NPC data
  async loadItemData() { } // Method to load item data
  async saveData() { } // Method to save data
  async initialize() { } // New method for initialization
}
class IEventEmitter {
  on() { }
  emit() { }
  off() { }
}
// Base Classes
class BaseManager {
  constructor({ server, logger }) {
    this.server = server; // Store server reference
    this.logger = logger; // Store logger reference
  }
}
// Configuration
class ConfigManager {
  constructor() {
    this.config = null;
  }
  async loadConfig() {
    try {
      const { default: CONFIG } = await import('./config.js');
      this.config = {
        HOST: CONFIG.HOST,
        PORT: CONFIG.PORT,
        SSL_CERT_PATH: CONFIG.SSL_CERT_PATH,
        SSL_KEY_PATH: CONFIG.SSL_KEY_PATH,
        LOG_LEVEL: CONFIG.LOG_LEVEL,
        LOCATION_DATA_PATH: CONFIG.LOCATION_DATA_PATH,
        NPC_DATA_PATH: CONFIG.NPC_DATA_PATH,
        ITEM_DATA_PATH: CONFIG.ITEM_DATA_PATH,
        TICK_RATE: CONFIG.TICK_RATE,
        WORLD_EVENT_INTERVAL: CONFIG.WORLD_EVENT_INTERVAL
      };
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  }
  get(key) {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config[key];
  }
}
// Core Components
class Server {
  constructor({ logger }) {
    this.eventEmitter = new EventEmitter(); // Instantiate EventEmitter
    this.configManager = new ConfigManager(); // Create instance
    this.logger = logger;
    this.databaseManager = null;
    this.socketEventManager = null;
    this.serverConfigurator = null;
    this.fs = null;
    this.activeSessions = new Map();
    this.moduleImporter = new ModuleImporter({ server: this, logger: this.logger }); // Add this line
    this.gameManager = null; // Add this line
    this.isHttps = false; // Add this line
  }
  async init() {
    try {
      await this.configManager.loadConfig(); // Load config asynchronously
      await this.moduleImporter.loadModules();
      this.fs = await import('fs').then(module => module.promises);
      this.databaseManager = new DatabaseManager({ server: this, logger: this.logger });
      this.socketEventManager = new SocketEventManager({ server: this, logger: this.logger });
      this.serverConfigurator = new ServerConfigurator({ server: this, logger: this.logger, socketEventManager: this.socketEventManager, config: this.configManager });
      await this.serverConfigurator.configureServer();
      await this.configManager.loadConfig(); // Load configuration
      this.eventEmitter.on('playerConnected', this.handlePlayerConnected.bind(this)); // Listen for player connection
      // Initialize GameManager with logger
      this.gameManager = new GameManager({ eventEmitter: this.eventEmitter, logger: this.logger, server: this });
    } catch (error) {
      this.logger.error(`ERROR: Server initialization: ${error.message}`, { error });
      this.logger.error(error.stack); // Log stack trace
    }
  }
  handlePlayerConnected(player) {
    this.logger.info(`Player connected: ${player.getName()}`); // Handle player connection event
  }
  async setupHttpServer() { // Kept async
    const sslOptions = { key: null, cert: null };
    const SSL_CERT_PATH = this.configManager.get('SSL_CERT_PATH'); // Use ConfigManager
    const SSL_KEY_PATH = this.configManager.get('SSL_KEY_PATH'); // Use ConfigManager
    try {
      sslOptions.cert = await this.fs.readFile(SSL_CERT_PATH); // Keep await here
    } catch (error) {
      this.logger.warn(`- - WARNING: Read SSL cert: ${error.message}`, { error });
    }
    try {
      sslOptions.key = await this.fs.readFile(SSL_KEY_PATH); // Keep await here
    } catch (error) {
      this.logger.warn(`- - WARNING: Read SSL  key: ${error.message}`, { error });
    }
    this.isHttps = sslOptions.key && sslOptions.cert; // Set isHttps based on SSL files
    const http = this.isHttps ? await import('https') : await import('http'); // Keep await here
    this.server = http.createServer(this.isHttps ? { key: sslOptions.key, cert: sslOptions.cert } : this.app);
    this.logger.info(`- Configuring Server using ${this.isHttps ? 'https' : 'http'}://${this.configManager.get('HOST')}:${this.configManager.get('PORT')}`);
    return this.server;
  }
  cleanup() {
    this.databaseManager = null;
    this.socketEventManager = null;
    this.serverConfigurator = null;
    this.fs = null;
    this.activeSessions.clear(); // Clear active sessions
  }
  startGame() {
    if (this.isGameRunning()) {
      this.logger.warn('Game is already running.');
      return;
    }
    try {
      this.startGameLoop();
      this.isRunning = true;
      const isHttps = this.isHttps; // Use the isHttps property from the Server class
      const host = this.configManager.get('HOST');
      const port = this.configManager.get('PORT');
      this.logger.info(`\n`);
      this.logger.info(`SERVER IS RUNNING AT: ${isHttps ? 'https' : 'http'}://${host}:${port}`);
      this.logger.info(`\n`);
    } catch (error) {
      this.logger.error(`Error starting game: ${error.message}`);
      this.logger.error(error.stack);
    }
  }
  isGameRunning() {
    return this.isRunning;
  }
}
class ModuleImporter extends BaseManager {
  constructor({ server, logger }) {
    super({ server, logger });
  }
  async loadModules() {
    try {
      this.logger.info(`\n`);
      this.logger.info(`STARTING MODULE IMPORTS:`);
      this.logger.info(`- Importing Process Module`);
      try {
        await import('process'); // Update the import in loadModules
        this.logger.info(`- Importing File System Module`);
        const fsModule = await import('fs'); // Corrected import
        this.fs = fsModule.promises; // Access promises property correctly
      } catch (error) {
        this.logger.error(`ERROR: Importing File System Module failed: ${error.message}`, { error });
        this.logger.error(error.stack); // Log stack trace
      }
      this.logger.info(`- Importing Express Module`);
      try {
        this.express = (await import('express')).default;
      } catch (error) {
        this.logger.error(`ERROR: Importing Express Module failed: ${error.message}`, { error });
        this.logger.error(error.stack); // Log stack trace
      }
      this.logger.info(`- Importing Socket.IO Module`);
      try {
        this.SocketIOServer = (await import('socket.io')).Server;
      } catch (error) {
        this.logger.error(`ERROR: Importing Socket.IO Module failed: ${error.message}`, { error });
        this.logger.error(error.stack); // Log stack trace
      }
      this.logger.info(`- Importing Queue Module`);
      try {
        this.queue = new (await import('queue')).default();
      } catch (error) {
        this.logger.error(`ERROR: Importing Queue Module failed: ${error.message}`, { error });
        this.logger.error(error.stack); // Log stack trace
      }
      this.logger.info(`MODULE IMPORTS FINISHED.`);
    } catch (error) {
      this.logger.error(`ERROR: During module imports: ${error.message}`, { error });
      this.logger.error(error.stack); // Log stack trace
    }
  }
}
class ServerConfigurator extends BaseManager {
  constructor({ config, logger, server, socketEventManager }) {
    super({ server, logger });
    this.config = config;
    this.socketEventManager = socketEventManager;
    this.server.app = null;
    this.server.express = null;
  }
  async configureServer() {
    const { logger, server } = this;
    logger.info(`\n`);
    logger.info(`STARTING SERVER CONFIGURATION:`);
    logger.info(`- Configuring Express`);
    try {
      await this.setupExpress(); // Ensure this method is defined
    } catch (error) {
      logger.error(`ERROR: During Express configuration: ${error.message}`, { error });
      logger.error(error.stack); // Log stack trace
    }
    logger.info(`- Configuring Server`);
    try {
      await server.setupHttpServer();
    } catch (error) {
      logger.error(`ERROR: During Http Server configuration: ${error.message}`, { error });
      logger.error(error.stack); // Log stack trace
    }
    logger.info(`- Configuring Middleware`);
    try {
      this.configureMiddleware(); // Call the middleware configuration
    } catch (error) {
      logger.error(`ERROR: During Middleware configuration: ${error.message}`, { error });
      logger.error(error.stack); // Log stack trace
    }
    logger.log('INFO', '- Configuring Queue Manager');
    try {
      server.queueManager = new QueueManager();
    } catch (error) {
      logger.error(`ERROR: During Queue Manager configuration: ${error.message}`, { error });
      logger.error(error.stack); // Log stack trace
    }
    logger.info(`SERVER CONFIGURATION FINISHED.`);
  }
  async setupExpress() { // Renamed from 'initializeExpress' to 'setupExpressApp'
    this.server.express = (await import('express')).default; // Ensure express is imported correctly
    this.server.app = this.server.express(); // Initialize app here
  }
  configureMiddleware() { // Removed async
    this.server.app.use(this.server.express.static('public'));
    this.server.app.use((err, res ) => {
      this.logger.error(err.message, { error: err });
      this.logger.error(err.stack); // Log stack trace
      res.status(500).send('An unexpected error occurred. Please try again later.');
    });
  }
}
// Event and Communication
class EventEmitter extends IEventEmitter {
  constructor() {
    super(); // Call the parent constructor
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
        this.logger.warn(`User with session ID ${sessionId} is already connected.`, { sessionId });
        socket.emit('sessionError', 'You are already connected.');
        socket.disconnect();
        return;
      }
      this.activeSessions.add(sessionId); // Add sessionId to Set
      this.logger.info(`A user connected: ${socket.id} with session ID ${sessionId}`, { sessionId, socketId: socket.id });
      this.initializeSocketListeners(socket, sessionId);
    });
    this.server.eventEmitter.on('playerAction', this.handlePlayerAction.bind(this)); // Listen for player actions
  }
  handlePlayerAction(actionData) {
    const { type, targetId, payload } = actionData; // Destructure actionData
    switch (type) {
      case 'move':
        this.movePlayer(payload.playerId, payload.newLocationId); // Handle player movement
        break;
      case 'attack':
        this.attackNpc(payload.playerId, targetId); // Handle player attacking an NPC
        break;
      default:
        this.logger.error(`ERROR:Unknown action type: ${type}`, { type }); // Log unknown action type
    }
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
    let locationId = null;
    if (type) {
      switch (type) {
        case 'public':
          this.server.io.emit('receiveMessage', { senderId: socket.id, content });
          break;
        case 'semiPublic':
          locationId = this.server.gameManager.getLocation(socket.id);
          this.server.io.to(locationId).emit('receiveMessage', { senderId: socket.id, content });
          break;
        case 'private':
          this.server.io.to(targetId).emit('receiveMessage', { senderId: socket.id, content });
          break;
        default:
          this.logger.error(`ERROR: Unknown message type: ${type}`, { type });
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
          this.logger.error(`ERROR: Unknown action type: ${actionType}`, { actionType });
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
// Data Management
class DatabaseManager extends IDatabaseManager {
  constructor({ server, logger }) {
    super({ server, logger });
    this.DATA_PATHS = {
      LOCATIONS: server.configManager.get('LOCATION_DATA_PATH'),
      NPCS: server.configManager.get('NPC_DATA_PATH'),
      ITEMS: server.configManager.get('ITEM_DATA_PATH'),
    };
    this.fs = null;
    this.path = null;
  }
  async initialize() {
    const fsPromises = await import('fs/promises');
    const pathModule = await import('path');
    this.fs = fsPromises;
    this.path = pathModule;
    // Validate data paths
    for (const [key, path] of Object.entries(this.DATA_PATHS)) {
      if (!path) {
        this.logger.error(`ERROR: ${key}_DATA_PATH is not defined in the configuration`);
      }
    }
  }
  async loadData(dataPath, type) {
    if (!dataPath) {
      throw new Error(`${type.toUpperCase()}_DATA_PATH is not defined in the configuration`);
    }
    try {
      const files = await this.getFilesInDirectory(dataPath);
      const data = await Promise.all(files.map(file => this.fs.readFile(file, 'utf-8').then(data => JSON.parse(data))));
      return data;
    } catch (error) {
      this.logger.error(`ERROR: Loading ${type} data: ${error.message}`, { error, dataPath });
      this.logger.error(error.stack);
      throw error;
    }
  }
  async getFilesInDirectory(directory) {
    if (!directory) {
      throw new Error('Directory path is undefined');
    }
    try {
      const files = await this.fs.readdir(directory);
      return files.filter(file => this.path.extname(file) === '.json').map(file => this.path.join(directory, file));
    } catch (error) {
      this.logger.error(`ERROR: Reading directory ${directory}: ${error.message}`, { error, directory });
      this.logger.error(error.stack);
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
      this.logger.error(`ERROR: Saving data for ${key} to ${filePath}: ${error.message}`, { error, filePath, key });
      this.logger.error(error.stack); // Log stack trace
    }
  }
  async loadLocationData() {
    try {
      const data = await this.loadData(this.DATA_PATHS.LOCATIONS, 'location');
      const locationData = new Map(data.map(location => [location.id, location]));
      const filenames = data.map(location => `${location.id}.json`);
      return { locationData, filenames };
    } catch (error) {
      this.logger.error(`ERROR: Loading location data: ${error.message}`, { error });
      this.logger.error(error.stack);
      throw error;
    }
  }
}
// Game Management
class GameManager {
  constructor({ eventEmitter, logger, server }) {
    this.players = new Map();
    this.locations = new Map();
    this.npcs = new Map();
    this.eventEmitter = eventEmitter;
    this.logger = logger; // Add logger
    this.server = server; // Add this line
    this.gameLoopInterval = null;
    this.gameTime = 0;
    this.isRunning = false;
    this.eventEmitter.on("tick", this.gameTick.bind(this));
    this.eventEmitter.on("newDay", this.newDayHandler.bind(this));
    this.tickRate = server.configManager.get('TICK_RATE');
    this.lastTickTime = Date.now();
    this.tickCount = 0;

    // Set up event listener for ticks
    this.eventEmitter.on('tick', this.handleTick.bind(this));
  }
  startGame() {
    if (this.isGameRunning()) {
      this.logger.warn('Game is already running.');
      return;
    }
    try {
      this.startGameLoop();
      this.isRunning = true;
      const isHttps = this.server.isHttps; // Use the isHttps property from the Server class
      const host = this.server.configManager.get('HOST');
      const port = this.server.configManager.get('PORT');
      this.logger.info(`\n`);
      this.logger.info(`SERVER IS RUNNING AT: ${isHttps ? 'https' : 'http'}://${host}:${port}`);
      this.logger.info(`\n`);
    } catch (error) {
      this.logger.error(`Error starting game: ${error.message}`);
      this.logger.error(error.stack);
    }
  }
  isGameRunning() {
    return this.isRunning;
  }
  shutdownGame() {
    try {
      this.stopGameLoop();
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
      this.logger.error(`ERROR: Shutting down game: ${error}`);
      this.logger.error(error.stack);
      MessageManager.notifyError(this, `ERROR shutting down game: ${error}`);
      throw error;
    }
  }
  async shutdownServer() {
    const { exit } = await import('process');
    exit(0);
  }
  startGameLoop() {
    const TICK_RATE = this.server.configManager.get('TICK_RATE');
    this.gameLoopInterval = setInterval(() => {
      try {
        this.eventEmitter.emit('tick');
      } catch (error) {
        this.logger.error(`Error in game tick: ${error.message}`);
        this.logger.error(error.stack);
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

    // Check if a tick interval has passed
    if (currentTime - this.lastTickTime >= this.tickRate) {
      this.lastTickTime = currentTime;
      this.tickCount = 0;
    }
  }
  sendTickMessageToClients() {
    const tickMessage = {
      type: 'tick',
      timestamp: this.lastTickTime,
      tickCount: this.tickCount
    };
    if (this.server && this.server.io) {
      this.server.io.emit('gameUpdate', tickMessage);
    } else {
      this.logger.warn('Socket.IO instance is not available in GameManager');
    }
  }
  updateGameTime() {
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - this.gameTime) / 1000);
    this.gameTime += elapsedSeconds;
    if (this.gameTime >= 1440) {
      this.gameTime %= 1440;
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
    if (!newLocation) return;
    newLocation.addEntity(entity, "players");
    MessageManager.notifyEnteringLocation(entity, newLocationId);
    const direction = DirectionManager.getDirectionFrom(oldLocationId);
    MessageManager.notify(entity, `${entity.getName()} arrives ${direction}.`);
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
    const WORLD_EVENT_INTERVAL = this.server.configManager.get('WORLD_EVENT_INTERVAL');
    if (this.gameTime % WORLD_EVENT_INTERVAL === 0) {
      this.triggerWorldEvent();
    }
  }
  triggerWorldEvent() {
    // Implement a more robust world event system
    const eventTypes = ['weather', 'economy', 'politics'];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    this.logger.info(`A ${eventType} world event has occurred!`);
    // Add more specific event handling here
  }
  newDayHandler() {
    this.logger.info("A new day has started!");
  }
  disconnectPlayer(uid) {
    const player = this.players.get(uid);
    if (player) {
      player.status = "disconnected";
      this.players.delete(uid);
      this.logger.info(`Player ${uid} has been disconnected.`);
    } else {
      this.logger.warn(`Player ${uid} not found for disconnection.`);
    }
  }
  createNpc(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, mobile = false, zones = [], aliases) {
    const npc = new Npc(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, mobile, zones, aliases);
    this.npcs.set(npc.id, npc);
    return npc;
  }
  getNpc(npcId) {
    return this.npcs.get(npcId);
  }
  initializeLocations(locationData) {
    this.logger.debug('Initializing locations');
    locationData.forEach((location, id) => {
      this.locations.set(id, location);
    });
    this.logger.debug(`Initialized ${this.locations.size} locations`);
  }
}
class GameComponentInitializer extends BaseManager {
  constructor({ server, logger }) {
    super({ server, logger });
  }
  async setupGameComponents() {
    try {
      this.server.databaseManager = new DatabaseManager({
        server: this.server,
        logger: this.server.logger
      });
      await this.server.databaseManager.initialize();
      this.server.gameManager = new GameManager({
        eventEmitter: this.server.eventEmitter,
        logger: this.server.logger,
        server: this.server // Add this line
      });
      await this.loadLocationsData();
      this.server.gameDataLoader = new GameDataLoader(this.server);
      await this.server.gameDataLoader.fetchGameData();
    } catch (error) {
      this.server.logger.error('ERROR: Loading game data:', error);
      this.server.logger.error(error.stack);
    }
  }
  async loadLocationsData() {
    try {
      const { locationData, filenames } = await this.server.databaseManager.loadLocationData();
      this.server.gameManager.initializeLocations(locationData);
      this.server.logger.debug('Locations data loaded successfully');
    } catch (error) {
      this.server.logger.error('ERROR: Loading locations data:', error);
      this.server.logger.error(error.stack);
    }
  }
}
class GameDataLoader {
  constructor(server) {
    this.server = server;
    this.locationManager = new LocationCoordinateManager(this.server);
  }
  async fetchGameData() {
    const { logger, databaseManager } = this.server;
    logger.info(`\n`)
    logger.info(`STARTING LOAD GAME DATA:`);
    const DATA_TYPES = { LOCATION: 'Location', NPC: 'Npc', ITEM: 'Item' };
    const loadData = async (loadFunction, type) => {
        try {
          logger.info(`- Starting Load ${type}s`, { type });
            const data = await loadFunction();
            return { type, data };
        } catch (error) {
            logger.error(`ERROR: Loading ${type} data: ${error.message}`, { error, type });
            logger.error(error.stack);
            return { type, error };
        }
    };
    try {
        const results = await Promise.allSettled([
            loadData(() => databaseManager.loadLocationData(), DATA_TYPES.LOCATION),
            loadData(() => databaseManager.loadNpcData(), DATA_TYPES.NPC),
            loadData(() => databaseManager.loadItemData(), DATA_TYPES.ITEM),
        ]);
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                logger.error(`Error: Failed to load data at index ${index}: ${result.reason.message}`, { error: result.reason, index });
                logger.error(result.reason.stack);
            }
        });
        const successfulResults = results
          .filter(result => result.status === 'fulfilled' && result.value && !result.value.error)
          .map(result => result.value);
        if (successfulResults.length > 0) {
          const locationData = successfulResults.find(result => result.type === DATA_TYPES.LOCATION)?.data;
          if (locationData) {
            await this.locationManager.assignCoordinates(locationData);
          }
        }
        logger.info(`LOADING GAME DATA FINISHED.`);
        return successfulResults;
    } catch (error) {
        logger.error(`ERROR: During game data fetching: ${error.message}`, { error });
        logger.error(error.stack);
    }
  }
  async saveLocationData(filenames) {
    try {
        const { locationData } = await this.server.databaseManager.loadLocationData();
        if (!locationData || locationData.size === 0) {
            this.server.logger.warn(`No location data found to save.`);
            return;
        }
        const filePath = this.server.configManager.get('LOCATION_DATA_PATH');
        for (const filename of filenames) {
            const fullPath = `${filePath}/${filename}`;
            const locationId = filename.replace('.json', '');
            const location = locationData.get(locationId);
            if (location) {
                await this.server.databaseManager.saveData(fullPath, 'locations', location);
                this.server.logger.info(`Location data saved successfully to ${fullPath}.`);
            } else {
                this.server.logger.warn(`Location data not found for ${filename}.`);
            }
        }
    } catch (error) {
        this.server.logger.error(`Error: Saving location data: ${error.message}`, { error });
        this.server.logger.error(error.stack);
    }
  }
}
class LocationCoordinateManager {
  constructor(server) {
    this.server = server;
    this.logger = server.logger;
    this.locations = new Map();
  }
  async loadLocations() {
    try {
      const locationData = await this.server.databaseManager.loadData(this.server.configManager.get('LOCATION_DATA_PATH'), 'location');
      this.logger.debug(`\n`)
      this.logger.debug(`- Loaded Raw Location Data:`);
      this.logger.debug(`\n`)
      this.logger.debug(`${JSON.stringify(locationData)}`);
      // Parse the JSON string if it's not already an object
      const parsedData = typeof locationData === 'string' ? JSON.parse(locationData) : locationData;
      // If parsedData is an array with a single object, use that object
      const locationsObject = Array.isArray(parsedData) ? parsedData[0] : parsedData;
      this.logger.debug(`\n`)
      for (const [id, location] of Object.entries(locationsObject)) {
        this.locations.set(id, location);
        this.logger.debug(`- Added location ${id} to locations Map`);
      }
      this.logger.debug(`\n`)
      this.logger.debug(`- Loaded ${this.locations.size} locations.`);
      this.logger.debug(`\n`)
      this.logger.debug(`- Locations Map contents:`);
      this.logger.debug(`\n`)
      this.logger.debug(`${JSON.stringify(Array.from(this.locations.entries()))}`);
    } catch (error) {
      this.logger.error('ERROR: Loading locations:', error);
      this.logger.error(error.stack);
    }
  }
  async assignCoordinates() {
    try {
      await this.loadLocations();
      this.logger.debug(`\n`)
      this.logger.debug(`- Locations loaded, proceeding with coordinate assignment:`);
      this.logger.debug(`\n`)
      const coordinates = new Map([["100", { x: 0, y: 0, z: 0 }]]);
      this.logger.debug(`- Initial coordinates: ${JSON.stringify(Array.from(coordinates.entries()))}`);
      this._assignCoordinatesRecursively("100", coordinates);
      this.logger.debug(`\n`)
      this.logger.debug(`- After recursive assignment:`);
      this.logger.debug(`\n`)
      this.logger.debug(`${JSON.stringify(Array.from(coordinates.entries()))}`);
      this.logger.debug(`\n`)
      this._updateLocationsWithCoordinates(coordinates);
    } catch (error) {
      this.logger.error('ERROR: Assigning coordinates:', error);
      this.logger.error(error.stack);
    }
  }
  _assignCoordinatesRecursively(locationId, coordinates, x = 0, y = 0, z = 0) {
    this.logger.debug(`- Assigning coordinates for location ${locationId} at (${x}, ${y}, ${z})`);
    const location = this.locations.get(locationId);
    if (!location) {
      this.logger.warn(`Location ${locationId} not found in locations Map`);
      return;
    }
    location.coordinates = { x, y, z };
    this.logger.debug(`- Exits for location ${locationId}: ${JSON.stringify(location.exits)}`);
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
        this.logger.debug(`- Assigning new coordinates for exit ${exitId} in direction ${direction}`);
        coordinates.set(exitId, { x: newX, y: newY, z: newZ });
        this._assignCoordinatesRecursively(exitId, coordinates, newX, newY, newZ);
      } else {
        this.logger.debug(`- Coordinates already assigned for exit ${exitId}`);
      }
    }
  }
  _updateLocationsWithCoordinates(coordinates) {
    this.logger.debug('- Updating locations with coordinates:');
    this.logger.debug(`\n`)
    this.logger.debug(`- Coordinates Map:`);
    this.logger.debug(`\n`)
    this.logger.debug(`${JSON.stringify(Array.from(coordinates.entries()))}`);
    this.logger.debug(`\n`)
    this.logger.debug(`- Locations Map:`);
    this.logger.debug(`\n`)
    this.logger.debug(`${JSON.stringify(Array.from(this.locations.entries()))}`);
    this.logger.debug(`\n`)
    for (const [id, coord] of coordinates) {
      const location = this.locations.get(id);
      if (location) {
        location.coordinates = coord;
        this.logger.debug(`- Location ${id} (${location.name}) coordinates: x=${coord.x}, y=${coord.y}, z=${coord.z}`);
      } else {
        this.logger.warn(`Location ${id} not found in this.locations`);
      }
    }
    this.logger.debug(`\n`)
    this.logger.debug(`- Total locations updated: ${coordinates.size}`);
    this.logger.debug(`\n`)
    this.logger.debug('- Coordinate assignment finished');
    this.logger.debug(`\n`)
  }
}
// Task and Queue Management
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
class Task {
  constructor(name) {
    this.name = name;
    this.execute = null;
  }
  run() {
    if (this.execute) this.execute();
  }
}
class QueueManager {
  constructor() {
    this.queue = [];
  }
  enqueue(task) {
    this.queue.push(task);
  }
  dequeue() {
    return this.queue.shift();
  }
  processQueue() {
    while (this.queue.length > 0) {
      const task = this.dequeue();
      task.run();
    }
  }
  cleanup() {
    this.queue = [];
  }
}
// Logging
class Logger extends ILogger {
  constructor(config) {
    super();
    this.CONFIG = config;
    this.logLevel = config.LOG_LEVEL;
    this.logLevels = {
      'DEBUG': 0,
      'INFO': 1,
      'WARN': 2,
      'ERROR': 3
    };
  }
  log(level, message) {
    if (this.shouldLog(level)) {
      let coloredMessage = message;
      switch (level) {
        case 'DEBUG':
          coloredMessage = `${this.CONFIG.ORANGE}${message}${this.CONFIG.RESET}`;
          break;
        case 'WARN':
          coloredMessage = `${this.CONFIG.MAGENTA}${message}${this.CONFIG.RESET}`;
          break;
        case 'ERROR':
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
    // Implement a more robust logging system
    // Consider using a logging library or implementing log rotation
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
// Initialization
class ServerInitializer {
  constructor(config) {
    this.logger = new Logger({
      LOG_LEVEL: config.LOG_LEVEL,
      ORANGE: config.ORANGE,
      MAGENTA: config.MAGENTA,
      RED: config.RED,
      RESET: config.RESET
    });
    this.server = new Server({ logger: this.logger });
    this.moduleImporter = new ModuleImporter({ server: this.server, logger: this.logger });
    this.serverConfigurator = new ServerConfigurator({
      server: this.server,
      logger: this.logger,
      socketEventManager: this.server.socketEventManager,
      config: this.server.configManager
    });
    this.gameComponentInitializer = new GameComponentInitializer({ server: this.server, logger: this.logger });
  }
  async initialize() {
    try {
      await this.server.init();
      await this.gameComponentInitializer.setupGameComponents();
      if (this.server.gameManager) {
        this.server.gameManager.startGame();
      } else {
        this.logger.error('GameManager not initialized');
      }
    } catch (error) {
      this.logger.error(`ERROR: Server initialization: ${error.message}`, { error });
      this.logger.error(error.stack); // Log stack trace
    }
  }
}
// Usage
import CONFIG from './config.js';
const serverInitializer = new ServerInitializer(CONFIG);
serverInitializer.initialize();