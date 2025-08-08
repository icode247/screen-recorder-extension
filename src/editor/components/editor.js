// src/editor/editor.js
class VideoEditor {
    constructor() {
        this.currentProject = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.videoElement = null;
        this.canvasElement = null;
        this.ctx = null;
        this.animationFrame = null;
        this.cursorEvents = [];
        this.settings = {
            autoZoom: true,
            zoomLevel: 2.0,
            zoomDuration: 300,
            exportFormat: 'mp4',
            exportQuality: 'high'
        };

        this.init();
    }

    async init() {
        this.bindElements();
        this.bindEvents();
        await this.loadProjectFromURL();
        this.setupCanvas();
    }

    bindElements() {
        // Video elements
        this.videoElement = document.getElementById('video-preview');
        this.canvasElement = document.getElementById('preview-canvas');
        this.ctx = this.canvasElement?.getContext('2d');

        // Timeline elements
        this.timelineTrack = document.getElementById('timeline-track');
        this.playhead = document.getElementById('playhead');

        // Control elements
        this.playPauseBtn = document.getElementById('play-pause');
        this.resetBtn = document.getElementById('reset-timeline');

        // Property elements
        this.autoZoomCheckbox = document.getElementById('auto-zoom-enabled');
        this.zoomLevelSlider = document.getElementById('zoom-level');
        this.zoomDurationSlider = document.getElementById('zoom-duration');
        this.exportFormatSelect = document.getElementById('export-format');
        this.exportQualitySelect = document.getElementById('export-quality');

        // Info elements
        this.projectTitle = document.getElementById('project-title');
        this.totalDuration = document.getElementById('total-duration');
        this.currentTimeDisplay = document.getElementById('current-time');
        this.projectCreated = document.getElementById('project-created');
        this.projectDuration = document.getElementById('project-duration');
        this.projectEvents = document.getElementById('project-events');
        this.projectSize = document.getElementById('project-size');

        // Value displays
        this.zoomLevelValue = document.getElementById('zoom-level-value');
        this.zoomDurationValue = document.getElementById('zoom-duration-value');
    }

    bindEvents() {
        // Playback controls
        this.playPauseBtn?.addEventListener('click', () => this.togglePlayback());
        this.resetBtn?.addEventListener('click', () => this.resetPlayback());

        // Timeline interaction
        this.timelineTrack?.addEventListener('click', (e) => this.seekToPosition(e));

        // Property controls
        this.autoZoomCheckbox?.addEventListener('change', (e) => {
            this.settings.autoZoom = e.target.checked;
            this.updatePreview();
        });

        this.zoomLevelSlider?.addEventListener('input', (e) => {
            this.settings.zoomLevel = parseFloat(e.target.value);
            this.zoomLevelValue.textContent = `${e.target.value}x`;
            this.updatePreview();
        });

        this.zoomDurationSlider?.addEventListener('input', (e) => {
            this.settings.zoomDuration = parseInt(e.target.value);
            this.zoomDurationValue.textContent = `${e.target.value}ms`;
        });

        this.exportFormatSelect?.addEventListener('change', (e) => {
            this.settings.exportFormat = e.target.value;
        });

        this.exportQualitySelect?.addEventListener('change', (e) => {
            this.settings.exportQuality = e.target.value;
        });

        // Action buttons
        document.getElementById('save-project')?.addEventListener('click', () => this.saveProject());
        document.getElementById('export-video')?.addEventListener('click', () => this.exportVideo());
        document.getElementById('preview-zoom')?.addEventListener('click', () => this.previewZoom());
        document.getElementById('reset-zoom')?.addEventListener('click', () => this.resetZoom());
        document.getElementById('delete-project')?.addEventListener('click', () => this.deleteProject());

        // Video events
        if (this.videoElement) {
            this.videoElement.addEventListener('loadedmetadata', () => {
                this.duration = this.videoElement.duration;
                this.updateTimelineDisplay();
            });

            this.videoElement.addEventListener('timeupdate', () => {
                this.currentTime = this.videoElement.currentTime;
                this.updatePlayhead();
                this.updateCurrentTimeDisplay();
                this.updateZoomIndicator();
            });

            this.videoElement.addEventListener('ended', () => {
                this.isPlaying = false;
                this.updatePlayPauseButton();
            });
        }

        // Window events
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    async loadProjectFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('project');

        if (projectId) {
            await this.loadProject(projectId);
        } else {
            this.showError('No project specified');
        }
    }

