class SocketManager {
  constructor(gameManager) {
    this.socket = io();
    this.gameManager = gameManager;
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('connect', () => this.handleConnect());
    this.socket.on('gameState', (data) => this.gameManager.handleGameState(data));
    this.socket.on('serverMessage', (data) => this.gameManager.handleServerMessage(data));
    // Add more event listeners as needed
  }

  handleConnect() {
    console.log('Connected to server');
    // Perform any necessary initialization
  }

  sendPlayerAction(action, payload) {
    this.socket.emit('playerAction', { action, payload });
  }
}
    // Client Side Error Message Manager **************************************************************
    class ErrorMessageManager {
      constructor() {
        this.errorMessages = [
          `Dude, try speaking English!`,
          `${this.player.sex === 'female' ? 'Girl' : 'Boy'}, you may be legally retarded!`,
          `Did your cat just walk on the keyboard?`,
          `I'm starting to think you're illiterate!`,
          `A squirrel must've chewed through the wires.<br>Please input something comprehensible!`,
          `I don't even know how to respond to that input!<br>Are you just mashing the keyboard randomly?`,
          `I'm embarrassed for both of us after that attempt at input.<br>Let's pretend it never happened!`,
          `Based on your input,<br>I suspect we're not even speaking the same language!`,
          `That input was so wrong, somewhere an error message writer is smiling proudly!`,
          `Who taught you how to type?<br>Because I'd like to have a word with them to<br>explain how command-line input is supposed to work!`,
          `Your input is so confusing I thought maybe my system crashed for a second.<br>But nope, it's just nonsense!`,
          `Your input is so illogical it broke my brain for a second.<br>Take a deep breath and try again!`,
          `That input is so wrong I had to check if it was April Fools' Day.<br>But nope, it's just bad input!`,
          `Whatch' you talkin' 'bout, Willis?`
        ];
      }
      displayRandomErrorMessage(outputFunction) {
        const randomIndex = Math.floor(Math.random() * this.errorMessages.length);
        outputFunction(`<br><span class="error-message">${this.errorMessages[randomIndex]}</span><br>`);
      }
    }
    // Client Side Game Manager ***********************************************************************
    class GameManager {
      handleGameJoined(player) {
        this.displayMessageFromServer(`Welcome, ${player.name}!`);
      }
      handleFullStateSync(data) {
        this.updateScoreDisplay(data.playerState);
      }
      handleDisplayMessageFromServer(data) {
        const messageTypes = {
          error: 'error-message',
          info: 'info-message',
          combat: 'combat-message',
          npc: 'npc-message',
          emote: 'emote-message',
          tell: 'tell-message',
          'tell-all': 'tell-message',
          'tell-room': 'tell-message',
        };
        const messageClass = messageTypes[data.type] || '';
        const formattedMessage = messageClass ? `<span id="${messageClass}">${data.content}</span>` : data.content;
        this.appendMessage(formattedMessage);
      }
      appendMessage(message) {
        gameContainer.innerHTML += `${message}<br>`;
        gameContainer.scrollTop = gameContainer.scrollHeight;
      }
      updateScoreDisplay(player) {
        healthScore.textContent = `HEALTH: ${Math.round(player.health || 0)}/${player.maxHealth || 0}`;
        levelScore.textContent = `LEVEL: ${player.level || 0}`;
        xpScore.textContent = `XP: ${player.xp || 0}`;
        coordinatesScore.textContent = `X: ${player.coordinates.x || 0} Y: ${player.coordinates.y || 0} Z: ${player.coordinates.z || 0}`;
      }
    }
    // Client Side Command Manager ********************************************************************
    class CommandManager {
      constructor() {
        this.errorMessageManager = new ErrorMessageManager();
        this.commands = {
          MOVE: 'move',
          ATTACK: 'attack',
          DROP: 'drop',
          GET: 'get',
          SHOW_INVENTORY: 'showInventory',
          DESCRIBE_LOCATION: 'describeLocation',
          LOOT: 'lootSpecifiedNpc',
          MEDITATE: 'meditate',
          SIT: 'sit',
          SLEEP: 'sleep',
          STAND: 'stand',
          STOP: 'stop',
          WAKE: 'wake',
          AUTO_LOOT: 'autoLootToggle',
        };
      }
      // Client Side Command Manager Methods **********************************************************
      sendMethodCallToServer() {
        const words = this.inputElement.value.trim().toLowerCase().split(" ");
        const [action, ...args] = words;
        const serverAction = this.getServerAction(action);
        if (serverAction) {
          this.serverCommunication.callMethod(serverAction, args);
          console.log(`Action sent: ${serverAction}, Args: ${args}`);
        } else {
          this.errorMessageManager.displayRandomErrorMessage(this.appendMessage.bind(this));
        }
        this.updateCommandHistory(words);
      }
      getServerAction(action) {
        const commandMap = new Map([
          ...this.navigationCommands(),
          ...this.actionCommands(),
        ]);
        return commandMap.get(action);
      }
      navigationCommands() {
        return [
          ['n', this.commands.MOVE],
          ['e', this.commands.MOVE],
          ['w', this.commands.MOVE],
          ['s', this.commands.MOVE],
          ['u', this.commands.MOVE],
          ['d', this.commands.MOVE],
        ];
      }
      actionCommands() {
        return [
          ['attack', this.commands.ATTACK],
          ['att', this.commands.ATTACK],
          ['a', this.commands.ATTACK],
          ['kill', this.commands.ATTACK],
          ['k', this.commands.ATTACK],
          ['drop', this.commands.DROP],
          ['get', this.commands.GET],
          ['grab', this.commands.GET],
          ['take', this.commands.GET],
          ['inventory', this.commands.SHOW_INVENTORY],
          ['inv', this.commands.SHOW_INVENTORY],
          ['i', this.commands.SHOW_INVENTORY],
          ['look', this.commands.DESCRIBE_LOCATION],
          ['loo', this.commands.DESCRIBE_LOCATION],
          ['l', this.commands.DESCRIBE_LOCATION],
          ['loot', this.commands.LOOT],
          ['meditate', this.commands.MEDITATE],
          ['sit', this.commands.SIT],
          ['sleep', this.commands.SLEEP],
          ['stand', this.commands.STAND],
          ['stop', this.commands.STOP],
          ['wake', this.commands.WAKE],
          ['eat', 'eat'],
          ['fuck', 'fuck'],
          ['motherfucker', 'motherfucker'],
          ['autoloot', this.commands.AUTO_LOOT],
        ];
      }
      updateCommandHistory(words) {
        this.inputElement.value = '';
        this.commandHistory.unshift(fullCommand);
        if (this.commandHistory.length > 10) {
          this.commandHistory.pop();
        }
        this.historyIndex = -1;
      }
      navigateHistory(direction) {
        if (direction === -1 && this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
        } else if (direction === 1 && this.historyIndex > -1) {
          this.historyIndex--;
        }
        this.inputElement.value = this.historyIndex === -1 ? '' : this.commandHistory[this.historyIndex];
      }
      handleDrop(words) {
        if (words[1] === 'all') {
          return words[2] ? 'dropAllSpecifiedItems' : 'dropAllItems';
        }
        return 'dropSingleItem';
      }
      handleGet(words) {
        if (words[1] === 'all') {
          if (words[4]) {
            return 'getAllSpecificItemsFromContainer';
          } else if (words[3]) {
            return 'getAllItemsFromContainer';
          } else if (words[2]) {
            return 'getAllSpecificItems';
          }
          return 'getAllItems';
        }
        return 'getSingleItem';
      }
      handlePutCommand(words) {
        if (words[1] === 'all') {
          return words[2] ? 'putAllSpecificItems' : 'putAllItems';
        }
        return 'putSingleItem';
      }
      handleEatCommand(words) {
        if (words[1] === 'shit') {
          this.processEatShitCommand();
        } else {
          // Handle other eat commands if necessary
        }
      }
      processEatShitCommand() {
        this.appendMessage(`<br><span class="error-message">That wouldn't taste very good!</span><br>`);
      }
      processFuckCommand() {
        const message = `In your WILDEST dreams, Sally!
        <br>Then again... What the hell? It might be fun!
        <br>${this.player.name} grabs ${this.player.posPron} ankles and takes it like a ${noun}!
        <br>Damn, ${this.player.subPron} is taking a genuinely fine pounding.
        <br>And ${this.player.name} certainly looks as though ${this.player.sex === 'female' ? 'pro' : 'man'} is enjoying every inch of it!
        <br>${this.player.name}'s truly an inspiration to fudge packing butt pirates everywhere!
        <br>Check it out! ${this.player.name} spends so much time on ${this.player.sex === 'female' ? 'her' : 'his'} back, the bottoms of ${this.player.sex === 'female' ? 'her' : 'his'} feet are sunburned!
        <br>Wow, what a trooper! Taking it on the chin like that! Muhahaha...`;
        this.appendMessage(`<br><span class="error-message">${message}</span>`);
      }
      processMotherfuckerCommand() {
        const nbsp = (count) => "&nbsp;".repeat(count);
        this.appendMessage(`<br><span class="error-message">Though a motherfucker I may be,<br>${nbsp(3)}the mother I fucked was not the mother of me.<br>${nbsp(6)}However, she may be the mother of thee!</span>`);
      }
      handleAutoLoot() {
        this.serverCommunication.callMethod(this.commands.AUTO_LOOT);
        console.log('Action sent: autoLootToggle');
      }
    }