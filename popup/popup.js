class PopupController {
    constructor() {
        this.isRecording = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadRecordings();
        this.checkRecordingStatus();
    }

    bindEvents() {
        document.getElementById('startBtn').addEventListener('click', () => this.startRecording());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopRecording());
        document.getElementById('viewRecordingsBtn').addEventListener('click', () => this.openRecordingsTab());
    }

    async checkRecordingStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
            this.updateUI(response.isRecording);
        } catch (error) {
            console.error('Error checking recording status:', error);
        }
    }

    async startRecording() {
        try {
            const settings = this.getSettings();

            const response = await chrome.runtime.sendMessage({
                action: 'START_RECORDING',
                data: settings
            });

            if (response.success) {
                this.updateUI(true);
            } else {
                this.showError(response.error || 'Failed to start recording');
            }
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError('Failed to start recording');
        }
    }

    async stopRecording() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'STOP_RECORDING'
            });

            if (response.success) {
                this.updateUI(false);
                this.showSuccess('Recording saved successfully! Opening viewer...');

                // Close popup after a short delay to let user see the success message
                setTimeout(() => {
                    window.close();
                }, 1500);

                this.loadRecordings(); // Refresh recordings list
            } else {
                this.showError(response.error || 'Failed to stop recording');
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.showError('Failed to stop recording');
        }
    }

    getSettings() {
        const quality = document.getElementById('qualitySelect').value;
        const fps = parseInt(document.getElementById('fpsSelect').value);
        const autoZoom = document.getElementById('autoZoomSelect').value === 'true';

        // Convert quality to resolution
        const resolutions = {
            '720p': { width: 1280, height: 720 },
            '1080p': { width: 1920, height: 1080 },
            '1440p': { width: 2560, height: 1440 }
        };

        return {
            quality: quality,
            resolution: resolutions[quality],
            fps: fps,
            autoZoom: autoZoom,
            timestamp: Date.now()
        };
    }

    updateUI(isRecording) {
        this.isRecording = isRecording;
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const status = document.getElementById('status');
        const statusIcon = document.getElementById('statusIcon');
        const statusText = document.getElementById('statusText');

        if (isRecording) {
            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            status.classList.add('recording');
            statusIcon.textContent = '🔴';
            statusText.textContent = 'Recording...';
        } else {
            startBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
            status.classList.remove('recording');
            statusIcon.textContent = '⚫';
            statusText.textContent = 'Ready to Record';
        }
    }

    async loadRecordings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'GET_RECORDINGS' });

            if (response.success) {
                this.displayRecordings(response.recordings);
            }
        } catch (error) {
            console.error('Error loading recordings:', error);
        }
    }

    displayRecordings(recordings) {
        const recordingsList = document.getElementById('recordingsList');
        recordingsList.innerHTML = '';

        if (!recordings || recordings.length === 0) {
            recordingsList.innerHTML = '<div style="text-align: center; opacity: 0.7; font-size: 14px;">No recordings yet</div>';
            return;
        }

        recordings.slice(0, 3).forEach(recording => { // Show only last 3
            const item = document.createElement('div');
            item.className = 'recording-item';

            const name = document.createElement('div');
            name.className = 'recording-name';
            name.textContent = this.formatRecordingName(recording);

            const actions = document.createElement('div');
            actions.className = 'recording-actions';

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'btn-small';
            downloadBtn.textContent = '⬇️';
            downloadBtn.style.background = 'rgba(34, 197, 94, 0.8)';
            downloadBtn.style.color = 'white';
            downloadBtn.onclick = () => this.downloadRecording(recording.id);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-small';
            deleteBtn.textContent = '🗑️';
            deleteBtn.style.background = 'rgba(239, 68, 68, 0.8)';
            deleteBtn.style.color = 'white';
            deleteBtn.onclick = () => this.deleteRecording(recording.id);

            actions.appendChild(downloadBtn);
            actions.appendChild(deleteBtn);

            item.appendChild(name);
            item.appendChild(actions);
            recordingsList.appendChild(item);
        });
    }

    formatRecordingName(recording) {
        const date = new Date(recording.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString();
        return `Recording ${timeStr} - ${dateStr}`;
    }

    async downloadRecording(recordingId) {
        try {
            await chrome.runtime.sendMessage({
                action: 'DOWNLOAD_RECORDING',
                data: { recordingId }
            });
        } catch (error) {
            console.error('Error downloading recording:', error);
            this.showError('Failed to download recording');
        }
    }

    async deleteRecording(recordingId) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'DELETE_RECORDING',
                data: { recordingId }
            });

            if (response.success) {
                this.loadRecordings(); // Refresh list
            }
        } catch (error) {
            console.error('Error deleting recording:', error);
            this.showError('Failed to delete recording');
        }
    }

    async openRecordingsTab() {
        try {
            await chrome.runtime.sendMessage({ action: 'OPEN_RECORDINGS_TAB' });
            window.close(); // Close popup
        } catch (error) {
            console.error('Error opening recordings tab:', error);
        }
    }

    showError(message) {
        const statusText = document.getElementById('statusText');
        statusText.textContent = message;
        statusText.style.color = '#fca5a5';

        setTimeout(() => {
            statusText.style.color = '';
            statusText.textContent = this.isRecording ? 'Recording...' : 'Ready to Record';
        }, 3000);
    }

    showSuccess(message) {
        const statusText = document.getElementById('statusText');
        statusText.textContent = message;
        statusText.style.color = '#86efac';

        setTimeout(() => {
            statusText.style.color = '';
            statusText.textContent = this.isRecording ? 'Recording...' : 'Ready to Record';
        }, 3000);
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});