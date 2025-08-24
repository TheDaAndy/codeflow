# CodeFlow - Claude Code Configuration

## Installation
```bash
npm install
```

## Running the Application
```bash
npm start
```

## Development Mode
```bash
npm run dev
```

## Claude Code Integration

### MCP Server Configuration
The application runs an MCP (Model Context Protocol) server that provides browser automation tools to Claude Code.

**MCP Server Configuration for Claude Code:**
```json
{
  "mcpServers": {
    "codeflow-browser": {
      "command": "node",
      "args": [
        "/data/data/com.termux/files/home/projects/codeflow/src/mcp/mcp-client.js"
      ],
      "env": {
        "CODEFLOW_MCP_PORT": "3001",
        "CODEFLOW_MCP_HOST": "localhost"
      }
    }
  }
}
```

### Available Browser Tools

1. **browser_navigate** - Navigate to a URL
2. **browser_click** - Click elements using CSS selectors
3. **browser_type** - Type text into input fields
4. **browser_screenshot** - Take screenshots of the current page
5. **browser_get_content** - Get page content (use summary=true to save context)
6. **browser_execute_script** - Execute JavaScript in browser context
7. **browser_get_console** - Get browser console logs
8. **browser_wait_for_selector** - Wait for elements to appear
9. **browser_get_dom** - Get DOM structure information

### Important Usage Guidelines

⚠️ **Context Optimization**: Always use subagents for browser content analysis to prevent context bloat. The browser tools are designed to work efficiently with subagents.

✅ **Recommended Pattern**:
```
1. Use browser tools to navigate/interact
2. Take screenshots for visual context
3. Use subagents to analyze content/DOM
4. Get lightweight summaries instead of full HTML
```

### Testing Commands
```bash
npm test          # Run all tests
npm run lint      # Check code quality
```

### Architecture
- **Frontend**: Electron app with terminal and browser panels
- **Backend**: Puppeteer-based browser automation
- **MCP Integration**: Native Claude Code integration via MCP protocol
- **Terminal**: Full pty support with Claude Code integration

The application is designed to be a local development environment where Claude Code can control both the terminal and browser seamlessly.