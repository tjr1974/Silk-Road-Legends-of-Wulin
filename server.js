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
***************************************************************************************************/
class ISocketEventEmitter {
  on(event, callback) {}
  emit(event, ...args) {}
  off(event, callback) {}
}
/**************************************************************************************************
Base Manager Interface Class
***************************************************************************************************/
class IBaseManager {
  constructor({ logger, server }) {
    this.server = server;
    this.logger = logger;
  }
}
/**************************************************************************************************
Database Manager Interface Class
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
***************************************************************************************************/
class IGameManager {
  getLocation(locationId) {}
  moveEntity(entity, newLocationId) {}
  getNpc(npcId) {}
}
/**************************************************************************************************
Logger Class
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
***************************************************************************************************/
class Server {
  constructor({ config, logger, bcrypt }) {
    this.config = config;
    this.logger = logger;
    this.bcrypt = bcrypt;
    this.gameManager = null;
    this.combatManager = null;
    this.itemManager = null;
    this.npcManager = null;
    this.playerManager = null;
    this.locationManager = null;
    this.messageManager = null;
    this.transactionManager = null;
    this.npcMovementManager = null;
    this.socketManager = null;
  }
  async initialize() {
    this.logger.info('Initializing server...');
    const initializationSteps = [
      this.initializeManagers,
      this.loadGameData,
      this.setupSocketServer,
      this.startNpcMovement,
    ];
    await this.executeSteps(initializationSteps);
    this.logger.info('Server initialization complete.');
  }
  async executeSteps(steps) {
    for (const step of steps) {
      await step.call(this);
    }
  }
  async initializeManagers() {
    const managerInitializations = [
      { name: 'GameManager', factory: () => GameManager.getInstance(this) },
      { name: 'CombatManager', factory: () => new CombatManager({ server: this, config: this.config }) },
      { name: 'ItemManager', factory: () => ItemManager.getInstance({ logger: this.logger, configManager: this.config, bcrypt: this.bcrypt }) },
      { name: 'NpcManager', factory: () => NpcManager.getInstance(this) },
      { name: 'PlayerManager', factory: () => PlayerManager.getInstance(this) },
      { name: 'LocationManager', factory: () => LocationManager.getInstance(this) },
      { name: 'MessageManager', factory: () => MessageManager.getInstance(this.logger) },
      { name: 'TransactionManager', factory: () => new TransactionManager(this) },
      { name: 'NpcMovementManager', factory: () => NpcMovementManager.getInstance({ logger: this.logger, configManager: this.config, gameManager: this.gameManager }) },
      { name: 'SocketManager', factory: () => new SocketManager(this) },
    ];
    await this.initializeManagersSequentially(managerInitializations);
  }
  async initializeManagersSequentially(managerInitializations) {
    for (const { name, factory } of managerInitializations) {
      this[name.charAt(0).toLowerCase() + name.slice(1)] = await factory();
      this.logger.info(`${name} initialized.`);
    }
  }
  async loadGameData() {
    const dataLoaders = [
      { name: 'Items', loader: () => this.itemManager.initialize(this.config.items) },
      { name: 'Locations', loader: () => this.locationManager.initialize(this.config.locations) },
      { name: 'NPCs', loader: () => this.npcManager.initialize(this.config.npcs) },
    ];
    await this.executeDataLoaders(dataLoaders);
  }
  async executeDataLoaders(dataLoaders) {
    for (const { name, loader } of dataLoaders) {
      await loader();
      this.logger.info(`${name} data loaded.`);
    }
  }
  setupSocketServer() {
    this.socketManager.initialize();
    this.logger.info('Socket server set up.');
  }
  startNpcMovement() {
    this.npcMovementManager.startMovement();
    this.logger.info('NPC movement started.');
  }
  async handlePlayerConnection(socket) {
    try {
      const player = await this.playerManager.handlePlayerConnection(socket);
      if (player) {
        await this.setupPlayerEventHandlers(socket, player);
      }
    } catch (error) {
      this.logger.error('Error handling player connection:', error);
    }
  }
  setupPlayerEventHandlers(socket, player) {
    const eventHandlers = [
      { event: 'disconnect', handler: () => this.handlePlayerDisconnect(player) },
      { event: 'chat', handler: (message) => this.handleChatMessage(player, message) },
      { event: 'command', handler: (command) => this.handleCommand(player, command) },
    ];
    eventHandlers.forEach(({ event, handler }) => {
      socket.on(event, handler);
    });
  }
  async handlePlayerDisconnect(player) {
    await this.playerManager.handlePlayerDisconnect(player);
  }
  async handleChatMessage(player, message) {
    await this.messageManager.broadcastChatMessage(player, message);
  }
  async handleCommand(player, command) {
    await this.gameManager.handleCommand(player, command);
  }
  cleanup() {
    const cleanupTasks = [
      () => this.socketManager.cleanup(),
      () => this.npcMovementManager.cleanup(),
      () => this.playerManager.cleanup(),
      () => this.npcManager.cleanup(),
      () => this.locationManager.cleanup(),
      () => this.itemManager.cleanup(),
      () => this.messageManager.cleanup(),
    ];
    this.executeCleanupTasks(cleanupTasks);
    this.logger.info('Server cleaned up.');
  }
  executeCleanupTasks(tasks) {
    tasks.forEach(task => task());
  }
}
/**************************************************************************************************
Server Initializer Class
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
    const initializationSteps = [
      this.initializeServer,
      this.configureServer,
      this.initializeGameComponents,
      this.logServerRunning
    ];
    await this.executeSteps(initializationSteps);
  }
  async executeSteps(steps) {
    for (const step of steps) {
      try {
        await step.call(this);
      } catch (error) {
        this.handleInitializationError(error, step.name);
      }
    }
  }
  async initializeServer() {
    this.logger.info("INITIALIZE SERVER STARTED");
    this.logger.debug("- Initialize Server Instance");
    await this.server.init();
    this.logger.debug("- Initialize Server Instance Finished");
  }
  async configureServer() {
    await this.serverConfigurator.configureServer();
  }
  async initializeGameComponents() {
    await this.gameComponentInitializer.setupGameComponents();
  }
  logServerRunning() {
    this.logger.info("INITIALIZE SERVER FINISHED");
    this.server.logServerRunningMessage();
  }
  handleInitializationError(error, stepName) {
    this.logger.error(`Error during ${stepName}: ${error.message}`, { error });
  }
  async cleanup() {
    const cleanupTasks = [
      { name: 'NpcMovementManager', task: () => this.server.npcMovementManager?.cleanup() },
      { name: 'ItemManager', task: () => this.server.itemManager?.cleanup() },
      { name: 'TransactionManager', task: () => this.server.transactionManager?.cleanup() },
      { name: 'MessageManager', task: () => MessageManager.cleanup() },
      { name: 'PlayerInventories', task: () => this.cleanupPlayerInventories() },
      { name: 'Database', task: () => this.server.db?.close() },
      { name: 'SocketConnection', task: () => this.closeSocketConnection() }
    ];
    await this.executeCleanupTasks(cleanupTasks);
    this.logger.info('Server cleanup completed');
  }
  async executeCleanupTasks(tasks) {
    for (const { name, task } of tasks) {
      try {
        await task();
        this.logger.info(`${name} cleaned up successfully`);
      } catch (error) {
        this.logger.error(`Error during ${name} cleanup: ${error.message}`, { error });
      }
    }
  }
  cleanupPlayerInventories() {
    this.server.players.forEach(player => {
      if (player.inventoryManager) {
        player.inventoryManager.cleanup();
      }
    });
  }
  async closeSocketConnection() {
    if (this.server.io) {
      await new Promise(resolve => this.server.io.close(resolve));
      this.logger.info('Socket connection closed');
    }
  }
}
/**************************************************************************************************
Server Configurator Class
***************************************************************************************************/
class ServerConfigurator extends IBaseManager {
  constructor({ logger, config, server, socketEventManager }) {
    super({ server, logger });
    this.config = config;
    this.socketEventManager = socketEventManager;
    this.server.app = null;
  }
  async configureServer() {
    const configurationSteps = [
      this.setupExpress,
      this.setupHttpServer,
      this.configureMiddleware,
      this.setupQueueManager
    ];
    await this.executeConfigurationSteps(configurationSteps);
  }
  async executeConfigurationSteps(steps) {
    for (const step of steps) {
      try {
        await step.call(this);
      } catch (error) {
        this.logger.error(`Error during ${step.name}: ${error.message}`, { error });
      }
    }
  }
  async setupExpress() {
    this.server.app = express();
  }
  async setupHttpServer() {
    await this.server.setupHttpServer();
  }
  configureMiddleware() {
    const middlewares = [
      express.static('public'),
      this.errorHandlerMiddleware
    ];
    middlewares.forEach(middleware => this.server.app.use(middleware));
  }
  errorHandlerMiddleware(err, req, res, next) {
    this.logger.error(`Middleware Error: ${err.message}`, { error: err });
    res.status(500).send('An Unexpected Error Occurred. Please Try Again Later.');
  }
  setupQueueManager() {
    this.server.queueManager = new QueueManager();
  }
  async cleanup() {
    this.logger.info("Starting server cleanup...");
    const cleanupTasks = [
      { name: 'GameManager', task: () => this.server.gameManager?.cleanup() },
      { name: 'DatabaseManager', task: () => this.server.databaseManager?.cleanup() },
      { name: 'SocketEventManager', task: () => this.server.socketEventManager?.cleanup() },
      { name: 'QueueManager', task: () => this.server.queueManager?.cleanup() },
      { name: 'MessageManager', task: () => MessageManager.cleanup() },
      { name: 'ItemManager', task: () => this.server.itemManager?.cleanup() },
      { name: 'TransactionManager', task: () => this.server.transactionManager?.cleanup() },
      { name: 'ReplicationManager', task: () => this.server.replicationManager?.cleanup() },
      { name: 'AuthManager', task: () => this.server.authManager?.cleanup() },
      { name: 'SessionManager', task: () => this.server.sessionManager?.cleanup() },
      { name: 'NpcMovementManager', task: () => this.server.npcMovementManager?.cleanup() },
      { name: 'Database', task: () => this.server.db?.close() },
      { name: 'SocketConnection', task: () => new Promise(resolve => this.server.io?.close(resolve)) }
    ];
    await this.executeCleanupTasks(cleanupTasks);
    this.server.activeSessions.clear();
    this.logger.info("Server cleanup completed successfully.");
  }
  async executeCleanupTasks(tasks) {
    for (const { name, task } of tasks) {
      try {
        await task();
        this.logger.info(`${name} cleaned up successfully.`);
      } catch (error) {
        this.logger.error(`Error during ${name} cleanup: ${error.message}`, { error });
      }
    }
  }
}
/**************************************************************************************************
Socket Event Manager Class
***************************************************************************************************/
class SocketEventManager extends IBaseManager {
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
      this.io.on('connection', this.handleNewConnection.bind(this));
    } catch (error) {
      this.logger.error(`Error Initializing Socket Events: ${error.message}`, { error });
    }
  }
  handleNewConnection(socket) {
    this.logger.info(`New client connected: ${socket.id}`);
    this.setupSocketListeners(socket);
  }
  setupSocketListeners(socket) {
    const listeners = [
      { event: 'playerAction', handler: this.handlePlayerAction.bind(this) },
      { event: 'disconnect', handler: () => this.handleDisconnect(socket) }
    ];
    listeners.forEach(({ event, handler }) => {
      socket.on(event, handler);
    });
  }
  handlePlayerAction(data) {
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
  }
  handleDisconnect(socket) {
    this.logger.info(`Client disconnected: ${socket.id}`);
    // Clean up any necessary game state
  }
}
/**************************************************************************************************
SocketEvent Emitter Class
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
***************************************************************************************************/
class Character extends Entity {
  constructor({ name, health }) {
    super(name);
    this.health = health;
  }
}
/**************************************************************************************************
Create New Player Class
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
Look At Command Handler Class
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
      ["attack is evaded", this.createOutcomeDescription(({ attacker, defender, technique }) =>
        `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} evades the strike!`)],
      ["attack is trapped", this.createOutcomeDescription(({ attacker, defender, technique }) =>
        `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} traps the strike!`)],
      ["attack is parried", this.createOutcomeDescription(({ attacker, defender, technique }) =>
        `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} parries the strike!`)],
      ["attack is blocked", this.createOutcomeDescription(({ attacker, defender, technique }) =>
        `${attacker.getName()} attacks ${defender.getName()} with a ${technique}, but ${defender.getName()} blocks the strike!`)],
      ["attack hits", this.createOutcomeDescription(({ attacker, defender, technique }) =>
        `${attacker.getName()} attacks ${defender.getName()} with a ${technique}. The strike successfully hits ${defender.getName()}!`)],
      ["critical success", this.createOutcomeDescription(({ attacker, defender, technique }) =>
        `${attacker.getName()} attacks ${defender.getName()} with a devastatingly catastrophic ${technique}.<br>The strike critically hits ${defender.getName()}!`)],
      ["knockout", this.createOutcomeDescription(({ attacker, defender, technique }) =>
        `${attacker.getName()} strikes ${defender.getName()} with a spectacularly phenomenal blow!<br>${defender.getName()}'s body goes limp and collapses to the ground!`)],
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
  createOutcomeDescription(descriptionFn) {
    return (args) => {
      try {
        return descriptionFn(args);
      } catch (error) {
        this.logger.error(`Error generating outcome description: ${error.message}`, { error });
        return "An unexpected outcome occurred.";
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
Npc Class
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
***************************************************************************************************/
class ContainerItem extends Item {
  constructor({ id, name, description, aliases, server }) {
    super({ id, name, description, aliases, type: 'container', server });
    this.inventory = new Set();
  }
}
/**************************************************************************************************
Weapon Item Class
***************************************************************************************************/
class WeaponItem extends Item {
  constructor({ id, name, description, aliases, damage, server }) {
    super({ id, name, description, aliases, type: 'weapon', server });
    this.damage = damage;
  }
}
/**************************************************************************************************
Item Manager Class
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
***************************************************************************************************/
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
  static createNotificationMethod(actionType) {
    return async ({ player, ...args }) => {
      try {
        const message = this[`get${actionType}Template`](args);
        return await this.notify(player, message, actionType.toLowerCase());
      } catch (error) {
        this.logger.error(`Error notifying ${actionType.toLowerCase()}:`, error);
      }
    };
  }
  static notifyLoginSuccess = this.createNotificationMethod('LoginSuccess');
  static notifyIncorrectPassword = this.createNotificationMethod('IncorrectPassword');
  static notifyDisconnectionDueToFailedAttempts = this.createNotificationMethod('DisconnectionDueToFailedAttempts');
  static notifyPickupItem = this.createNotificationMethod('PickupItem');
  static notifyDropItem = this.createNotificationMethod('DropItem');
  static createTemplateMethod(templateFunction) {
    return (args) => {
      try {
        return templateFunction(args);
      } catch (error) {
        this.logger.error(`Error getting template:`, error);
      }
    };
  }
  static getLoginSuccessTemplate = this.createTemplateMethod(
    ({ player }) => `${player.getName()} has logged in!`
  );
  static getIncorrectPasswordTemplate = this.createTemplateMethod(
    () => `Incorrect password. Please try again.`
  );
  static getDisconnectionDueToFailedAttemptsTemplate = this.createTemplateMethod(
    ({ player }) => `${player.getName()} has been disconnected due to too many failed login attempts.`
  );
  static getPickupItemTemplate = this.createTemplateMethod(
    ({ player, itemName }) => `${player.getName()} picks up ${itemName}.`
  );
  static getDropItemTemplate = this.createTemplateMethod(
    ({ player, itemName }) => `${player.getName()} drops ${itemName}.`
  );
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
