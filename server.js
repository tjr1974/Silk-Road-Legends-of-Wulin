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
  constructor({ server }) {
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
  constructor({ server }) {
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
  combatManager;
  locations; // Add a property to hold locations
  constructor({ eventEmitter }) {
    this.players = new Map();
    this.locations = new Map(); // Initialize locations Map
    this.npcs = new Map();
    this.combatManager = new CombatManager(this);
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
//*************************************************************************************************
// Create New Player ******************************************************************************
/*
 * The CreateNewPlayer class is responsible for creating new player instances from existing player
 * data, providing methods to initialize player attributes and state.
*/
class CreateNewPlayer {
  constructor(name, age) {
    this.name = name; this.age = age; // Player's name and age
  }
  static fromPlayerData(uid, playerData, bcrypt) {
    const player = new Player(uid, playerData.name, bcrypt); player.updateData(playerData); return player; // Create and return player
  }
  async updateData(updatedData) {
    if (updatedData.health !== undefined) await this.setHealth(updatedData.health); // Await health update if provided
    if (updatedData.experience !== undefined) await this.setExperience(updatedData.experience); // Await experience update if provided
    if (updatedData.level !== undefined) await this.setLevel(updatedData.level); // Await level update if provided
  }
}
// Entity ***************************************************************************************
/*
 * The Entity class is a base class for all entities in the game.
 * It contains shared properties and methods for characters and players.
*/
class Entity {
  constructor(name, health) {
    this.name = name; this.health = health; // Entity's name and health
  }
  getName() { return this.name; } // Return entity's name
  getHealth() { return this.health; } // Return entity's health
  setHealth(newHealth) { this.health = newHealth; } // Set new health value
}
// Character ***************************************************************************************
/*
 * The Character class represents a character in the game.
 * It extends the Entity class.
*/
class Character extends Entity {
  constructor(name, health) { super(name, health); } // Call the parent constructor
}
// Player *****************************************************************************************
/*
* The Player class represents a player in the game.
* It extends the Character class.
*/
class Player extends Character {
  constructor(uid, name, bcrypt) {
    super(name, 100); this.uid = uid; this.bcrypt = bcrypt; this.inventory = new Set(); this.healthRegenerator = new HealthRegenerator(this); // Initialize properties
    this.initializePlayerAttributes(); // Call method to initialize player attributes
  }
  initializePlayerAttributes() {
    this.CONFIG = null; this.password = ""; this.description = ""; this.title = ""; this.reputation = ""; this.profession = ""; this.sex = ""; this.age = 0; this.maxHealth = 100; this.level = 0; this.csml = 0; this.attackPower = 10; this.defensePower = 0; this.experience = 0; this.currentLocation = "100"; this.coordinates = {}; this.skills = []; this.status = "standing"; this.affects = []; this.killer = true; this.autoLoot = true; this.lastRegenTime = Date.now(); this.failedLoginAttempts = 0; this.consecutiveFailedAttempts = 0; this.lastLoginTime = Date.now(); this.totalPlayingTime = 0; this.colorPreferences = {}; this.previousState = { health: this.health, status: this.status }; this.inventoryManager = new InventoryManager(this); this.weapons = new Set(); // Initialize all player attributes
  }
  getId() { return this.uid; } // Return unique identifier
  getPossessivePronoun() { return this.sex === 'male' ? 'his' : 'her'; } // Return possessive pronoun based on sex
  addToInventory(item) { this.inventory.add(item); } // Add item to inventory Set
  removeFromInventory(item) { this.inventory.delete(item); } // Remove item from inventory Set
  canAddToInventory(item) {
    const INVENTORY_CAPACITY = this.server.config.INVENTORY_CAPACITY; // Use ConfigManager
    return this.inventory.size < INVENTORY_CAPACITY && item.isValid(); // Check size of Set
  }
  getInventoryCapacity() { return this.server.config.INVENTORY_CAPACITY; } // Use config to return maximum inventory capacity
  authenticate(password) {
    const isPasswordValid = this.bcrypt.compare(password, this.password); // Compare provided password with stored password
    if (isPasswordValid) { this.resetFailedLoginAttempts(); return true; } // Reset failed login attempts on success
    this.incrementFailedLoginAttempts(); return false; // Increment failed login attempts on failure
  }
  attackNpc(target) { this.actions.attackNpc(target); } // Delegate to PlayerActions
  incrementFailedLoginAttempts() {
    this.failedLoginAttempts++; this.consecutiveFailedAttempts++; // Increment failed login attempts
    if (this.consecutiveFailedAttempts >= 3) { MessageManager.notifyDisconnectionDueToFailedAttempts(this); this.server.gameManager.disconnectPlayer(this.uid); } // Notify disconnection due to failed attempts
  }
  showInventory() {
    const inventoryList = this.getInventoryList(); this.notifyPlayer(inventoryList); // Use utility method
  }
  lootSpecifiedNpc(target) {
    const location = this.server.gameManager.getLocation(this.currentLocation); // Use this.server to access gameManager
    if (!location) return; // Early return if location is not found
    const targetLower = target.toLowerCase(); // Convert target name to lowercase
    const targetEntity = location.entities.find(entity => entity.name.toLowerCase() === targetLower); // Find target entity in location
    if (targetEntity) { this.notifyPlayer(`You loot ${targetEntity.name}.`); return; } // Early return if target is found
    this.notifyPlayer(`Target ${target} not found in location.`); // Use utility method
  }
  moveToLocation(newLocationId) {
    try {
      const newLocation = this.server.gameManager.getLocation(newLocationId); // Get new location
      if (newLocation) {
        this.currentLocation = newLocationId; // Update current location
        newLocation.addPlayer(this); // Add player to new location
        const oldLocation = this.server.gameManager.getLocation(this.currentLocation); // Get old location
        if (oldLocation) oldLocation.removePlayer(this); // Remove player from old location
        MessageManager.notify(this, `You moved to ${newLocation.getName()}.`); // Notify player
      }
    } catch (error) {
      this.server.logger.error(`ERROR: Moving to location: ${error.message}`, { error });
      this.server.logger.error(error.stack); // Log stack trace
    }
  }
  notifyPlayer(message) { MessageManager.notify(this, message); } // Centralized notification method
  resetFailedLoginAttempts() {
    this.failedLoginAttempts = 0; this.consecutiveFailedAttempts = 0; this.lastLoginTime = Date.now(); // Reset failed login attempts
  }
  save() {
    const playerData = this.collectPlayerData(); // Collect player data for batch saving
    QueueManager.addDataSaveTask(DatabaseManager.PLAYER_DATA_PATH, this.getId(), playerData); // Add save task to queue
  }
  collectPlayerData() {
    return {
      name: this.name, age: this.age, health: this.health, experience: this.experience, level: this.level, // ... add other relevant properties ...
    }; // Return an object with relevant player data
  }
  static async loadBatch(playerIds) {
    const playerDataArray = await DatabaseManager.loadPlayersData(playerIds); // Load data for multiple players
    return playerDataArray.map(data => new Player(data.uid, data.name, data.bcrypt)); // Create Player instances from loaded data
  }
  // @ todo: add code for this.
  score() {
    const stats = `Level: ${this.level}, XP: ${this.experience}, Health: ${this.health}/${this.maxHealth}`; // Create score string
    MessageManager.notifyStats(this, stats); // Notify player of their stats
  }
  updateData(updatedData) {
    if (updatedData.health !== undefined) this.setHealth(updatedData.health); // Update health if provided
    if (updatedData.experience !== undefined) this.setExperience(updatedData.experience); // Update experience if provided
    if (updatedData.level !== undefined) this.setLevel(updatedData.level); // Update level if provided
  }
  async hashUid() {
    try { this.hashedUid = await this.bcrypt.hash(this.uid, 5); } catch (error) { console.error('Failed to hash UID:', error); console.error(error.stack); } // Handle hashing error
  }
  async login(inputPassword) {
    const isAuthenticated = await this.authenticate(inputPassword); // Await authentication
    if (isAuthenticated) { MessageManager.notifyLoginSuccess(this); return true; } // Notify successful login
    MessageManager.notifyIncorrectPassword(this); return false; // Notify incorrect password
  }
  startHealthRegeneration() { this.healthRegenerator.start(); } // Start health regeneration process
  checkAndRemoveExpiredAffects() {
    const now = Date.now(); // Get current time
    this.affects = this.affects.filter(affect => {
      if (affect.endTime && affect.endTime <= now) { affect.remove(this); return false; } // Remove expired affect
      return true; // Keep active affects
    });
  }
  meditate() {
    if (this.status !== "sitting") { this.startHealthRegeneration(); MessageManager.notifyMeditationAction(this); return; } // Start health regeneration if not sitting
    this.status = "meditating"; MessageManager.notifyMeditationStart(this); // Notify meditation start
  }
  sleep() {
    this.startHealthRegeneration(); this.status = "sleeping"; MessageManager.notifySleepAction(this); // Notify sleep action
  }
  sit() {
    if (this.status === "sitting") { MessageManager.notifyAlreadySitting(this); return; } // Notify if already sitting
    if (this.status === "standing") { this.startHealthRegeneration(); this.status = "sitting"; MessageManager.notifySittingDown(this); return; } // Set status to sitting
    MessageManager.notifyStoppingMeditation(this); // Notify stopping meditation
  }
  stand() {
    if (this.status === "lying unconscious") { this.status = "standing"; MessageManager.notifyStandingUp(this); } // Notify standing up action
    else MessageManager.notifyAlreadyStanding(this); // Notify if already standing
  }
  wake() {
    if (this.status === "lying unconscious") { this.status = "standing"; MessageManager.notifyStandingUp(this); return; } // Set status to standing
    if (this.status === "sleeping") { this.status = "standing"; MessageManager.notifyWakingUp(this); return; } // Notify waking up action
    MessageManager.notifyAlreadyAwake(this); // Notify if already awake
  }
  autoLootToggle() {
    this.autoLoot = !this.autoLoot; MessageManager.notifyAutoLootToggle(this, this.autoLoot); // Notify auto-loot toggle
  }
  lookIn(containerName) {
    const location = this.server.gameManager.getLocation(this.currentLocation); // Use this.server to access gameManager
    const containerId = this.getContainerId(containerName) || this.findEntity(containerName, location.items, 'item'); // Get container ID
    if (!containerId) { MessageManager.notifyNoContainerHere(this, containerName); return; } // Notify if no container found
    const container = this.server.items[containerId]; // Use this.server to access items
    if (container instanceof ContainerItem) {
      const itemsInContainer = container.inventory.map(itemId => this.server.items[itemId].name); // Use this.server to access items
      MessageManager.notifyLookInContainer(this, container.name, itemsInContainer); // Notify items in container
    } else MessageManager.notifyNotAContainer(this, container.name); // Notify if not a container
  }
  hasChangedState() {
    const hasChanged = this.health !== this.previousState.health || this.status !== this.previousState.status; // Check if state has changed
    if (hasChanged) this.previousState = { health: this.health, status: this.status }; // Update previous state
    return hasChanged; // Return if state has changed
  }
  getInventoryList() { return Array.from(this.inventory).map(item => item.name).join(", "); } // Centralized inventory list retrieval
  describeCurrentLocation() { new DescribeLocationManager(this).describe(); } // Call the describe method
  lookAt(target) { new LookAt(this).look(target); } // Call the look method
  addWeapon(weapon) {
    if (weapon instanceof WeaponItem) { this.weapons.add(weapon); MessageManager.notifyPickupItem(this, weapon.name); } // Notify weapon pickup
  }
  removeWeapon(weapon) { this.weapons.delete(weapon); }
  static async createNewPlayer(name, age) { return new CreateNewPlayer(name, age); } // Use CreateNewPlayer to create a new instance
}
// Health Regenerator ****************************************************************************
/*
 * The HealthRegenerator class is responsible for regenerating the player's health over time.
 * It uses a setInterval to call the regenerate method at regular intervals.
*/
class HealthRegenerator {
  constructor(player) {
    this.player = player; this.config = null; this.regenInterval = null; // Initialize properties
  }
  start() {
    if (!this.regenInterval) {
      const REGEN_INTERVAL = this.config.get('REGEN_INTERVAL'); // Use ConfigManager for REGEN_INTERVAL
      this.regenInterval = setInterval(() => this.regenerate(), REGEN_INTERVAL); // Use config
    }
  }
  regenerate() {
    const { health, maxHealth } = this.player; const now = Date.now(); const timeSinceLastRegen = (now - this.player.lastRegenTime) / 1000; const regenAmount = (this.getRegenAmountPerMinute() / 60) * timeSinceLastRegen; // Calculate regeneration amount
    if (regenAmount > 0 && health < maxHealth) { this.player.health = Math.min(health + regenAmount, maxHealth); this.player.lastRegenTime = now; } // Regenerate health
    if (health >= maxHealth) this.stop(); // Stop regeneration if max health is reached
  }
  getRegenAmountPerMinute() {
    const regenRates = {
      "in combat": this.config.get('REGEN_RATES').get('IN_COMBAT'), // Use ConfigManager for REGEN_RATES
      "standing": this.config.get('REGEN_RATES').get('STANDING'), // Use ConfigManager for REGEN_RATES
      "sitting": this.config.get('REGEN_RATES').get('SITTING'), // Use ConfigManager for REGEN_RATES
      "sleeping": this.config.get('REGEN_RATES').get('SLEEPING'), // Use ConfigManager for REGEN_RATES
      "unconscious": this.config.get('REGEN_RATES').get('UNCONSCIOUS'), // Use ConfigManager for REGEN_RATES
      "meditating": this.config.get('REGEN_RATES').get('MEDITATING'), // Use ConfigManager for REGEN_RATES
    }; // Use .get() to access values from the Map
    return (regenRates[this.player.status] || 0) * this.player.maxHealth; // Return regeneration amount based on status
  }
  stop() {
    if (this.regenInterval) { clearInterval(this.regenInterval); this.regenInterval = null; } // Clear regeneration interval
  }
}
// Look At ***************************************************************************************
/*
 * The LookAt class is responsible for handling the player's "look" command.
 * It retrieves the target entity from the current location and formats the appropriate message.
*/
class LookAt {
  constructor(player) { this.player = player; } // Reference to the player instance
  look(target) {
    const { currentLocation, player } = this; // Destructure properties
    const location = this.server.gameManager.getLocation(currentLocation); // Get current location
    if (!location) return; // Early return if location is not found
    const targetLower = target.toLowerCase(); // Convert target name to lowercase
    const playerNameLower = player.getName().toLowerCase(); // Convert player name to lowercase
    if (targetLower === 'self' || targetLower === playerNameLower || playerNameLower.startsWith(targetLower)) { this.lookAtSelf(); return; } // Look at self if target is self
    const itemInInventory = player.inventory.find(item => item.aliases.includes(targetLower)); // Find item in inventory
    if (itemInInventory) { MessageManager.notifyLookAtItemInInventory(player, itemInInventory); return; } // Notify looking at item in inventory
    const itemInLocation = location.items.find(item => item.aliases.includes(targetLower)); // Find item in location
    if (itemInLocation) { MessageManager.notifyLookAtItemInLocation(player, itemInLocation); return; } // Notify looking at item in location
    const npcId = location.npcs.find(npcId => {
      const npc = this.server.gameManager.getNpc(npcId); // Get NPC instance
      return npc && npc.aliases.includes(targetLower); // Check if NPC matches target
    });
    if (npcId) { const npc = this.server.gameManager.getNpc(npcId); MessageManager.notifyLookAtNpc(player, npc); return; } // Notify looking at NPC
    const otherPlayer = location.playersInLocation.find(player => player.name.toLowerCase() === targetLower); // Find other player in location
    if (otherPlayer) { MessageManager.notifyLookAtOtherPlayer(player, otherPlayer); return; } // Notify looking at other player
    MessageManager.notifyTargetNotFoundInLocation(player, target); // Notify if target is not found in location
  }
  lookAtSelf() { MessageManager.notifyLookAtSelf(this.player); } // Notify looking at self
}
// Uid Generator **********************************************************************************
/*
 * The UidGenerator class is responsible for generating unique IDs for entities in the game.
 * It uses bcrypt to generate a unique value and return the hashed UID.
*/
class UidGenerator {
  static async generateUid() {
    const { hash } = await import('bcrypt'); // Correctly import bcrypt
    const uniqueValue = Date.now() + Math.random(); // Generate a unique value based on time and randomness
    return hash(uniqueValue.toString(), 5); // Hash the unique value
  }
}
// Direction Manager ******************************************************************************
/*
 * The DirectionManager class is responsible for partially generating Player and NPC movement
 * message content based on directions. It provides methods to get the direction to a new location
 * and the direction from an old location.
*/
class DirectionManager {
  static getDirectionTo(newLocationId) {
    const directionMap = { 'north': 'northward', 'east': 'eastward', 'west': 'westward', 'south': 'southward', 'up': 'upward', 'down': 'downward' }; // Map direction to string
    return directionMap[newLocationId] || 'unknown direction'; // Return direction string or default
  }
  static getDirectionFrom(oldLocationId) {
    const directionMap = { 'north': 'from the north', 'east': 'from the east', 'west': 'from the west', 'south': 'from the south', 'up': 'from above', 'down': 'from below' }; // Map direction to string
    return directionMap[oldLocationId] || 'from an unknown direction'; // Return direction string or default
  }
}
// Location ***************************************************************************************
/*
 * The Location class intended to be used with OLC (online creation system).
*/
class Location {
  constructor(name, description) {
    this.name = name; this.description = description; this.exits = new Map(); this.items = new Set(); this.npcs = new Set(); this.playersInLocation = new Set(); this.zone = []; // Initialize properties
  }
  addExit(direction, linkedLocation) { this.exits.set(direction, linkedLocation); } // Add exit to the location
  addItem(item) { this.items.add(item); } // Add item to the location
  addNpc(npc) { this.npcs.add(npc.id); } // Add NPC to the location
  addPlayer(player) { this.playersInLocation.add(player); } // Add player to the location
  removePlayer(player) { this.playersInLocation.delete(player); } // Remove player from the location
  getDescription() { return this.description; } // Return location description
  getName() { return this.name; } // Return location name
  getNpcs() { return Array.from(this.npcs).map(npcId => this.gameManager.getNpc(npcId)); } // Retrieve all NPCs in the location
}
// NPC ********************************************************************************************
/*
 * The Npc class is responsible for representing non-player characters in the game.
 * It extends the Character class.
*/
class Npc extends Character {
  constructor(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, mobile = false, zones = [], aliases) {
    super(name, currHealth); this.sex = sex; this.maxHealth = maxHealth; this.attackPower = attackPower; this.csml = csml; this.aggro = aggro; this.assist = assist; this.status = status; this.currentLocation = currentLocation; this.mobile = mobile; this.zones = zones; this.aliases = aliases; this.id = UidGenerator.generateUid(); this.currHealth; this.previousState = { currHealth, status }; // Initialize properties
    if (this.mobile) this.startMovement(); // Start movement if NPC is mobile
  }
  startMovement() {
    setInterval(() => { if (this.status !== "engaged in combat") this.moveRandomly(); }, this.CONFIG.NPC_MOVEMENT_INTERVAL); // Set movement interval
  }
  moveRandomly() {
    const location = this.server.gameManager.getLocation(this.currentLocation); // Get current location
    const validDirections = Object.keys(location.exits).filter(direction => this.zones.includes(location.zone[0]) ? direction : null); // Check if the zone matches
    if (validDirections.length > 0) {
      const randomDirection = validDirections[Math.floor(Math.random() * validDirections.length)]; // Select a random direction
      const newLocationId = location.exits[randomDirection]; // Get new location ID
      MessageManager.notifyNpcDeparture(this, DirectionManager.getDirectionTo(newLocationId)); // Notify players of NPC departure
      this.currentLocation = newLocationId; // Update NPC's location
      const direction = DirectionManager.getDirectionFrom(this.currentLocation); // Use DirectionManager directly
      MessageManager.notifyNpcArrival(this, direction); // Pass direction to notifyNpcArrival
    }
  }
  hasChangedState() {
    const hasChanged = this.currHealth !== this.previousState.currHealth || this.status !== this.previousState.status; // Check if state has changed
    if (hasChanged) this.previousState = { currHealth: this.currHealth, status: this.status }; // Update previous state
    return hasChanged; // Return if state has changed
  }
}
// Base Item ***************************************************************************************
/*
 * The BaseItem class is responsible for representing items in the game.
 * It stores the item's UID, name, description, and aliases.
*/
class BaseItem {
  constructor(name, description, aliases) {
    this.name = name; this.description = description; this.aliases = aliases; this.uid = UidGenerator.generateUid(); // Initialize properties
  }
}
// Item *******************************************************************************************
/*
 * The Item class is responsible for representing items in the game.
 * It stores the item's UID, name, description, and aliases.
*/
class Item extends BaseItem {
  constructor(name, description, aliases) { super(name, description, aliases); } // Call parent constructor
}
// Container Item *********************************************************************************
/*
 * The ContainerItem class extends the Item class and is used to represent items that can hold other items.
 * It adds an inventory property to store the items contained within the container.
*/
class ContainerItem extends BaseItem {
  constructor(name, description, aliases) {
    super(name, description, aliases); this.inventory = []; // Initialize inventory array
  }
}
// Weapon Item ************************************************************************************
/*
 * The WeaponItem class is responsible for representing items that can be used in combat.
 * It adds a damage property to store the weapon's damage value.
*/
class WeaponItem extends BaseItem {
  constructor(name, description, aliases) {
    super(name, description, aliases); this.damage = 0; // Initialize damage value
  }
}
// Inventory Manager ******************************************************************************
/*
 * The InventoryManager class is responsible for managing the player's inventory.
 * It provides methods to add, remove, and transfer items between the player's inventory and other
 * sources.
*/
class InventoryManager {
  constructor(player) {
    this.player = player; // Reference to the player instance
    this.messageManager = new MessageManager(); // Initialize message manager
  }
  addToInventory(item) {
    try {
      if (item instanceof Item) { // Check if item is an instance of Item
        this.player.inventory.push(item); // Add item to player's inventory
        MessageManager.notifyPickupItem(this.player, item.name); // Notify item pickup
      }
    } catch (error) {
      this.messageManager.notifyError(this.player, `ERROR: Adding item to inventory: ${error.message}`);
      this.player.server.logger.error(error.stack); // Log stack trace
    }
  }
  removeFromInventory(item) {
    this.player.inventoryManager.removeFromInventory(item); // Use inventoryManager to remove item
  }
  getAllItemsFromSource(source, sourceType, containerName) {
    if (source && source.length > 0) {
      const itemsTaken = source.map(itemId => this.player.server.items[itemId]); // Get items from source
      this.player.inventory.push(...itemsTaken); // Add items to player's inventory
      if (sourceType === 'location') {
        this.player.server.location[this.player.currentLocation].items = []; // Clear items from location
      } else {
        this.player.server.items[containerName].inventory = []; // Clear items from container
      }
      this.messageManager.notifyItemsTaken(this.player, itemsTaken); // Notify items taken
    } else {
      this.messageManager.notifyNoItemsHere(this.player); // Notify if no items found
    }
  }
  getAllItemsFromLocation() {
    this.getAllItemsFromSource(this.player.server.location[this.player.currentLocation].items, 'location'); // Get all items from current location
  }
  getAllItemsFromContainer(containerName) {
    const containerId = this.getContainerId(containerName); // Get container ID
    if (!containerId) return; // Return if container not found
    const container = this.player.server.items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const items = container.inventory.filter(i => this.player.server.items[i]); // Find items in container
      this.getAllItemsFromSource(items, 'container', container.name); // Get items from container
    }
  }
  getSingleItemFromContainer(itemName, containerName) {
    const containerId = this.getContainerId(containerName); // Get container ID
    if (!containerId) return; // Return if container not found
    const container = this.player.server.items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const itemId = this.getItemIdFromContainer(itemName, container); // Use method to find item in container
      if (itemId) {
        this.transferItem(itemId, container, 'container'); // Transfer item from container to player
      } else {
        this.messageManager.notifyNoItemInContainer(this.player, itemName, container.name); // Notify if item not found
      }
    }
  }
  getSingleItemFromLocation(target1) {
    const itemId = this.getItemIdFromLocation(target1, this.player.server.location[this.player.currentLocation].items); // Use method to find item in location
    if (itemId) {
      this.transferItem(itemId, this.player.server.location[this.player.currentLocation], 'location'); // Transfer item from location to player
    } else {
      this.messageManager.notifyNoItemHere(this.player, target1); // Notify if item not found
    }
  }
  dropAllItems() {
    this.dropItems(this.player.inventory, 'all'); // Drop all items from inventory
  }
  dropAllSpecificItems(itemType) {
    const itemsToDrop = this.player.inventory.filter(item => this.itemMatchesType(item, itemType)); // Filter items by type
    this.dropItems(itemsToDrop, 'specific', itemType); // Drop specific items
  }
  dropSingleItem(target1) {
    const item = this.player.inventory.find(i => i.name.toLowerCase() === target1.toLowerCase()); // Find item in inventory
    if (item) {
      this.transferItem(item, this.player.server.location[this.player.currentLocation], 'drop'); // Transfer item from player to location
    } else {
      this.messageManager.notifyNoItemToDrop(this.player, target1); // Notify if item not found
    }
  }
  putSingleItem(itemName, containerName) {
    const item = this.getItemFromInventory(itemName); // Get item from inventory
    if (!item) return; // Return if item not found
    const containerId = this.getContainerId(containerName); // Get container ID
    if (!containerId) return; // Return if container not found
    const container = this.player.server.items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      container.inventory.push(item.uid); // Add item to container's inventory
      this.player.inventory = this.player.inventory.filter(i => i !== item); // Remove item from player's inventory
      this.messageManager.notifyItemPutInContainer(this.player, item.name, container.name); // Notify item placement
    }
  }
  putAllItems(containerName) {
    const containerId = this.getContainerId(containerName); // Get container ID
    if (!containerId) return; // Early return if container not found
    const container = this.player.server.items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const itemsToPut = this.player.inventory.filter(item => item !== container); // Filter items to put in container
      if (itemsToPut.length === 0) {
        this.messageManager.notifyNoItemsToPut(this.player, container.name); // Notify if no items to put
        return;
      }
      container.inventory.push(...itemsToPut.map(item => item.uid)); // Add items to container's inventory
      this.player.inventory = this.player.inventory.filter(item => item === container); // Remove items from player's inventory
      this.messageManager.notifyItemsPutInContainer(this.player, itemsToPut, container.name); // Notify items placement
    }
  }
  putAllSpecificItemsIntoContainer(itemType, containerName) {
    const error = this.containerErrorMessage(containerName, 'hold'); // Check for container errors
    if (error) {
      this.messageManager.notify(this.player, error); // Notify container error
      return;
    }
    const containerId = this.getContainerId(containerName); // Get container ID
    const container = this.player.server.items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const itemsToPut = this.player.inventory.filter(item => item !== container && this.itemMatchesType(item, itemType)); // Filter items by type
      if (itemsToPut.length === 0) {
        this.messageManager.notifyNoSpecificItemsToPut(this.player, itemType, container.name); // Notify if no specific items to put
        return;
      }
      container.inventory.push(...itemsToPut.map(item => item.uid)); // Add items to container's inventory
      this.player.inventory = this.player.inventory.filter(item => !itemsToPut.includes(item)); // Remove items from player's inventory
      this.messageManager.notifyItemsPutInContainer(this.player, itemsToPut, container.name); // Notify items placement
    }
  }
  getAllSpecificItemsFromLocation(itemType) {
    const currentLocation = this.player.server.location[this.player.currentLocation]; // Get current location
    if (currentLocation.items && currentLocation.items.length > 0) {
      const itemsTaken = currentLocation.items.filter(itemId => this.itemMatchesType(this.player.server.items[itemId], itemType)); // Filter items by type
      if (itemsTaken.length > 0) {
        this.player.inventory.push(...itemsTaken.map(itemId => this.player.server.items[itemId])); // Add items to player's inventory
        currentLocation.items = currentLocation.items.filter(itemId => !itemsTaken.includes(itemId)); // Remove items from location
        this.messageManager.notifyItemsTaken(this.player, itemsTaken); // Notify items taken
      } else {
        this.messageManager.notifyNoSpecificItemsHere(this.player, itemType); // Notify if no specific items found
      }
    } else {
      this.messageManager.notifyNoItemsHere(this.player); // Notify if no items found
    }
  }
  getAllSpecificItemsFromContainer(itemType, containerName) {
    const error = this.containerErrorMessage(containerName, 'hold'); // Check for container errors
    if (error) {
      this.messageManager.notify(this.player, error); // Notify container error
      return;
    }
    const containerId = this.getContainerId(containerName); // Get container ID
    const container = this.player.server.items[containerId]; // Get container instance
    if (container instanceof ContainerItem) {
      const itemsTaken = container.inventory.filter(itemId => this.itemMatchesType(this.player.server.items[itemId], itemType)); // Filter items by type
      if (itemsTaken.length > 0) {
        this.player.inventory.push(...itemsTaken.map(itemId => this.player.server.items[itemId])); // Add items to player's inventory
        container.inventory = container.inventory.filter(itemId => !itemsTaken.includes(itemId)); // Remove items from container
        this.messageManager.notifyItemsTakenFromContainer(this.player, itemsTaken, container.name); // Notify items taken from container
      } else {
        this.messageManager.notifyNoSpecificItemsInContainer(this.player, itemType, container.name); // Notify if no specific items found
      }
    }
  }
  autoLootNPC(npc) {
    if (npc.inventory && npc.inventory.length > 0) {
      const lootedItems = [...npc.inventory]; // Clone NPC's inventory
      this.player.inventory.push(...lootedItems.map(itemId => this.player.server.items[itemId])); // Add looted items to player's inventory
      npc.inventory = []; // Clear NPC's inventory
      return this.messageManager.createAutoLootMessage(this.player, npc, lootedItems); // Create and return auto loot message
    }
    return null; // No items to loot
  }
  lootNPC(target1) {
    const npcId = this.getNpcIdFromLocation(target1, this.player.server.location[this.player.currentLocation].npcs); // Find NPC in location
    if (npcId) {
      const npc = this.player.server.npcs[npcId]; // Get NPC instance
      if (npc.status === "lying unconscious" || npc.status === "lying dead") {
        if (npc.inventory && npc.inventory.length > 0) {
          const lootedItems = [...npc.inventory]; // Clone NPC's inventory
          this.player.inventory.push(...lootedItems.map(itemId => this.player.server.items[itemId])); // Add looted items to player's inventory
          npc.inventory = []; // Clear NPC's inventory
          this.messageManager.notifyLootedNPC(this.player, npc, lootedItems); // Notify looted NPC
        } else {
          this.messageManager.notifyNothingToLoot(this.player, npc); // Notify if nothing to loot
        }
      } else {
        this.messageManager.notifyCannotLootNPC(this.player, npc); // Notify if NPC cannot be looted
      }
    } else {
      this.messageManager.notifyNoNPCToLoot(this.player, target1); // Notify if no NPC found to loot
    }
  }
  lootAllNPCs() {
    const currentLocation = this.player.server.location[this.player.currentLocation]; // Get current location
    if (!currentLocation.npcs || currentLocation.npcs.length === 0) {
      this.messageManager.notifyNoNPCsToLoot(this.player); // Notify if no NPCs to loot
      return;
    }
    const lootedItems = []; // Array to hold looted items
    const lootedNPCs = []; // Array to hold names of looted NPCs
    currentLocation.npcs.forEach(npcId => {
      const npc = this.player.server.npcs[npcId]; // Get NPC instance
      if ((npc.status === "lying unconscious" || npc.status === "lying dead") && npc.inventory && npc.inventory.length > 0) {
        lootedItems.push(...npc.inventory); // Add looted items to array
        this.player.inventory.push(...npc.inventory.map(itemId => this.player.server.items[itemId])); // Add items to player's inventory
        lootedNPCs.push(npc.name); // Add NPC name to looted NPCs
        npc.inventory = []; // Clear NPC's inventory
      }
    });
    if (lootedItems.length > 0) {
      this.messageManager.notifyLootedAllNPCs(this.player, lootedNPCs, lootedItems); // Notify looted NPCs
    } else {
      this.messageManager.notifyNothingToLootFromNPCs(this.player); // Notify if nothing to loot from NPCs
    }
  }
  containerErrorMessage(containerName, action) {
    const containerId = this.getContainerId(containerName); // Use getContainerId method instead
    if (!containerId) {
      return `${this.player.getName()} doesn't have a ${containerName} to ${action}.`; // Return error message if container not found
    }
    if (!this.player.server.items[containerId].inventory) {
      return MessageManager.notifyNotAContainer(this.player, this.player.server.items[containerId].name, action); // Return error message if not a container
    }
    return null; // No error
  }
  itemNotFoundMessage(itemName, location) {
    return MessageManager.notifyItemNotInInventory(this.player, itemName, location) // Notify if item not found in inventory
  }
  dropItems(itemsToDrop, type, itemType) {
    if (itemsToDrop.length > 0) {
      if (!this.player.server.location[this.player.currentLocation].items) {
        this.player.server.location[this.player.currentLocation].items = []; // Initialize items array if not present
      }
      this.player.server.location[this.player.currentLocation].items.push(...itemsToDrop.map(item => item.uid)); // Add items to location
      this.player.inventory = this.player.inventory.filter(item => !itemsToDrop.includes(item)); // Remove items from player's inventory
      this.messageManager.notifyItemsDropped(this.player, itemsToDrop); // Notify items dropped
    } else {
      this.messageManager.notifyNoItemsToDrop(this.player, type, itemType); // Notify if no items to drop
    }
  }
  getContainerId(containerName) {
    const containerId = this.getContainerIdFromInventory(containerName); // Use method to find container ID
    if (!containerId) {
      this.messageManager.notifyNoContainer(this.player, containerName); // Notify if no container found
      return null; // Return null if not found
    }
    if (!this.player.server.items[containerId].inventory) {
      this.messageManager.notifyNotAContainer(this.player, this.player.server.items[containerId].name); // Notify if not a container
      return null; // Return null if not a container
    }
    return containerId; // Return container ID
  }
  getItemFromInventory(itemName) {
    const item = this.player.inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase()); // Find item in inventory
    if (!item) {
      this.messageManager.notifyItemNotInInventory(this.player, itemName); // Notify if item not found
    }
    return item; // Return found item or undefined
  }
  transferItem(itemId, source, sourceType) {
    this.player.server.transferItem(itemId, source, sourceType, this.player); // Use server's transferItem method
  }
  getContainerIdFromInventory(containerName) { // New method to find container ID
    return this.player.inventory.find(item => item.name.toLowerCase() === containerName.toLowerCase())?.uid; // Find container by name
  }
  getNpcIdFromLocation(npcName, npcs) { // New method to find NPC ID
    return npcs.find(npcId => this.player.server.npcs[npcId].name.toLowerCase() === npcName.toLowerCase()); // Find NPC by name
  }
  getItemIdFromLocation(target, items) { // New method to find item ID in location
    return items.find(item => item.name.toLowerCase() === target.toLowerCase())?.uid; // Find item by name
  }
  getItemIdFromContainer(itemName, container) { // New method to find item ID in container
    return container.inventory.find(itemId => this.player.server.items[itemId].name.toLowerCase() === itemName.toLowerCase()); // Find item by name
  }
  itemMatchesType(item, itemType) { // New method to check item type
    return item.type === itemType; // Adjust according to your item structure
  }
  addWeaponToInventory(weapon) {
    if (weapon instanceof WeaponItem) {
      this.player.weapons.add(weapon); // Add weapon to player's weapons
      MessageManager.notifyPickupItem(this.player, weapon.name); // Notify weapon pickup
    }
  }
}
// Combat Action **********************************************************************************
/*
 * The CombatAction class is responsible for performing combat actions between two entities.
 * It calculates the damage inflicted, updates the defender's health, and handles the defeat of the defender.
*/
class CombatAction {
  constructor(logger) {
    this.logger = logger;
  }
  perform(attacker, defender) {
    try {
      const damage = this.calculateDamage(attacker, defender);
      defender.health -= damage; // Reduce defender's health by damage
      this.notifyCombatResult(attacker, defender, damage); // Notify combat result
      if (defender.health <= 0) {
        this.handleDefeat(defender); // Handle defeat if health drops to 0
      }
    } catch (error) {
      this.logger.error(`ERROR: During combat action: ${error.message}`, { error });
      this.logger.error(error.stack); // Log stack trace
    }
  }
  calculateDamage(attacker, defender) {
    const baseDamage = attacker.attackPower; // Base damage from attacker's power
    const defense = defender.defensePower; // Defense from defender
    const damage = Math.max(baseDamage - defense, 0); // Ensure damage is not negative
    return damage; // Return calculated damage
  }
  notifyCombatResult(attacker, defender, damage) {
    this.logger.info(`${attacker.getName()} attacks ${defender.getName()} for ${damage} damage.`);
  }
  handleDefeat(defender) {
    this.logger.info(`${defender.getName()} has been defeated!`);
    defender.status = "lying unconscious"; // Update status
    // Additional logic for handling defeat (e.g., removing from game, notifying players)
  }
}
// Combat Manager *********************************************************************************
/*
 * The CombatManager class is responsible for managing combat between players and NPCs.
 * It handles the initiation, execution, and end of combat, as well as the selection of combat techniques.
*/
class CombatManager {
  constructor(server) {
    this.server = server;
    this.logger = server.logger;
    this.objectPool = new ObjectPool(() => new CombatAction(this.logger), 10);
    this.gameManager = server.gameManager;
    this.techniques = this.initializeTechniques();
    this.combatOrder = new Map();
    this.defeatedNpcs = new Set();
    this.combatInitiatedNpcs = new Set();
  }
  initializeTechniques() {
    return [
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
    ]; // List of combat techniques
  }
  initiateCombatWithNpc(npcId, player, playerInitiated = false) { // Public method to initiate combat
    try {
      this.logger.debug(`Initiating combat with NPC ${npcId} for player ${player.getName()}`);
      this.startCombat(npcId, player, playerInitiated); // Calls the private method to start combat
    } catch (error) {
      this.logger.error(`ERROR: Initiating combat with NPC ${npcId} for player ${player.getName()}:`, error);
      this.logger.error(error.stack); // Log stack trace
    }
  }
  endCombatForPlayer(player) { // Public method to end combat for a player
    this.endCombat(player); // Calls the private method to end combat
  }
  startCombat(npcId, player, playerInitiated) {
    try {
      this.logger.debug(`Starting combat between player ${player.getName()} and NPC ${npcId}`);
      const npc = this.gameManager.getNpc(npcId); // Get NPC instance
      if (!npc || this.combatOrder.has(npcId)) {
        this.logger.warn(`NPC ${npcId} not found or already in combat`);
        return;
      }
      this.combatOrder.set(npcId, { state: 'engaged' }); // Add NPC to combat order
      player.status !== "in combat"
        ? this.initiateCombat(player, npc, playerInitiated) // Initiate combat if player is not in combat
        : this.notifyCombatJoin(npc, player); // Notify if player joins combat
      npc.status = "engaged in combat"; // Set NPC status to engaged
    } catch (error) {
      this.logger.error(`ERROR: Starting combat between player ${player.getName()} and NPC ${npcId}:`, error);
      this.logger.error(error.stack); // Log stack trace
    }
  }
  initiateCombat(player, npc, playerInitiated) {
    player.status = "in combat"; // Set player status to in combat
    const message = playerInitiated
      ? MessageManager.notifyCombatInitiation(player, npc.getName()) // Notify combat initiation by player
      : MessageManager.notifyCombatInitiation(npc, player.getName()); // Notify combat initiation by NPC
    this.notifyPlayersInLocation(player.currentLocation, message.content); // Notify players in location
    if (!playerInitiated) {
      player.lastAttacker = npc.id; // Set last attacker for player
      this.combatInitiatedNpcs.add(npc.id); // Add NPC to initiated combat set
    }
    this.startCombatLoop(player); // Start combat loop for player
  }
  notifyCombatJoin(npc, player) {
    this.notifyPlayersInLocation(player.currentLocation, {
      type: "combat",
      content: MessageManager.notifyCombatJoin(npc.getName()).content // Notify players of NPC joining combat
    });
    this.combatInitiatedNpcs.add(npc.id); // Add NPC to initiated combat set
  }
  startCombatLoop(player) {
    if (player.status === "in combat" && !player.combatInterval) {
      player.combatInterval = setInterval(() => this.executeCombatRound(player), 1500); // Start combat round interval
    }
  }
  executeCombatRound(player) {
    try {
      this.logger.debug(`Executing combat round for player ${player.getName()}`);
      while (true) {
        if (player.status !== "in combat") {
          this.endCombat(player); // End combat if player is not in combat
          return;
        }
        const npc = this.getNextNpcInCombatOrder(); // Get next NPC in combat order
        if (npc) {
          const action = this.objectPool.acquire(); // Acquire a combat action from the pool
          action.perform(player, npc); // Perform combat action
          this.objectPool.release(action); // Release action back to the pool
          this.notifyHealthStatus(player, npc); // Notify health status
          const result = this.performCombatAction(player, npc, true); // Perform combat action
          MessageManager.notifyCombatResult(player, result); // Notify players of the combat result
          if (npc.health <= 0) {
            this.handleNpcDefeat(npc, player); // Handle NPC defeat
          }
        }
        if (player.health <= 0) {
          this.handlePlayerDefeat(npc, player); // Handle player defeat
        }
      }
    } catch (error) {
      this.logger.error(`ERROR: Executing combat round for player ${player.getName()}:`, error);
      this.logger.error(error.stack); // Log stack trace
    }
  }
  handlePlayerDefeat(defeatingNpc, player) {
    player.status = "lying unconscious"; // Set player status to lying unconscious
    this.endCombat(player); // End combat for player
    this.logger.info(`${player.getName()} has been defeated by ${defeatingNpc.getName()}.`, { playerId: player.getId(), npcId: defeatingNpc.id });
  }
  handleNpcDefeat(npc, player) {
    npc.status = player.killer ? "lying dead" : "lying unconscious"; // Set NPC status based on player
    player.status = "standing"; // Set player status to standing
    player.experience += npc.experienceReward; // Add experience reward to player
    const messages = this.generateDefeatMessages(player, npc); // Generate defeat messages
    this.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), { type: "combat", content: messages.join("<br>") }); // Notify players of defeat
  }
  generateDefeatMessages(player, npc) {
    const messages = [MessageManager.notifyVictory(player, npc.getName()).content]; // Create victory message
    const levelUpMessage = this.gameManager.checkLevelUp(player); // Check for level up
    if (levelUpMessage) {
      messages.push(levelUpMessage);
      this.logger.info(`${player.getName()} leveled up after defeating ${npc.getName()}.`, {
        playerId: player.getId(),
        npcId: npc.id,
        newLevel: player.level
      });
    }
    if (player.autoLoot) {
      const lootMessage = this.gameManager.autoLootNpc(npc, player); // Attempt to auto loot NPC
      if (lootMessage) {
        messages.push(lootMessage);
        this.logger.info(`${player.getName()} auto-looted ${npc.getName()}.`, {
          playerId: player.getId(),
          npcId: npc.id
        });
      }
    }
    this.combatOrder.delete(npc.id); // Remove NPC from combat order
    this.defeatedNpcs.add(npc.id);
    return messages;
  }
  endCombat(player) {
    // Ends combat for the specified player, clearing combat states and resetting status
    if (player.combatInterval) {
      clearInterval(player.combatInterval);
      player.combatInterval = null;
    }
    this.combatOrder.clear();
    this.defeatedNpcs.clear();
    this.combatInitiatedNpcs.clear();
    player.status = "standing"; // Reset player status to standing
    this.gameManager.fullStateSync(player); // Sync player state with the game manager
    this.checkAggressiveNpcs(player); // Check for aggressive NPCs in the player's location
  }
  checkForAggressiveNpcs(player) {
    // Checks for aggressive NPCs in the player's current location and initiates combat if found
    if (player.health > 0) {
      const location = this.gameManager.getLocation(player.currentLocation);
      if (location && location.npcs) {
        for (const npcId of location.npcs) {
          const npc = this.gameManager.getNpc(npcId);
          if (this.isAggressiveNpc(npc, player)) {
            this.startCombat(npcId, player, false); // Start combat with aggressive NPC
          }
        }
      }
    }
  }
  isAggressiveNpc(npc, player) {
    // Determines if the specified NPC is aggressive towards the player
    return npc && npc.aggressive &&
      npc.status !== "lying unconscious" &&
      npc.status !== "lying dead" &&
      player.status !== "lying unconscious" &&
      !this.defeatedNpcs.has(npc.id); // Check if NPC is not defeated
  }
  performCombatAction(attacker, defender, isPlayer) {
    // Executes a combat action between the attacker and defender, returning the result message
    const outcome = this.calculateAttackOutcome(attacker, defender);
    const technique = CombatManager.getRandomElement(this.techniques);
    let damage = attacker.attackPower;
    let resistDamage = defender.defensePower;
    let description = this.getCombatDescription(outcome, attacker, defender, technique);
    if (outcome === "critical success") {
      damage *= 2; // Double damage on critical success
    }
    if (damage > resistDamage) {
      defender.health -= damage - resistDamage; // Apply damage to defender's health
    }
    return FormatMessageManager.createMessageData(`<span id="combat-message-${isPlayer ? "player" : "npc"}">${description}</span>`); // Return formatted combat message
  }
  getCombatDescription(outcome, attacker, defender, technique) {
    // Generates a description of the combat action based on the outcome
    const descriptions = {
      "attack is evaded": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} evades the strike!`,
      "attack is trapped": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} traps the strike!`,
      "attack is parried": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} parries the strike!`,
      "attack is blocked": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} blocks the strike!`,
      "attack hits": `${attacker.getName()} attacks ${defender.getName()} with a ${technique}. The strike successfully hits ${defender.getName()}!`,
      "critical success": `${attacker.getName()} attacks ${defender.getName()} with a devastatingly catastrophic ${technique}.<br>The strike critically hits ${defender.getName()}!`,
      "knockout": `${attacker.getName()} strikes ${defender.getName()} with a spectacularly phenomenal blow!<br>${defender.getName()}'s body goes limp and collapses to the ground!`,
    };
    return FormatMessageManager.createMessageData(descriptions[outcome] || `${attacker.getName()} attacks ${defender.getName()} with a ${technique}.`); // Return combat description
  }
  attackNpc(player, target1) {
    const location = player.server.gameManager.getLocation(player.currentLocation); // Get current location
    if (!location) return; // Early return if location is not found
    const npcId = target1 ? this.getNpcIdFromLocation(target1, location.npcs) : this.getAvailableNpcId(location.npcs); // Find NPC by name if specified
    if (!npcId) {
      if (target1) {
        MessageManager.notifyTargetNotFound(player, target1); // Notify player if target NPC is not found
      } else {
        MessageManager.notifyNoConsciousEnemies(player); // Notify player if no conscious enemies are available
      }
      return; // Early return if no NPC found
    }
    const npc = player.server.gameManager.getNpc(npcId); // Get NPC instance
    if (!npc) return; // Early return if NPC is not found
    if (npc.isUnconsciousOrDead()) {
      MessageManager.notifyNpcAlreadyInStatus(player, npc); // Notify player if NPC is already in a non-combat state
    } else {
      this.startCombat(npcId, player, true); // Start combat with the NPC
    }
  }
  getAvailableNpcId(npcs) {
    // Returns the ID of the first available NPC that is not unconscious or dead
    return npcs.find(id => {
      const npc = this.gameManager.getNpc(id);
      return npc && !npc.isUnconsciousOrDead(); // Check if NPC is available for combat
    });
  }
  getCombatOrder() {
    // Returns the current combat order
    return this.combatOrder; // Return the set of NPCs in combat order
  }
  getNextNpcInCombatOrder() {
    return Array.from(this.combatOrder.keys())[0]; // Returns the first NPC in combat order
  }
  notifyPlayersInLocation(locationId, content) {
    MessageManager.notifyPlayersInLocation(this.gameManager.getLocation(locationId), content);
  }
  notifyHealthStatus(player, npc) {
    const playerHealthPercentage = this.calculateHealthPercentage(player.health, player.maxHealth);
    const npcHealthPercentage = this.calculateHealthPercentage(npc.health, npc.maxHealth);
    this.notifyPlayersInLocation(player.currentLocation,
      MessageManager.createCombatHealthStatusMessage(player, playerHealthPercentage, npc, npcHealthPercentage));
  }
  calculateHealthPercentage(currentHealth, maxHealth) {
    return (currentHealth / maxHealth) * 100; // Health percentage calculation
  }
  calculateAttackValue(attacker, defender, roll) {
    if (attacker.level === defender.level) {
      return roll + attacker.csml; // Equal levels
    } else if (attacker.level < defender.level) {
      return (roll + attacker.csml) - (defender.level - attacker.level); // Attacker lower level
    } else {
      return (roll + attacker.csml) + (attacker.level - defender.level); // Attacker higher level
    }
  }
  calculateAttackOutcome(attacker, defender) {
    const roll = Math.floor(Math.random() * 20) + 1; // Roll a d20
    let value = this.calculateAttackValue(attacker, defender, roll); // Calculate attack value
    if (value >= 21 || value === 19) return "critical success"; // Critical success
    if (value === 20) return "knockout"; // Knockout
    if (value >= 13) return "attack hits"; // Attack hits
    if (value >= 10) return "attack is blocked"; // Attack blocked
    if (value >= 7) return "attack is parried"; // Attack parried
    if (value >= 4) return "attack is trapped"; // Attack trapped
    if (value >= 1) return "attack is evaded"; // Attack evaded
    return "attack hits"; // Default case
  }
  static getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)]; // Random selection utility
  }
}
// Location Manager *******************************************************************************
/*
 * The LocationCoordinateManager class is responsible for assigning coordinates to locations in the game.
 * It uses a recursive approach to assign coordinates to all connected locations immediately after
 * location data is loaded.
*/
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

