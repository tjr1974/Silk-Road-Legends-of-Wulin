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
      await this.socketEventManager.setupSocketEvents(); // Ensure socket events are set up
      await this.gameComponentInitializer.initializeGameComponents(); // Call to initialize game components
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
      this.server.databaseManager = new DatabaseManager(this.server); // Pass server instance
      if (!this.server.databaseManager) throw new Error('DatabaseManager initialization failed!!!'); // Check initialization
      console.log(`  - Database Manager started successfully.`); // Improved message
      console.log(`  - Loading Game Data...`);
      this.server.gameDataLoader = new GameDataLoader(this.server); // Initialize GameDataLoader
      if (!this.server.gameDataLoader) throw new Error('GameDataLoader is not initialized!');
      console.log(`  - Game Data loaded successfully.`); // Improved message
      console.log(`  - Starting Game Manager...`); // Updated to remove redundant Game Component Initializer
      this.server.gameManager = new GameManager(); // Initialize GameManager directly
      if (!this.server.gameManager) throw new Error('GameManager initialization failed!!!');
      console.log(`  - Game Manager started successfully.`); // Improved message
    } catch (error) {
      console.error(`Error during game component initialization: ${error.message} - ${error.stack}`); // Log error message with stack trace
    }
    console.log(`STARTING GAME COMPONENTS COMPLETED SUCCESSFULLY...`);
  }
}
// Method Call to Start an instance of Server
const serverInstance = new Server(); // Renamed variable to avoid multiple declarations
serverInstance.init(); // Call the init method to complete initialization
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
  constructor(server) { // Pass server instance
    this.server = server; // Store server reference
    this.fs = null; // Initialize fs as null
    this.initialize(); // Call the async initialization method
  }
  async initialize() { // New async method for initialization
    this.fs = await import('fs').then(module => module.promises); // Use import instead of require
    this.DATA_PATHS = { // Encapsulated DATA_PATHS
      LOCATIONS: this.server.CONFIG.LOCATION_DATA_PATH,
      NPCS: this.server.CONFIG.NPC_DATA_PATH,
      ITEMS: this.server.CONFIG.ITEM_DATA_PATH,
    };
  }
  async loadData() {
    try {
      console.log(`Loading data...`);
      return await this.gameDataLoader.loadGameData();
    } catch (error) {
      console.error(`Error loading data: ${error.message}`);
      throw error;
    }
  }
  async loadLocationData() {
    try {
      const data = await this.fs.readFile(this.DATA_PATHS.LOCATIONS, 'utf-8'); // Use encapsulated constant
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading location data: ${error.message}`);
      throw error;
    }
  }
  async loadNpcData() { // Added method to load NPC data
    try {
      const data = await this.fs.readFile(this.DATA_PATHS.NPCS, 'utf-8'); // Use encapsulated constant
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading NPC data: ${error.message}`);
      throw error;
    }
  }
  async loadItemData() { // Added method to load item data
    try {
      const data = await this.fs.readFile(this.DATA_PATHS.ITEMS, 'utf-8'); // Use encapsulated constant
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading item data: ${error.message}`);
      throw error;
    }
  }
  async saveData(filePath, key, data) {
    try {
      const existingData = await this.fs.readFile(filePath, 'utf-8'); // Read existing data
      const parsedData = JSON.parse(existingData); // Parse existing data
      parsedData[key] = data; // Update the data
      await this.fs.writeFile(filePath, JSON.stringify(parsedData, null, 2)); // Write updated data
      console.log(`Data saved for ${key} to ${filePath}`);
    } catch (error) {
      console.error(`Error saving data for ${key} to ${filePath}: ${error.message}`);
      // DatabaseManager.notifyDataSaveError(this, filePath, error); // Uncomment if notifyDataSaveError is defined
    }
  }
  async getFilesInDirectory(directoryPath) {
    const files = await this.fs.readdir(directoryPath);
    return files.map(file => `${directoryPath}/${file}`);
  }
}
// Game Data Loader ******************************************************************************
/*
 * The GameDataLoader class is responsible for loading game data from the database, ensuring that
 * all necessary data is loaded before the game starts.
*/
class GameDataLoader {
  constructor(server) {
    this.server = server;
  }
  async loadGameData() {
    console.log(`\nStarting game data loading...`);
    const DATA_TYPES = { LOCATION: 'location', NPC: 'npc', ITEM: 'item' };
    const loadData = async (loadFunction, type) => {
      try {
        const data = await loadFunction();
        console.log(`${type} data loaded successfully.`);
        return { type, data };
      } catch (error) {
        console.error(`Error loading ${type} data: ${error.message}`);
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
        console.error(`Failed to load data at index ${index}: ${result.reason.message}`);
      }
    });
    console.log(`Finished loading game data.`);
    return results.map(result => result.value).filter(value => value && !value.error);
  }
}
// Game Manager ***********************************************************************************
/*
 * The GameManager class is responsible for managing the game's state, including the game loop,
 * entity management, and event handling.
*/
class GameManager {
  #gameLoopInterval = null;
  #gameTime = 0;
  #isRunning = false;
  #combatManager;
  constructor() {
    this.players = new Map();
    this.locations = new Map();
    this.npcs = new Map();
    // @ todo: this.#combatManager = new CombatManager(this);
    this.eventEmitter = new EventEmitter();
  }
  startGame() {
    try {
      this.startGameLoop();
      this.#isRunning = true;
    } catch (error) {
      console.log(`Error Start game: ${error}`);
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
      console.log(`Error shutting down game: ${error}`);
      MessageManager.notifyError(this, `Error shutting down game: ${error}`);
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
    this.setGameTime(this.getGameTime() + 1);
    if (this.getGameTime() >= 1440) {
      this.setGameTime(0);
      this.eventEmitter.emit("newDay");
    }
  }
  // New method to handle movement
  moveEntity(entity, newLocationId) {
    const oldLocationId = entity.currentLocation;
    const oldLocation = this.getLocation(oldLocationId);
    const newLocation = this.getLocation(newLocationId);
    if (oldLocation) {
      MessageManager.notifyLeavingLocation(entity, oldLocationId, newLocationId);
      const direction = Utility.getDirectionTo(newLocationId);
      MessageManager.notify(entity, `${entity.getName()} travels ${direction}.`);
    }
    entity.currentLocation = newLocationId;
    if (newLocation) {
      newLocation.addEntity(entity, "players");
      MessageManager.notifyEnteringLocation(entity, newLocationId);
      const direction = Utility.getDirectionFrom(oldLocationId);
      MessageManager.notify(entity, `${entity.getName()} arrives ${direction}.`);
    }
  }
}
// EventEmitter ***********************************************************************************
/*
 * The EventEmitter class is responsible for managing events and listeners, allowing for event
 * emission and handling in a decoupled manner.
*/
class EventEmitter {
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
