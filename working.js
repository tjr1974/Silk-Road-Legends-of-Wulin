// Server *****************************************************************************************
/*
 * The Server class is the main entry point for the game server. It is responsible for initializing
 * the server environment, setting up middleware, and managing the game loop.
 */
class Server {
  constructor() {
    this.moduleImporter = new ModuleImporter(this); // Initialize ModuleImporter
    this.serverSetup = new ServerSetup(this); // Initialize ServerSetup
    this.socketEventManager = new SocketEventManager(this); // Initialize SocketEventManager
    this.gameComponentInitializer = new GameComponentInitializer(this); // Initialize GameComponentInitializer
  }
  async init() { // New init method
    try {
      await this.moduleImporter.importModules(); // Ensure modules are initialized first
      await this.serverSetup.setupServer(); // Call to setup the server
      await this.gameComponentInitializer.initializeGameComponents(); // Call to initialize game components
      this.startGameLoop(); // Start the game loop
    } catch (error) {
      console.error(`Error during server initialization: ${error.message}`); // Log initialization error
    }
  }
  startGameLoop() { // New method to start the game loop
    // Logic to start the game loop (e.g., setInterval for game updates)
  }
}
// Socket Event Manager **************************************************************************
/*
 * The SocketEventManager class handles socket events for real-time communication between the server
 * and connected clients. It manages user connections and disconnections.
 */
class SocketEventManager {
  constructor(server) {
    this.server = server; // Reference to the server instance
  }
  setupSocketEvents() { // Moved from Server
    this.server.io.on('connection', (socket) => {
      console.log('A user connected:', socket.id); // Log connection
      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id); // Log disconnection
      });
    });
  }
}
// Module Importer ********************************************************************************
/*
 * The ModuleImporter class is responsible for importing necessary modules and dependencies for the
 * server to function. It ensures that all required modules are loaded before the server starts.
 */
class ModuleImporter {
  constructor(server) {
    this.server = server; // Reference to the server instance
  }
  async importModules() { // Moved from Server
    try {
      console.log(`\nSTARTING MODULE IMPORTS:`); // Improved message
      console.log(`  - Importing Config Module...`);
      this.server.CONFIG = await import('./config.js'); // Await the import
      console.log(`  - Config module imported successfully.`); // Improved message
      console.log(`  - Importing File System Module...`);
      this.server.fs = await import('fs').then(module => module.promises); // Await the import
      console.log(`  - File System module imported successfully.`); // Improved message
      console.log(`  - Importing Express Module...`);
      this.server.express = (await import('express')).default; // Assign default or named export
      console.log(`  - Express module imported successfully.`); // Improved message
      console.log(`  - Importing Socket.IO Module...`);
      this.server.SocketIOServer = (await import('socket.io')).Server; // Assign to instance variable
      console.log(`  - Socket.IO module imported successfully.`); // Improved message
      console.log(`  - Importing Queue Module...`);
      this.server.queue = new (await import('queue')).default(); // Await the import and instantiate the Queue class
      console.log(`  - Queue module imported successfully.`); // Improved message
      console.log(`MODULE IMPORTS COMPLETED SUCCESSFULLY.`); // Improved message
    } catch (error) {
      console.error(`Error during module imports: ${error.message}!!!`); // Log error message
    }
  }
}
// Server Setup ***********************************************************************************
/*
 * The ServerSetup class is responsible for configuring the server environment, including setting up
 * the Express application, initializing the Socket.IO server, and managing middleware.
 */