    async loadProject(projectId) {
        try {
            this.showLoading('Loading project...');

            // In a real extension, this would use chrome.runtime.sendMessage
            const response = await this.sendMessage({
                action: 'LOAD_PROJECT',
                data: { projectId }
            });

            if (response && !response.error) {
                this.currentProject = response;
                this.cursorEvents = response.timeline?.cursorEvents || [];
                await this.setupProject();
            } else {
                throw new Error(response?.error || 'Failed to load project');
            }
        } catch (error) {
            console.error('Error loading project:', error);
            this.showError(`Failed to load project: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async setupProject() {
        if (!this.currentProject) return;

        // Update UI
        this.projectTitle.textContent = this.currentProject.name || 'Untitled Project';
        this.projectCreated.textContent = new Date(this.currentProject.createdAt).toLocaleDateString();
        this.projectDuration.textContent = this.formatDuration(this.currentProject.duration);
        this.projectEvents.textContent = this.cursorEvents.length.toString();

        // Load video
        await this.loadVideo();

        // Setup timeline
        this.setupTimeline();

        // Update settings from project
        if (this.currentProject.settings) {
            this.settings = { ...this.settings, ...this.currentProject.settings };
            this.updateSettingsUI();
        }
    }

    async loadVideo() {
        try {
            // In a real implementation, this would load the actual video data
            // For now, we'll create a placeholder or load from stored blobs
            const videoBlobs = await this.getProjectVideoBlobs();

            if (videoBlobs && videoBlobs.length > 0) {
                const combinedBlob = new Blob(videoBlobs, { type: 'video/mp4' });
                const videoUrl = URL.createObjectURL(combinedBlob);
                this.videoElement.src = videoUrl;
            } else {
                // Create a placeholder video for demo
                this.createPlaceholderVideo();
            }
        } catch (error) {
            console.error('Error loading video:', error);
            this.createPlaceholderVideo();
        }
    }

    createPlaceholderVideo() {
        // Create a simple canvas-based placeholder video
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');

        // Draw placeholder content
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CursorFlow Recording', canvas.width / 2, canvas.height / 2);

        // Convert to blob and set as video source (this is simplified)
        this.videoElement.style.background = '#1a1a1a';
        this.videoElement.poster = canvas.toDataURL();
    }

    async getProjectVideoBlobs() {
        try {
            // This would retrieve stored video blobs from chrome.storage
            const segments = this.currentProject.timeline?.videoSegments || [];
            const blobs = [];

            for (const segment of segments) {
                const blobData = await this.getBlobData(segment.blobId);
                if (blobData) {
                    blobs.push(this.base64ToBlob(blobData.data, blobData.type));
                }
            }

            return blobs;
        } catch (error) {
            console.error('Error getting video blobs:', error);
            return [];
        }
    }

    setupTimeline() {
        // Clear existing events
        const existingEvents = this.timelineTrack.querySelectorAll('.cursor-event');
        existingEvents.forEach(event => event.remove());

        // Add cursor events to timeline
        this.cursorEvents.forEach((event, index) => {
            const eventElement = document.createElement('div');
            eventElement.className = 'cursor-event';
            eventElement.style.left = `${(event.relativeTime / this.duration) * 100}%`;
            eventElement.title = `${event.type} at ${this.formatTime(event.relativeTime)}`;
            eventElement.addEventListener('click', () => this.seekToTime(event.relativeTime));

            this.timelineTrack.appendChild(eventElement);
        });

        this.updateTimelineDisplay();
    }

    setupCanvas() {
        if (!this.canvasElement || !this.videoElement) return;

        // Match canvas size to video
        const updateCanvasSize = () => {
            const rect = this.videoElement.getBoundingClientRect();
            this.canvasElement.width = rect.width;
            this.canvasElement.height = rect.height;
        };

        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);
    }

    togglePlayback() {
        if (!this.videoElement) return;

        if (this.isPlaying) {
            this.videoElement.pause();
            this.isPlaying = false;
        } else {
            this.videoElement.play();
            this.isPlaying = true;
        }

        this.updatePlayPauseButton();
    }

    resetPlayback() {
        if (!this.videoElement) return;

        this.videoElement.currentTime = 0;
        this.currentTime = 0;
        this.updatePlayhead();
        this.updateCurrentTimeDisplay();
        this.updateZoomIndicator();
    }

    seekToPosition(event) {
        if (!this.videoElement || !this.timelineTrack) return;

        const rect = this.timelineTrack.getBoundingClientRect();
        const position = (event.clientX - rect.left) / rect.width;
        const targetTime = position * this.duration;

        this.seekToTime(targetTime);
    }

    seekToTime(time) {
        if (!this.videoElement) return;

        this.videoElement.currentTime = Math.max(0, Math.min(time, this.duration));
        this.currentTime = this.videoElement.currentTime;
        this.updatePlayhead();
        this.updateCurrentTimeDisplay();
        this.updateZoomIndicator();
    }

    updatePlayhead() {
        if (!this.playhead || this.duration === 0) return;

        const position = (this.currentTime / this.duration) * 100;
        this.playhead.style.left = `${position}%`;
    }

    updateTimelineDisplay() {
        if (this.totalDuration) {
            this.totalDuration.textContent = this.formatTime(this.duration);
        }
    }

    updateCurrentTimeDisplay() {
        if (this.currentTimeDisplay) {
            this.currentTimeDisplay.textContent = this.formatTime(this.currentTime);
        }
    }

    updatePlayPauseButton() {
        if (!this.playPauseBtn) return;

        const icon = this.playPauseBtn.querySelector('svg');
        const text = this.playPauseBtn.querySelector('span') || this.playPauseBtn.childNodes[this.playPauseBtn.childNodes.length - 1];

        if (this.isPlaying) {
            icon.innerHTML = '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>';
            if (text) text.textContent = 'Pause';
        } else {
            icon.innerHTML = '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832L14 10.202a1 1 0 000-1.664l-4.445-2.37z" clip-rule="evenodd"/>';
            if (text) text.textContent = 'Play';
        }
    }

    updateZoomIndicator() {
        if (!this.settings.autoZoom) return;

        // Find the relevant cursor event for current time
        const currentEvent = this.findCursorEventAtTime(this.currentTime);

        if (currentEvent && currentEvent.type === 'mousemove') {
            this.showZoomIndicator(currentEvent.x, currentEvent.y);
        } else {
            this.hideZoomIndicator();
        }
    }

    findCursorEventAtTime(time) {
        const timeMs = time * 1000;
        return this.cursorEvents.find(event =>
            Math.abs(event.relativeTime - timeMs) < 100 // 100ms tolerance
        );
    }

    showZoomIndicator(x, y) {
        const indicator = document.getElementById('zoom-indicator');
        if (!indicator || !this.videoElement) return;

        const rect = this.videoElement.getBoundingClientRect();
        const centerX = (x / window.innerWidth) * rect.width;
        const centerY = (y / window.innerHeight) * rect.height;

        const zoomSize = Math.min(rect.width, rect.height) / this.settings.zoomLevel;

        indicator.style.left = `${centerX - zoomSize / 2}px`;
        indicator.style.top = `${centerY - zoomSize / 2}px`;
        indicator.style.width = `${zoomSize}px`;
        indicator.style.height = `${zoomSize}px`;
        indicator.classList.remove('hidden');
    }

    hideZoomIndicator() {
        const indicator = document.getElementById('zoom-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }

    updateSettingsUI() {
        if (this.autoZoomCheckbox) this.autoZoomCheckbox.checked = this.settings.autoZoom;
        if (this.zoomLevelSlider) {
            this.zoomLevelSlider.value = this.settings.zoomLevel;
            this.zoomLevelValue.textContent = `${this.settings.zoomLevel}x`;
        }
        if (this.zoomDurationSlider) {
            this.zoomDurationSlider.value = this.settings.zoomDuration;
            this.zoomDurationValue.textContent = `${this.settings.zoomDuration}ms`;
        }
        if (this.exportFormatSelect) this.exportFormatSelect.value = this.settings.exportFormat;
        if (this.exportQualitySelect) this.exportQualitySelect.value = this.settings.exportQuality;
    }

    updatePreview() {
        // This would trigger a re-render of the preview with new settings
        this.updateZoomIndicator();
    }

    previewZoom() {
        // Implement zoom preview functionality
        this.showNotification('Zoom preview feature coming soon!', 'info');
    }

    resetZoom() {
        this.settings.zoomLevel = 2.0;
        this.settings.zoomDuration = 300;
        this.updateSettingsUI();
        this.updatePreview();
        this.showNotification('Zoom settings reset to default', 'success');
    }

    async saveProject() {
        if (!this.currentProject) return;

        try {
            this.showLoading('Saving project...');

            const updatedProject = {
                ...this.currentProject,
                settings: this.settings,
                updatedAt: Date.now()
            };

            const response = await this.sendMessage({
                action: 'SAVE_PROJECT',
                data: { project: updatedProject }
            });

            if (response && !response.error) {
                this.currentProject = updatedProject;
                this.showNotification('Project saved successfully!', 'success');
            } else {
                throw new Error(response?.error || 'Failed to save project');
            }
        } catch (error) {
            console.error('Error saving project:', error);
            this.showNotification('Failed to save project', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async exportVideo() {
        if (!this.currentProject) return;

        try {
            this.showExportModal();

            const exportData = {
                projectId: this.currentProject.id,
                format: this.settings.exportFormat,
                quality: this.settings.exportQuality,
                settings: this.settings
            };

            const response = await this.sendMessage({
                action: 'EXPORT_VIDEO',
                data: exportData
            });

            if (response && response.success) {
                this.hideExportModal();

                // Create download link
                const a = document.createElement('a');
                a.href = response.downloadUrl;
                a.download = `${this.currentProject.name.replace(/[^a-z0-9]/gi, '_')}.${this.settings.exportFormat}`;
                a.click();

                this.showNotification('Video exported successfully!', 'success');
            } else {
                throw new Error(response?.error || 'Export failed');
            }
        } catch (error) {
            console.error('Error exporting video:', error);
            this.showNotification('Failed to export video', 'error');
            this.hideExportModal();
        }
    }

    async deleteProject() {
        if (!this.currentProject) return;

        const confirmed = confirm(`Are you sure you want to delete "${this.currentProject.name}"? This action cannot be undone.`);

        if (confirmed) {
            try {
                this.showLoading('Deleting project...');

                const response = await this.sendMessage({
                    action: 'DELETE_PROJECT',
                    data: { projectId: this.currentProject.id }
                });

                if (response && response.success) {
                    this.showNotification('Project deleted successfully', 'success');
                    // Redirect back to main extension
                    setTimeout(() => {
                        window.close();
                    }, 1500);
                } else {
                    throw new Error(response?.error || 'Failed to delete project');
                }
            } catch (error) {
                console.error('Error deleting project:', error);
                this.showNotification('Failed to delete project', 'error');
            } finally {
                this.hideLoading();
            }
        }
    }

    // Utility methods
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000) % 60;
        const minutes = Math.floor(ms / (1000 * 60));

        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.querySelector('span').textContent = message;
            overlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showExportModal() {
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.startExportProgress();
        }
    }

    hideExportModal() {
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.classList.add('hidden');
            this.stopExportProgress();
        }
    }

    startExportProgress() {
        let progress = 0;
        const progressBar = document.getElementById('export-progress');
        const statusText = document.getElementById('export-status');
        const percentageText = document.getElementById('export-percentage');

        const steps = [
            'Preparing video data...',
            'Processing cursor events...',
            'Applying zoom effects...',
            'Encoding video...',
            'Finalizing export...'
        ];

        this.exportInterval = setInterval(() => {
            progress += Math.random() * 20;
            progress = Math.min(progress, 95);

            const stepIndex = Math.floor((progress / 100) * steps.length);

            if (progressBar) progressBar.style.width = `${progress}%`;
            if (statusText) statusText.textContent = steps[stepIndex] || steps[steps.length - 1];
            if (percentageText) percentageText.textContent = `${Math.round(progress)}%`;

            if (progress >= 95) {
                clearInterval(this.exportInterval);
            }
        }, 500);
    }

    stopExportProgress() {
        if (this.exportInterval) {
            clearInterval(this.exportInterval);
        }
    }

    showNotification(message, type = 'info') {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 ${type === 'success' ? 'bg-green-500' :
                type === 'error' ? 'bg-red-500' :
                    type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
            }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    // Communication with extension
    async sendMessage(message) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage(message, resolve);
            } else {
                // Fallback for testing
                console.log('Would send message:', message);
                resolve({ success: true });
            }
        });
    }

    async getBlobData(blobId) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get([`blob_${blobId}`], (result) => {
                    resolve(result[`blob_${blobId}`]);
                });
            } else {
                resolve(null);
            }
        });
    }

    base64ToBlob(base64Data, contentType) {
        const byteCharacters = atob(base64Data.split(',')[1]);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);

            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        return new Blob(byteArrays, { type: contentType });
    }

    cleanup() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        if (this.exportInterval) {
            clearInterval(this.exportInterval);
        }

        // Clean up any object URLs
        if (this.videoElement && this.videoElement.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.videoElement.src);
        }
    }
}

// Initialize editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VideoEditor();
});