// Describe Location Manager***********************************************************************
/*
 * The DescribeLocationManager class is responsible for describing the current location of the player.
 * It retrieves the location object from the game manager and formats the description based on the
 * location's details. The formatted description is then sent to the player.
*/
class DescribeLocationManager {
  constructor(player, server) {
    this.player = player; // Reference to the player instance
    this.server = server;
    this.logger = server.logger;
    this.description = {}; // Reusable description object
  }

  describe() {
    try {
      const location = this.server.gameManager.getLocation(this.player.currentLocation); // Get current location
      if (!location) {
        MessageManager.notify(this.player, `${this.player.getName()} is in an unknown location.`); // Notify if location is unknown
        return;
      }
      this.description = this.formatDescription(location); // Format location description
      MessageManager.notify(this.player, this.description); // Send description to player
    } catch (error) {
      this.logger.error(`ERROR: Describing location for player ${this.player.getName()}:`, error);
      this.logger.error(error.stack); // Log stack trace
    }
  }

  formatDescription(location) {
    const title = { cssid: `location-title`, text: location.getName() }; // Title of the location
    const desc = { cssid: `location-description`, text: location.getDescription() }; // Description of the location
    const exits = { cssid: `location-exits`, text: 'Exits:' }; // Exits information
    const exitsList = this.getExitsDescription(location); // Get exits description
    const items = this.getItemsDescription(location); // Get items description
    const npcs = this.getNpcsDescription(location); // Get NPCs description
    const players = this.getPlayersDescription(location); // Get players description
    return {
      title,
      desc,
      exits,
      exitsList,
      items,
      npcs,
      players,
    };
  }

