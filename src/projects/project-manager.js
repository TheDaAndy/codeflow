const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class ProjectManager {
    constructor() {
        this.projectPaths = [
            '/data/data/com.termux/files/home/projects',
            '/storage/emulated/0/CodeFlow',
            '/sdcard/CodeFlow'
        ];
        this.projects = new Map();
        this.recentProjects = [];
        this.favorites = new Set();
        
        this.loadSettings();
    }

    async loadSettings() {
        try {
            const settingsPath = path.join('/data/data/com.termux/files/home', '.codeflow-settings.json');
            const settings = await fs.readFile(settingsPath, 'utf8');
            const data = JSON.parse(settings);
            
            this.recentProjects = data.recent || [];
            this.favorites = new Set(data.favorites || []);
            this.projectPaths = data.projectPaths || this.projectPaths;
        } catch (error) {
            // Settings file doesn't exist, use defaults
        }
    }

    async saveSettings() {
        try {
            const settingsPath = path.join('/data/data/com.termux/files/home', '.codeflow-settings.json');
            const settings = {
                recent: this.recentProjects,
                favorites: Array.from(this.favorites),
                projectPaths: this.projectPaths
            };
            
            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    async scanForProjects(basePath) {
        const projects = [];
        
        try {
            // Ensure directory exists
            await fs.mkdir(basePath, { recursive: true });
            
            const entries = await fs.readdir(basePath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const projectPath = path.join(basePath, entry.name);
                    const project = await this.analyzeProject(projectPath);
                    
                    if (project) {
                        projects.push(project);
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to scan ${basePath}:`, error);
        }
        
        return projects;
    }

    async analyzeProject(projectPath) {
        try {
            const stats = await fs.stat(projectPath);
            const projectName = path.basename(projectPath);
            
            // Check for common project files
            const files = await fs.readdir(projectPath);
            const projectType = this.detectProjectType(files);
            
            // Read project description
            let description = '';
            try {
                if (files.includes('package.json')) {
                    const packageJson = await fs.readFile(path.join(projectPath, 'package.json'), 'utf8');
                    const pkg = JSON.parse(packageJson);
                    description = pkg.description || '';
                } else if (files.includes('README.md')) {
                    const readme = await fs.readFile(path.join(projectPath, 'README.md'), 'utf8');
                    const firstLine = readme.split('\\n')[0].replace(/^#\\s*/, '');
                    description = firstLine.substring(0, 100);
                }
            } catch (error) {
                // Ignore errors reading description
            }

            return {
                name: projectName,
                path: projectPath,
                type: projectType,
                description: description || 'No description',
                modified: stats.mtime,
                size: await this.getDirectorySize(projectPath),
                isFavorite: this.favorites.has(projectPath),
                isRecent: this.recentProjects.includes(projectPath)
            };
            
        } catch (error) {
            return null;
        }
    }

    detectProjectType(files) {
        if (files.includes('package.json')) {
            if (files.includes('next.config.js')) return 'next';
            if (files.includes('vue.config.js') || files.includes('vite.config.js')) return 'vue';
            if (files.includes('angular.json')) return 'angular';
            if (files.some(f => f.startsWith('gatsby-'))) return 'gatsby';
            return files.some(f => f.includes('react')) ? 'react' : 'node';
        }
        
        if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) {
            return 'python';
        }
        
        if (files.includes('Cargo.toml')) return 'rust';
        if (files.includes('go.mod')) return 'go';
        if (files.includes('composer.json')) return 'php';
        if (files.includes('Gemfile')) return 'ruby';
        if (files.includes('index.html')) return 'web';
        
        return 'folder';
    }

    async getDirectorySize(dirPath) {
        let size = 0;
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
                        size += await this.getDirectorySize(fullPath);
                    }
                } else {
                    const stats = await fs.stat(fullPath);
                    size += stats.size;
                }
            }
        } catch (error) {
            // Ignore errors
        }
        
        return size;
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async getAllProjects() {
        const allProjects = [];
        
        for (const basePath of this.projectPaths) {
            const projects = await this.scanForProjects(basePath);
            allProjects.push(...projects);
        }
        
        // Remove duplicates and sort
        const uniqueProjects = allProjects.filter((project, index, self) => 
            index === self.findIndex(p => p.path === project.path)
        );
        
        return uniqueProjects.sort((a, b) => b.modified - a.modified);
    }

    async getRecentProjects() {
        const allProjects = await this.getAllProjects();
        return allProjects.filter(project => 
            this.recentProjects.includes(project.path)
        ).sort((a, b) => {
            const aIndex = this.recentProjects.indexOf(a.path);
            const bIndex = this.recentProjects.indexOf(b.path);
            return aIndex - bIndex;
        });
    }

    async getFavoriteProjects() {
        const allProjects = await this.getAllProjects();
        return allProjects.filter(project => 
            this.favorites.has(project.path)
        );
    }

    async createProject(options) {
        const {
            name,
            description,
            type,
            location,
            initGit,
            createReadme
        } = options;

        const projectPath = path.join(location, name);
        
        try {
            // Create project directory
            await fs.mkdir(projectPath, { recursive: true });
            
            // Initialize based on project type
            await this.initializeProjectType(projectPath, type, name, description);
            
            // Create README if requested
            if (createReadme) {
                await this.createReadme(projectPath, name, description);
            }
            
            // Initialize Git if requested
            if (initGit) {
                await this.initializeGit(projectPath);
            }
            
            // Add to recent projects
            this.addToRecent(projectPath);
            
            return {
                success: true,
                project: await this.analyzeProject(projectPath)
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async initializeProjectType(projectPath, type, name, description) {
        switch (type) {
            case 'node':
                await this.createPackageJson(projectPath, name, description);
                await fs.writeFile(path.join(projectPath, 'index.js'), 
                    'console.log("Hello, CodeFlow!")\\n');
                break;
                
            case 'web':
                await this.createWebProject(projectPath, name);
                break;
                
            case 'react':
                await this.createReactProject(projectPath, name);
                break;
                
            case 'vue':
                await this.createVueProject(projectPath, name);
                break;
                
            case 'python':
                await this.createPythonProject(projectPath, name);
                break;
                
            case 'static':
                await this.createStaticProject(projectPath, name);
                break;
                
            default:
                // Empty project - just create a basic structure
                await fs.writeFile(path.join(projectPath, '.codeflow'), 
                    JSON.stringify({ name, type, created: new Date().toISOString() }, null, 2));
                break;
        }
    }

    async createPackageJson(projectPath, name, description) {
        const packageJson = {
            name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            version: '1.0.0',
            description: description || 'A CodeFlow project',
            main: 'index.js',
            scripts: {
                start: 'node index.js',
                dev: 'node index.js',
                test: 'echo "Error: no test specified" && exit 1'
            },
            keywords: [],
            author: '',
            license: 'ISC'
        };
        
        await fs.writeFile(path.join(projectPath, 'package.json'), 
            JSON.stringify(packageJson, null, 2));
    }

    async createWebProject(projectPath, name) {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to ${name}</h1>
        <p>Your CodeFlow web project is ready!</p>
    </div>
    <script src="script.js"></script>
</body>
</html>`;

        const css = `/* ${name} Styles */
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    margin: 0;
    padding: 0;
    background: #f5f5f5;
}

.container {
    max-width: 800px;
    margin: 50px auto;
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    text-align: center;
}

h1 {
    color: #333;
    margin-bottom: 20px;
}

p {
    color: #666;
    line-height: 1.6;
}`;

        const js = `// ${name} JavaScript
console.log('Welcome to ${name}!');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded and ready');
});`;

        await fs.writeFile(path.join(projectPath, 'index.html'), html);
        await fs.writeFile(path.join(projectPath, 'style.css'), css);
        await fs.writeFile(path.join(projectPath, 'script.js'), js);
    }

    async createReactProject(projectPath, name) {
        await this.createPackageJson(projectPath, name, 'A React application');
        
        // Add React dependencies to package.json
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        
        packageJson.dependencies = {
            react: '^18.2.0',
            'react-dom': '^18.2.0'
        };
        
        packageJson.scripts = {
            start: 'react-scripts start',
            build: 'react-scripts build',
            test: 'react-scripts test',
            eject: 'react-scripts eject'
        };
        
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
        
        // Create basic React structure
        await fs.mkdir(path.join(projectPath, 'src'));
        await fs.mkdir(path.join(projectPath, 'public'));
        
        const appJs = `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to ${name}</h1>
        <p>Your React app is ready!</p>
      </header>
    </div>
  );
}

export default App;`;

        await fs.writeFile(path.join(projectPath, 'src', 'App.js'), appJs);
        await fs.writeFile(path.join(projectPath, 'src', 'index.js'), 
            `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`);
    }

    async createPythonProject(projectPath, name) {
        const mainPy = `#!/usr/bin/env python3
"""
${name} - A Python project created with CodeFlow
"""

def main():
    print(f"Welcome to ${name}!")
    print("Your Python project is ready!")

if __name__ == "__main__":
    main()`;

        await fs.writeFile(path.join(projectPath, 'main.py'), mainPy);
        await fs.writeFile(path.join(projectPath, 'requirements.txt'), '# Project dependencies\\n');
        await fs.writeFile(path.join(projectPath, '.gitignore'), '__pycache__/\\n*.pyc\\n.env\\nvenv/\\n');
    }

    async createStaticProject(projectPath, name) {
        await this.createWebProject(projectPath, name);
        
        // Add some additional static site files
        await fs.mkdir(path.join(projectPath, 'assets'));
        await fs.mkdir(path.join(projectPath, 'assets', 'css'));
        await fs.mkdir(path.join(projectPath, 'assets', 'js'));
        await fs.mkdir(path.join(projectPath, 'assets', 'images'));
    }

    async createReadme(projectPath, name, description) {
        const readme = `# ${name}

${description || 'A project created with CodeFlow'}

## Getting Started

This project was created using CodeFlow IDE.

## Development

To start developing:

1. Open the project in CodeFlow IDE
2. Use the integrated terminal to run commands
3. Use the browser panel to preview your application

## Project Structure

\`\`\`
${name}/
├── README.md
└── (project files)
\`\`\`

---

Created with ❤️ using [CodeFlow IDE](https://github.com/codeflow)`;

        await fs.writeFile(path.join(projectPath, 'README.md'), readme);
    }

    async initializeGit(projectPath) {
        return new Promise((resolve, reject) => {
            const git = spawn('git', ['init'], { cwd: projectPath });
            
            git.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error('Git initialization failed'));
                }
            });
        });
    }

    addToRecent(projectPath) {
        // Remove if already exists
        this.recentProjects = this.recentProjects.filter(path => path !== projectPath);
        
        // Add to beginning
        this.recentProjects.unshift(projectPath);
        
        // Keep only last 10
        this.recentProjects = this.recentProjects.slice(0, 10);
        
        this.saveSettings();
    }

    toggleFavorite(projectPath) {
        if (this.favorites.has(projectPath)) {
            this.favorites.delete(projectPath);
        } else {
            this.favorites.add(projectPath);
        }
        this.saveSettings();
    }

    async importProject(options) {
        const { type, source, name, location } = options;
        const projectPath = path.join(location, name);
        
        try {
            switch (type) {
                case 'folder':
                    await this.copyDirectory(source, projectPath);
                    break;
                case 'git':
                    await this.cloneRepository(source, projectPath);
                    break;
                case 'zip':
                    await this.extractZip(source, projectPath);
                    break;
                default:
                    throw new Error('Unknown import type');
            }
            
            this.addToRecent(projectPath);
            
            return {
                success: true,
                project: await this.analyzeProject(projectPath)
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    async cloneRepository(url, dest) {
        return new Promise((resolve, reject) => {
            const git = spawn('git', ['clone', url, dest]);
            
            git.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error('Git clone failed'));
                }
            });
        });
    }
}

module.exports = ProjectManager;