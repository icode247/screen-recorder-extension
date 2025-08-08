// src/popup/popup.js
class PopupController {
    constructor() {
      this.currentSession = null;
      this.recordingTimer = null;
      this.startTime = null;
      this.pausedTime = 0;
      
      this.init();
    }
  
    async init() {
      this.bindEvents();
      await this.loadRecentProjects();
      await this.updateRecordingState();
      this.setupSettingsSync();
    }
  
    bindEvents() {
      // Recording controls
      document.getElementById('start-recording').addEventListener('click', () => this.startRecording());
      document.getElementById('pause-recording').addEventListener('click', () => this.pauseRecording());
      document.getElementById('resume-recording').addEventListener('click', () => this.resumeRecording());
      document.getElementById('stop-recording').addEventListener('click', () => this.stopRecording());
      document.getElementById('stop-paused-recording').addEventListener('click', () => this.stopRecording());
  
      // Settings
      document.getElementById('zoom-range').addEventListener('input', (e) => {
        document.getElementById('zoom-value').textContent = `${e.target.value}x`;
      });
  
      // Navigation
      document.getElementById('open-editor').addEventListener('click', () => this.openEditor());
      document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
  
      // Auto-save settings
      ['quality-select', 'fps-select', 'auto-zoom-toggle', 'zoom-range'].forEach(id => {
        const element = document.getElementById(id);
        element.addEventListener('change', () => this.saveSettings());
      });
    }
  
    async startRecording() {
      try {
        this.showLoading('Starting recording...');
        
        const settings = this.getRecordingSettings();
        
        const response = await this.sendMessage({
          action: 'START_RECORDING',
          data: settings
        });
  
        if (response.success) {
          this.currentSession = response.sessionId;
          this.startTime = Date.now();
          this.pausedTime = 0;
          this.showActiveRecording();
          this.startTimer();
          this.showNotification('Recording started!', 'success');
        } else {
          throw new Error(response.error || 'Failed to start recording');
        }
      } catch (error) {
        console.error('Error starting recording:', error);
        this.showNotification(error.message, 'error');
      } finally {
        this.hideLoading();
      }
    }
  
    async pauseRecording() {
      try {
        const response = await this.sendMessage({
          action: 'PAUSE_RECORDING',
          data: { sessionId: this.currentSession }
        });
  
        if (response.success) {
          this.pausedTime = Date.now();
          this.showPausedRecording();
          this.stopTimer();
          this.showNotification('Recording paused', 'info');
        }
      } catch (error) {
        console.error('Error pausing recording:', error);
        this.showNotification('Failed to pause recording', 'error');
      }
    }
  
    async resumeRecording() {
      try {
        const response = await this.sendMessage({
          action: 'RESUME_RECORDING',
          data: { sessionId: this.currentSession }
        });
  
        if (response.success) {
          // Adjust start time to account for pause duration
          const pauseDuration = Date.now() - this.pausedTime;
          this.startTime += pauseDuration;
          this.showActiveRecording();
          this.startTimer();
          this.showNotification('Recording resumed', 'success');
        }
      } catch (error) {
        console.error('Error resuming recording:', error);
        this.showNotification('Failed to resume recording', 'error');
      }
    }
  
    async stopRecording() {
      try {
        this.showLoading('Stopping recording...');
        
        const response = await this.sendMessage({
          action: 'STOP_RECORDING',
          data: { sessionId: this.currentSession }
        });
  
        if (response.success) {
          this.currentSession = null;
          this.showRecordingControls();
          this.stopTimer();
          await this.loadRecentProjects();
          this.showNotification(`Recording saved! Duration: ${this.formatDuration(response.duration)}`, 'success');
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        this.showNotification('Failed to stop recording', 'error');
      } finally {
        this.hideLoading();
      }
    }
  
    getRecordingSettings() {
      return {
        quality: document.getElementById('quality-select').value,
        fps: parseInt(document.getElementById('fps-select').value),
        autoZoom: document.getElementById('auto-zoom-toggle').checked,
        zoomLevel: parseFloat(document.getElementById('zoom-range').value),
        zoomDuration: 300 // ms
      };
    }
  
    async updateRecordingState() {
      try {
        const response = await this.sendMessage({ action: 'GET_RECORDING_STATE' });
        
        if (response.isRecording) {
          const session = response.sessions.find(s => s.state === 'recording' || s.state === 'paused');
          if (session) {
            this.currentSession = session.id;
            this.startTime = session.startTime;
            
            if (session.state === 'recording') {
              this.showActiveRecording();
              this.startTimer();
            } else if (session.state === 'paused') {
              this.showPausedRecording();
            }
          }
        }
      } catch (error) {
        console.error('Error updating recording state:', error);
      }
    }
  
    showRecordingControls() {
      document.getElementById('recording-controls').classList.remove('hidden');
      document.getElementById('active-recording').classList.add('hidden');
      document.getElementById('paused-recording').classList.add('hidden');
      document.getElementById('recording-status').classList.add('hidden');
    }
  
    showActiveRecording() {
      document.getElementById('recording-controls').classList.add('hidden');
      document.getElementById('active-recording').classList.remove('hidden');
      document.getElementById('paused-recording').classList.add('hidden');
      document.getElementById('recording-status').classList.remove('hidden');
    }
  
    showPausedRecording() {
      document.getElementById('recording-controls').classList.add('hidden');
      document.getElementById('active-recording').classList.add('hidden');
      document.getElementById('paused-recording').classList.remove('hidden');
      document.getElementById('recording-status').classList.add('hidden');
    }
  
    startTimer() {
      this.stopTimer(); // Clear any existing timer
      
      this.recordingTimer = setInterval(() => {
        const elapsed = Date.now() - this.startTime;
        const timerElement = document.getElementById('recording-timer') || document.getElementById('paused-timer');
        if (timerElement) {
          timerElement.textContent = this.formatTime(elapsed);
        }
      }, 1000);
    }
  
    stopTimer() {
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
        this.recordingTimer = null;
      }
    }
  
