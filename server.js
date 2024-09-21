// Server *****************************************************************************************
/*
 * The Server class is the main entry point for the game server. It is responsible for initializing
 * the server environment, setting up middleware, and managing the game loop.
*/
class Server {
  constructor({ logger }) {
    this.eventEmitter = new EventEmitter(); // Instantiate EventEmitter
    this.configManager = new ConfigManager(); // Create instance
    this.configManager.loadConfig(); // Load config
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
      this.serverConfigurator = new ServerConfigurator({ server: this, logger: this.logger, socketEventManager: this.socketEventManager, config: this.configManager });
      await this.serverConfigurator.configureServer();
      await this.configManager.loadConfig(); // Load configuration
      this.eventEmitter.on('playerConnected', this.handlePlayerConnected.bind(this)); // Listen for player connection
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
      this.logger.warn(`- - WARNING: Read SSL cert: ${error.message}${this.logger.CONFIG.RESET}`, { error });
      this.logger.debug(`\n`);
      this.logger.debug(error.stack); // Log stack trace
      this.logger.debug(`\n`);
    }
    try {
      sslOptions.key = await this.fs.readFile(SSL_KEY_PATH); // Keep await here
    } catch (error) {
      this.logger.warn(`- - WARNING: Read SSL  key: ${error.message}${this.logger.CONFIG.RESET}`, { error });
      this.logger.debug(`\n`);
      this.logger.debug(error.stack); // Log stack trace
      this.logger.debug(`\n`);
    }
    const isHttps = sslOptions.key && sslOptions.cert;
    const http = isHttps ? await import('https') : await import('http'); // Keep await here
    this.server = http.createServer(isHttps ? { key: sslOptions.key, cert: sslOptions.cert } : this.app); // Ensure this.server is assigned
    this.logger.info(`- Configuring Server using ${isHttps ? 'https' : 'http'}://${this.configManager.get('HOST')}:${this.configManager.get('PORT')}`);
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
// Module Importer ********************************************************************************
/*
 * The ModuleImporter class is responsible for importing necessary modules and dependencies for the
 * server to function. It ensures that all required modules are loaded before the server starts.
*/
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
// Server Configurator ***********************************************************************************
/*
 * The ServerConfigurator class is responsible for configuring the server environment.
*/
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
// GameComponentInitializer Class ******************************************************************
class GameComponentInitializer extends BaseManager {
  constructor({ server, logger }) {
    super({ server, logger });
  }
  async setupGameComponents() {
    try {
      // Initialize DatabaseManager first
      this.server.databaseManager = new DatabaseManager({
        server: this.server,
        logger: this.server.logger
      });
      await this.server.databaseManager.initialize();
      // Initialize GameManager
      this.server.gameManager = new GameManager(this.server);
      // Load locations data
      await this.loadLocationsData();
      // Now initialize other components
      this.server.gameDataLoader = new GameDataLoader(this.server);
      // ... other component initializations ...
      // Load remaining game data
      await this.server.gameDataLoader.fetchGameData();
    } catch (error) {
      this.server.logger.error('ERROR: Loading game data:', error);
      this.server.logger.error(error.stack);
    }
  }
  async loadLocationsData() {
    try {
      const locationsData = await this.server.databaseManager.loadLocationData();
      this.server.gameManager.initializeLocations(locationsData);
    } catch (error) {
      this.server.logger.error('ERROR: Loading locations data:', error);
      this.server.logger.error(error.stack);
    }
  }
}
// Logger Interface *******************************************************************************
/*
 * The ILogger interface defines the methods that a logger must implement.
*/
class ILogger {
  log() { }
  debug() { }
  info() { }
  warn() { }
  error() { }
}
// Database Manager Interface *********************************************************************
/*
 * The IDatabaseManager interface defines the methods that a database manager must implement.
*/
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
// Event Emitter Interface ************************************************************************
class IEventEmitter {
  on() { }
  emit() { }
  off() { }
}
// Logger Class ***********************************************************************************
/*
 * The Logger class implements the ILogger interface and provides methods for logging messages
 * to the console with different levels of severity.
*/
class Logger extends ILogger {
  constructor(config) {
    super();
    this.CONFIG = config; // Initialize CONFIG here
    this.logLevel = config.LOG_LEVEL; // Store log level from config
  }
  log(level, message) {
    if (this.shouldLog(level)) {
      if (level === 'DEBUG') {
        message = `${this.CONFIG.ORANGE}${message}${this.CONFIG.RESET}`;
      } else if (level === 'WARN') {
        message = `${this.CONFIG.MAGENTA}${message}${this.CONFIG.RESET}`;
      } else if (level === 'ERROR') {
        message = `${this.CONFIG.RED}${message}${this.CONFIG.RESET}`;
      }
      const logString = `${message}`;
      this.writeToConsole(logString);
    }
  }
  shouldLog(level) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
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
/*
 * The EventEmitter class implements the IEventEmitter interface and provides methods for
 * registering and emitting events.
*/
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
// DatabaseManager Class ****************************************************************************
/*
 * The DatabaseManager class implements the IDatabaseManager interface and provides methods
 * for loading and saving game data from the database.
*/
import { promises as fs } from 'fs';
import path from 'path';
class DatabaseManager extends IDatabaseManager {
  constructor({ server, logger }) {
    super({ server, logger });
    this.DATA_PATHS = {
      LOCATIONS: this.server.configManager.get('LOCATION_DATA_PATH'), // Use config
      NPCS: this.server.configManager.get('NPC_DATA_PATH'), // Use config
      ITEMS: this.server.configManager.get('ITEM_DATA_PATH'), // Use config
    };
  }
  async initialize() {
    // No need to import fs here, as we've imported it at the top of the file
  }
  async loadLocationData() {
    try {
      const files = await fs.readdir(this.DATA_PATHS.LOCATIONS);
      const locationData = {};
      for (const file of files) {
        if (path.extname(file) === '.json') {
          const filePath = path.join(this.DATA_PATHS.LOCATIONS, file);
          const data = await fs.readFile(filePath, 'utf8');
          const location = JSON.parse(data);
          locationData[location.id] = location;
        }
      }
      return locationData;
    } catch (error) {
      this.logger.error('ERROR: Loading location data:', error);
      throw error; // Re-throw the error to be caught by the caller
    }
  }
  async loadNpcData() {
    try {
      return await this.loadData(this.DATA_PATHS.NPCS, 'npc');
    } catch (error) {
      this.logger.error(`ERROR: Loading NPC data: ${error.message}`, { error });
      this.logger.error(error.stack); // Log stack trace
    }
  }
  async loadItemData() {
    try {
      return await this.loadData(this.DATA_PATHS.ITEMS, 'item');
    } catch (error) {
      this.logger.error(`ERROR: Loading item data: ${error.message}`, { error });
      this.logger.error(error.stack); // Log stack trace
    }
  }
  async loadData(dataPath, type) { // New utility method
    try {
      const files = await this.getFilesInDirectory(dataPath);
      const data = await Promise.all(files.map(file => fs.readFile(file, 'utf-8').then(data => JSON.parse(data))));
      return data;
    } catch (error) {
      this.logger.error(`ERROR: Loading ${type} data: ${error.message}`, { error });
      this.logger.error(error.stack); // Log stack trace
      throw error;
    }
  }
  async getFilesInDirectory(directory) {
    try {
      const files = await fs.readdir(directory);
      return files.filter(file => path.extname(file) === '.json').map(file => path.join(directory, file));
    } catch (error) {
      this.logger.error(`ERROR: Reading directory ${directory}: ${error.message}`, { error });
      this.logger.error(error.stack); // Log stack trace
      throw error;
    }
  }
  async saveData(filePath, key, data) {
    try {
      const existingData = await fs.readFile(filePath, 'utf-8');
      const parsedData = JSON.parse(existingData);
      parsedData[key] = data;
      await fs.writeFile(filePath, JSON.stringify(parsedData, null, 2));
      this.logger.info(`Data saved for ${key} to ${filePath}`, { filePath, key });
    } catch (error) {
      this.logger.error(`ERROR: Saving data for ${key} to ${filePath}: ${error.message}`, { error, filePath, key });
      this.logger.error(error.stack); // Log stack trace
    }
  }
  cleanup() {
    // No need to clear fs reference as we're using the imported promises version
  }
}
// GameManager Class ********************************************************************************
/*
 * The GameManager class is responsible for managing the game state, including entities, locations,
 * and events. It handles game loop updates, entity movement, and event triggering.
*/
class GameManager {
  gameLoopInterval = null; // Changed from #gameLoopInterval
  gameTime = 0; // Changed from #gameTime
  isRunning = false; // Changed from #isRunning
  //combatManager;
  locations; // Add a property to hold locations
  constructor({ eventEmitter }) {
    this.players = new Map();
    this.locations = new Map(); // Initialize locations Map
    this.npcs = new Map();
    //this.combatManager = new CombatManager(this);
    this.eventEmitter = eventEmitter;
    this.eventEmitter.on("tick", this.gameTick.bind(this));
    this.eventEmitter.on("newDay", this.newDayHandler.bind(this));
  }
  initializeLocations(locationsData) {
    this.locations = new Map(Object.entries(locationsData));
  }
  addLocation(location) {
    this.locations.set(location.getName(), location); // Method to add a location
  }
  getLocation(locationId) {
    return this.locations.get(locationId); // Retrieve location by ID
  }
  startGame() {
    if (this.isGameRunning()) return; // Prevent starting if already running
    try {
      this.startGameLoop();
      this.isRunning = true;
      this.logger.info('Game started successfully.');
    } catch (error) {
      this.logger.error(`ERROR: Starting game: ${error}`);
      this.logger.error(error.stack); // Log stack trace
    }
  }
  isGameRunning() { // New method to check if the game is running
    return this.isRunning;
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
        this.logger.info('All socket connections closed.');
        this.shutdownServer(); // Call a new method to handle server shutdown
      });
      MessageManager.notifyGameShutdownSuccess(this);
    } catch (error) {
      this.logger.error(`ERROR: Shutting down game: ${error}`);
      this.logger.error(error.stack); // Log stack trace
      MessageManager.notifyError(this, `ERROR shutting down game: ${error}`);
      throw error;
    }
  }
  async shutdownServer() { // New method for server shutdown
    const { exit } = await import('process'); // Import exit from process
    exit(0); // Use exit instead of process.exit
  }
  startGameLoop() {
    const TICK_RATE = this.server.configManager.get('TICK_RATE'); // Use ConfigManager for TICK_RATE
    this.gameLoopInterval = setInterval(() => this.gameTick(), TICK_RATE); // Use config for TICK_RATE
  }
  stopGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }
  gameTick() {
    this.updateNpcs();
    this.updatePlayerAffects();
    this.updateWorldEvents();
    this.eventEmitter.emit("tick", this.gameTime);
  }
  updateGameTime() {
    this.setGameTime(this.getGameTime() + Math.floor((Date.now() - this.gameTime) / 1000));
    this.gameTime = Date.now();
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
  updateNpcs() {
    this.npcs.forEach(npc => {
      if (npc.hasChangedState()) {
        MessageManager.notifyNpcStateChange(npc);
      }
    });
  }
  updatePlayerAffects() {
    this.players.forEach(player => {
      if (player.hasChangedState()) { // Check if player has changed state
        player.checkAndRemoveExpiredAffects();
      }
    });
  }
  updateWorldEvents() {
    if (this.isTimeForWorldEvent()) {
      this.triggerWorldEvent();
    }
  }
  isTimeForWorldEvent() {
    const WORLD_EVENT_INTERVAL = this.server.configManager.get('WORLD_EVENT_INTERVAL'); // Use ConfigManager for WORLD_EVENT_INTERVAL
    return this.gameTime % WORLD_EVENT_INTERVAL === 0; // Use config for WORLD_EVENT_INTERVAL
  }
  triggerWorldEvent() {
    this.logger.info(`A world event has occurred!`);
  }
  newDayHandler() {
    this.logger.info("A new day has started!");
  }
  // Method to disconnect a player
  disconnectPlayer(uid) {
    // Expected parameter: uid (string)
    const player = this.players.get(uid); // Retrieve the player using uid
    if (player) {
      player.status = "disconnected"; // Update player status
      this.players.delete(uid); // Remove player from active players
      this.logger.info(`Player ${uid} has been disconnected.`); // Log disconnection
    } else {
      this.logger.warn(`Player ${uid} not found for disconnection.`); // Log warning if player not found
    }
  }
  createNpc(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, mobile = false, zones = [], aliases) {
    const npc = new Npc(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, mobile, zones, aliases);
    this.npcs.set(npc.id, npc); // Store NPC by ID
    return npc;
  }
  getNpc(npcId) {
    return this.npcs.get(npcId); // Retrieve NPC by ID
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
    this.locationManager = new LocationCoordinateManager(this.server); // Instantiate LocationCoordinateManager
  }
  async fetchGameData() { // Renamed from 'loadGameData' to 'fetchGameData'
    const { logger, databaseManager } = this.server; // Destructure server
    logger.info(`\n`)
    logger.info(`STARTING LOAD GAME DATA:`);
    const DATA_TYPES = { LOCATION: 'location', NPC: 'npc', ITEM: 'item' };
    const loadData = async (loadFunction, type) => {
        try {
          logger.info(`- Starting Load ${type}s`, { type });
            const data = await loadFunction();
            return { type, data };
        } catch (error) {
            logger.error(`ERROR: Loading ${type} data: ${error.message}`, { error, type });
            logger.error(error.stack); // Log stack trace
            return { type, error };
        }
    };
    try {
        const { locationData, filenames } = await databaseManager.loadLocationData(); // Load location data and filenames
        await this.locationManager.assignCoordinates(locationData); // Call assignCoordinates after loading location data
        const results = await Promise.allSettled([
            loadData(databaseManager.loadNpcData.bind(databaseManager), DATA_TYPES.NPC),
            loadData(databaseManager.loadItemData.bind(databaseManager), DATA_TYPES.ITEM),
        ]);
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                logger.error(`Error: Failed to load data at index ${index}: ${result.reason.message}`, { error: result.reason, index });
                logger.error(result.reason.stack); // Log stack trace
            }
        });
        logger.info(`LOADING GAME DATA FINISHED.`);
        return results.map(result => result.value).filter(value => value && !value.error);
    } catch (error) {
        logger.error(`ERROR: During game data fetching: ${error.message}`, { error });
        logger.error(error.stack); // Log stack trace
    }
  }
  async saveLocationData(filenames) { // Accept filenames as a parameter
    try {
        const { locationData } = await this.server.databaseManager.loadLocationData(); // Load location data
        if (!locationData || locationData.size === 0) {
            this.server.logger.warn(`No location data found to save.`); // Log warning if no data
            return;
        }
        const filePath = this.server.configManager.get('LOCATION_DATA_PATH'); // Get base path from config
        for (const filename of filenames) {
            const fullPath = `${filePath}/${filename}`; // Construct the full path using the filename
            const locationId = filename.replace('.json', ''); // Extract location ID from filename
            const location = locationData.get(locationId); // Get location data
            if (location) {
                await this.server.databaseManager.saveData(fullPath, 'locations', location); // Save location data to file
                this.server.logger.info(`Location data saved successfully to ${fullPath}.`); // Log success message
            } else {
                this.server.logger.warn(`Location data not found for ${filename}.`); // Log warning if location data not found
            }
        }
    } catch (error) {
        this.server.logger.error(`Error: Saving location data: ${error.message}`, { error }); // Log error
        this.server.logger.error(error.stack); // Log stack trace
    }
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
    this.objectPool = objectPool; // Use ObjectPool instance
    this.queue = [];
    this.isProcessing = false;
  }
  addTask(task) {
    const pooledTask = this.objectPool.acquire(); // Acquire a task from the pool
    pooledTask.name = task.name; // Set task name
    pooledTask.execute = task.execute; // Set task execution logic
    this.queue.push(pooledTask); // Add to queue
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
          console.error(error.stack); // Log stack trace
        }
      }
      this.isProcessing = false; // Reset processing state after all tasks are done
      this.cleanup();
    };
    processNextTask(); // Start processing tasks
  }
  addDataLoadTask(filePath, key) {
    const task = new Task('Data Load Task'); // Use Task class
    task.execute = async () => {
      const data = await this.databaseManager.loadData(filePath, key);
      this.handleLoadedData(key, data); // Use the loaded data
      this.objectPool.release(task);
    };
    this.addTask(task);
  }
  handleLoadedData(key, data) { // New method to handle loaded data
    // Implement logic to process the loaded data based on the key
    switch (key) {
      case 'location':
        this.server.gameManager.addLocations(data); // Example usage
        break;
      case 'npc':
        this.server.gameManager.addNpcs(data); // Example usage
        break;
      case 'item':
        this.server.gameManager.addItems(data); // Example usage
        break;
      default:
        this.logger.warn(`No handler for data type: ${key}`);
    }
  }
  addDataSaveTask(filePath, key, data) {
    const task = new Task('Data Save Task'); // Use Task class
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
    task.execute = async () => {
      try {
        // Integrate with event handling
        this.server.eventEmitter.emit(event.type, event.data); // Emit the event
        // Example of processing game logic based on the event
        if (event.type === 'playerAction') {
          const player = this.server.gameManager.getPlayerById(event.data.playerId);
          if (player) {
            await player.handleAction(event.data.action); // Call player action handling
          }
        }
      } catch (error) {
        this.server.logger.error(`ERROR: Processing event: ${error.message}`, { error });
        this.server.logger.error(error.stack); // Log stack trace
      } finally {
        this.objectPool.release(task); // Ensure task is released
      }
    };
    this.addTask(task); // Add task to the queue
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
    this.queue.forEach(task => this.objectPool.release(task)); // Release tasks back to the pool
    this.queue = [];
    this.isProcessing = false;
  }
}
// ConfigManager Class ****************************************************************************
/*
 * The ConfigManager class is responsible for loading and providing access to configuration settings.
 * It ensures that the configuration is loaded only once and provides a method to retrieve values by key.
*/
class ConfigManager {
  static instance = null;
  constructor() {
    if (ConfigManager.instance) {
      return ConfigManager.instance;
    }
    this.CONFIG = null;
    ConfigManager.instance = this;
  }
  async loadConfig() {
    if (!this.CONFIG) {
      console.log(`\nSTARTING LOAD CONFIGURATION SETTINGS:`);
      try {
        this.CONFIG = await import('./config.js').then(module => module.default);
        console.log(`LOAD CONFIGURATION SETTINGS FINISHED.`);
      } catch (error) {
        console.error(`ERROR LOADING CONFIG: ${error.message}`);
        console.error(error.stack); // Log stack trace
      }
    }
  }
  get(key) {
    return this.CONFIG?.[key];
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
      this.logger.info('- Starting Load Locations');
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
// ServerInitializer Class *************************************************************************
class ServerInitializer {
  constructor() {
    this.configManager = new ConfigManager();
    this.logger = null;
    this.server = null;
    this.moduleImporter = null;
  }
  async initialize() {
    try {
      await this.setupComponents();
      await this.initializeServer();
      await this.setupGameComponents();
      this.startListening();
    } catch (error) {
      this.handleError(error);
    }
  }
  async setupComponents() {
    await this.configManager.loadConfig();
    this.logger = new Logger(this.configManager.CONFIG);
    this.server = new Server({ logger: this.logger });
    this.moduleImporter = new ModuleImporter({ server: this.server, logger: this.logger });
    this.server.moduleImporter = this.moduleImporter;
  }
  async initializeServer() {
    await this.server.init();
  }
  async setupGameComponents() {
    const gameComponentInitializer = new GameComponentInitializer({ server: this.server, logger: this.logger });
    await gameComponentInitializer.setupGameComponents();
  }
  startListening() {
    const port = this.server.configManager.get('PORT');
    const host = this.server.configManager.get('HOST');
    const isHttps = this.server.configManager.get('HTTPS_ENABLED');
    this.server.server.listen(port, host, () => {
      this.logger.info(`\n`);
      this.logger.info(`SERVER IS RUNNING AT: ${isHttps ? 'https' : 'http'}://${host}:${port}`);
    });
  }
  handleError(error) {
    if (this.logger) {
      this.logger.error('ERROR: Starting the server:', error);
      this.logger.error(error.stack);
    } else {
      console.error('ERROR: Starting the server:', error);
      console.error(error.stack);
    }
  }
}
// Usage
const serverInitializer = new ServerInitializer();
serverInitializer.initialize();