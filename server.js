import { promises as fs } from 'fs';
import path from 'path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import Queue from 'queue';
import http from 'http';
import https from 'https';
import { exit } from 'process';
import CONFIG from './config.js';
import bcrypt from 'bcrypt';
/**************************************************************************************************
Game Command Manager Class
The GameCommandManager class is responsible for handling game commands from players.
It provides methods to handle different types of game commands, such as movement,
attack, drop, get, show inventory, describe location, loot, meditate, sit, sleep, stand, stop, wake.
It also handles the formatting and transmission of these messages to the client.
***************************************************************************************************/
class GameCommandManager {
  constructor(server, logger) {
    this.server = server;
    this.logger = logger;
    this.commandHandlers = {
      move: new MoveCommandHandler(logger),
      attack: new AttackCommandHandler(logger),
      drop: new DropCommandHandler(logger),
      get: new GetCommandHandler(logger),
      showInventory: new ShowInventoryCommandHandler(logger),
      describeLocation: new DescribeLocationCommandHandler(logger),
      loot: new LootCommandHandler(logger),
      simpleAction: new SimpleActionCommandHandler(logger),
      autoLootToggle: new AutoLootToggleCommandHandler(logger),
      eat: new EatCommandHandler(logger),
    };
  }
  handleCommand(socket, actionType, payload) {
    const handler = this.commandHandlers[actionType] || this.commandHandlers.simpleAction;
    handler.execute(socket, payload);
  }
}
// Example command handler class
class MoveCommandHandler {
  constructor(logger) {
    this.logger = logger;
  }
  execute(socket, payload) {
    const { direction } = payload;
    // Implement move logic
    this.logger.info(`Player ${socket.id} moved ${direction}`);
  }
}
// Similar classes for other commands (AttackCommandHandler, DropCommandHandler, etc.)
/**************************************************************************************************
Logger Interface Class
The ILogger class is an interface that defines the structure for a logging system. It includes
method signatures for various logging levels, such as log, debug, info, warn, and error. However,
it does not provide any implementation for these methods. This allows other classes to implement
the ILogger interface and provide their own logging functionality.
***************************************************************************************************/
class ILogger {
  log() {}
  debug() {}
  info() {}
  warn() {}
  error() {}
}
/**************************************************************************************************
Database Manager Interface Class
The IDatabaseManager class is an interface that defines the structure for a database manager. It
includes method signatures for various database operations, such as loadLocationData, loadNpcData,
loadItemData, saveData, and initialize. However, it does not provide any implementation for these
methods. This allows other classes to implement the IDatabaseManager interface and provide their
own database management functionality.
***************************************************************************************************/
class IDatabaseManager {
  constructor({ server, logger }) {
    this.server = server;
    this.logger = logger;
  }
  async loadLocationData() {}
  async loadNpcData() {}
  async loadItemData() {}
  async saveData() {}
  async initialize() {}
}
class IEventEmitter {
  on() {}
  emit() {}
  off() {}
}
class BaseManager {
  constructor({ server, logger }) {
    this.server = server;
    this.logger = logger;
  }
}
/**************************************************************************************************
Config Manager Class
The ConfigManager class is responsible for loading and providing access to the server's
configuration settings. It reads the configuration from a JSON file and stores the values in an
object. The configuration settings can then be accessed using the get method, passing the key as an argument.
***************************************************************************************************/
class ConfigManager {
  constructor() {
    this.config = null;
  }
  async loadConfig() {
    try {
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
      throw new Error('Configuration Not Loaded. Call loadConfig() first.');
    }
    return this.config[key];
  }
}
/************************************************************************************************
Server Class
The Server class is the main entry point for the server application. It initializes the server and
configures the necessary components. It also sets up the HTTP server and handles player connections.
***************************************************************************************************/
class Server {
  constructor({ logger }) {
    this.eventEmitter = new EventEmitter();
    this.configManager = new ConfigManager();
    this.logger = logger;
    this.databaseManager = null;
    this.socketEventManager = null;
    this.serverConfigurator = null;
    this.activeSessions = new Map();
    this.gameManager = null;
    this.isHttps = false;
    this.app = null;
    this.queueManager = new QueueManager();
    this.locationCoordinateManager = new LocationCoordinateManager(this, []); // Pass an empty array or actual data
  }
  async init() {
    try {
      await this.configManager.loadConfig();
      this.databaseManager = new DatabaseManager({ server: this, logger: this.logger });
      this.socketEventManager = new SocketEventManager({ server: this, logger: this.logger });
      this.serverConfigurator = new ServerConfigurator({
        server: this,
        logger: this.logger,
        socketEventManager: this.socketEventManager,
        config: this.configManager
      });
      await this.serverConfigurator.configureServer();
      this.eventEmitter.on('playerConnected', this.handlePlayerConnected.bind(this));
      this.gameManager = new GameManager({ eventEmitter: this.eventEmitter, logger: this.logger, server: this });
    } catch (error) {
      this.logger.error(`ERROR: Server initialization: ${error.message}`, { error });
      this.logger.error(error.stack);
    }
  }
  handlePlayerConnected(player) {
    this.logger.info(`Player connected: ${player.getName()}`);
  }
  async setupHttpServer() {
    const sslOptions = await this.loadSslOptions();
    this.isHttps = sslOptions.key && sslOptions.cert;
    const httpModule = this.isHttps ? https : http;
    this.server = httpModule.createServer(this.isHttps ? sslOptions : this.app);
    this.logger.info(`- Configuring Server using ${this.isHttps ? 'https' : 'http'}://${this.configManager.get('HOST')}:${this.configManager.get('PORT')}`);
    return this.server;
  }
  async loadSslOptions() {
    const sslOptions = { key: null, cert: null };
    const SSL_CERT_PATH = this.configManager.get('SSL_CERT_PATH');
    const SSL_KEY_PATH = this.configManager.get('SSL_KEY_PATH');
    try {
      sslOptions.cert = await fs.readFile(SSL_CERT_PATH);
      sslOptions.key = await fs.readFile(SSL_KEY_PATH);
    } catch (error) {
      this.logger.warn(`- - WARNING: Read SSL files: ${error.message}`, { error });
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
      this.logger.warn('Game is already running.');
      return;
    }
    try {
      this.gameManager.startGameLoop();
      this.isRunning = true;
      this.logServerRunningMessage();
    } catch (error) {
      this.logger.error(`Error starting game: ${error.message}`);
      this.logger.error(error.stack);
    }
  }
  logServerRunningMessage() {
    const protocol = this.isHttps ? 'https' : 'http';
    const host = this.configManager.get('HOST');
    const port = this.configManager.get('PORT');
    this.logger.debug(``);
    this.logger.info(`SERVER IS RUNNING AT: ${protocol}://${host}:${port}`);
    this.logger.debug(``);
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
class ServerConfigurator extends BaseManager {
  constructor({ config, logger, server, socketEventManager }) {
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
      logger.error(`ERROR: During Express configuration: ${error.message}`, { error });
      logger.error(error.stack);
    }
    logger.info(`- Configuring Server`);
    try {
      await server.setupHttpServer();
    } catch (error) {
      logger.error(`ERROR: During Http Server configuration: ${error.message}`, { error });
      logger.error(error.stack);
    }
    logger.info(`- Configuring Middleware`);
    try {
      this.configureMiddleware();
    } catch (error) {
      logger.error(`ERROR: During Middleware configuration: ${error.message}`, { error });
      logger.error(error.stack);
    }
    logger.log('INFO', '- Configuring Queue Manager');
    try {
      server.queueManager = new QueueManager();
    } catch (error) {
      logger.error(`ERROR: During Queue Manager configuration: ${error.message}`, { error });
      logger.error(error.stack);
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
      this.logger.error(err.stack);
      res.status(500).send('An unexpected error occurred. Please try again later.');
    });
  }
}
/**************************************************************************************************
Event and Communication
The EventEmitter class is an implementation of the IEventEmitter interface. It provides methods for
registering and emitting events. It uses a Map to store listeners for each event type. The on method
is used to register a listener for a specific event, while the emit method is used to trigger the
event and call all registered listeners. The off method is used to remove a listener from an event.
***************************************************************************************************/
class EventEmitter extends IEventEmitter {
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
Socket Event Manager Class
The SocketEventManager class is responsible for managing the socket events. It uses the Socket.IO
library to manage the socket events. The initializeSocketEvents method initializes the socket
events and sets up the event listeners for the socket. The setupSocketListeners method sets up
the event listeners for the socket. The handlePlayerAction method handles the player action.
The handleDisconnect method handles the disconnect event.
***************************************************************************************************/
class SocketEventManager extends BaseManager {
  constructor({ server, logger, gameCommandManager }) {
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
Database Manager Class
The DatabaseManager class extends the IDatabaseManager interface and provides a concrete implementation
for managing data storage and retrieval. It uses the server's configuration to determine the paths for
data files and provides methods to load and save data from these files. The loadData method reads
data from a specified file, parses it, and returns the parsed data. The saveData method writes data
to a specified file, ensuring the data is saved in a structured format. The loadLocationData method
is a specific implementation for loading location data, which is used to initialize the game's locations.
***************************************************************************************************/
class DatabaseManager extends IDatabaseManager {
  constructor({ server, logger }) {
    super({ server, logger });
    this.DATA_PATHS = {
      LOCATIONS: server.configManager.get('LOCATION_DATA_PATH'),
      NPCS: server.configManager.get('NPC_DATA_PATH'),
      ITEMS: server.configManager.get('ITEM_DATA_PATH'),
    };
    this.path = path;
    this.locationCoordinateManager = new LocationCoordinateManager(server, []); // Ensure it's instantiated
  }
  async initialize() {
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
      const data = await Promise.all(files.map(file => fs.readFile(file, 'utf-8').then(data => JSON.parse(data))));
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
      const files = await fs.readdir(directory);
      return files.filter(file => path.extname(file) === '.json').map(file => path.join(directory, file));
    } catch (error) {
      this.logger.error(`ERROR: Reading directory ${directory}: ${error.message}`, { error, directory });
      this.logger.error(error.stack);
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
      this.logger.error(error.stack);
    }
  }
  async loadLocationData() {
    const locationDataPath = this.DATA_PATHS.LOCATIONS;
    if (!locationDataPath) {
      throw new Error('LOCATION_DATA_PATH is not defined in the configuration');
    }
    try {
      const data = await this.loadData(locationDataPath, 'location');
      return this.validateAndParseLocationData(data[0]); // Parse the first item in the array
    } catch (error) {
      this.logger.error(`ERROR: Loading location data: ${error.message}`, { error });
      throw error;
    }
  }
  validateAndParseLocationData(data) {
    // Check if data is an object and not an array
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Location data must be an object');
    }
    const locationData = new Map();
    for (const [id, location] of Object.entries(data)) {
      if (!this.isValidLocation(location)) {
        throw new Error(`Invalid location object: ${JSON.stringify(location)}`);
      }
      locationData.set(id, location);
    }
    return locationData; // Return the Map instead of an array
  }
  isValidLocation(location) {
    return location && typeof location.name === 'string' && typeof location.description === 'string' &&
           typeof location.exits === 'object' && Array.isArray(location.zone);
  }
}
/**************************************************************************************************
Game Management
The GameManager class is responsible for managing the game state and updating the game loop.
It uses the EventEmitter to handle events such as tick and newDay. The gameTick method updates
the game time and triggers world events based on the game time. The moveEntity method updates
the player's location and sends appropriate messages to the clients. The notifyLeavingLocation
and notifyEnteringLocation methods send messages to the clients when a player leaves or enters
a location. The updateNpcs and updatePlayerAffects methods update the state of non-player characters
and player affects, respectively. The updateWorldEvents method triggers world events based on the
game time. The newDayHandler method handles the start of a new day. The disconnectPlayer method
disconnects a player from the game.
***************************************************************************************************/
class GameManager {
  constructor({ eventEmitter, logger, server }) {
    this.players = new Map();
    this.locations = new Map(); // Ensure this is a Map
    this.npcs = new Map();
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.server = server;
    this.gameLoopInterval = null;
    this.gameTime = 0;
    this.isRunning = false;
    this.tickRate = server.configManager.get('TICK_RATE');
    this.lastTickTime = Date.now();
    this.tickCount = 0;
    this.items = new Set(); // Initialize items as a Set
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.eventEmitter.on("tick", this.gameTick.bind(this));
    this.eventEmitter.on("newDay", this.newDayHandler.bind(this));
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
      this.logServerRunningMessage();
    } catch (error) {
      this.logger.error(`Error starting game: ${error.message}`);
      this.logger.error(error.stack);
    }
  }
  logServerRunningMessage() {
    const { isHttps, configManager } = this.server;
    const protocol = isHttps ? 'https' : 'http';
    const host = configManager.get('HOST');
    const port = configManager.get('PORT');
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
    try {
      await this.server.socketEventManager.server.io.close();
      this.logger.info('All socket connections closed.');
      exit(0);
    } catch (error) {
      this.logger.error(`ERROR: Shutting down server: ${error.message}`, { error });
    }
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
      this.eventEmitter.emit("newDay");
    }
  }
  moveEntity(entity, newLocationId) {
    const oldLocationId = entity.currentLocation;
    const oldLocation = this.getLocation(oldLocationId);
    const newLocation = this.getLocation(newLocationId);
    if (oldLocation) {
      this.notifyLeavingLocation(entity, oldLocationId, newLocationId);
    }
    entity.currentLocation = newLocationId;
    if (newLocation) {
      this.notifyEnteringLocation(entity, oldLocationId, newLocationId);
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
      this.logger.warn(`Cannot notify entering location: ${newLocationId} not found.`);
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
    const WORLD_EVENT_INTERVAL = this.server.configManager.get('WORLD_EVENT_INTERVAL');
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
      this.logger.info(`Player ${uid} has been disconnected.`);
    } else {
      this.logger.warn(`Player ${uid} not found for disconnection.`);
    }
  }
  createNpc(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, type, quest = null, zones = [], aliases) {
    let npc;
    switch (type) {
      case 'mobile':
        npc = new MobileNpc(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, zones, aliases);
        break;
      case 'quest':
        npc = new QuestNpc(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, quest, zones, aliases);
        break;
      default:
        npc = new Npc(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases);
    }
    this.npcs.set(npc.id, npc);
    return npc;
  }
  getNpc(npcId) {
    return this.npcs.get(npcId);
  }
  getLocation(locationId) {
    return this.locations.get(locationId) || null; // Updated to get from Map
  }
  handlePlayerAction(action) {
    const task = new TaskManager('PlayerAction', () => {
      // Logic for handling player action
      this.logger.info(`Handling action: ${action}`);
    });
    this.server.addTask(task);
  }
  cleanup() {
    this.npcs.clear();
  }
}
/**************************************************************************************************
Game Component Initializer
The GameComponentInitializer class extends the BaseManager class and provides a concrete implementation
for initializing the game components. It uses the server and logger instances to initialize the
database manager, game manager, and game data loader. The setupGameComponents method initializes
the game components in the correct order. The initializeDatabaseManager method initializes the
database manager. The initializeGameManager method initializes the game manager. The initializeGameDataLoader method initializes the game data loader. The handleSetupError method handles any errors that occur during the setup process.
***************************************************************************************************/
class GameComponentInitializer extends BaseManager {
  constructor({ server, logger }) {
    super({ server, logger });
  }
  async setupGameComponents() {
    try {
      await this.initializeDatabaseManager();
      await this.initializeGameManager();
      await this.initializeLocationCoordinateManager(); // Add this line

      await this.initializeGameDataLoader();
    } catch (error) {
      this.handleSetupError(error);
    }
  }
  async initializeDatabaseManager() {
    this.server.databaseManager = new DatabaseManager({
      server: this.server,
      logger: this.server.logger
    });
    await this.server.databaseManager.initialize();
  }
  async initializeGameManager() {
    this.server.gameManager = new GameManager({
      eventEmitter: this.server.eventEmitter,
      logger: this.server.logger,
      server: this.server
    });
  }
  async initializeLocationCoordinateManager() {
    this.server.locationCoordinateManager = new LocationCoordinateManager(this.server, []); // Ensure it's initialized
  }
  async initializeGameDataLoader() {
    this.server.gameDataLoader = new GameDataLoader(this.server);
    await this.server.gameDataLoader.fetchGameData();
  }
  handleSetupError(error) {
    this.server.logger.error('ERROR: Loading game data:', error);
    this.server.logger.error(error.stack);
  }
}
/**************************************************************************************************
Game Data Loader
The GameDataLoader class is responsible for loading the game data from the database. It uses the
database manager to load the data and the location coordinate manager to assign coordinates to
the locations. The fetchGameData method fetches the game data from the database and returns it.
The saveLocationData method saves the location data to the database.
***************************************************************************************************/
class GameDataLoader {
  constructor(server) {
    this.server = server;
    this.locationManager = new LocationCoordinateManager(this.server, []); // Pass an empty array or actual data
  }
  async fetchGameData() {
    const { logger, databaseManager } = this.server;
    const DATA_TYPES = { LOCATION: 'Location', NPC: 'Npc', ITEM: 'Item' };
    const loadData = async (loadFunction, type) => {
        try {
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
          if (locationData instanceof Map) {
            await this.locationManager.assignCoordinates(locationData); // Pass the Map directly
          } else {
            logger.error(`Invalid location data format: ${JSON.stringify(locationData)}`);
            throw new Error(`Invalid location data format.`);
          }
        }
        logger.info(`LOADING GAME DATA FINISHED.`);
        return successfulResults;
    } catch (error) {
        logger.error(`ERROR: Fetching Game Data: ${error.message}`, { error });
        logger.error(error.stack);
    }
  }
  async saveLocationData(filenames) {
    try {
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
/**************************************************************************************************
Location Coordinate Manager
The LocationCoordinateManager class is responsible for managing the coordinates of the locations.
It uses the server and logger instances to manage the locations. The assignCoordinates method
assigns coordinates to the locations. The logLocationLoadStatus method logs the status of the
location load. The initializeCoordinates method initializes the coordinates. The
logCoordinateAssignmentStatus method logs the status of the coordinate assignment. The
_assignCoordinatesRecursively method assigns coordinates to the locations recursively. The
_updateLocationsWithCoordinates method updates the locations with the coordinates.
***************************************************************************************************/
class LocationCoordinateManager {
  constructor(server, locationData) {
    this.server = server;
    this.logger = server.logger;
    this.locations = new Map(); // Changed to Map for better performance
    this.parsedData = locationData instanceof Map ? locationData : new Map(); // Ensure it's a Map
  }
  async assignCoordinates(locationData) {
    // Ensure locationData is a Map
    if (!(locationData instanceof Map)) {
      this.logger.error(`Invalid location data format. Expected a Map.`);
      throw new Error(`Invalid location data format.`);
    }
    this.locations = locationData; // Directly assign the Map
    this.logger.debug(``);
    this.logger.debug(`- Loaded ${this.locations.size} Locations`);
    this.logger.debug(``);
    this.logger.debug(`- Locations Map Contents:`);
    this.logger.debug(``);
    this.logger.debug(`${JSON.stringify(Array.from(this.locations.entries()))}`);
    this.logLocationLoadStatus();
    const coordinates = this.initializeCoordinates();
    this._assignCoordinatesRecursively("100", coordinates);
    this.logCoordinateAssignmentStatus(coordinates);
    this._updateLocationsWithCoordinates(coordinates);
  }
  logLocationLoadStatus() {
    this.logger.debug(``);
    this.logger.debug(`- Assign Coordinates:`);
    this.logger.debug(``);
  }
  initializeCoordinates() {
    const coordinates = new Map([["100", { x: 0, y: 0, z: 0 }]]);
    return coordinates;
  }
  logCoordinateAssignmentStatus(coordinates) {
    this.logger.debug(``);
    this.logger.debug(`- After recursive assignment:`);
    this.logger.debug(``);
    this.logger.debug(`${JSON.stringify(Array.from(coordinates.entries()))}`);
  }
  _assignCoordinatesRecursively(locationId, coordinates, x = 0, y = 0, z = 0) {
    this.logger.debug(`- Assigning coordinates for location ${locationId} at (${x}, ${y}, ${z})`);
    const location = this.locations.get(locationId);
    if (!location) {
      this.logger.warn(`Location ${locationId} not found in locations Map`);
      return;
    }
    location.coordinates = { x, y, z };
    // Check if exits exist before iterating
    if (!location.exits) {
      this.logger.warn(`No exits found for location ${locationId}`);
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
        this.logger.debug(`- Assigning new coordinates for exit ${exitId} in direction ${direction}`);
        coordinates.set(exitId, { x: newX, y: newY, z: newZ });
        this._assignCoordinatesRecursively(exitId, coordinates, newX, newY, newZ);
      } else {
        this.logger.debug(`- Coordinates already assigned for exit ${exitId}`);
      }
    }
  }
  _updateLocationsWithCoordinates(coordinates) {
    this.logger.debug(``);
    this.logger.debug('- Updating locations with coordinates:');
    for (const [id, coord] of coordinates) {
      const location = this.locations.get(id);
      if (location) {
        location.coordinates = coord;
        this.logger.debug(`- Location ${id} (${location.name}) coordinates: x=${coord.x}, y=${coord.y}, z=${coord.z}`);
      } else {
        this.logger.warn(`Location ${id} not found in this.locations`);
      }
    }
    this.logger.debug(``)
    this.logger.debug(`- Total locations updated: ${coordinates.size}`);
    this.logger.debug(``)
    this.logger.debug('- Coordinate assignment finished');
    this.logger.debug(``)
  }
}
/**************************************************************************************************
Task Manager Class
The TaskManager class is responsible for managing the tasks.
***************************************************************************************************/
class TaskManager {
  constructor(name, execute) {
    this.name = name;
    this.execute = execute;
    this.status = 'pending'; // Track task status
  }
  async run() {
    this.status = 'running';
    try {
      await this.execute();
      this.status = 'completed';
    } catch (error) {
      this.status = 'failed';
      throw error; // Propagate error for handling in QueueManager
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
Queue Manager Class
QueueManager class is responsible for managing the queue. The processQueue method processes the
queue. The cleanup method cleans up the queue.
***************************************************************************************************/
class QueueManager {
  constructor() {
    this.queue = [];
    this.runningTasks = new Set();
    this.maxConcurrentTasks = 5; // Set a limit for concurrent tasks
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
        task.onComplete(); // Call the completion callback
      } catch (error) {
        task.onError(error); // Handle errors
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
Logger Class
The Logger class is responsible for logging the messages. The log method logs the messages. The
shouldLog method checks if the message should be logged. The writeToConsole method writes the
message to the console. The debug method logs the debug messages. The info method logs the info
messages. The warn method logs the warn messages. The error method logs the error messages.
***************************************************************************************************/
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
    // @todo: Implementing log rotation
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
/**************************************************************************************************
Server Initializer Class
The ServerInitializer class is responsible for initializing the server.
***************************************************************************************************/
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
      this.logger.error(error.stack);
    }
  }
}
/**************************************************************************************************
Create New Player Class
The CreateNewPlayer class is responsible for creating new player instances from existing player
data, providing methods to initialize player attributes and state.
***************************************************************************************************/
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
/**************************************************************************************************
Entity Class
The Entity class is a base class for all entities in the game.
It contains shared properties and methods for characters and players.
***************************************************************************************************/
class Entity {
  constructor() {
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
Base Item Class
The BaseItem class is a base class for all items in the game.
It contains shared properties and methods for all items.
***************************************************************************************************/
class BaseItem {
  constructor(name, description, aliases) {
    this.name = name;
    this.description = description;
    this.aliases = aliases;
  }
}
/**************************************************************************************************
Item Class
The Item class is a base class for all items in the game.
It contains shared properties and methods for all items.
***************************************************************************************************/
class Item extends BaseItem {
  constructor(template, uniqueId) {
    super(template.name, template.description, template.aliases);
    this.id = uniqueId; // Unique ID for the item instance
    this.type = template.type; // Set the type from the template
  }
}
/**************************************************************************************************
Container Item Class
The ContainerItem class is a base class for all container items in the game.
It contains shared properties and methods for all container items.
***************************************************************************************************/
class ContainerItem extends BaseItem {
  constructor(name, description, aliases) {
    super(name, description, aliases);
    this.inventory = []; // Only ContainerItem has an inventory
  }
}
/**************************************************************************************************
Weapon Item Class
The WeaponItem class is a base class for all weapon items in the game.
It contains shared properties and methods for all weapon items.
***************************************************************************************************/
class WeaponItem extends BaseItem {
  constructor(name, description, aliases, damage = 0) {
    super(name, description, aliases);
    this.damage = damage;
  }
}
/**************************************************************************************************
Character Class
The Character class represents a character in the game.
It extends the Entity class.
***************************************************************************************************/
class Character extends Entity {
  constructor(name, health) { super(name, health); } // Call the parent constructor
}
/**************************************************************************************************
Player Class
The Player class represents a player in the game.
It extends the Character class.
***************************************************************************************************/
class Player extends Character {
  constructor(uid, name, bcrypt, gameCommandManager) {
    super(name, 100);
    this.uid = uid;
    this.bcrypt = bcrypt;
    this.inventory = new Set();
    this.healthRegenerator = new HealthRegenerator(this);
    this.gameCommandManager = gameCommandManager;
    this.initializePlayerAttributes();
  }
  initializePlayerAttributes() {
    const INITIAL_HEALTH = 100;
    const INITIAL_ATTACK_POWER = 10;
    // Use object literal for initialization
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
      inventoryManager: new InventoryManager(this),
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
    const INVENTORY_CAPACITY = this.server.config.INVENTORY_CAPACITY;
    return this.inventory.size < INVENTORY_CAPACITY && item.isValid();
  }
  getInventoryCapacity() {
    return this.server.config.INVENTORY_CAPACITY;
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
      MessageManager.notifyDisconnectionDueToFailedAttempts(this);
      this.server.gameManager.disconnectPlayer(this.uid);
    }
  }
  showInventory() {
    const inventoryList = this.getInventoryList();
    this.notifyPlayer(inventoryList);
  }
  lootSpecifiedNpc(target) {
    const location = this.server.gameManager.getLocation(this.currentLocation);
    if (!location) return;
    const targetLower = target.toLowerCase();
    const targetEntity = location.entities.find(entity => entity.name.toLowerCase() === targetLower);
    if (targetEntity) {
      this.notifyPlayer(`You loot ${targetEntity.name}.`);
      return;
    }
    this.notifyPlayer(`Target ${target} not found in location.`);
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
        MessageManager.notify(this, `You moved to ${newLocation.getName()}.`);
      }
    } catch (error) {
      this.server.logger.error(`ERROR: Moving to location: ${error.message}`, { error });
      this.server.logger.error(error.stack);
    }
  }
  notifyPlayer(message) {
    MessageManager.notify(this, message);
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
    // Use object destructuring for cleaner property access
    const { name, age, health, experience, level } = this;
    return { name, age, health, experience, level };
  }
  static async loadBatch(playerIds) {
    const playerDataArray = await DatabaseManager.loadPlayersData(playerIds);
    return playerDataArray.map(data => new Player(data.uid, data.name, data.bcrypt));
  }
  score() {
    const stats = `Level: ${this.level}, XP: ${this.experience}, Health: ${this.health}/${this.maxHealth}`;
    MessageManager.notifyStats(this, stats);
  }
  updateData(updatedData) {
    // Use object destructuring and optional chaining for cleaner code
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
      MessageManager.notifyLoginSuccess(this);
      return true;
    }
    MessageManager.notifyIncorrectPassword(this);
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
      MessageManager.notifyMeditationAction(this);
      return;
    }
    this.status = "meditating";
    MessageManager.notifyMeditationStart(this);
  }
  sleep() {
    this.startHealthRegeneration();
    this.status = "sleeping";
    MessageManager.notifySleepAction(this);
  }
  sit() {
    if (this.status === "sitting") {
      MessageManager.notifyAlreadySitting(this);
      return;
    }
    if (this.status === "standing") {
      this.startHealthRegeneration();
      this.status = "sitting";
      MessageManager.notifySittingDown(this);
      return;
    }
    MessageManager.notifyStoppingMeditation(this);
  }
  stand() {
    if (this.status === "lying unconscious") {
      this.status = "standing";
      MessageManager.notifyStandingUp(this);
    } else {
      MessageManager.notifyAlreadyStanding(this);
    }
  }
  wake() {
    if (this.status === "lying unconscious") {
      this.status = "standing";
      MessageManager.notifyStandingUp(this);
      return;
    }
    if (this.status === "sleeping") {
      this.status = "standing";
      MessageManager.notifyWakingUp(this);
      return;
    }
    MessageManager.notifyAlreadyAwake(this);
  }
  autoLootToggle() {
    this.autoLoot = !this.autoLoot;
    MessageManager.notifyAutoLootToggle(this, this.autoLoot);
  }
  lookIn(containerName) {
    const { gameManager, items } = this.server;
    const location = gameManager.getLocation(this.currentLocation);
    if (!location) return;
    const containerId = this.getContainerId(containerName) || this.findEntity(containerName, location.items, 'item');
    if (!containerId) {
      MessageManager.notifyNoContainerHere(this, containerName);
      return;
    }
    const container = items[containerId];
    if (container instanceof ContainerItem) {
      const itemsInContainer = container.inventory.map(itemId => items[itemId].name);
      MessageManager.notifyLookInContainer(this, container.name, itemsInContainer);
    } else {
      MessageManager.notifyNotAContainer(this, container.name);
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
  lookAt(target) {
    new LookAt(this).look(target);
  }
  addWeapon(weapon) {
    if (weapon instanceof WeaponItem) {
      this.weapons.add(weapon);
      MessageManager.notifyPickupItem(this, weapon.name);
    }
  }
  removeWeapon(weapon) {
    this.weapons.delete(weapon);
  }
  static async createNewPlayer(name, age) {
    return new CreateNewPlayer(name, age);
  }
  performAction(actionType, payload) {
    this.gameCommandManager.handleCommand(this.socket, actionType, payload);
  }
}
/**************************************************************************************************
Health Regenerator Class
The HealthRegenerator class is responsible for regenerating the player's health over time.
It uses a setInterval to call the regenerate method at regular intervals.
***************************************************************************************************/
class HealthRegenerator {
  constructor(player) {
    this.player = player;
    this.config = null;
    this.regenInterval = null;
  }
  start() {
    if (!this.regenInterval) {
      const REGEN_INTERVAL = this.config.get('REGEN_INTERVAL');
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
      ["in combat", this.config.get('REGEN_RATES').IN_COMBAT],
      ["standing", this.config.get('REGEN_RATES').STANDING],
      ["sitting", this.config.get('REGEN_RATES').SITTING],
      ["sleeping", this.config.get('REGEN_RATES').SLEEPING],
      ["unconscious", this.config.get('REGEN_RATES').UNCONSCIOUS],
      ["meditating", this.config.get('REGEN_RATES').MEDITATING]
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
Look At Class
The LookAt class is responsible for handling the player's "look" command.
It retrieves the target entity from the current location and formats the appropriate message.
***************************************************************************************************/
class LookAt {
  constructor(player) {
    this.player = player;
  }
  look(target) {
    const { currentLocation, player } = this;
    const location = this.server.gameManager.getLocation(currentLocation);
    if (!location) return;
    const targetLower = target.toLowerCase();
    const playerNameLower = player.getName().toLowerCase();
    if (this.isSelfLook(targetLower, playerNameLower)) {
      this.lookAtSelf();
      return;
    }
    const lookTargets = [
      { check: () => player.inventory.find(item => item.aliases.includes(targetLower)), notify: MessageManager.notifyLookAtItemInInventory },
      { check: () => location.items.find(item => item.aliases.includes(targetLower)), notify: MessageManager.notifyLookAtItemInLocation },
      { check: () => this.findNpc(location, targetLower), notify: MessageManager.notifyLookAtNpc },
      { check: () => location.playersInLocation.find(p => p.name.toLowerCase() === targetLower), notify: MessageManager.notifyLookAtOtherPlayer }
    ];
    for (const { check, notify } of lookTargets) {
      const result = check();
      if (result) {
        notify(player, result);
        return;
      }
    }
    MessageManager.notifyTargetNotFoundInLocation(player, target);
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
  lookAtSelf() {
    MessageManager.notifyLookAtSelf(this.player);
  }
}
/**************************************************************************************************
Uid Generator Class
The UidGenerator class is responsible for generating unique IDs for entities in the game.
It uses bcrypt to generate a unique value and return the hashed UID.
***************************************************************************************************/
class UidGenerator {
  static async generateUid() {
    const { hash } = await import('bcrypt');
    const uniqueValue = Date.now() + Math.random();
    return hash(uniqueValue.toString(), 5);
  }
}
/**************************************************************************************************
Direction Manager Class
The DirectionManager class is responsible for partially generating Player and NPC movement
message content based on directions. It provides methods to get the direction to a new location
and the direction from an old location.
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
Location Class
The Location class is intended to be used with OLC (online creation system).
***************************************************************************************************/
class Location {
  constructor(name, description) {
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
NPC Class
The Npc class is responsible for representing non-player characters in the game.
It extends the Character class.
***************************************************************************************************/
class Npc extends Character {
  constructor(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, aliases) {
    super(name, currHealth);
    this.sex = sex;
    this.maxHealth = maxHealth;
    this.attackPower = attackPower;
    this.csml = csml;
    this.aggro = aggro;
    this.assist = assist;
    this.status = status;
    this.currentLocation = currentLocation;
    this.aliases = aliases;
    this.id = UidGenerator.generateUid();
    this.currHealth = currHealth;
    this.previousState = { currHealth, status };
  }
  hasChangedState() {
    const hasChanged = this.currHealth !== this.previousState.currHealth || this.status !== this.previousState.status;
    if (hasChanged) {
      this.previousState = { currHealth: this.currHealth, status: this.status };
    }
    return hasChanged;
  }
}
class MobileNpc extends Npc {
  constructor(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, zones = [], aliases) {
    super(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, zones, aliases);
    this.zones = zones;
    this.startMovement();
  }
  startMovement() {
    setInterval(() => {
      if (this.canMove()) {
        this.moveRandomly();
      }
    }, this.CONFIG.NPC_MOVEMENT_INTERVAL);
  }
  canMove() {
    return this.status !== "engaged in combat" && this.status !== "lying dead" && this.status !== "lying unconscious";
  }
  moveRandomly() {
    const { gameManager } = this.server;
    const location = gameManager.getLocation(this.currentLocation);
    const validDirections = Object.keys(location.exits).filter(direction =>
      this.zones.includes(location.zone[0]) ? direction : null
    );
    if (validDirections.length > 0) {
      const randomDirection = validDirections[Math.floor(Math.random() * validDirections.length)];
      const newLocationId = location.exits[randomDirection];
      MessageManager.notifyNpcDeparture(this, DirectionManager.getDirectionTo(newLocationId));
      this.currentLocation = newLocationId;
      const direction = DirectionManager.getDirectionFrom(this.currentLocation);
      MessageManager.notifyNpcArrival(this, direction);
    }
  }
}
class QuestNpc extends Npc {
  constructor(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, quest, zones = [], aliases) {
    super(name, sex, currHealth, maxHealth, attackPower, csml, aggro, assist, status, currentLocation, zones, aliases);
    this.quest = quest; // Store quest information
  }
  provideQuest() {
    // Logic to provide the quest to the player
    MessageManager.notify(this, `You have received a quest: ${this.quest.title}`);
  }
  completeQuest(player) {
    // Logic to complete the quest
    if (this.quest.isCompleted(player)) {
      MessageManager.notify(player, `You have completed the quest: ${this.quest.title}`);
      // Additional logic for rewards
    } else {
      MessageManager.notify(player, `You have not completed the quest: ${this.quest.title}`);
    }
  }
}
/**************************************************************************************************
Inventory Manager Class
The InventoryManager class is responsible for managing the player's inventory.
It provides methods to add, remove, and transfer items between the player's inventory and other
sources.
***************************************************************************************************/
class InventoryManager {
  constructor(player) {
    this.player = player;
    this.messageManager = new MessageManager();
    this.itemTypeMap = new Map();
  }
  // Create an item instance from a template
  async createItemFromTemplate(templateName) {
    const template = itemTemplates[templateName]; // Assuming itemTemplates is accessible
    const uniqueId = await UidGenerator.generateUid(); // Generate a unique ID
    return new Item(template, uniqueId); // Create a new item instance
  }
  addToInventory(item) {
    try {
      if (item instanceof Item) {
        this.player.inventory.add(item);
        this.messageManager.notifyPickupItem(this.player, item.name);
        if (item instanceof WeaponItem) {
          this.player.weapons.add(item);
        }
      }
    } catch (error) {
      this.messageManager.notifyError(this.player, `ERROR: Adding item to inventory: ${error.message}`);
      this.player.server.logger.error(error.stack);
    }
  }
  removeFromInventory(item) {
    this.player.inventory.delete(item);
    if (item instanceof WeaponItem) {
      this.player.weapons.delete(item);
    }
  }
  getAllItemsFromSource(source, sourceType, containerName) {
    if (!source || source.size === 0) {
      this.messageManager.notifyNoItemsHere(this.player);
      return;
    }
    const itemsTaken = Array.from(source).map(itemId => this.player.server.items[itemId]);
    itemsTaken.forEach(item => this.player.inventory.add(item));
    if (sourceType === 'location') {
      this.player.server.location[this.player.currentLocation].items.clear();
    } else {
      this.player.server.items[containerName].inventory.clear();
    }
    this.messageManager.notifyItemsTaken(this.player, itemsTaken);
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
      this.messageManager.notifyNoItemInContainer(this.player, itemName, container.name);
    }
  }
  getSingleItemFromLocation(target) {
    const currentLocation = this.player.server.location[this.player.currentLocation];
    const itemId = this.getItemIdFromLocation(target, currentLocation.items);
    if (itemId) {
      this.transferItem(itemId, currentLocation, 'location');
    } else {
      this.messageManager.notifyNoItemHere(this.player, target);
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
    this.messageManager.notifyItemPutInContainer(this.player, item.name, container.name);
  }
  putAllItems(containerName) {
    const container = this.getContainer(containerName);
    if (!container) return;
    const itemsToPut = new Set(Array.from(this.player.inventory).filter(item => item !== container));
    if (itemsToPut.size === 0) {
      this.messageManager.notifyNoItemsToPut(this.player, container.name);
      return;
    }
    itemsToPut.forEach(item => {
      container.inventory.add(item.uid);
      this.player.inventory.delete(item);
    });
    this.messageManager.notifyItemsPutInContainer(this.player, Array.from(itemsToPut), container.name);
  }
  putAllSpecificItemsIntoContainer(itemType, containerName) {
    const container = this.getContainer(containerName);
    if (!container) return;
    const itemsToPut = new Set(Array.from(this.player.inventory).filter(item => item !== container && this.itemMatchesType(item, itemType)));
    if (itemsToPut.size === 0) {
      this.messageManager.notifyNoSpecificItemsToPut(this.player, itemType, container.name);
      return;
    }
    itemsToPut.forEach(item => {
      container.inventory.add(item.uid);
      this.player.inventory.delete(item);
    });
    this.messageManager.notifyItemsPutInContainer(this.player, Array.from(itemsToPut), container.name);
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
        this.messageManager.notifyItemsTaken(this.player, Array.from(itemsTaken));
      } else {
        this.messageManager.notifyNoSpecificItemsHere(this.player, itemType);
      }
    } else {
      this.messageManager.notifyNoItemsHere(this.player);
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
      this.messageManager.notifyItemsTakenFromContainer(this.player, Array.from(itemsTaken), container.name);
    } else {
      this.messageManager.notifyNoSpecificItemsInContainer(this.player, itemType, container.name);
    }
  }
  autoLootNPC(npc) {
    if (npc.inventory && npc.inventory.size > 0) {
      const lootedItems = new Set(npc.inventory);
      lootedItems.forEach(itemId => this.player.inventory.add(this.player.server.items[itemId]));
      npc.inventory.clear();
      return this.messageManager.createAutoLootMessage(this.player, npc, Array.from(lootedItems));
    }
    return null;
  }
  lootNPC(target) {
    const npcId = this.getNpcIdFromLocation(target, this.player.server.location[this.player.currentLocation].npcs);
    if (npcId) {
      const npc = this.player.server.npcs[npcId];
      if (npc.status === "lying unconscious" || npc.status === "lying dead") {
        if (npc.inventory && npc.inventory.size > 0) {
          const lootedItems = new Set(npc.inventory);
          lootedItems.forEach(itemId => this.player.inventory.add(this.player.server.items[itemId]));
          npc.inventory.clear();
          this.messageManager.notifyLootedNPC(this.player, npc, Array.from(lootedItems));
        } else {
          this.messageManager.notifyNothingToLoot(this.player, npc);
        }
      } else {
        this.messageManager.notifyCannotLootNPC(this.player, npc);
      }
    } else {
      this.messageManager.notifyNoNPCToLoot(this.player, target);
    }
  }
  lootAllNPCs() {
    const currentLocation = this.player.server.location[this.player.currentLocation];
    if (!currentLocation.npcs || currentLocation.npcs.size === 0) {
      this.messageManager.notifyNoNPCsToLoot(this.player);
      return;
    }
    const lootedItems = new Set();
    const lootedNPCs = new Set();
    currentLocation.npcs.forEach(npcId => {
      const npc = this.player.server.npcs[npcId];
      if ((npc.status === "lying unconscious" || npc.status === "lying dead") && npc.inventory && npc.inventory.size > 0) {
        npc.inventory.forEach(itemId => {
          lootedItems.add(itemId);
          this.player.inventory.add(this.player.server.items[itemId]);
        });
        lootedNPCs.add(npc.name);
        npc.inventory.clear();
      }
    });
    if (lootedItems.size > 0) {
      this.messageManager.notifyLootedAllNPCs(this.player, Array.from(lootedNPCs), Array.from(lootedItems));
    } else {
      this.messageManager.notifyNothingToLootFromNPCs(this.player);
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
      this.messageManager.notifyNoContainer(this.player, containerName);
      return null;
    }
    return container;
  }
  getItemFromInventory(itemName) {
    const item = Array.from(this.player.inventory).find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!item) {
      this.messageManager.notifyItemNotInInventory(this.player, itemName);
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
    if (!this.itemTypeMap.has(item.uid)) {
      this.itemTypeMap.set(item.uid, item.type);
    }
    return this.itemTypeMap.get(item.uid) === itemType;
  }
}
/**************************************************************************************************
 * Combat Action Class
 * The CombatAction class is responsible for performing combat actions between two entities.
 * It calculates the damage inflicted, updates the defender's health, and handles the defeat of the defender.
***************************************************************************************************/
class CombatAction {
  constructor(logger) {
    this.logger = logger;
  }
  perform(attacker, defender) {
    try {
      const damage = this.calculateDamage(attacker, defender);
      defender.health = Math.max(0, defender.health - damage);
      this.notifyCombatResult(attacker, defender, damage);
      if (defender.health <= 0) {
        this.handleDefeat(defender);
      }
    } catch (error) {
      this.logger.error(`ERROR: During combat action: ${error.message}`, { error, stack: error.stack });
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
Combat Manager Class
The CombatManager class is responsible for managing combat between players and NPCs.
It handles the initiation, execution, and end of combat, as well as the selection of combat
techniques.
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
  constructor(server) {
    this.server = server;
    this.logger = server.logger;
    this.objectPool = new ObjectPool(() => new CombatAction(this.logger), 10);
    this.gameManager = server.gameManager;
    this.combatOrder = new Map();
    this.defeatedNpcs = new Set();
    this.combatInitiatedNpcs = new Set();
    this.outcomeDescriptions = new Map([
      ["attack is evaded", (attacker, defender, technique) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} evades the strike!`],
      ["attack is trapped", (attacker, defender, technique) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} traps the strike!`],
      ["attack is parried", (attacker, defender, technique) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} parries the strike!`],
      ["attack is blocked", (attacker, defender, technique) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} blocks the strike!`],
      ["attack hits", (attacker, defender, technique) => `${attacker.getName()} attacks ${defender.getName()} with a ${technique}. The strike successfully hits ${defender.getName()}!`],
      ["critical success", (attacker, defender, technique) => `${attacker.getName()} attacks ${defender.getName()} with a devastatingly catastrophic ${technique}.<br>The strike critically hits ${defender.getName()}!`],
      ["knockout", (attacker, defender, technique) => `${attacker.getName()} strikes ${defender.getName()} with a spectacularly phenomenal blow!<br>${defender.getName()}'s body goes limp and collapses to the ground!`],
    ]);
  }
  initiateCombatWithNpc(npcId, player, playerInitiated = false) {
    try {
      this.logger.debug(`Initiating combat with NPC ${npcId} for player ${player.getName()}`);
      this.startCombat(npcId, player, playerInitiated);
    } catch (error) {
      this.logger.error(`ERROR: Initiating combat with NPC ${npcId} for player ${player.getName()}:`, error, error.stack);
    }
  }
  endCombatForPlayer(player) {
    this.endCombat(player);
  }
  startCombat(npcId, player, playerInitiated) {
    try {
      this.logger.debug(`Starting combat between player ${player.getName()} and NPC ${npcId}`);
      const npc = this.gameManager.getNpc(npcId);
      if (!npc || this.combatOrder.has(npcId)) {
        this.logger.warn(`NPC ${npcId} not found or already in combat`);
        return;
      }
      this.combatOrder.set(npcId, { state: 'engaged' });
      player.status !== "in combat"
        ? this.initiateCombat(player, npc, playerInitiated)
        : this.notifyCombatJoin(npc, player);
      npc.status = "engaged in combat";
    } catch (error) {
      this.logger.error(`ERROR: Starting combat between player ${player.getName()} and NPC ${npcId}:`, error, error.stack);
    }
  }
  initiateCombat(player, npc, playerInitiated) {
    player.status = "in combat";
    const message = playerInitiated
      ? MessageManager.notifyCombatInitiation(player, npc.getName())
      : MessageManager.notifyCombatInitiation(npc, player.getName());
    this.notifyPlayersInLocation(player.currentLocation, message.content);
    if (!playerInitiated) {
      player.lastAttacker = npc.id;
      this.combatInitiatedNpcs.add(npc.id);
    }
    this.startCombatLoop(player);
  }
  notifyCombatJoin(npc, player) {
    this.notifyPlayersInLocation(player.currentLocation, {
      type: "combat",
      content: MessageManager.notifyCombatJoin(npc.getName()).content
    });
    this.combatInitiatedNpcs.add(npc.id);
  }
  startCombatLoop(player) {
    if (player.status === "in combat" && !player.combatInterval) {
      player.combatInterval = setInterval(() => this.executeCombatRound(player), CombatManager.COMBAT_INTERVAL);
    }
  }
  executeCombatRound(player) {
    try {
      this.logger.debug(`Executing combat round for player ${player.getName()}`);
      if (player.status !== "in combat") {
        this.endCombat(player);
        return;
      }
      const npc = this.getNextNpcInCombatOrder();
      if (npc) {
        const action = this.objectPool.acquire();
        action.perform(player, npc);
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
    } catch (error) {
      this.logger.error(`ERROR: Executing combat round for player ${player.getName()}:`, error, error.stack);
    }
  }
  handlePlayerDefeat(defeatingNpc, player) {
    player.status = "lying unconscious";
    this.endCombat(player);
    this.logger.info(`${player.getName()} has been defeated by ${defeatingNpc.getName()}.`, { playerId: player.getId(), npcId: defeatingNpc.id });
  }
  handleNpcDefeat(npc, player) {
    npc.status = player.killer ? "lying dead" : "lying unconscious";
    player.status = "standing";
    player.experience += npc.experienceReward;
    const messages = this.generateDefeatMessages(player, npc);
    this.notifyPlayersInLocation(this.gameManager.getLocation(player.currentLocation), { type: "combat", content: messages });
  }
  generateDefeatMessages(player, npc) {
    const messages = [MessageManager.notifyVictory(player, npc.getName()).content];
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
            this.startCombat(npcId, player, false);
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
      ((a, d, t) => `${a.getName()} attacks ${d.getName()} with a ${t}.`);
    return FormatMessageManager.createMessageData(descriptionFunc(attacker, defender, technique));
  }
  attackNpc(player, target1) {
    const location = player.server.gameManager.getLocation(player.currentLocation);
    if (!location) return;
    const npcId = target1 ? this.getNpcIdFromLocation(target1, location.npcs) : this.getAvailableNpcId(location.npcs);
    if (!npcId) {
      if (target1) {
        MessageManager.notifyTargetNotFound(player, target1);
      } else {
        MessageManager.notifyNoConsciousEnemies(player);
      }
      return;
    }
    const npc = player.server.gameManager.getNpc(npcId);
    if (!npc) return;
    if (npc.isUnconsciousOrDead()) {
      MessageManager.notifyNpcAlreadyInStatus(player, npc);
    } else {
      this.startCombat(npcId, player, true);
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
    this.notifyPlayersInLocation(player.currentLocation,
      MessageManager.createCombatHealthStatusMessage(player, playerHealthPercentage, npc, npcHealthPercentage));
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
Describe Location Manager Class
The DescribeLocationManager class is responsible for describing the location of the player.
It contains methods to format the description of the location, the exits, the items, the npcs,
and the players in the location.
***************************************************************************************************/
class DescribeLocationManager {
  constructor(player, server) {
    this.player = player;
    this.server = server;
    this.logger = server.logger;
    this.description = {};
  }
  describe() {
    try {
      const location = this.server.gameManager.getLocation(this.player.currentLocation);
      if (!location) {
        MessageManager.notify(this.player, `${this.player.getName()} is in an unknown location.`);
        return;
      }
      this.description = this.formatDescription(location);
      MessageManager.notify(this.player, this.description);
    } catch (error) {
      this.logger.error(`ERROR: Describing location for player ${this.player.getName()}:`, error, error.stack);
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
Format Message Manager Class
The FormatMessageManager class is responsible for creating and managing message data that is
sent to players within the game. It centralizes the formatting of messages, ensuring consistency
in how messages are constructed and sent. This class provides methods to create message data with
associated CSS IDs for styling and to retrieve predefined message IDs based on specific types of
messages (e.g., login success, combat notifications). By centralizing message handling, it
simplifies the process of modifying or updating message formats and ensures that all messages
adhere to a consistent structure throughout the game.
***************************************************************************************************/
class FormatMessageManager {
  static createMessageData(cssid = '', message) {
    return { cssid, content: message };
  }
  static getIdForMessage(type) {
    const messageIds = {
      loginSuccess: 'player-name',
      incorrectPassword: 'error-message',
      inventoryStatus: 'inventory-list',
      lootAction: 'combat-message',
      targetNotFound: 'error-message',
      combatInitiation: 'combat-message-player',
      combatJoin: 'combat-message-npc',
      combatMessageHealth: 'combat-message-health',
      defeat: 'combat-message-npc',
      victory: 'combat-message-player',
      meditationAction: 'combat-message',
      meditationStart: 'combat-message',
      sleepAction: 'combat-message',
      standingUp: 'combat-message',
      wakingUp: 'combat-message',
      alreadySitting: 'error-message',
      alreadyStanding: 'error-message',
      disconnectionFailedAttempts: 'error-message',
      stats: 'combat-message',
      invalidItemAddition: 'error-message',
      inventoryFull: 'error-message',
      itemNotFoundInInventory: 'error-message',
      leavingLocation: 'combat-message',
      enteringLocation: 'combat-message',
      combatActionMessage: 'combat-message',
      dataLoadError: 'error-message',
      dataSaveError: 'error-message',
      generalError: 'error-message',
      lookAtSelf: 'combat-message',
      lookAtItem: 'combat-message',
      lookAtNpc: 'combat-message',
      lookAtOtherPlayer: 'combat-message',
    };
    return messageIds[type] || '';
  }
}
/**************************************************************************************************
Message Manager Class
The MessageManager class is responsible for sending messages to players.
It provides methods to notify players of various events, such as combat, location changes,
and actions performed by other players. It also handles the formatting and transmission
of these messages to the client.
***************************************************************************************************/
class MessageManager {
  static socket;
  static setSocket(socketInstance) {
    this.socket = socketInstance;
  }
  static notify(player, message, cssid = '') {
    try {
      player.server.logger.info(`Message to ${player.getName()}: ${message}`);
      const messageData = FormatMessageManager.createMessageData(cssid, message);
      if (this.socket) {
        this.socket.emit('message', { playerId: player.getId(), messageData });
      }
      return messageData;
    } catch (error) {
      player.server.logger.error(`ERROR: Notifying player ${player.getName()}:`, error, error.stack);
    }
  }
  static notifyPlayersInLocation(location, message) {
    if (!location || !location.playersInLocation) return;
    Array.from(location.playersInLocation).forEach(player => this.notify(player, message));
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
    return this.notifyAction(player, 'grabs', itemName, FormatMessageManager.getIdForMessage('pickupItem'));
  }
  static notifyDropItem(player, itemName) {
    return this.notifyAction(player, 'drops', itemName, FormatMessageManager.getIdForMessage('dropItem'));
  }
}
/**************************************************************************************************/
/**************************************************************************************************
Start Server
The StartServer code is responsible for starting the server. It uses the ServerInitializer class
to initialize the server.
***************************************************************************************************/
const serverInitializer = new ServerInitializer(CONFIG);
serverInitializer.initialize();
