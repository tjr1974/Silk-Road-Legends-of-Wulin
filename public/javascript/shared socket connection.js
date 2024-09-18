/*
Usage in Other Parts of the Application
You can now use the shared socket connection in any part of your application like this:
  import socketManager from './socket.js';

  const socket = socketManager.getSocket();

  // Example of emitting an event
  socket.emit('someEvent', { data: 'example' });

  // Example of listening for an event
  socket.on('someResponse', (response) => {
    console.log('Received response:', response);
  });
Explanation of the Implementation
Singleton Pattern: The SocketManager class ensures that only one instance of the socket connection is created. If an instance already exists, it returns that instance.
Connection Management: The initialize method sets up event listeners for connection and disconnection events, managing the connection status effectively.
Error Handling: The socket listens for sessionError events from the server, allowing you to handle session-related issues gracefully.
Benefits
Single Connection: This approach guarantees that only one socket connection is used throughout the application, preventing multiple connections.
Centralized Management: All socket-related logic is centralized in one place, making it easier to manage and maintain.
Ease of Use: Other parts of the application can easily access the shared socket instance without worrying about connection management.
Using a shared socket connection is a clean and efficient way to handle WebSocket connections in your application, ensuring that you maintain a single connection while providing a straightforward interface for communication.
*/
// socket.js
class SocketManager {
  constructor() {
    if (!SocketManager.instance) {
      const sessionId = this.getSessionId(); // Retrieve session ID dynamically
      this.socket = io.connect('http://yourserver.com', {
        query: { sessionId } // Pass session ID
      });
      this.isConnected = false; // Track connection status
      this.initialize();
      SocketManager.instance = this; // Store the instance
    }
    return SocketManager.instance; // Return the singleton instance
  }

  getSessionId() {
    // Retrieve the session ID from a secure source (e.g., local storage, cookie)
    return localStorage.getItem('sessionId') || 'default-session-id'; // Fallback if not found
  }

  initialize() {
    this.socket.on('connect', () => {
      if (this.isConnected) {
        console.warn('Already connected to the server.'); // Warn if already connected
        this.socket.disconnect(); // Disconnect if already connected
      } else {
        this.isConnected = true; // Set flag to true on successful connection
        console.log('Connected to the server.');
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false; // Reset flag on disconnect
      console.log('Disconnected from the server.');
    });

    // Handle session errors from the server
    this.socket.on('sessionError', (message) => {
      console.error(`Session Error: ${message}`); // Log session error message
      // Optionally, redirect to login or show a message to the user
    });
  }

  getSocket() {
    return this.socket; // Return the socket instance
  }
}

// Export the singleton instance
const socketManager = new SocketManager();
export default socketManager;