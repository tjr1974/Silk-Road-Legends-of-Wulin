/**************************************************************************************************
Import Dependencies
***************************************************************************************************/
import CONFIG from './config.js';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import http from 'http';
import https from 'https';
import { promises as fs } from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { exit } from 'process';
/**************************************************************************************************
Configuration System Class
***************************************************************************************************/
class ConfigurationSystem {
  constructor(config) {
    this.config = config;
    this.logger = new LogSystem();
  }
  get(key) {
    return this.config[key];
  }
  set(key, value) {
    this.config[key] = value;
  }
  getAll() {
    return { ...this.config };
  }
  updateFromEnvironment() {
    Object.keys(this.config).forEach(key => {
      if (process.env[key] !== undefined) {
        if (typeof this.config[key] === 'number') {
          this.config[key] = Number(process.env[key]);
        } else if (typeof this.config[key] === 'boolean') {
          this.config[key] = process.env[key].toLowerCase() === 'true';
        } else if (key === 'REGEN_RATES') {
          try {
            this.config[key] = new Map(Object.entries(JSON.parse(process.env[key])));
          } catch (error) {
            this.logger.error(`Failed to parse REGEN_RATES from environment: ${error}`);
          }
        } else {
          this.config[key] = process.env[key];
        }
      }
    });
  }
  validate() {
    const requiredKeys = [
      'HOST', 'PORT', 'LOG_LEVEL', 'SESSION_SECRET',
      'SSL_KEY_PATH', 'SSL_CERT_PATH', 'LOG_FILE_PATH',
      'PLAYER_DATA_PATH', 'LOCATIONS_DATA_PATH', 'NPCS_DATA_PATH',
      'ITEMS_DATA_PATH', 'GAME_DATA_PATH'
    ];
    requiredKeys.forEach(key => {
      if (this.config[key] === undefined) {
        this.logger.error(`Missing required configuration: ${key}`);
      }
    });
    const numericKeys = [
      'PORT', 'LOG_MAX_FILE_SIZE', 'PASSWORD_SALT_ROUNDS',
      'ITEM_UID_SALT_ROUNDS', 'TICK_RATE', 'WORLD_EVENT_INTERVAL',
      'NPC_MOVEMENT_INTERVAL', 'INITIAL_HEALTH', 'INITIAL_ATTACK_POWER',
      'REGEN_INTERVAL', 'LEVEL_UP_XP', 'INVENTORY_CAPACITY', 'COMBAT_INTERVAL'
    ];
    numericKeys.forEach(key => {
      if (typeof this.config[key] !== 'number' || isNaN(this.config[key])) {
        this.logger.error(`Invalid numeric value for ${key}: ${this.config[key]}`);
      }
    });
    const booleanKeys = ['SESSION_RESAVE', 'SESSION_SAVE_UNINITIALIZED', 'COOKIE_SECURE', 'COOKIE_HTTP_ONLY'];
    booleanKeys.forEach(key => {
      if (typeof this.config[key] !== 'boolean') {
        this.logger.error(`Invalid boolean value for ${key}: ${this.config[key]}`);
      }
    });
    if (!(this.config.REGEN_RATES instanceof Map)) {
      this.logger.error('REGEN_RATES must be a Map');
    } else {
      this.config.REGEN_RATES.forEach((value, key) => {
        if (typeof value !== 'number' || isNaN(value)) {
          this.logger.error(`Invalid numeric value for REGEN_RATES[${key}]: ${value}`);
        }
      });
    }
    const validLogLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    if (!validLogLevels.includes(this.config.LOG_LEVEL)) {
      this.logger.error(`Invalid LOG_LEVEL: ${this.config.LOG_LEVEL}`);
    }
    const validSameSiteValues = ['strict', 'lax', 'none'];
    if (!validSameSiteValues.includes(this.config.COOKIE_SAME_SITE.toLowerCase())) {
      this.logger.error(`Invalid COOKIE_SAME_SITE value: ${this.config.COOKIE_SAME_SITE}`);
    }
  }
}
/**************************************************************************************************
Log System Class
***************************************************************************************************/
class LogSystem {
  static instance = null;
  constructor() {
    if (LogSystem.instance) {
      return LogSystem.instance;
    }
    this.logLevel = this.getLogLevelValue(CONFIG.LOG_LEVEL);
    this.logFilePath = CONFIG.LOG_FILE_PATH;
    this.maxFileSize = CONFIG.LOG_MAX_FILE_SIZE;
    this.CONFIG = CONFIG;
    LogSystem.instance = this;
  }
  getLogLevelValue(level) {
    const levels = {
      'DEBUG': 0,
      'INFO': 1,
      'WARN': 2,
      'ERROR': 3
    };
    return levels[level] || 0;
  }
  async log(level, message) {
    const levelValue = this.getLogLevelValue(level);
    if (levelValue >= this.logLevel) {
      const formattedMessage = this.formatMessage(level, message);
      console.log(formattedMessage);
      await this.writeToFile(this.stripAnsiCodes(formattedMessage));
    }
  }
  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
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
    return `[${timestamp}] [${level}] ${coloredMessage}`;
  }
  stripAnsiCodes(str) {
    return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
  }
  async writeToFile(message) {
    try {
      const fileName = `${new Date().toISOString().split('T')[0]}.log`;
      const filePath = path.join(this.logFilePath, fileName);
      await fs.mkdir(this.logFilePath, { recursive: true });
      const stats = await fs.stat(filePath).catch(() => ({ size: 0 }));
      if (stats.size > this.maxFileSize) {
        const newFileName = `${fileName}.${Date.now()}`;
        await fs.rename(filePath, path.join(this.logFilePath, newFileName));
      }
      await fs.appendFile(filePath, message + '\n');
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
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
Core Server System Class
***************************************************************************************************/
class CoreServerSystem {
  constructor(config) {
    this.configSystem = new ConfigurationSystem(config);
    this.express = express();
    this.http = null;
    this.https = null;
    this.io = null;
    this.gameLoop = null;
    this.socketEventSystem = new SocketEventSystem();
    this.clientManager = new ClientManager();
    this.databaseManager = new DatabaseManager(this.configSystem);
    this.gameDataManager = new GameDataManager(this.configSystem, this.databaseManager);
    this.worldManager = new WorldManager(this.gameDataManager);
    this.logger = new LogSystem();
  }
  async initialize() {
    this.configSystem.updateFromEnvironment();
    this.configSystem.validate();
    try {
      await this.databaseManager.initialize();
      this.logger.info('Database system initialized successfully');
      await this.gameDataManager.loadGameData();
      this.logger.info('Game data loaded successfully');
      this.worldManager.initialize();
      this.logger.info('World initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize server: ${error.message}`);
      throw error;
    }
  }
  start() {
    // Start the server and game loop
    this.setupExpress();
    this.setupSocketIO();
    this.startGameLoop();
    this.logger.info('Server started successfully');
  }
  stop() {
    // Gracefully stop the server and game loop
    this.stopGameLoop();
    this.io.close();
    this.http.close();
    this.https.close();
    this.databaseManager.disconnect();
    this.logger.info('Server stopped successfully');
  }
  setupExpress() {
    const { HOST, PORT, SSL_KEY_PATH, SSL_CERT_PATH } = this.configSystem.getAll();
    this.express.use(express.json());
    this.express.use(express.static('public'));
    if (SSL_KEY_PATH && SSL_CERT_PATH) {
      const httpsOptions = {
        key: fs.readFileSync(SSL_KEY_PATH),
        cert: fs.readFileSync(SSL_CERT_PATH)
      };
      this.https = https.createServer(httpsOptions, this.express);
      this.http = http.createServer((req, res) => {
        res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
        res.end();
      });
      this.https.listen(PORT, HOST, () => {
        this.logger.info(`HTTPS server running on https://${HOST}:${PORT}`);
      });
      this.http.listen(80, HOST, () => {
        this.logger.info(`HTTP server redirecting to HTTPS`);
      });
    } else {
      this.http = http.createServer(this.express);
      this.http.listen(PORT, HOST, () => {
        this.logger.info(`HTTP server running on http://${HOST}:${PORT}`);
      });
    }
  }
  setupSocketIO() {
    this.io = new SocketIOServer(this.https || this.http);
    this.io.on('connection', (socket) => {
      this.handleNewConnection(socket);
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });
      // Add more socket event listeners here
    });
  }
  startGameLoop() {
    const TICK_RATE = this.configSystem.get('TICK_RATE');
    const TICK_INTERVAL = 1000 / TICK_RATE;
    let lastUpdate = Date.now();
    this.gameLoop = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastUpdate) / 1000;
      this.tick(deltaTime);
      lastUpdate = now;
    }, TICK_INTERVAL);
    this.logger.info(`Game loop started with tick rate: ${TICK_RATE} Hz`);
  }
  stopGameLoop() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
      this.logger.info('Game loop stopped');
    }
  }
  handleNewConnection(socket) {
    this.logger.info(`New client connected: ${socket.id}`);
    // Add authentication logic here
    // For now, we'll create a dummy player
    const dummyPlayer = new Player(socket.id, `Player_${socket.id}`, 'A new player');
    this.clientManager.addClient(socket, dummyPlayer);
    socket.emit('connectionEstablished', { playerId: dummyPlayer.id });
  }
  handleDisconnection(socket) {
    this.logger.info(`Client disconnected: ${socket.id}`);
    this.clientManager.removeClient(socket);
  }
  tick(deltaTime) {
    this.worldManager.updateWorld(deltaTime);
    // Update all connected clients with the new world state
    const worldState = this.worldManager.getWorldState();
    this.clientManager.broadcastToAll('worldUpdate', worldState);
  }
}
/**************************************************************************************************
Socket Event System Class
***************************************************************************************************/
class SocketEventSystem {
  constructor() {
    this.listeners = new Map();
  }
  on(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);
  }
  emit(eventName, ...args) {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }
  removeListener(eventName, listener) {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      listeners.delete(listener);
    }
  }
  removeAllListeners(eventName) {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
    }
  }
  createCustomEvent(name, data) {
    this.emit(name, data);
  }
}
/**************************************************************************************************
Client Manager Class
***************************************************************************************************/
class ClientManager {
  constructor() {
    this.clients = new Map();
  }
  addClient(socket, player) {
    this.clients.set(socket.id, { socket, player });
  }
  removeClient(socket) {
    this.clients.delete(socket.id);
  }
  broadcastToAll(event, data) {
    for (const client of this.clients.values()) {
      client.socket.emit(event, data);
    }
  }
}
/**************************************************************************************************
Database Manager Class
***************************************************************************************************/
class DatabaseManager {
  constructor(configSystem) {
    this.configSystem = configSystem;
    this.logger = new LogSystem();
    this.dataPath = this.configSystem.get('GAME_DATA_PATH');
  }
  async initialize() {
    // Verify that the data directory exists
    try {
      await fs.access(this.dataPath);
      this.logger.info('JSON file system initialized successfully');
    } catch (error) {
      this.logger.error(`Data directory not accessible: ${error.message}`);
      throw error;
    }
  }
  async query(dataType, filter = null) {
    try {
      const data = await this.loadJSONData(`${dataType}.json`);
      if (filter) {
        return data.filter(filter);
      }
      return data;
    } catch (error) {
      this.logger.error(`Error querying ${dataType} data: ${error.message}`);
      throw error;
    }
  }
  async loadJSONData(filename) {
    try {
      const filePath = path.join(this.dataPath, filename);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to load JSON data from ${filename}: ${error.message}`);
    }
  }
  async saveJSONData(filename, data) {
    try {
      const filePath = path.join(this.dataPath, filename);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      this.logger.info(`${filename} saved successfully`);
    } catch (error) {
      this.logger.error(`Error saving ${filename}:`, error);
      throw error;
    }
  }
  async getPlayer(playerId) {
    const players = await this.query('players', player => player.id === playerId);
    return players[0];
  }
  async savePlayer(player) {
    const players = await this.query('players');
    const index = players.findIndex(p => p.id === player.id);
    if (index !== -1) {
      players[index] = player;
    } else {
      players.push(player);
    }
    await this.saveJSONData('players.json', players);
    this.logger.info(`Player ${player.id} saved successfully`);
  }
  async getWorldState() {
    return await this.query('world_state');
  }
  async saveWorldState(worldState) {
    await this.saveJSONData('world_state.json', worldState);
    this.logger.info('World state saved successfully');
  }
  async loadGameData(dataType) {
    return await this.query(dataType);
  }
  async saveGameData(dataType, data) {
    await this.saveJSONData(`${dataType}.json`, data);
    this.logger.info(`${dataType} data saved successfully`);
  }
}
/**************************************************************************************************
Game Data Manager Class
***************************************************************************************************/
class GameDataManager {
  constructor(configSystem, databaseManager) {
    this.configSystem = configSystem;
    this.databaseManager = databaseManager;
    this.locations = new Map();
    this.npcs = new Map();
    this.mobileNPCs = new Map();
    this.merchantNPCs = new Map();
    this.questNPCs = new Map();
    this.items = new Map();
    this.locationCoordinateManager = new LocationCoordinateManager();
    this.logger = new LogSystem();
  }
  async loadGameData() {
    await this.loadLocationData();
    await this.loadNPCData();
    await this.loadItemData();
  }
  async loadLocationData() {
    try {
      const locationData = await this.loadData('locations');
      this.checkForDuplicateIds(locationData, 'location');
      this.initializeLocationCoordinates(locationData);
      locationData.forEach(location => this.locations.set(location.id, location));
    } catch (error) {
      this.logger.error('Error loading location data:', error);
    }
  }
  async loadNPCData() {
    try {
      const npcData = await this.loadData('npcs');
      this.checkForDuplicateIds(npcData, 'NPC');
      npcData.forEach(npcData => {
        const npc = new NPC(
          npcData.id,
          npcData.name,
          npcData.description,
          npcData.type,
          npcData.dialogueTree,
          npcData.inventory,
          npcData.questId
        );
        this.npcs.set(npc.id, npc);
        // Categorize NPCs based on their type
        if (npc.type === 'mobile') {
          this.mobileNPCs.set(npc.id, npc);
        } else if (npc.type === 'merchant') {
          this.merchantNPCs.set(npc.id, npc);
        }
        // Quest NPCs can be of any type, so we check for questId
        if (npc.questId) {
          this.questNPCs.set(npc.id, npc);
        }
      });
      this.logger.info(`Loaded ${this.npcs.size} NPCs, including ${this.mobileNPCs.size} mobile, ${this.merchantNPCs.size} merchant, and ${this.questNPCs.size} quest NPCs`);
    } catch (error) {
      this.logger.error('Error loading NPC data:', error);
    }
  }
  async loadItemData() {
    try {
      const itemData = await this.loadData('items');
      this.checkForDuplicateIds(itemData, 'item');
      for (const item of itemData) {
        item.uid = await this.generateUID(item.id);
        this.items.set(item.id, item);
      }
      this.logger.info(`Loaded ${this.items.size} items`);
    } catch (error) {
      this.logger.error('Error loading item data:', error);
    }
  }
  async loadData(dataType) {
    return await this.parseJSONData(`${dataType}.json`);
  }
  async parseJSONData(filename) {
    try {
      const dataPath = this.configSystem.get('GAME_DATA_PATH');
      const data = await fs.readFile(path.join(dataPath, filename), 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to parse JSON data from ${filename}: ${error.message}`);
    }
  }
  checkForDuplicateIds(dataArray, entityType) {
    const ids = new Set();
    dataArray.forEach(item => {
      if (ids.has(item.id)) {
        throw new Error(`Duplicate ${entityType} ID found: ${item.id}`);
      }
      ids.add(item.id);
    });
  }
  initializeLocationCoordinates(locationData) {
    this.locationCoordinateManager.initialize(locationData);
    locationData.forEach(location => {
      location.coordinates = this.locationCoordinateManager.getCoordinates(location.id);
    });
  }
  async generateUID(itemId) {
    const ITEM_UID_SALT_ROUNDS = this.configSystem.get('ITEM_UID_SALT_ROUNDS');
    const salt = await bcrypt.genSalt(ITEM_UID_SALT_ROUNDS);
    const hash = await bcrypt.hash(itemId, salt);
    return hash.replace(/[/$.]/g, '').slice(0, 24); // Remove bcrypt special chars and truncate
  }
  getLocation(id) {
    return this.locations.get(id);
  }
  getNPC(id) {
    return this.npcs.get(id);
  }
  getItem(id) {
    return this.items.get(id);
  }
  async saveGameData() {
    await this.saveDataToJSON('locations.json', Array.from(this.locations.values()));
    await this.saveDataToJSON('npcs.json', Array.from(this.npcs.values()));
    await this.saveDataToJSON('items.json', Array.from(this.items.values()));
  }
  async saveDataToJSON(filename, data) {
    try {
      const dataPath = this.configSystem.get('GAME_DATA_PATH');
      const filePath = path.join(dataPath, filename);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      this.logger.info(`${filename} saved successfully`);
    } catch (error) {
      this.logger.error(`Error saving ${filename}:`, error);
    }
  }
  getMobileNPCs() {
    return this.mobileNPCs;
  }
  getMerchantNPCs() {
    return this.merchantNPCs;
  }
  getQuestNPCs() {
    return this.questNPCs;
  }
}
/**************************************************************************************************
Location System Class
***************************************************************************************************/
class LocationSystem {
  constructor(gameDataManager) {
    this.gameDataManager = gameDataManager;
    this.locations = new Map();
    this.logger = new LogSystem();
  }
  initialize() {
    this.loadLocations();
    this.validateConnections();
    this.logger.info('Location System initialized successfully');
  }
  loadLocations() {
    for (const [id, locationData] of this.gameDataManager.locations) {
      this.locations.set(id, new Location(locationData));
    }
  }
  validateConnections() {
    for (const location of this.locations.values()) {
      for (const [direction, targetId] of Object.entries(location.exits)) {
        if (!this.locations.has(targetId)) {
          this.logger.warn(`Invalid exit in location ${location.id}: ${direction} leads to non-existent location ${targetId}`);
        }
      }
    }
  }
  getLocation(id) {
    return this.locations.get(id);
  }
  getConnectedLocations(locationId) {
    const location = this.getLocation(locationId);
    if (!location) return [];
    return Object.entries(location.exits).map(([direction, targetId]) => ({
      direction,
      location: this.getLocation(targetId)
    }));
  }
  canMove(fromId, toId) {
    const fromLocation = this.getLocation(fromId);
    return fromLocation && Object.values(fromLocation.exits).includes(toId);
  }
  addLocation(locationData) {
    const newLocation = new Location(locationData);
    this.locations.set(newLocation.id, newLocation);
    this.gameDataManager.locations.set(newLocation.id, locationData);
    this.logger.info(`New location added: ${newLocation.id}`);
  }
  updateLocation(id, updateData) {
    const location = this.getLocation(id);
    if (location) {
      Object.assign(location, updateData);
      this.gameDataManager.locations.set(id, { ...location });
      this.logger.info(`Location updated: ${id}`);
    } else {
      this.logger.warn(`Attempted to update non-existent location: ${id}`);
    }
  }
  removeLocation(id) {
    if (this.locations.delete(id)) {
      this.gameDataManager.locations.delete(id);
      this.logger.info(`Location removed: ${id}`);
      this.validateConnections(); // Re-validate after removal
    } else {
      this.logger.warn(`Attempted to remove non-existent location: ${id}`);
    }
  }
}
/**************************************************************************************************
Location Class
***************************************************************************************************/
class Location {
  constructor({ id, name, description, exits, items, npcs, zone }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.exits = exits;
    this.items = new Set(items);
    this.npcs = new Set(npcs);
    this.zone = zone;
    this.players = new Set();
  }
  addPlayer(playerId) {
    this.players.add(playerId);
  }
  removePlayer(playerId) {
    this.players.delete(playerId);
  }
  addItem(itemId) {
    this.items.add(itemId);
  }
  removeItem(itemId) {
    this.items.delete(itemId);
  }
  addNPC(npcId) {
    this.npcs.add(npcId);
  }
  removeNPC(npcId) {
    this.npcs.delete(npcId);
  }
  getDescription() {
    // This method could be expanded to include dynamic elements
    return this.description;
  }
}
/**************************************************************************************************
World Event System Class
***************************************************************************************************/
class WorldEventSystem {
  constructor(worldManager) {
    this.worldManager = worldManager;
    this.scheduledEvents = new Map();
    this.activeEvents = new Set();
    this.eventListeners = new Map();
  }
  scheduleWorldEvent(eventName, triggerTime, eventData) {
    this.scheduledEvents.set(eventName, { triggerTime, eventData });
  }
  cancelScheduledWorldEvent(eventName) {
    this.scheduledEvents.delete(eventName);
  }
  triggerWorldEvent(eventName, eventData) {
    this.activeEvents.add(eventName);
    this.notifyListeners(eventName, eventData);
    // Implement event-specific logic here
    this.worldManager.broadcastToAll('worldEvent', { name: eventName, data: eventData });
  }
  endWorldEvent(eventName) {
    this.activeEvents.delete(eventName);
    this.notifyListeners(`${eventName}End`, {});
    this.worldManager.broadcastToAll('worldEventEnd', { name: eventName });
  }
  addWorldEventListener(eventName, listener) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName).add(listener);
  }
  removeWorldEventListener(eventName, listener) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.delete(listener);
    }
  }
  notifyWorldEventListeners(eventName, eventData) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach(listener => listener(eventData));
    }
  }
  updateWorldEventSystem(currentTime) {
    for (const [eventName, eventInfo] of this.scheduledEvents.entries()) {
      if (currentTime >= eventInfo.triggerTime) {
        this.triggerWorldEvent(eventName, eventInfo.eventData);
        this.scheduledEvents.delete(eventName);
      }
    }
  }
}
/**************************************************************************************************
World Manager Class
***************************************************************************************************/
class WorldManager {
  constructor(gameDataManager) {
    this.gameDataManager = gameDataManager;
    this.locations = new LocationSystem(gameDataManager);
    this.time = new TimeSystem();
    this.worldEventSystem = new WorldEventSystem(this);
    this.entities = new Map();
    this.locationCoordinateManager = new LocationCoordinateManager();
    this.movementDirections = ['north', 'east', 'west', 'south', 'up', 'down'];
    this.npcManager = new NPCManager(this, gameDataManager);
    this.lastNPCMovementTime = Date.now();
  }
  initialize() {
    this.locations.initialize();
    // Initialize other systems...
  }
  getLocation(locationId) {
    // Get location by ID
  }
  moveEntity(entity, direction) {
    if (!this.movementDirections.includes(direction.toLowerCase())) {
      return { success: false, message: "Invalid direction." };
    }
    const currentLocation = this.locations.getLocation(entity.location);
    if (!currentLocation) {
      return { success: false, message: "Current location not found." };
    }
    const newLocationId = currentLocation.exits[direction.toLowerCase()];
    if (!newLocationId) {
      return { success: false, message: `You cannot go ${direction} from here.` };
    }
    const newLocation = this.locations.getLocation(newLocationId);
    if (!newLocation) {
      return { success: false, message: "Destination location not found." };
    }
    // Remove entity from current location
    currentLocation.removePlayer(entity.id);
    // Add entity to new location
    newLocation.addPlayer(entity.id);
    // Update entity's location
    entity.location = newLocationId;
    // Prepare location info for the player
    const locationInfo = this.getLocationInfo(newLocationId);
    // Notify other players in the old and new locations
    this.broadcastToLocation(currentLocation.id, 'playerLeft', { playerId: entity.id });
    this.broadcastToLocation(newLocation.id, 'playerEntered', { playerId: entity.id });
    return {
      success: true,
      message: `You move ${direction} to ${newLocation.name}.`,
      locationInfo: locationInfo
    };
  }
  updateWorld(deltaTime) {
    this.time.update(deltaTime);
    this.worldEventSystem.updateWorldEventSystem(this.time.currentTime);
    // Check if it's time to move NPCs
    const currentTime = Date.now();
    if (currentTime - this.lastNPCMovementTime >= CONFIG.NPC_MOVEMENT_INTERVAL) {
      this.npcManager.moveMobileNPCs();
      this.lastNPCMovementTime = currentTime;
    }
    // Update all entities
    for (const entity of this.entities.values()) {
      entity.update(deltaTime);
    }
  }
  getWorldState() {
    return {
      time: this.time.currentTime,
      entities: Array.from(this.entities.values()).map(entity => ({
        id: entity.id,
        name: entity.name,
        location: entity.location,
        // Add more properties as needed
      }))
    };
  }
  addEntity(entity) {
    this.entities.set(entity.id, entity);
  }
  removeEntity(entityId) {
    this.entities.delete(entityId);
  }
  broadcastToAll(eventName, data) {
    // Implement method to broadcast to all connected clients
  }
  getLocationInfo(locationId) {
    const location = this.locations.getLocation(locationId);
    if (!location) {
      return null;
    }
    return {
      id: location.id,
      name: location.name,
      description: location.description,
      exits: Object.keys(location.exits),
      items: Array.from(location.items),
      npcs: Array.from(location.npcs),
      players: Array.from(location.players),
      coordinates: this.locationCoordinateManager.getCoordinates(locationId)
    };
  }
  broadcastToPlayer(playerId, eventName, data) {
    // Implement method to send data to a specific player
  }
  broadcastToLocation(locationId, eventName, data) {
    // Implement method to broadcast to all players in a specific location
  }
  getConnectedLocations(locationId) {
    const location = this.locations.getLocation(locationId);
    if (!location) return [];
    return Object.entries(location.exits).map(([direction, targetId]) => ({
      direction,
      location: this.locations.getLocation(targetId)
    }));
  }
}
/**************************************************************************************************
Time System Class
***************************************************************************************************/
class TimeSystem {
  constructor() {
    this.currentTime = 0;
    this.dayLength = 24 * 60 * 60; // 24 hours in seconds
  }
  update(deltaTime) {
    this.currentTime += deltaTime;
    if (this.currentTime >= this.dayLength) {
      this.currentTime -= this.dayLength;
    }
  }
  isDaytime() {
    const hour = (this.currentTime / 3600) % 24;
    return hour >= 6 && hour < 18;
  }
}
/**************************************************************************************************
Entity Class
***************************************************************************************************/
class Entity {
  constructor(id, name, description) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.location = null;
  }
  update(deltaTime) {
    // Update entity state
  }
}
/**************************************************************************************************
Character Class
***************************************************************************************************/
class Character extends Entity {
  constructor(id, name, description) {
    super(id, name, description);
    this.inventory = new Inventory();
  }
  takeDamage(amount) {
    // Handle taking damage
  }
  useSkill(skillName, target) {
    // Use a skill on a target
  }
}
/**************************************************************************************************
Player Class
***************************************************************************************************/
class Player extends Character {
  constructor(id, name, description) {
    super(id, name, description);
    this.quests = new QuestLog();
  }
  gainExperience(amount) {
    // Handle gaining experience
  }
  move(direction, worldManager) {
    return worldManager.moveEntity(this, direction);
  }
}
/**************************************************************************************************
NPC Class
***************************************************************************************************/
class NPC extends Character {
  constructor(id, name, description, type, dialogueTree, inventory, questId = null, zones = []) {
    super(id, name, description);
    this.type = type;
    this.dialogueTree = new DialogueTree(dialogueTree);
    this.inventory = new Inventory(inventory);
    this.questId = questId;
    this.zones = zones;
    this.currentLocation = null;
    this.respawnTime = 0;
    this.lastInteractionTime = 0;
    this.currentDialogueNode = 'greeting';
    this.aiState = 'idle';
    this.movementPattern = null;
    this.combatAbilities = [];
  }
  interact(player) {
    this.lastInteractionTime = Date.now();
    const dialogue = this.dialogueTree.getNode(this.currentDialogueNode);
    return {
      message: dialogue.message,
      options: dialogue.options
    };
  }
  respondToPlayer(player, choice) {
    const dialogue = this.dialogueTree.getNode(this.currentDialogueNode);
    const chosenOption = dialogue.options.find(option => option.id === choice);
    if (chosenOption) {
      this.currentDialogueNode = chosenOption.next;
      return this.interact(player);
    }
    return null;
  }
  update(deltaTime, worldManager) {
    super.update(deltaTime);
    if (this.aiState === 'patrolling') {
      this.updateMovement(deltaTime, worldManager);
    } else if (this.aiState === 'combat') {
      this.updateCombat(deltaTime, worldManager);
    }
    // Reset dialogue if no interaction for a while
    if (Date.now() - this.lastInteractionTime > 300000) { // 5 minutes
      this.currentDialogueNode = 'greeting';
    }
  }
  updateMovement(deltaTime, worldManager) {
    if (this.movementPattern) {
      // Implement movement logic based on the pattern
      // For example, move to the next location in the pattern
    }
  }
  updateCombat(deltaTime, worldManager) {
    // Implement combat AI logic
    // For example, choose and use combat abilities
  }
  setMovementPattern(pattern) {
    this.movementPattern = pattern;
  }
  addCombatAbility(ability) {
    this.combatAbilities.push(ability);
  }
  die() {
    this.aiState = 'dead';
    // Drop loot, if any
    // Set respawn timer
  }
  respawn(location) {
    this.health = this.maxHealth;
    this.aiState = 'idle';
    this.location = location;
  }
  startQuest(player) {
    if (this.questId && player.quests) {
      return player.quests.startQuest(this.questId);
    }
    return false;
  }
  completeQuest(player) {
    if (this.questId && player.quests) {
      return player.quests.completeQuest(this.questId);
    }
    return false;
  }
  trade(player, itemId, quantity, isBuying) {
    if (this.type !== 'merchant') return false;
    const item = isBuying ? this.inventory.getItem(itemId) : player.inventory.getItem(itemId);
    if (!item) return false;
    const totalPrice = item.price * quantity;
    if (isBuying) {
      if (player.currency < totalPrice) return false;
      if (!this.inventory.removeItem(itemId, quantity)) return false;
      player.currency -= totalPrice;
      player.inventory.addItem(item, quantity);
    } else {
      if (!player.inventory.removeItem(itemId, quantity)) return false;
      player.currency += totalPrice;
      this.inventory.addItem(item, quantity);
    }
    return true;
  }
}
/**************************************************************************************************
Merchant Class
***************************************************************************************************/
class Merchant extends NPC {
  constructor(id, name, description, inventory) {
    super(id, name, description);
    this.inventory = inventory;
  }
  updateInventory() {
    // Refresh merchant's inventory
  }
}
/**************************************************************************************************
NPC Manager Class
***************************************************************************************************/
class NPCManager {
  constructor(worldManager, gameDataManager) {
    this.worldManager = worldManager;
    this.gameDataManager = gameDataManager;
    this.mobileNPCs = gameDataManager.getMobileNPCs();
  }
  moveMobileNPCs() {
    for (const [npcId, npc] of this.mobileNPCs) {
      if (Math.random() < 0.33) { // 33% chance to move
        this.moveNPC(npc);
      }
    }
  }
  moveNPC(npc) {
    const connectedLocations = this.worldManager.getConnectedLocations(npc.currentLocation);
    if (connectedLocations.length === 0) return;
    let validLocations = connectedLocations;
    // If the NPC has specified zones, filter locations based on those zones
    if (npc.zones && npc.zones.length > 0) {
      validLocations = connectedLocations.filter(loc =>
        loc.location.zone.some(zone => npc.zones.includes(zone))
      );
    }
    // If no valid locations after filtering, don't move
    if (validLocations.length === 0) return;
    // Choose a random valid location
    const chosenLocation = validLocations[Math.floor(Math.random() * validLocations.length)];
    // Move the NPC
    const oldLocation = this.worldManager.locations.getLocation(npc.currentLocation);
    const newLocation = chosenLocation.location;
    oldLocation.removeNPC(npc.id);
    newLocation.addNPC(npc.id);
    npc.currentLocation = newLocation.id;
    // Notify players in both locations
    this.worldManager.broadcastToLocation(oldLocation.id, 'npcLeft', { npcId: npc.id, npcName: npc.name });
    this.worldManager.broadcastToLocation(newLocation.id, 'npcEntered', { npcId: npc.id, npcName: npc.name });
    console.log(`NPC ${npc.name} moved from ${oldLocation.name} to ${newLocation.name}`);
  }
}
/**************************************************************************************************
Item Class
***************************************************************************************************/
class Item extends Entity {
  constructor(id, name, description, type) {
    super(id, name, description);
    this.type = type;
  }
  use(character) {
    // Use the item
  }
}
/**************************************************************************************************
Weapon Class
***************************************************************************************************/
class Weapon extends Item {
  constructor(id, name, description, damage) {
    super(id, name, description, 'weapon');
    this.damage = damage;
  }
  attack(attacker, target) {
    // Perform attack
  }
}
/**************************************************************************************************
Consumable Class
***************************************************************************************************/
class Consumable extends Item {
  constructor(id, name, description, effect) {
    super(id, name, description, 'consumable');
    this.effect = effect;
  }
  consume(character) {
    // Apply consumable effect
  }
}
/**************************************************************************************************
Skill System Class
***************************************************************************************************/
class SkillSystem {
  constructor() {
    this.skills = new Map();
  }
  registerSkill(skill) {
    // Register a new skill
  }
  useSkill(character, skillName, target) {
    // Use a skill
  }
  updateCooldowns(deltaTime) {
    // Update skill cooldowns
  }
}
/**************************************************************************************************
Skill Class
***************************************************************************************************/
class Skill {
  constructor(name, effect, cooldown) {
    this.name = name;
    this.effect = effect;
    this.cooldown = cooldown;
    this.currentCooldown = 0;
  }
  use(character, target) {
    // Use the skill
  }
  updateCooldown(deltaTime) {
    // Update the skill's cooldown
  }
}
/**************************************************************************************************
Quest System Class
***************************************************************************************************/
class QuestSystem {
  constructor() {
    this.quests = new Map();
  }
  registerQuest(quest) {
    // Register a new quest
  }
  assignQuest(player, questId) {
    // Assign a quest to a player
  }
  updateQuestProgress(player, action, target) {
    // Update quest progress based on player actions
  }
  completeQuest(player, questId) {
    // Complete a quest and give rewards
  }
}
/**************************************************************************************************
Quest Class
***************************************************************************************************/
class Quest {
  constructor(id, name, description, objectives, rewards) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.objectives = objectives;
    this.rewards = rewards;
  }
  checkCompletion(progress) {
    // Check if all objectives are completed
  }
}
/**************************************************************************************************
Economic System Class
***************************************************************************************************/
class EconomicSystem {
  constructor() {
    this.merchants = new Map();
  }
  registerMerchant(merchant) {
    // Register a new merchant
  }
  buyItem(player, merchantId, itemId) {
    // Handle player buying an item from a merchant
  }
  sellItem(player, merchantId, itemId) {
    // Handle player selling an item to a merchant
  }
  updatePrices() {
    // Update item prices based on supply and demand
  }
}
/**************************************************************************************************
Chat Channel Class
***************************************************************************************************/
class ChatChannel {
  constructor(name, isPrivate) {
    this.name = name;
    this.isPrivate = isPrivate;
    this.members = new Set();
  }
  addMember(player) {
    // Add a player to the channel
  }
  removeMember(player) {
    // Remove a player from the channel
  }
  broadcast(message, sender) {
    // Broadcast a message to all channel members
  }
}
/**************************************************************************************************
Chat System Class
***************************************************************************************************/
class ChatSystem {
  constructor() {
    this.channels = new Map();
  }
  createChannel(name, isPrivate = false) {
    // Create a new chat channel
  }
  joinChannel(player, channelName) {
    // Add player to a channel
  }
  leaveChannel(player, channelName) {
    // Remove player from a channel
  }
  sendMessage(player, channelName, message) {
    // Send a message to a channel
  }
  sendPrivateMessage(sender, recipient, message) {
    // Send a private message
  }
}
/**************************************************************************************************
Emote System Class
***************************************************************************************************/
class EmoteSystem {
  constructor() {
    this.predefinedEmotes = new Map();
  }
  registerEmote(name, template) {
    // Register a predefined emote
  }
  useEmote(player, emoteName, target = null) {
    // Use a predefined emote
  }
  useCustomEmote(player, emoteText) {
    // Use a custom emote
  }
}
/**************************************************************************************************
Command Parser Class
***************************************************************************************************/
class CommandParser {
  constructor() {
    this.commands = new Map();
  }
  registerCommand(command) {
    // Register a new command
  }
  parse(input) {
    // Parse user input into command and arguments
  }
  sanitizeInput(input) {
    // Sanitize user input
  }
}
/**************************************************************************************************
Command Class
***************************************************************************************************/
class Command {
  constructor(name, handler, minArgs, maxArgs) {
    this.name = name;
    this.handler = handler;
    this.minArgs = minArgs;
    this.maxArgs = maxArgs;
  }
  execute(player, args) {
    // Execute the command
  }
}
/**************************************************************************************************
Game State Manager Class
***************************************************************************************************/
class GameStateManager {
  constructor(worldManager, playerManager) {
    this.worldManager = worldManager;
    this.playerManager = playerManager;
  }
  handleLogin(username, password) {
    // Handle player login
  }
  handleLogout(player) {
    // Handle player logout
  }
  createCharacter(playerData) {
    // Create a new character for a player
  }
  saveGameState() {
    // Save the current game state
  }
  loadGameState() {
    // Load the game state from storage
  }
}
/**************************************************************************************************
Script Engine Class
***************************************************************************************************/
class ScriptEngine {
  constructor(worldManager) {
    this.worldManager = worldManager;
    this.scripts = new Map();
  }
  loadScript(name, code) {
    // Load and compile a script
  }
  executeScript(name, context) {
    // Execute a loaded script
  }
  provideAPI(name, func) {
    // Provide an API function to scripts
  }
}
/**************************************************************************************************
Admin Tools Class
***************************************************************************************************/
class AdminTools {
  constructor(server) {
    this.server = server;
  }
  kickPlayer(adminPlayer, targetPlayer) {
    // Kick a player from the server
  }
  banPlayer(adminPlayer, targetPlayer, reason, duration) {
    // Ban a player from the server
  }
  teleportPlayer(adminPlayer, targetPlayer, locationId) {
    // Teleport a player to a specific location
  }
  giveItem(adminPlayer, targetPlayer, itemId, quantity) {
    // Give an item to a player
  }
  editWorldObject(adminPlayer, objectId, properties) {
    // Edit properties of a world object
  }
}
/**************************************************************************************************
Monitoring System Class
***************************************************************************************************/
class MonitoringSystem {
  constructor() {
    this.metrics = new Map();
    this.logs = [];
  }
  recordMetric(name, value) {
    // Record a performance metric
  }
  logPlayerActivity(player, activity) {
    // Log player activity
  }
  logError(error) {
    // Log an error
  }
  generateReport() {
    // Generate a monitoring report
  }
}
/**************************************************************************************************
Authentication System Class
***************************************************************************************************/
class AuthenticationSystem {
  constructor(database) {
    this.database = database;
  }
  async registerUser(username, password) {
    // Register a new user
  }
  async authenticateUser(username, password) {
    // Authenticate a user
  }
  hashPassword(password) {
    // Hash a password
  }
  generateToken(userId) {
    // Generate an authentication token
  }
  verifyToken(token) {
    // Verify an authentication token
  }
}
/**************************************************************************************************
AntiCheat System Class
***************************************************************************************************/
class AntiCheatSystem {
  constructor() {
    this.suspiciousActivities = new Map();
  }
  validateAction(player, action, data) {
    // Validate a player action
  }
  detectSpeedHack(player, movementData) {
    // Detect potential speed hacking
  }
  detectImpossibleActions(player, action) {
    // Detect actions that should be impossible
  }
  applyRateLimit(player, action) {
    // Apply rate limiting to player actions
  }
  reportSuspiciousActivity(player, reason) {
    // Report suspicious activity for review
  }
}
/**************************************************************************************************
Cache Manager Class
***************************************************************************************************/
class CacheManager {
  constructor() {
    this.cache = new Map();
  }
  set(key, value, ttl) {
    // Set a value in the cache with a time-to-live
  }
  get(key) {
    // Get a value from the cache
  }
  invalidate(key) {
    // Invalidate a cache entry
  }
  clear() {
    // Clear the entire cache
  }
}
/**************************************************************************************************
Message Protocol Class
***************************************************************************************************/
class MessageProtocol {
  static encode(message) {
    // Encode a message for transmission
  }
  static decode(data) {
    // Decode a received message
  }
  static createMessage(type, payload) {
    // Create a standardized message object
  }
}
/**************************************************************************************************
Location Coordinate Manager Class
***************************************************************************************************/
class LocationCoordinateManager {
  constructor() {
    this.coordinates = new Map();
  }
  initialize(locationData) {
    // Initialize coordinates for all locations
    // This method should be called when loading game data
  }
  getCoordinates(locationId) {
    return this.coordinates.get(locationId) || null;
  }
}
/**************************************************************************************************
Start Server Code
***************************************************************************************************/
const server = new CoreServerSystem(CONFIG);
server.initialize().then(() => {
  server.start();
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});