  getExitsDescription(location) {
    return Object.entries(location.exits).map(([direction, linkedLocation]) => ({
      cssid: `exit-${direction}`, // CSS ID for exit
      text: `${direction.padEnd(6, ' ')} - ${linkedLocation.getName()}`, // Exit description
    }));
  }

  getItemsDescription(location) {
    return location.items.map(item => ({
      cssid: `item-${item.uid}`, // CSS ID for item
      text: `A ${item.name} is lying here.`, // Item description
    }));
  }

  getNpcsDescription(location) {
    return location.npcs.map(npcId => {
      const npc = this.server.gameManager.getNpc(npcId); // Get NPC instance
      return npc ? { cssid: `npc-${npc.id}`, text: `${npc.getName()} is ${npc.status} here.` } : null; // NPC description
    }).filter(npc => npc); // Filter out null values
  }

  getPlayersDescription(location) {
    return location.playersInLocation.map(otherPlayer => ({
      cssid: `player`, // CSS ID for player
      text: `${otherPlayer.getName()} is ${otherPlayer.getStatus()} here.`, // Player description
    }));
  }
}

// Format Message Manager *************************************************************************
/*
 * The FormatMessageManager class is responsible for creating and managing message data that is
 * sent to players within the game. It centralizes the formatting of messages, ensuring consistency
 * in how messages are constructed and sent. This class provides methods to create message data with
 * associated CSS IDs for styling and to retrieve predefined message IDs based on specific types of
 * messages (e.g., login success, combat notifications). By centralizing message handling, it
 * simplifies the process of modifying or updating message formats and ensures that all messages
 * adhere to a consistent structure throughout the game.
*/
class FormatMessageManager {
  static createMessageData(cssid = '', message) {
    return { cssid, content: message }; // Create message data with CSS ID
  }