    formatTime(ms) {
      const seconds = Math.floor(ms / 1000) % 60;
      const minutes = Math.floor(ms / (1000 * 60)) % 60;
      const hours = Math.floor(ms / (1000 * 60 * 60));
      
      if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  
    formatDuration(ms) {
      const seconds = Math.floor(ms / 1000) % 60;
      const minutes = Math.floor(ms / (1000 * 60));
      
      if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      }
      return `${seconds}s`;
    }
  
    async loadRecentProjects() {
      try {
        const result = await this.getStorageData('recent_projects');
        const projects = result.recent_projects || [];
        
        const container = document.getElementById('recent-projects');
        
        if (projects.length === 0) {
          container.innerHTML = `
            <div class="text-sm text-gray-500 text-center py-4">
              No recordings yet. Start your first recording!
            </div>
          `;
          return;
        }
  
        container.innerHTML = projects.slice(0, 5).map(project => `
          <div class="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer project-item" data-project-id="${project.id}">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 truncate">${project.name}</div>
              <div class="text-xs text-gray-500">${this.formatDate(project.createdAt)} • ${this.formatDuration(project.duration)}</div>
            </div>
            <div class="flex space-x-1">
              <button class="edit-project text-blue-600 hover:text-blue-800" data-project-id="${project.id}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button class="export-project text-green-600 hover:text-green-800" data-project-id="${project.id}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </button>
            </div>
          </div>
        `).join('');
  
        // Bind project actions
        container.querySelectorAll('.edit-project').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editProject(btn.dataset.projectId);
          });
        });
  
        container.querySelectorAll('.export-project').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.exportProject(btn.dataset.projectId);
          });
        });
  
        container.querySelectorAll('.project-item').forEach(item => {
          item.addEventListener('click', () => {
            this.openProject(item.dataset.projectId);
          });
        });
  
      } catch (error) {
        console.error('Error loading recent projects:', error);
      }
    }
  
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleDateString();
    }
  
    async editProject(projectId) {
      this.openEditor(`?project=${projectId}`);
    }
  
    async exportProject(projectId) {
      try {
        this.showLoading('Exporting video...');
        
        const response = await this.sendMessage({
          action: 'EXPORT_VIDEO',
          data: { projectId, format: 'mp4', quality: 'high' }
        });
  
        if (response.success) {
          // Create download link
          const a = document.createElement('a');
          a.href = response.downloadUrl;
          a.download = `cursorflow-recording-${Date.now()}.mp4`;
          a.click();
          
          this.showNotification('Video exported successfully!', 'success');
        }
      } catch (error) {
        console.error('Error exporting project:', error);
        this.showNotification('Failed to export video', 'error');
      } finally {
        this.hideLoading();
      }
    }
  
    async openProject(projectId) {
      this.openEditor(`?project=${projectId}`);
    }
  
    openEditor(params = '') {
      const editorUrl = chrome.runtime.getURL(`src/editor/index.html${params}`);
      chrome.tabs.create({ url: editorUrl });
    }
  
    openSettings() {
      // Could open a settings page or expand settings in popup
      this.showNotification('Settings coming soon!', 'info');
    }
  
    async saveSettings() {
      const settings = {
        quality: document.getElementById('quality-select').value,
        fps: document.getElementById('fps-select').value,
        autoZoom: document.getElementById('auto-zoom-toggle').checked,
        zoomLevel: document.getElementById('zoom-range').value
      };
  
      await this.setStorageData({ user_settings: settings });
    }
  
    async setupSettingsSync() {
      try {
        const result = await this.getStorageData('user_settings');
        const settings = result.user_settings || {};
  
        if (settings.quality) document.getElementById('quality-select').value = settings.quality;
        if (settings.fps) document.getElementById('fps-select').value = settings.fps;
        if (settings.autoZoom !== undefined) document.getElementById('auto-zoom-toggle').checked = settings.autoZoom;
        if (settings.zoomLevel) {
          document.getElementById('zoom-range').value = settings.zoomLevel;
          document.getElementById('zoom-value').textContent = `${settings.zoomLevel}x`;
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  
    showLoading(message = 'Loading...') {
      const existingLoader = document.getElementById('loading-overlay');
      if (existingLoader) existingLoader.remove();
  
      const loader = document.createElement('div');
      loader.id = 'loading-overlay';
      loader.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      loader.innerHTML = `
        <div class="bg-white rounded-lg p-6 flex items-center space-x-3">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          <span class="text-gray-700">${message}</span>
        </div>
      `;
      document.body.appendChild(loader);
    }
  
    hideLoading() {
      const loader = document.getElementById('loading-overlay');
      if (loader) loader.remove();
    }
  
    showNotification(message, type = 'info') {
      const existingNotification = document.getElementById('notification');
      if (existingNotification) existingNotification.remove();
  
      const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500'
      };
  
      const notification = document.createElement('div');
      notification.id = 'notification';
      notification.className = `fixed top-4 left-4 right-4 ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg z-50 transform transition-transform duration-300`;
      notification.textContent = message;
  
      document.body.appendChild(notification);
  
      // Auto-hide after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.transform = 'translateY(-100%)';
          setTimeout(() => notification.remove(), 300);
        }
      }, 3000);
    }
  
    async sendMessage(message) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
    }
  
    async getStorageData(keys) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
      });
    }
  
    async setStorageData(data) {
      return new Promise((resolve) => {
        chrome.storage.local.set(data, resolve);
      });
    }
  }
  
  // Initialize popup when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
  });