```markdown
# Server Dependencies

This server requires certain dependencies. Here's a list of the main dependencies you'll need to install if not already installed:

## Node.js

To install Node.js:

```bash
sudo apt update
sudo apt install nodejs
```

To query Node.js for its version number:

```bash
node -v
```

## npm (Node Package Manager)

Node Package Manager usually comes with Node.js. If not, install it with:

```bash
sudo apt install npm
```

## npm Packages

You'll need to install the following npm packages if not already installed:

```bash
npm install socket.io
npm install express
npm install pino pino-http
npm install queue
npm install body-parser
```

```