  static getIdForMessage(type) {
    const messageIds = {
      loginSuccess: 'player-name', // ID for login success message
      incorrectPassword: 'error-message', // ID for incorrect password message
      inventoryStatus: 'inventory-list', // ID for inventory status message
      lootAction: 'combat-message', // ID for loot action message
      targetNotFound: 'error-message', // ID for target not found message
      combatInitiation: 'combat-message-player', // ID for combat initiation message
      combatJoin: 'combat-message-npc', // ID for combat join message
      combatMessageHealth: 'combat-message-health', // ID for combat health status message
      defeat: 'combat-message-npc', // ID for defeat message
      victory: 'combat-message-player', // ID for victory message
      meditationAction: 'combat-message', // ID for meditation action message
      meditationStart: 'combat-message', // ID for meditation start message
      sleepAction: 'combat-message', // ID for sleep action message
      standingUp: 'combat-message', // ID for standing up message
      wakingUp: 'combat-message', // ID for waking up message
      alreadySitting: 'error-message', // ID for already sitting message
      alreadyStanding: 'error-message', // ID for already standing message
      disconnectionFailedAttempts: 'error-message', // ID for disconnection due to failed attempts
      stats: 'combat-message', // ID for stats message
      invalidItemAddition: 'error-message', // ID for invalid item addition message
      inventoryFull: 'error-message', // ID for inventory full message
      itemNotFoundInInventory: 'error-message', // ID for item not found in inventory message
      leavingLocation: 'combat-message', // ID for leaving location message
      enteringLocation: 'combat-message', // ID for entering location message
      combatActionMessage: 'combat-message', // ID for combat action message
      dataLoadError: 'error-message', // ID for data load error message
      dataSaveError: 'error-message', // ID for data save error message
      generalError: 'error-message', // ID for general error message
      lookAtSelf: 'combat-message', // ID for looking at self message
      lookAtItem: 'combat-message', // ID for looking at item message
      lookAtNpc: 'combat-message', // ID for looking at NPC message
      lookAtOtherPlayer: 'combat-message', // ID for looking at other player message
    };
    return messageIds[type] || ''; // Return message ID or empty string
  }
}
// Message Manager ********************************************************************************
/*
 * The MessageManager class is responsible for sending messages to players.
 * It provides methods to notify players of various events, such as combat, location changes,
 * and actions performed by other players. It also handles the formatting and transmission
 * of these messages to the client.
*/
class MessageManager {
  static socket;
  static setSocket(socketInstance) {
    this.socket = socketInstance; // Set socket instance
  }
  static notify(player, message, cssid = '') {
    try {
      player.server.logger.info(`Message to ${player.getName()}: ${message}`);
      const messageData = FormatMessageManager.createMessageData(cssid, message); // Create message data
      if (this.socket) {
        this.socket.emit('message', { playerId: player.getId(), messageData }); // Emit message
      }
      return messageData; // Return message data
    } catch (error) {
      player.server.logger.error(`ERROR: Notifying player ${player.getName()}:`, error);
      player.server.logger.error(error.stack); // Log stack trace
    }
  }
  static notifyPlayersInLocation(location, message) {
    if (!location || !location.playersInLocation) return;
    location.playersInLocation.forEach(player => this.notify(player, message));
  }
  static notifyAction(player, action, targetName, cssid) {
    return this.notify(player, `${player.getName()} ${action} ${targetName}.`, cssid);
  }
  static notifyLoginSuccess(player) {
    return this.notifyAction(player, 'has logged in successfully!', '', FormatMessageManager.getIdForMessage('loginSuccess'));
  }
  static notifyIncorrectPassword(player) {
    return this.notify(player, `Incorrect password. Please try again.`, FormatMessageManager.getIdForMessage('incorrectPassword'));
  }
  static notifyDisconnectionDueToFailedAttempts(player) {
    return this.notify(player, `${player.getName()} has been disconnected due to too many failed login attempts.`, FormatMessageManager.getIdForMessage('disconnectionFailedAttempts'));
  }
  static notifyPickupItem(player, itemName) {
    return this.notifyAction(player, 'picks up', itemName, FormatMessageManager.getIdForMessage('pickupItem'));
  }
  static notifyDropItem(player, itemName) {
    return this.notifyAction(player, 'drops', itemName, FormatMessageManager.getIdForMessage('dropItem'));
  }
}
//*************************************************************************************************
// Start the server *******************************************************************************
/*
 * The server is initialized and configured here. It sets up the server, logger, and other components.
 * The server is then initialized and starts listening for incoming connections.
*/
const configManager = new ConfigManager();
await configManager.loadConfig(); // Ensure config is loaded
const logger = new Logger(configManager.CONFIG); // Pass the loaded CONFIG to logger
const server = new Server({ logger }); // Initialize server with null moduleImporter
const moduleImporter = new ModuleImporter({ server }); // Pass server instance
server.moduleImporter = moduleImporter; // Assign moduleImporter to server
// Ensure modules are imported before initializing the server
try {
  await server.init(); // Now initialize the server
  const gameComponentInitializer = new GameComponentInitializer({ server });
  await gameComponentInitializer.setupGameComponents();

  // Start listening for incoming connections
  server.server.listen(server.configManager.get('PORT'), server.configManager.get('HOST'), () => {
    const isHttps = server.configManager.get('HTTPS_ENABLED'); // Define isHttps based on your configuration
    server.logger.info(`\n`);
    server.logger.info(`SERVER IS RUNNING AT: ${isHttps ? 'https' : 'http'}://${server.configManager.get('HOST')}:${server.configManager.get('PORT')}`);
  });
} catch (error) {
  logger.error('ERROR: Starting the server:', error);
  logger.error(error.stack); // Log stack trace
}