class ServerSetup {
  constructor(server) {
    this.server = server; // Reference to the server instance
  }
  async setupServer() { // Moved from Server
    console.log(`\nSTARTING SERVER SETUP:`); // Improved message
    try {
      console.log(`  - Starting Express...`);
      await this.setupExpress();
      if (!this.server.app) throw new Error('Start Express unsuccessful!!!');
      console.log(`  - Start Express completed successfully.`); // Improved message
      console.log(`  - Starting Server...`);
      await this.createServer(); // Await server creation to ensure it completes
      if (!this.server.server) throw new Error('Start Server unsuccessful!!!');
      console.log(`  - Server started successfully.`); // Improved message
      console.log(`  - Starting Socket.IO...`);
      this.server.io = new this.server.SocketIOServer(this.server.server); // Initialize Socket.IO server
      if (!this.server.io) throw new Error('Start Socket.IO unsuccessful!!!');
      console.log(`  - Socket.IO started successfully.`); // Improved message
      console.log(`  - Starting Socket Events...`);
      this.server.socketEventManager.setupSocketEvents(); // Set up socket events
      if (!this.server.socketEventManager) throw new Error('Start Socket Events unsuccessful!!!');
      console.log(`  - Socket Events started successfully.`); // Improved message
      console.log(`  - Starting Queue Manager...`);
      this.server.queueManager = new QueueManager(); // Ensure QueueManager is initialized correctly
      if (!this.server.queueManager) throw new Error('Start queue manager unsuccessful!!!');
      console.log(`  - Queue Manager started successfully.`); // Improved message
      console.log(`SERVER SETUP COMPLETED SUCCESSFULLY.`); // Improved message
    } catch (error) {
      console.error(`Error during server setup: ${error.message}`); // Log error message
    }
  }
  async createServer() { // Moved from Server
    const { MAGENTA, RESET } = await import('./config.js'); // Import constants from config file
    const sslOptions = { key: null, cert: null };
    try {
      sslOptions.key = await this.server.fs.readFile(this.server.CONFIG.SSL_KEY_PATH); // Use SSL_KEY_PATH from config
    } catch (error) {
      console.log(`    - ${MAGENTA}WARNING: Read SSL key: ${error.message}...${RESET}`);
    }
    try {
      sslOptions.cert = await this.server.fs.readFile(this.server.CONFIG.SSL_CERT_PATH); // Use SSL_CERT_PATH from config
    } catch (error) {
      console.log(`    - ${MAGENTA}WARNING: Read SSL cert: ${error.message}...${RESET}`);
    }
    const isHttps = sslOptions.key && sslOptions.cert; // Determine server type
    const http = isHttps ? await import('https') : await import('http');
    this.server.server = http.createServer(isHttps ? { key: sslOptions.key, cert: sslOptions.cert } : this.server.app);
    console.log(`    - Server created using ${isHttps ? 'HTTPS' : 'HTTP'}.`); // Log server type
    console.log(`    - Starting server on ${isHttps ? 'HTTPS' : 'HTTP'}//${this.server.CONFIG.HOST}:${this.server.CONFIG.PORT}...`); // Improved message
    return this.server.server;
  }
  async setupExpress() { // Moved from Server
    this.server.app = this.server.express(); // Initialize the express app
    this.server.app.use(this.server.express.static('public')); // Use express to serve static files
    this.server.app.use((err, req, res, next) => { // Error handling middleware
      console.error(err.stack); // Log the error stack
      res.status(500).send('Something broke!'); // Send a 500 response
    });
  }
}
// Game Component Initializer ********************************************************************
/*
 * The GameComponentInitializer class is responsible for initializing various game components,
 * such as the database manager and game data loader, ensuring that all necessary components are
 * ready before the game starts.
 */
