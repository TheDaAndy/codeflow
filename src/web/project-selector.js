class ProjectSelector {
    constructor() {
        this.currentCategory = 'recent';
        this.currentStorage = '/data/data/com.termux/files/home/projects';
        this.projects = [];
        this.filteredProjects = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadProjects();
    }

    setupEventListeners() {
        // Quick actions
        document.getElementById('new-project-btn').addEventListener('click', () => this.showNewProjectModal());
        document.getElementById('import-project-btn').addEventListener('click', () => this.showImportModal());
        document.getElementById('refresh-projects-btn').addEventListener('click', () => this.loadProjects());

        // Category tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchCategory(btn.dataset.category));
        });

        // Storage selector
        document.getElementById('storage-location').addEventListener('change', (e) => {
            this.currentStorage = e.target.value;
            if (e.target.value === 'custom') {
                document.getElementById('custom-path').style.display = 'block';
            } else {
                document.getElementById('custom-path').style.display = 'none';
                this.loadProjects();
            }
        });

        document.getElementById('custom-path').addEventListener('blur', () => {
            const customPath = document.getElementById('custom-path').value;
            if (customPath) {
                this.currentStorage = customPath;
                this.loadProjects();
            }
        });

        // Modal events
        this.setupModalEvents();
    }

    setupModalEvents() {
        // New Project Modal
        const newProjectModal = document.getElementById('new-project-modal');
        const importProjectModal = document.getElementById('import-project-modal');

        // Close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                newProjectModal.classList.add('hidden');
                importProjectModal.classList.add('hidden');
            });
        });

        // Cancel buttons
        document.getElementById('cancel-project').addEventListener('click', () => {
            newProjectModal.classList.add('hidden');
        });

        document.getElementById('cancel-import').addEventListener('click', () => {
            importProjectModal.classList.add('hidden');
        });

        // Form submissions
        document.getElementById('new-project-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createProject();
        });

        document.getElementById('import-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.importProject();
        });

        // Import options
        document.querySelectorAll('.import-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.import-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                this.showImportForm(option.dataset.type);
            });
        });

        // Click outside to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.add('hidden');
            }
        });
    }

    async loadProjects() {
        this.showLoading();
        
        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'list',
                    storage: this.currentStorage,
                    category: this.currentCategory
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.projects = result.projects;
                this.filterProjects();
                this.renderProjects();
            } else {
                this.showError('Failed to load projects: ' + result.error);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            this.showError('Failed to connect to project service');
        }
    }

    filterProjects() {
        switch (this.currentCategory) {
            case 'recent':
                this.filteredProjects = this.projects.filter(p => p.isRecent);
                break;
            case 'favorites':
                this.filteredProjects = this.projects.filter(p => p.isFavorite);
                break;
            case 'all':
            default:
                this.filteredProjects = this.projects;
                break;
        }
    }

    renderProjects() {
        const grid = document.getElementById('projects-grid');
        
        if (this.filteredProjects.length === 0) {
            grid.innerHTML = this.getEmptyState();
            return;
        }

        grid.innerHTML = this.filteredProjects.map(project => 
            this.createProjectCard(project)
        ).join('');

        // Add event listeners to project cards
        grid.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', () => {
                const projectPath = card.dataset.path;
                this.openProject(projectPath);
            });
        });

        // Add event listeners to action buttons
        grid.querySelectorAll('.project-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const projectPath = btn.closest('.project-card').dataset.path;
                this.handleProjectAction(action, projectPath);
            });
        });
    }

    createProjectCard(project) {
        const iconMap = {
            'react': 'fab fa-react',
            'vue': 'fab fa-vuejs',
            'node': 'fab fa-node-js',
            'python': 'fab fa-python',
            'web': 'fas fa-globe',
            'static': 'fas fa-file-code',
            'folder': 'fas fa-folder'
        };

        const icon = iconMap[project.type] || 'fas fa-folder';
        const modifiedDate = new Date(project.modified).toLocaleDateString();
        const size = this.formatBytes(project.size);

        return `
            <div class="project-card" data-path="${project.path}">
                <div class="project-header">
                    <div class="project-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="project-actions">
                        <button class="project-action" data-action="favorite" title="${project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                            <i class="fas fa-star${project.isFavorite ? '' : '-o'}"></i>
                        </button>
                        <button class="project-action" data-action="settings" title="Project settings">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button class="project-action" data-action="delete" title="Delete project">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="project-info">
                    <div class="project-name">${project.name}</div>
                    <div class="project-description">${project.description}</div>
                    <div class="project-meta">
                        <span class="project-type">
                            <i class="${icon}"></i>
                            ${project.type}
                        </span>
                        <span class="project-modified">${modifiedDate}</span>
                    </div>
                </div>
            </div>
        `;
    }

    getEmptyState() {
        const messages = {
            recent: {
                icon: 'fas fa-clock',
                title: 'No Recent Projects',
                message: 'Projects you work on will appear here'
            },
            favorites: {
                icon: 'fas fa-star',
                title: 'No Favorite Projects',
                message: 'Mark projects as favorites to see them here'
            },
            all: {
                icon: 'fas fa-folder-open',
                title: 'No Projects Found',
                message: 'Create a new project to get started'
            }
        };

        const state = messages[this.currentCategory];
        
        return `
            <div class="empty-state">
                <i class="${state.icon}"></i>
                <h3>${state.title}</h3>
                <p>${state.message}</p>
                <button class="action-btn primary" onclick="document.getElementById('new-project-btn').click()">
                    <i class="fas fa-plus"></i> Create New Project
                </button>
            </div>
        `;
    }

    showLoading() {
        document.getElementById('projects-grid').innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading projects...</p>
            </div>
        `;
    }

    showError(message) {
        document.getElementById('projects-grid').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error</h3>
                <p>${message}</p>
                <button class="action-btn" onclick="window.location.reload()">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }

    switchCategory(category) {
        this.currentCategory = category;
        
        // Update UI
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
        
        this.filterProjects();
        this.renderProjects();
    }

    showNewProjectModal() {
        document.getElementById('new-project-modal').classList.remove('hidden');
        document.getElementById('project-name').focus();
    }

    showImportModal() {
        document.getElementById('import-project-modal').classList.remove('hidden');
        // Reset form
        document.getElementById('import-form').style.display = 'none';
        document.getElementById('import-project').style.display = 'none';
        document.querySelectorAll('.import-option').forEach(o => o.classList.remove('selected'));
    }

    showImportForm(type) {
        const form = document.getElementById('import-form');
        const submitBtn = document.getElementById('import-project');
        
        // Hide all input groups
        document.querySelectorAll('[id$="-input-group"]').forEach(group => {
            group.style.display = 'none';
        });
        
        // Show relevant input group
        document.getElementById(`${type}-input-group`).style.display = 'block';
        
        form.style.display = 'block';
        submitBtn.style.display = 'inline-flex';
        
        // Update submit button text
        const texts = {
            folder: 'Import Folder',
            git: 'Clone Repository',
            zip: 'Extract ZIP'
        };
        submitBtn.innerHTML = `<i class="fas fa-download"></i> ${texts[type]}`;
    }

    async createProject() {
        const formData = {
            name: document.getElementById('project-name').value.trim(),
            description: document.getElementById('project-description').value.trim(),
            type: document.getElementById('project-type').value,
            location: document.getElementById('project-location').value,
            initGit: document.getElementById('init-git').checked,
            createReadme: document.getElementById('create-readme').checked
        };

        if (!formData.name) {
            alert('Please enter a project name');
            return;
        }

        // Validate project name
        if (!/^[a-z0-9-_]+$/i.test(formData.name)) {
            alert('Project name can only contain letters, numbers, hyphens, and underscores');
            return;
        }

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    ...formData
                })
            });

            const result = await response.json();
            
            if (result.success) {
                document.getElementById('new-project-modal').classList.add('hidden');
                this.openProject(result.project.path);
            } else {
                alert('Failed to create project: ' + result.error);
            }
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Failed to create project');
        }
    }

    async importProject() {
        const selectedOption = document.querySelector('.import-option.selected');
        if (!selectedOption) {
            alert('Please select an import method');
            return;
        }

        const type = selectedOption.dataset.type;
        const name = document.getElementById('import-name').value.trim();

        if (!name) {
            alert('Please enter a project name');
            return;
        }

        let source = '';
        switch (type) {
            case 'folder':
                source = document.getElementById('folder-path').value.trim();
                break;
            case 'git':
                source = document.getElementById('git-url').value.trim();
                break;
            case 'zip':
                source = document.getElementById('zip-file').value.trim();
                break;
        }

        if (!source) {
            alert('Please enter the source path/URL');
            return;
        }

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'import',
                    type,
                    source,
                    name,
                    location: this.currentStorage
                })
            });

            const result = await response.json();
            
            if (result.success) {
                document.getElementById('import-project-modal').classList.add('hidden');
                this.openProject(result.project.path);
            } else {
                alert('Failed to import project: ' + result.error);
            }
        } catch (error) {
            console.error('Error importing project:', error);
            alert('Failed to import project');
        }
    }

    async handleProjectAction(action, projectPath) {
        switch (action) {
            case 'favorite':
                await this.toggleFavorite(projectPath);
                break;
            case 'settings':
                this.showProjectSettings(projectPath);
                break;
            case 'delete':
                this.deleteProject(projectPath);
                break;
        }
    }

    async toggleFavorite(projectPath) {
        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggle-favorite',
                    path: projectPath
                })
            });

            if (response.ok) {
                this.loadProjects();
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    }

    showProjectSettings(projectPath) {
        // TODO: Implement project settings
        alert('Project settings coming soon!');
    }

    deleteProject(projectPath) {
        const project = this.projects.find(p => p.path === projectPath);
        if (!project) return;

        if (confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
            // TODO: Implement project deletion
            alert('Project deletion will be implemented');
        }
    }

    openProject(projectPath) {
        // Store selected project in localStorage
        localStorage.setItem('selectedProject', JSON.stringify({
            path: projectPath,
            timestamp: Date.now()
        }));

        // Redirect to IDE
        window.location.href = '/ide';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProjectSelector();
});