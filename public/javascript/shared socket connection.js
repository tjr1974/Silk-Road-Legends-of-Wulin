// socket.js
let socket;
const socketId = sessionStorage.getItem('socketId');
function initializeSocket() {
  const socketUrl = 'http://localhost:6400'; // Adjust URL as needed
  if (socketId) {
    // Connect using the existing socket ID if available
    socket = io(socketUrl, {
      query: { socketId }
    });
  } else {
    // No existing socket ID, create a new connection
    socket = io(socketUrl);
  }
  // Store the new socket ID in sessionStorage
  sessionStorage.setItem('socketId', socket.id);
  socket.on('connect', () => {
    console.log(`Connected with socket ID: ${socket.id}`);
    sessionStorage.setItem('socketId', socket.id);
  });
  socket.on('disconnect', () => {
    console.log(`Disconnected. Clearing socket ID from sessionStorage.`);
    sessionStorage.removeItem('socketId');
  });
}
// Initialize the socket connection
initializeSocket();