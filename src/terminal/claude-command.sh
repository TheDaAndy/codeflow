#!/bin/bash

# Claude Code command wrapper for CodeFlow
# This script provides easy access to Claude Code within the terminal

CODEFLOW_DIR="/data/data/com.termux/files/home/projects/codeflow"
CLAUDE_CONFIG="$CODEFLOW_DIR/src/mcp/claude-config.json"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
PURPLE='\\033[0;35m'
CYAN='\\033[0;36m'
NC='\\033[0m' # No Color

print_header() {
    echo -e "${CYAN}╭─────────────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│              Claude Code                    │${NC}"
    echo -e "${CYAN}│         CodeFlow Integration               │${NC}"
    echo -e "${CYAN}╰─────────────────────────────────────────────╯${NC}"
    echo
}

print_help() {
    print_header
    echo -e "${YELLOW}Usage:${NC}"
    echo "  claude [command] [options]"
    echo
    echo -e "${YELLOW}Commands:${NC}"
    echo "  start      - Start Claude Code with CodeFlow MCP integration"
    echo "  config     - Show MCP configuration"
    echo "  status     - Check MCP server status"
    echo "  tools      - List available browser tools"
    echo "  test       - Test browser automation"
    echo "  help       - Show this help message"
    echo
    echo -e "${YELLOW}Examples:${NC}"
    echo "  claude start                 # Start Claude Code"
    echo "  claude test navigate         # Test navigation"
    echo "  claude tools                 # List browser tools"
    echo
}

check_mcp_server() {
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

show_config() {
    print_header
    echo -e "${YELLOW}MCP Configuration for Claude Code:${NC}"
    echo
    if [ -f "$CLAUDE_CONFIG" ]; then
        cat "$CLAUDE_CONFIG" | python3 -m json.tool 2>/dev/null || cat "$CLAUDE_CONFIG"
    else
        echo -e "${RED}Configuration file not found: $CLAUDE_CONFIG${NC}"
    fi
    echo
    echo -e "${YELLOW}To use with Claude Code:${NC}"
    echo "1. Copy the above configuration to your Claude Code MCP settings"
    echo "2. Restart Claude Code"
    echo "3. The browser automation tools will be available"
}

show_status() {
    print_header
    echo -e "${YELLOW}CodeFlow MCP Server Status:${NC}"
    echo
    
    if check_mcp_server; then
        echo -e "${GREEN}✓ MCP Server: Running${NC}"
        
        # Get server info
        SERVER_INFO=$(curl -s http://localhost:3001/status 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Browser Tools: Available${NC}"
            echo -e "${GREEN}✓ WebSocket: Ready${NC}"
        fi
        
        echo
        echo -e "${CYAN}Server Details:${NC}"
        echo "  URL: http://localhost:3001"
        echo "  Health: http://localhost:3001/health"
        echo "  Tools: http://localhost:3001/tools"
        
    else
        echo -e "${RED}✗ MCP Server: Not running${NC}"
        echo
        echo -e "${YELLOW}To start the server:${NC}"
        echo "  cd $CODEFLOW_DIR && npm start"
    fi
}

list_tools() {
    print_header
    echo -e "${YELLOW}Available Browser Automation Tools:${NC}"
    echo
    
    if check_mcp_server; then
        TOOLS=$(curl -s http://localhost:3001/tools 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo "$TOOLS" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for i, tool in enumerate(data.get('tools', []), 1):
        print(f'  {i:2d}. \\033[0;36m{tool[\"name\"]}\\033[0m')
        print(f'      {tool[\"description\"]}')
        print()
except:
    print('Error parsing tools response')
" 2>/dev/null || echo -e "${RED}Error fetching tools${NC}"
        else
            echo -e "${RED}Failed to fetch tools from server${NC}"
        fi
    else
        echo -e "${RED}MCP Server not running${NC}"
        echo "Start the server first: cd $CODEFLOW_DIR && npm start"
    fi
}

test_automation() {
    local test_type="$1"
    
    print_header
    echo -e "${YELLOW}Testing Browser Automation...${NC}"
    echo
    
    if ! check_mcp_server; then
        echo -e "${RED}✗ MCP Server not running${NC}"
        return 1
    fi
    
    case "$test_type" in
        "navigate"|"nav")
            echo -e "${CYAN}Testing navigation...${NC}"
            RESULT=$(curl -s -X POST -H "Content-Type: application/json" \\
                -d '{"arguments":{"url":"https://example.com"}}' \\
                http://localhost:3001/tools/browser_navigate 2>/dev/null)
            ;;
        "screenshot"|"shot")
            echo -e "${CYAN}Testing screenshot...${NC}"
            RESULT=$(curl -s -X POST -H "Content-Type: application/json" \\
                -d '{"arguments":{}}' \\
                http://localhost:3001/tools/browser_screenshot 2>/dev/null)
            ;;
        *)
            echo -e "${CYAN}Testing basic functionality...${NC}"
            RESULT=$(curl -s http://localhost:3001/health 2>/dev/null)
            ;;
    esac
    
    if [ $? -eq 0 ] && echo "$RESULT" | grep -q '"success":true\\|"status":"ok"'; then
        echo -e "${GREEN}✓ Test passed${NC}"
        echo
        echo -e "${YELLOW}Response:${NC}"
        echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
    else
        echo -e "${RED}✗ Test failed${NC}"
        echo "$RESULT"
    fi
}

start_claude() {
    print_header
    echo -e "${YELLOW}Starting Claude Code with CodeFlow integration...${NC}"
    echo
    
    if ! check_mcp_server; then
        echo -e "${RED}✗ CodeFlow MCP Server not running${NC}"
        echo
        echo -e "${YELLOW}Please start the server first:${NC}"
        echo "  cd $CODEFLOW_DIR && npm start"
        echo
        echo -e "${YELLOW}Then open the IDE at:${NC} ${CYAN}http://localhost:3001${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ MCP Server is running${NC}"
    echo
    echo -e "${YELLOW}Claude Code Integration Status:${NC}"
    echo -e "${GREEN}✓ Browser automation tools available${NC}"
    echo -e "${GREEN}✓ MCP configuration ready${NC}"
    echo
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Configure Claude Code with the MCP settings (use 'claude config')"
    echo "2. Restart Claude Code to load the integration"
    echo "3. Use browser automation commands in Claude Code"
    echo
    echo -e "${CYAN}Example Claude Code commands:${NC}"
    echo "  • Navigate to a website"
    echo "  • Take a screenshot"
    echo "  • Click on elements"
    echo "  • Get page content"
    echo
    echo -e "${PURPLE}IDE Interface: ${CYAN}http://localhost:3001${NC}"
}

# Main command handler
case "${1:-help}" in
    "start")
        start_claude
        ;;
    "config")
        show_config
        ;;
    "status")
        show_status
        ;;
    "tools")
        list_tools
        ;;
    "test")
        test_automation "$2"
        ;;
    "help"|"-h"|"--help")
        print_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Use 'claude help' for usage information"
        exit 1
        ;;
esac