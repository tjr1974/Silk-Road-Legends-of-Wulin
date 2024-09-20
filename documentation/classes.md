# INTERFACES
1. ILogger
   - log()
   - debug()
   - info()
   - warn()
   - error()
2. IDatabaseManager
   - loadLocationData()
   - loadNpcData()
   - loadItemData()
   - saveData()
3. IEventEmitter
   - on()
   - emit()
   - off()

# BASE CLASSES
4. BaseManager
   - constructor()
5. Logger (extends ILogger)
   - constructor()
   - setLogLevel()
   - log()
   - writeToConsole()
   - debug()
   - info()
   - warn()
   - error()
6. EventEmitter (extends IEventEmitter)
   - constructor()
   - on()
   - emit()
   - off()

# DATABASE MANAGEMENT
7. DatabaseManager (extends BaseManager)
   - constructor()
   - initialize()
   - getFilesInDirectory()
   - loadLocationData()
   - loadNpcData()
   - loadItemData()
   - loadData()
   - saveData()
   - cleanup()

# GAME MANAGEMENT
8. GameManager
   - constructor()
   - startGame()
   - shutdownGame()
   - startGameLoop()
   - stopGameLoop()
   - _gameTick()
   - _updateGameTime()
   - moveEntity()
   - _updateNpcs()
   - _updatePlayerAffects()
   - _updateWorldEvents()
   - isTimeForWorldEvent()
   - triggerWorldEvent()
   - _newDayHandler()
9. GameComponentInitializer (extends BaseManager)
   - constructor()
   - setupGameComponents()
10. GameDataLoader
    - constructor()
    - fetchGameData()
11. GameDataVerifier
    - constructor()
    - validateGameData()

# TASK MANAGEMENT
12. Task
    - constructor()
    - run()
13. QueueManager
    - constructor()
    - addTask()
    - processQueue()

# NETWORKING
14. SocketEventManager (extends BaseManager)
    - constructor()
    - initializeSocketEvents()
    - initializeSocketListeners()
    - handleAction()
    - movePlayer()
    - attackNpc()
    - cleanup()

# SERVER MANAGEMENT
15. Server
    - constructor()
    - init()
    - setupHttpServer()
    - cleanup()
16. ModuleImporter (extends BaseManager)
    - constructor()
    - loadModules()
17. ServerConfigurator (extends BaseManager)
    - constructor()
    - configureServer()
    - setupExpressApp()
    - configureExpressMiddleware()