class GameComponentInitializer {
  constructor(server) {
    this.server = server; // Reference to the server instance
  }
  async initializeGameComponents() { // Moved from Server
    console.log(`\nSTARTING GAME COMPONENTS:`); // Improved message
    try {
      console.log(`  - Starting Database Manager...`);
      this.server.databaseManager = new DatabaseManager(); // Initialize DatabaseManager correctly
      if (!this.server.databaseManager) throw new Error('Start database manager unsuccessful!!!');
      console.log(`  - Database Manager started successfully.`); // Improved message
      console.log(`  - Starting Game Manager...`); // Updated to remove redundant Game Component Initializer
      this.server.gameManager = new GameManager(); // Initialize GameManager directly
      if (!this.server.gameManager) throw new Error('Start game manager unsuccessful!!!');
      console.log(`  - Game Manager started successfully.`); // Improved message
      console.log(`  - Loading Game Data...`);
      if (!this.server.databaseManager.gameDataLoader) throw new Error('GameDataLoader is not initialized!');
      await this.server.databaseManager.loadData(); // Ensure game data loads before proceeding
      if (!this.server.gameData) throw new Error('Load game data unsuccessful!!!');
      console.log(`  - Game Data loaded successfully.`); // Improved message
    } catch (error) {
      console.error(`Error during game component initialization: ${error.message}`); // Log error message
    }
    console.log(`STARTING GAME COMPONENTS COMPLETED SUCCESSFULLY...`);
  }
}
// Method Call to Start an instance of Server
const server = new Server();
server.init(); // Call the init method to complete initialization
// Object Pool ************************************************************************************
/*
 * The ObjectPool class manages a pool of reusable objects to optimize memory usage and performance
 * by reducing the overhead of object creation and garbage collection.
 */
