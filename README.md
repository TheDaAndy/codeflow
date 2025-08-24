# CodeFlow - Local Development Environment

<div align="center">
  <img src="assets/logo.svg" alt="CodeFlow Logo" width="120">
  <h3>Full-featured local IDE with browser and terminal integration</h3>
  <p>Built for PC and mobile development with Claude Code integration</p>
</div>

## Features

🖥️ **Full Terminal** - Real shell terminal like Termux  
🌐 **Browser Control** - Full browser automation with DOM access  
🤖 **Claude Code Integration** - Native MCP server support  
📱 **Mobile Compatible** - Works on Android via Termux  
🎨 **Project Management** - Create and manage coding projects  
⚡ **Real-time Sync** - WebSocket-based communication  

## Quick Start

### Prerequisites
- Node.js 16+ 
- For mobile: Termux app on Android

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/codeflow.git
cd codeflow

# Install dependencies
npm install

# Start the server
npm start
```

### Usage

1. **Project Selector**: Visit `http://localhost:3001` to create or select a project
2. **IDE Interface**: Automatically opens at `/ide` with your selected project
3. **Terminal**: Full shell access that starts in your project directory
4. **Browser**: Integrated browser panel for web development

## Claude Code Integration

CodeFlow includes a built-in MCP (Model Context Protocol) server that provides browser automation tools to Claude Code.

### Available Tools

- `browser_navigate` - Navigate to URLs
- `browser_click` - Click elements via CSS selectors  
- `browser_screenshot` - Take page screenshots
- `browser_get_content` - Get page content (optimized for AI)
- `browser_execute_script` - Run JavaScript
- `browser_get_console` - Access console logs
- `browser_wait_for_selector` - Wait for elements
- `browser_get_dom` - Get DOM structure

### MCP Configuration

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "codeflow-browser": {
      "command": "node",
      "args": ["/path/to/codeflow/src/mcp/server-standalone.js"],
      "env": {
        "CODEFLOW_MCP_PORT": "3001",
        "CODEFLOW_MCP_HOST": "localhost"
      }
    }
  }
}
```

## Project Templates

CodeFlow supports multiple project types:

- **Web** - HTML/CSS/JavaScript projects
- **React** - React applications with modern tooling
- **Node.js** - Server-side JavaScript projects  
- **Vue** - Vue.js applications
- **Python** - Python projects with virtual environment setup
- **Static** - Static websites with asset organization

## Architecture

- **Frontend**: Web-based IDE with terminal and browser panels
- **Backend**: Express.js server with WebSocket support
- **Terminal**: Custom WebSocket-based terminal for mobile compatibility
- **Browser**: Mock browser automation for development preview
- **MCP Server**: Native Claude Code integration

## Development

```bash
# Run tests
npm test

# Development mode (with auto-restart)
npm run dev

# Lint code
npm run lint
```

## Mobile Development

CodeFlow is optimized for mobile development in Termux:

1. Install Termux from F-Droid
2. Install Node.js: `pkg install nodejs`
3. Clone and run CodeFlow
4. Access via mobile browser at `localhost:3001`

## Configuration

Project settings are stored in `~/.codeflow-settings.json`:

```json
{
  "recent": ["path/to/recent/projects"],
  "favorites": ["path/to/favorite/projects"],
  "projectPaths": ["/custom/project/locations"]
}
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for Claude Code integration
- Inspired by VS Code and modern web IDEs
- Designed for cross-platform development

---

<div align="center">
  <p>Made with ❤️ for developers who want local control</p>
  <p>⭐ Star this repo if you find it useful!</p>
</div>