async loadModules() {
    try {
      this.logger.info(`\n`);
      this.logger.info(`STARTING MODULE IMPORTS:`);
      try {
        this.logger.info(`- Importing Process Module`);
        await import('process'); // Update the import in loadModules
        this.logger.info(`- Importing File System Module`);
        const fsModule = await import('fs'); // Corrected import
        this.fs = fsModule.promises; // Access promises property correctly
      } catch (error) {
        this.logger.error(`ERROR importing File System Module: ${error.message}`, { error });
      }
      this.logger.info(`- Importing Express Module`);
      try {
        this.express = (await import('express')).default;
      } catch (error) {
        this.logger.error(`ERROR importing Express Module: ${error.message}`, { error });
      }
      this.logger.info(`- Importing Socket.IO Module`);
      try {
        this.SocketIOServer = (await import('socket.io')).Server;
      } catch (error) {
        this.logger.error(`ERROR importing Socket.IO Module: ${error.message}`, { error });
      }
      this.logger.info(`- Importing Queue Module`);
      try {
        this.queue = new (await import('queue')).default();
      } catch (error) {
        this.logger.error(`ERROR importing Queue Module: ${error.message}`, { error });
      }
      this.logger.info(`MODULE IMPORTS FINISHED.`);
    } catch (error) {
      this.logger.error(`ERROR during module imports: ${error.message}`, { error });
    }
  }

  async configureServer() {
    const { logger, server } = this; // Destructure this
    logger.info(`\n`);
    logger.info(`STARTING SERVER CONFIGURATION:`);
    try {
      await this.setupExpressApp();
      this.configureExpressMiddleware();
    } catch (error) {
      logger.error(`ERROR during Express configuration: ${error.message}`, { error });
    }
    try {
      await server.setupHttpServer();
    } catch (error) {
      logger.error(`ERROR during Server configuration: ${error.message}`, { error });
    }
    try {
      logger.log('INFO', '- Configuring Queue Manager');
    } catch (error) {
      logger.error(`ERROR during Server configuration: ${error.message}`, { error });
    }
    try {
      logger.log('INFO', '- Configuring Queue Manager');
      server.queueManager = new QueueManager();
    } catch (error) {
      logger.error(`ERROR during Queue Manager configuration: ${error.message}`, { error });
    }
    logger.info(`SERVER CONFIGURATION FINISHED.`);
  }
  async setupGameComponents() { // Renamed from 'initializeGameComponents' to 'setupGameComponents'
    this.logger.info(`\n`);
    this.logger.info(`STARTING INITIALIZE GAME COMPONENTS:`);
    try {
      this.logger.log('INFO', '- Configuring Game Component Initializer');
      this.gameComponentInitializer = new GameComponentInitializer(this);
    } catch (error) {
      this.logger.error('Game Component Initializer configuration unsuccessful!!!', { error }); // Added error logging
    }
    this.logger.log('INFO', '- Starting Database Manager');
    try {
      this.server.databaseManager = new DatabaseManager({ server: this.server, logger: this.logger });
      await this.server.databaseManager.initialize();
    } catch (error) {
      this.logger.error('Database Manager configuration unsuccessful!!!', { error }); // Added error logging
    }
    this.logger.log('INFO', '- Loading Game Data');
    try {
      this.server.gameDataLoader = new GameDataLoader(this.server);
      if (!this.server.gameDataLoader) throw new Error('GameDataLoader is not initialized!');
    } catch (error) {
      this.logger.error('GameDataLoader configuration unsuccessful!!!', { error }); // Added error logging
    }
    if (this.logger.logLevel === 'DEBUG') { // Check if log level is DEBUG
      this.logger.log('DEBUG', '\n');
      this.logger.log('DEBUG', 'VERIFYING GAME DATA:');
      const gameDataVerifier = new GameDataVerifier(this.server.databaseManager);
      await gameDataVerifier.validateGameData();
      this.logger.log('DEBUG', '\n');
    }
    this.logger.log('INFO', '- Starting Game Manager');
    try {
      this.server.gameManager = new GameManager({ eventEmitter: this.server.eventEmitter });
    } catch (error) {
      this.logger.error('GameManager configuration unsuccessful!!!', { error }); // Added error logging
    }
    this.logger.info(`GAME COMPONENTS INITIALIZED.`);
  }