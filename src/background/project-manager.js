// src/background/project-manager.js
export class ProjectManager {
    constructor() {
        this.maxProjects = 100; // Limit stored projects
        this.maxProjectAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
    }

    async saveProject(projectData) {
        try {
            // Validate project data
            if (!projectData || !projectData.id) {
                throw new Error('Invalid project data');
            }

            // Store the project
            await this.setStorageData({
                [`project_${projectData.id}`]: {
                    ...projectData,
                    savedAt: Date.now()
                }
            });

            // Update recent projects list
            await this.updateRecentProjects(projectData);

            // Cleanup old projects
            await this.cleanupOldProjects();

            console.log(`Project saved: ${projectData.id}`);
            return { success: true, projectId: projectData.id };
        } catch (error) {
            console.error('Error saving project:', error);
            throw error;
        }
    }

    async loadProject(projectId) {
        try {
            const result = await this.getStorageData(`project_${projectId}`);
            const project = result[`project_${projectId}`];

            if (!project) {
                throw new Error('Project not found');
            }

            // Update last accessed time
            project.lastAccessed = Date.now();
            await this.setStorageData({
                [`project_${projectId}`]: project
            });

            return project;
        } catch (error) {
            console.error('Error loading project:', error);
            throw error;
        }
    }

    async deleteProject(projectId) {
        try {
            // Remove project data
            await this.removeStorageData(`project_${projectId}`);

            // Remove associated blobs
            await this.deleteProjectBlobs(projectId);

            // Update recent projects list
            await this.removeFromRecentProjects(projectId);

            console.log(`Project deleted: ${projectId}`);
            return { success: true };
        } catch (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    }

    async updateRecentProjects(projectData) {
        const result = await this.getStorageData('recent_projects');
        let recentProjects = result.recent_projects || [];

        // Remove existing entry if it exists
        recentProjects = recentProjects.filter(p => p.id !== projectData.id);

        // Add new entry at the beginning
        recentProjects.unshift({
            id: projectData.id,
            name: projectData.name,
            createdAt: projectData.createdAt,
            updatedAt: projectData.updatedAt,
            duration: projectData.duration,
            thumbnail: projectData.thumbnail || null
        });

        // Limit to recent items
        recentProjects = recentProjects.slice(0, 20);

        await this.setStorageData({ recent_projects: recentProjects });
    }

    async removeFromRecentProjects(projectId) {
        const result = await this.getStorageData('recent_projects');
        let recentProjects = result.recent_projects || [];

        recentProjects = recentProjects.filter(p => p.id !== projectId);
        await this.setStorageData({ recent_projects: recentProjects });
    }

    async getAllProjects(options = {}) {
        try {
            const { sortBy = 'updatedAt', sortOrder = 'desc', limit = 50 } = options;

            // Get all storage data
            const allData = await this.getAllStorageData();

            // Filter project entries
            const projects = Object.entries(allData)
                .filter(([key]) => key.startsWith('project_'))
                .map(([key, value]) => value)
                .filter(project => project && project.id);

            // Sort projects
            projects.sort((a, b) => {
                const aValue = a[sortBy] || 0;
                const bValue = b[sortBy] || 0;

                if (sortOrder === 'asc') {
                    return aValue - bValue;
                }
                return bValue - aValue;
            });

            // Apply limit
            return projects.slice(0, limit);
        } catch (error) {
            console.error('Error getting all projects:', error);
            return [];
        }
    }

    async searchProjects(query, options = {}) {
        try {
            const projects = await this.getAllProjects(options);

            if (!query || query.trim() === '') {
                return projects;
            }

            const searchTerm = query.toLowerCase().trim();

            return projects.filter(project => {
                return (
                    project.name?.toLowerCase().includes(searchTerm) ||
                    project.id?.toLowerCase().includes(searchTerm) ||
                    (project.tags && project.tags.some(tag =>
                        tag.toLowerCase().includes(searchTerm)
                    ))
                );
            });
        } catch (error) {
            console.error('Error searching projects:', error);
            return [];
        }
    }

    async updateProject(projectId, updates) {
        try {
            const project = await this.loadProject(projectId);

            const updatedProject = {
                ...project,
                ...updates,
                updatedAt: Date.now()
            };

            await this.saveProject(updatedProject);
            return updatedProject;
        } catch (error) {
            console.error('Error updating project:', error);
            throw error;
        }
    }

    async duplicateProject(projectId, newName = null) {
        try {
            const originalProject = await this.loadProject(projectId);

            const duplicatedProject = {
                ...originalProject,
                id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: newName || `${originalProject.name} (Copy)`,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // Duplicate associated blobs
            await this.duplicateProjectBlobs(originalProject.id, duplicatedProject.id);

            await this.saveProject(duplicatedProject);
            return duplicatedProject;
        } catch (error) {
            console.error('Error duplicating project:', error);
            throw error;
        }
    }

    async exportProject(projectId, format = 'json') {
        try {
            const project = await this.loadProject(projectId);

            if (format === 'json') {
                // Include blob data for complete export
                const blobData = await this.getProjectBlobs(projectId);

                const exportData = {
                    project,
                    blobs: blobData,
                    exportedAt: Date.now(),
                    version: '1.0'
                };

                return {
                    data: JSON.stringify(exportData, null, 2),
                    filename: `${project.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`,
                    mimeType: 'application/json'
                };
            }

            throw new Error(`Unsupported export format: ${format}`);
        } catch (error) {
            console.error('Error exporting project:', error);
            throw error;
        }
    }

    async importProject(importData, options = {}) {
        try {
            const { overwriteExisting = false } = options;

            let projectData;

            if (typeof importData === 'string') {
                projectData = JSON.parse(importData);
            } else {
                projectData = importData;
            }

            if (!projectData.project || !projectData.project.id) {
                throw new Error('Invalid project import data');
            }

            const project = projectData.project;
            const blobs = projectData.blobs || {};

            // Check if project already exists
            if (!overwriteExisting) {
                try {
                    await this.loadProject(project.id);
                    throw new Error('Project already exists. Use overwriteExisting option to replace.');
                } catch (error) {
                    if (!error.message.includes('Project not found')) {
                        throw error;
                    }
                    // Project doesn't exist, continue with import
                }
            }

            // Import blobs first
            for (const [blobId, blobData] of Object.entries(blobs)) {
                await this.setStorageData({
                    [`blob_${blobId}`]: blobData
                });
            }

            // Import project
            project.importedAt = Date.now();
            await this.saveProject(project);

            return project;
        } catch (error) {
            console.error('Error importing project:', error);
            throw error;
        }
    }

    async getProjectBlobs(projectId) {
        try {
            const allData = await this.getAllStorageData();
            const blobs = {};

            // Find all blobs associated with this project
            for (const [key, value] of Object.entries(allData)) {
                if (key.startsWith('blob_') && key.includes(projectId)) {
                    const blobId = key.replace('blob_', '');
                    blobs[blobId] = value;
                }
            }

            return blobs;
        } catch (error) {
            console.error('Error getting project blobs:', error);
            return {};
        }
    }

    async deleteProjectBlobs(projectId) {
        try {
            const allData = await this.getAllStorageData();
            const blobKeys = [];

            // Find all blob keys associated with this project
            for (const key of Object.keys(allData)) {
                if (key.startsWith('blob_') && key.includes(projectId)) {
                    blobKeys.push(key);
                }
            }

            // Remove blobs
            if (blobKeys.length > 0) {
                await this.removeStorageData(blobKeys);
            }

            console.log(`Deleted ${blobKeys.length} blobs for project ${projectId}`);
        } catch (error) {
            console.error('Error deleting project blobs:', error);
        }
    }

    async duplicateProjectBlobs(sourceProjectId, targetProjectId) {
        try {
            const sourceBlobs = await this.getProjectBlobs(sourceProjectId);
            const duplicatedBlobs = {};

            for (const [blobId, blobData] of Object.entries(sourceBlobs)) {
                const newBlobId = blobId.replace(sourceProjectId, targetProjectId);
                duplicatedBlobs[`blob_${newBlobId}`] = {
                    ...blobData,
                    createdAt: Date.now()
                };
            }

            if (Object.keys(duplicatedBlobs).length > 0) {
                await this.setStorageData(duplicatedBlobs);
            }

            console.log(`Duplicated ${Object.keys(duplicatedBlobs).length} blobs`);
        } catch (error) {
            console.error('Error duplicating project blobs:', error);
        }
    }

    async cleanupOldProjects() {
        try {
            const projects = await this.getAllProjects({ sortBy: 'updatedAt', sortOrder: 'asc' });
            const now = Date.now();

            // Delete projects older than maxProjectAge
            const oldProjects = projects.filter(project =>
                (now - (project.updatedAt || project.createdAt)) > this.maxProjectAge
            );

            // Delete excess projects if over limit
            const excessProjects = projects.slice(this.maxProjects);

            const projectsToDelete = [...oldProjects, ...excessProjects];

            for (const project of projectsToDelete) {
                await this.deleteProject(project.id);
                console.log(`Cleaned up old project: ${project.id}`);
            }

            if (projectsToDelete.length > 0) {
                console.log(`Cleaned up ${projectsToDelete.length} old projects`);
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    async getStorageUsage() {
        try {
            const usage = await new Promise((resolve) => {
                chrome.storage.local.getBytesInUse(null, resolve);
            });

            const quota = chrome.storage.local.QUOTA_BYTES || (5 * 1024 * 1024); // 5MB default

            return {
                used: usage,
                quota: quota,
                percentage: Math.round((usage / quota) * 100),
                available: quota - usage
            };
        } catch (error) {
            console.error('Error getting storage usage:', error);
            return null;
        }
    }

    // Storage helper methods
    async getStorageData(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, resolve);
        });
    }

    async setStorageData(data) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(data, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    async removeStorageData(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    async getAllStorageData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, resolve);
        });
    }

    async clearAllData() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.clear(() => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }
}