class ObjectPool {
  constructor(createFunc, size) {
    this.createFunc = createFunc; // Function to create new objects
    this.pool = Array.from({ length: size }, this.createFunc); // Preallocate objects in the pool
    this.available = []; // Array to track available objects for reuse
  }
  acquire() {
    return this.available.length > 0 ? this.available.pop() : this.pool.pop(); // Acquire an object from the pool
  }
  release(object) {
    this.available.push(object); // Release an object back to the pool
  }
}
// Task Class ************************************************************************************
/*
 * The Task class represents a unit of work that can be executed. It encapsulates the task's name
 * and execution logic, allowing for flexible task management.
*/
class Task {
  constructor(name) {
    this.name = name; // Name of the task
    this.execute = null; // Placeholder for the task execution function
  }
  run() { // Method to execute the task
    if (this.execute) this.execute(); // Execute the assigned function
  }
}
// Queue Manager *********************************************************************************
/*
 * The QueueManager class manages a queue of tasks to be executed. It handles task addition,
 * processing, and execution, ensuring that tasks are run in a controlled manner.
*/
class QueueManager {
  constructor() {
    this.queue = []; // Array to hold tasks in the queue
    this.isProcessing = false; // Track if the queue is currently processing
    this.taskPool = new ObjectPool(() => new Task(''), 10); // Object pool for task management
  }
  addTask(task) {
    console.log(`Adding task: ${task.name}`); // Log task addition
    this.queue.push(task); // Add task to the queue
    this.processQueue(); // Start processing the queue when a new task is added
  }
  processQueue() {
    if (this.isProcessing) return; // Prevent re-entrance
    this.isProcessing = true; // Mark as processing
    while (this.queue.length > 0) {
      const task = this.queue.shift(); // Get the next task
      try {
        task.run(); // Call the run method to execute the task
      } catch (error) {
        console.error(`Error processing task: ${error.message}`); // Log error
      }
    }
    this.isProcessing = false; // Mark as not processing
  }
  executeTask(task) {
    return new Promise(resolve => setTimeout(resolve, 1000)); // Resolve the promise after a delay
  }
  // Methods to add tasks
  addDataLoadTask(filePath, key) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Data Load Task'; // Set task name
    task.execute = () => {
      const data = this.databaseManager.loadData(filePath, key); // Load data using the database manager
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addDataSaveTask(filePath, key, data) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Data Save Task'; // Set task name
    task.execute = () => {
      this.databaseManager.saveData(filePath, key, data); // Save data using the database manager
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addCombatActionTask(player, target) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Combat Action Task'; // Set task name
    task.execute = () => {
      player.attackNpc(target); // Execute combat action
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addEventProcessingTask(event) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Event Processing Task'; // Set task name
    task.execute = () => {
      // Process the event (e.g., day/night transition)
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addHealthRegenerationTask(player) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Health Regeneration Task'; // Set task name
    task.execute = () => {
      player.startHealthRegeneration(); // Start health regeneration for the player
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addInventoryManagementTask(player, action, item) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Inventory Management Task'; // Set task name
    task.execute = () => {
      action === 'pickup' ? player.addToInventory(item) : player.removeFromInventory(item); // Add or remove item
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  addNotificationTask(player, message) {
    const task = this.taskPool.acquire(); // Acquire a task from the pool
    task.name = 'Notification Task'; // Set task name
    task.execute = () => {
      MessageManager.notify(player, message); // Send notification to the player
      this.taskPool.release(task); // Release the task back to the pool
    };
    this.addTask(task); // Add the task to the queue
  }
  cleanup() { // New cleanup method
    this.queue = []; // Clear the queue
    this.isProcessing = false; // Reset processing state
    this.taskPool = null; // Clear task pool reference
  }
}
// Database Manager ******************************************************************************
/*
 * The DatabaseManager class is responsible for managing the game's data storage and retrieval,
 * ensuring that all data is saved and loaded correctly.
*/
class DatabaseManager {
  constructor() {
    this.fs = import('fs').promises; // Use promises API for file system operations
    this.gameDataLoader = new GameDataLoader(this); // Initialize GameDataLoader
  }
  async loadData() {
    try {
      console.log(`Loading data...`); // Log data loading
      return await this.gameDataLoader.loadGameData(); // Call loadGameData on gameDataLoader
    } catch (error) {
      console.error(`Error loading data: ${error.message}`); // Log any errors during loading
      throw error; // Rethrow the error for further handling
    }
  }
  async saveData(filePath, key, data) { // Updated to handle batch saving
    try {
      const existingData = await this.loadData([filePath]); // Await loading existing data
      existingData[filePath][key] = data; // Update the specific key with new data
      await this.fs.writeFile(filePath, JSON.stringify(existingData[filePath], null, 2)); // Await saving updated data
      console.log(`Data saved for ${key} to ${filePath}`); // Log successful save
    } catch (error) {
      console.error(`Error saving data for ${key} to ${filePath}: ${error.message}`); // Improved error message
      DatabaseManager.notifyDataSaveError(this, filePath, error); // Notify error if saving fails
    }
  }
  async loadPlayerData() {
    try {
      return await this.loadData(this.CONFIG.FILE_PATHS.PLAYER_DATA); // Use the path from config.js
    } catch (error) {
      console.error(`Error loading player data: ${error.message}`); // Improved error message
    }
  }
  async savePlayerData(playerData) { await this.saveData(this.CONFIG.FILE_PATHS.PLAYER_DATA, playerData.username, playerData); } // Save player data
  async loadLocationData() {
    try {
      const locationFiles = await this.getFilesInDirectory(this.CONFIG.FILE_PATHS.LOCATION_DATA); // Get all files in the location directory
      const locations = [];
      for (const file of locationFiles) {
        const data = await this.fs.readFile(file, 'utf-8'); // Read each file
        locations.push(JSON.parse(data)); // Parse and add to locations array
      }
      return locations; // Return all loaded locations
    } catch (error) {
      console.error(`Error loading location data: ${error.message}`); // Improved error message
    }
  }
  async saveLocationData(locationData) { await this.saveData(this.CONFIG.FILE_PATHS.LOCATION_DATA, locationData.id, locationData); } // Save location data
  async loadNpcData() {
    try {
      const npcFiles = await this.getFilesInDirectory(this.CONFIG.FILE_PATHS.NPC_DATA); // Get all files in the NPC directory
      const npcs = [];
      for (const file of npcFiles) {
        const data = await this.fs.readFile(file, 'utf-8'); // Read each file
        npcs.push(JSON.parse(data)); // Parse and add to NPCs array
      }
      return npcs; // Return all loaded NPCs
    } catch (error) {
      console.error(`Error loading NPC data: ${error.message}`); // Improved error message
    }
  }
  async saveNpcData(npcData) { await this.saveData(this.CONFIG.FILE_PATHS.NPC_DATA, npcData.id, npcData); } // Save NPC data
  async loadItemData() {
    try {
      const itemFiles = await this.getFilesInDirectory(this.CONFIG.FILE_PATHS.ITEM_DATA); // Get all files in the item directory
      const items = [];
      for (const file of itemFiles) {
        const data = await this.fs.readFile(file, 'utf-8'); // Read each file
        items.push(JSON.parse(data)); // Parse and add to items array
      }
      return items; // Return all loaded items
    } catch (error) {
      console.error(`Error loading item data: ${error.message}`); // Improved error message
    }
  }
  async saveItemData(itemData) { await this.saveData(this.CONFIG.FILE_PATHS.ITEM_DATA, itemData.id, itemData); } // Save item data

  async getFilesInDirectory(directoryPath) {
    const files = await this.fs.readdir(directoryPath); // Read directory contents
    return files.map(file => `${directoryPath}/${file}`); // Return full paths of files
  }
}
// Game Data Loader ******************************************************************************
/*
 * The GameDataLoader class is responsible for loading game data from various sources, ensuring
 * that all necessary data is available for the game to function correctly.
*/
class GameDataLoader {
  constructor(server) {
    this.server = server; // Reference to the server instance
  }
  async loadGameData() { // Moved from Server
    console.log(`\nStarting game data loading...`); // Improved message
    const DATA_TYPES = { LOCATION: 'location', NPC: 'npc', ITEM: 'item' }; // Constants for data types
    const loadData = async (loadFunction, type) => {
      try {
        const data = await loadFunction();
        console.log(`${type} data loaded successfully.`); // Improved message
        return { type, data }; // Return loaded data
      } catch (error) {
        console.error(`Error loading ${type} data: ${error.message}`); // Improved error message
        return { type, error }; // Return error
      }
    };
    const results = await Promise.allSettled([
      loadData(this.server.databaseManager.loadLocationData.bind(this.server.databaseManager), DATA_TYPES.LOCATION),
      loadData(this.server.databaseManager.loadNpcData.bind(this.server.databaseManager), DATA_TYPES.NPC),
      loadData(this.server.databaseManager.loadItemData.bind(this.server.databaseManager), DATA_TYPES.ITEM),
    ]);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to load data at index ${index}: ${result.reason.message}`); // Improved error message
      }
    });
    console.log(`Finished loading game data.`); // Improved message
    return results.map(result => result.value).filter(value => value && !value.error); // Return all successfully loaded data
  }
}
// Game Manager ***********************************************************************************
/*
 * The GameManager class is responsible for managing the overall game state, including player
 * interactions, NPC management, game time, and event handling.
*/
class GameManager {
  #gameLoopInterval = null; // Declare the private field for game loop interval
  #gameTime = 0; // Declare the private field for game time
  #isRunning = false; // Add this line to declare the private field for game state
  #combatManager; // Private field for combat manager instance
  constructor() {
    this.players = new Map(); // Map to store players
    this.locations = new Map(); // Map to store locations
    this.npcs = new Map(); // Map to store NPCs
    this.#combatManager = new CombatManager(this); // Initialize combat manager
    this.eventEmitter = new EventEmitter(); // Initialize event emitter for handling events
  }
  getGameTime() {
    return this.#gameTime; // Return current game time
  }
  setGameTime(newTime) {
    this.#gameTime = newTime; // Set new game time
  }
  startGame() {
    try {
      this.startGameLoop(); // Call the public method to start the game loop
      this.#isRunning = true; // Mark game as running
    } catch (error) {
      console.log(`Error Start game: ${error}`); // Log error
    }
  }
  shutdownGame() {
    try {
      this.stopGameLoop(); // Call the public method to stop the game loop
      for (const player of this.players.values()) {
        player.save(); // Save each player's state
      }
      MessageManager.notifyGameShutdownSuccess(this); // Notify successful game shutdown
    } catch (error) {
      console.log(`Error shutting down game: ${error}`); // Notify error during shutdown
      MessageManager.notifyError(this, `Error shutting down game: ${error}`); // Notify error during shutdown
      throw error; // Rethrow error
    }
  }
  addPlayer(player) {
    this.players.set(player.getId(), player); // Efficient insertion of player
  }
  getPlayer(playerId) {
    return this.players.get(playerId); // Efficient lookup of player
  }
  removePlayer(playerId) {
    this.players.delete(playerId); // Efficient removal of player
  }
  addLocation(location) {
    this.locations.set(location.getId(), location); // Efficient insertion of location
  }
  getLocation(locationId) {
    return this.locations.get(locationId); // Efficient lookup of location
  }
  addNpc(npc) {
    this.npcs.set(npc.getId(), npc); // Efficient insertion of NPC
  }
  getNpc(npcId) {
    return this.npcs.get(npcId); // Efficient lookup of NPC
  }
  removeNpc(npcId) {
    this.npcs.delete(npcId); // Efficient removal of NPC
  }
  startGameLoop() { // Public method to start the game loop
    this.startGameLoopInternal(); // Calls a public method to start the internal loop
  }
  stopGameLoop() { // Public method to stop the game loop
    this.stopGameLoopInternal(); // Calls a public method to stop the internal loop
  }
  incrementGameTime() { // Public method to increment game time
    this.incrementGameTimeInternal(); // Calls a public method to increment the internal game time
  }
  getCurrentGameTime() { // Public method to get current game time
    return this.getGameTime(); // Calls the public getter for game time
  }
  startGameLoopInternal() { this._startGameLoop(); } // New public method to start the internal game loop
  stopGameLoopInternal() { this._stopGameLoop(); } // New public method to stop the internal game loop
  incrementGameTimeInternal() { this._updateGameTime(); } // New public method to update the internal game time
  _startGameLoop() {
    this.#gameLoopInterval = setInterval(() => this._gameTick(), TICK_RATE); // Start the game loop at defined tick rate
  }
  _stopGameLoop() {
    if (this.#gameLoopInterval) {
      clearInterval(this.#gameLoopInterval); // Clear the game loop interval
      this.#gameLoopInterval = null; // Reset interval reference
    }
  }
  _gameTick() {
    this._updateNpcs(); // Update NPC states
    this._updatePlayerAffects(); // Update player status effects
    this._updateWorldEvents(); // Handle world events
    this.eventEmitter.emit("tick", this.#gameTime); // Emit tick event
  }
  _updateGameTime() {
    this.setGameTime(this.getGameTime() + 1); // Increment game time
    if (this.getGameTime() >= 1440) {
      this.setGameTime(0); // Reset game time
      this.eventEmitter.emit("newDay"); // Emit new day event
    }
  }
  _updateNpcs() {
    for (const npc of this.npcs.values()) {
      if (npc.hasChangedState()) { // Check if NPC state has changed
        npc.update(this.#gameTime); // Update NPC state
      }
    }
  }
  _updatePlayerAffects() {
    for (const player of this.players.values()) {
      if (player.hasChangedState()) { // Check if player state has changed
        player.updateAffects(); // Update player status effects
      }
    }
  }
  _updateWorldEvents() {
    if (this.#gameTime % 60 === 0) this._hourlyUpdate(); // Call the method to handle hourly updates
    if (this.#gameTime === 360 || this.#gameTime === 1080) this._dailyUpdate(); // Call the method to handle daily updates
  }
  _hourlyUpdate() {
    this._regenerateResourceNodes(); // Regenerate resources in the game world
  }
  _dailyUpdate() {
    this._updateNpcSchedules(); // Update the schedules of all NPCs in the game
  }
  _updateNpcSchedules() {
    for (const npc of this.npcs.values()) {
      npc.updateSchedule(this.#gameTime); // Call the updateSchedule method for each NPC
    }
  }
  disconnectPlayer(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) {
      console.log.warn(`Player with ID ${playerId} not found.`); // Log warning for player not found
      return; // Early return if player not found
    }
    player.status = "disconnected";
    player.save();
    this.removePlayer(playerId);
    MessageManager.notifyPlayersInLocation(player.currentLocation, `${player.getName()} has disconnected from the game.`);
  }
  getGameTime() {
    const hours = Math.floor(this.#gameTime / 60); // Convert total minutes to hours
    const minutes = this.#gameTime % 60; // Get the remaining minutes
    return { hours, minutes }; // Return an object containing hours and minutes
  }
  autoLootNpc(npc, player) {
    if (!npc.inventory || npc.inventory.length === 0) return null; // No items to loot
    const lootedItems = [...npc.inventory]; // Clone NPC's inventory
    player.inventory.push(...lootedItems.map(itemId => items[itemId])); // Add looted items to player's inventory
    npc.inventory = []; // Clear NPC's inventory after looting
    return MessageManager.createAutoLootMessage(player, npc, lootedItems); // Create and return auto loot message
  }
  findEntity(target, collection) {
    return collection.find(entity => entity.name.toLowerCase() === target.toLowerCase()) || null; // Find entity by name in the collection
  }
  fullStateSync(player) {
    return { // Return player state
      uid: player.getId(),
      name: player.getName(),
      health: player.getHealth(),
      status: player.getStatus(),
      inventory: player.inventory,
      currentLocation: player.currentLocation,
      experience: player.experience,
      level: player.level,
      skills: player.skills,
    };
  }
  checkLevelUp(player) {
    const LEVEL_UP_XP = this.CONFIG.LEVEL_UP_XP; // Use LEVEL_UP_XP from config
    if (player.experience < LEVEL_UP_XP) return; // Early return if not enough experience
    player.level += 1; // Increment player's level
    player.experience -= LEVEL_UP_XP; // Deduct experience points for leveling up
    console.log(`${player.getName()} leveled up to level ${player.level}!`); // Log level up
    return `Congratulations! You have reached level ${player.level}.`; // Return level up message
  }
  moveEntity(entity, newLocationId) { // New method to handle movement
    const oldLocationId = entity.currentLocation; // Store old location ID
    const oldLocation = this.getLocation(oldLocationId); // Get old location
    const newLocation = this.getLocation(newLocationId); // Get new location
    if (oldLocation) {
      MessageManager.notifyLeavingLocation(entity, oldLocationId, newLocationId); // Notify leaving old location
      const direction = Utility.getDirectionTo(newLocationId); // Get direction to new location
      MessageManager.notify(entity, `${entity.getName()} travels ${direction}.`); // Notify entity of movement
    }
    entity.currentLocation = newLocationId; // Update entity's current location
    if (newLocation) {
      newLocation.addEntity(entity, "players"); // Add entity to new location
      MessageManager.notifyEnteringLocation(entity, newLocationId); // Notify entering new location
      const direction = Utility.getDirectionFrom(oldLocationId); // Get direction from old location
      MessageManager.notify(entity, `${entity.getName()} arrives ${direction}.`); // Notify entity of arrival
    }
  }
}
// EventEmitter ***********************************************************************************
/*
 * The EventEmitter class provides a mechanism for managing and emitting events within the game,
 * allowing different components to communicate and respond to specific actions or changes.
*/
class EventEmitter {
  constructor() {
    this.events = {}; // Object to store event listeners
  }
  on(event, listener) {
    if (!this.events[event]) this.events[event] = []; // Initialize event array if it doesn't exist
    this.events[event].push(listener); // Add listener to the event
  }
  emit(event, ...args) {
    if (this.events[event]) this.events[event].forEach(listener => listener(...args)); // Call each listener with arguments
  }
  off(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener); // Remove listener from the event
    }
  }
}