class RecordingsManager {
    constructor() {
        this.recordings = [];
        this.init();
    }

    async init() {
        await this.loadRecordings();
        this.updateStats();
        this.hideLoading();

        // Bind event listeners
        this.bindEventListeners();

        // Check if we should auto-open a specific recording
        this.checkForAutoOpen();
    }

    bindEventListeners() {
        // Debug button
        const debugBtn = document.getElementById('debugBtn');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.debugStorage());
        }

        // Modal close button
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeModal());
        }

        // Close modal when clicking outside
        const modal = document.getElementById('recordingModal');
        if (modal) {
            window.addEventListener('click', (event) => {
                if (event.target === modal) {
                    this.closeModal();
                }
            });
        }
    }

    closeModal() {
        document.getElementById('recordingModal').style.display = 'none';
    }

    checkForAutoOpen() {
        const urlParams = new URLSearchParams(window.location.search);
        const recordingId = urlParams.get('id');

        if (recordingId) {
            console.log('Auto-opening recording:', recordingId);
            // Auto-open the recording modal after a short delay
            setTimeout(() => {
                viewRecording(recordingId);
            }, 500);
        }
    }

    // Debug function to check storage
    async debugStorage() {
        try {
            const allData = await chrome.storage.local.get(null);
            console.log('All storage data:', allData);

            const recordings_list = await chrome.storage.local.get(['recordings_list']);
            console.log('Recordings list specifically:', recordings_list);

            // Check for any recording keys
            const recordingKeys = Object.keys(allData).filter(key => key.startsWith('recording_'));
            console.log('Found recording keys:', recordingKeys);

            return allData;
        } catch (error) {
            console.error('Error debugging storage:', error);
        }
    }

    async loadRecordings() {
        try {
            console.log('Loading recordings from storage...');

            // Get recordings list from storage
            const result = await chrome.storage.local.get(['recordings_list']);
            console.log('Storage result:', result);

            this.recordings = result.recordings_list || [];
            console.log('Loaded recordings:', this.recordings);

            if (this.recordings.length === 0) {
                console.log('No recordings found, showing empty state');
                this.showEmptyState();
            } else {
                console.log('Rendering', this.recordings.length, 'recordings');
                await this.renderRecordings();
            }
        } catch (error) {
            console.error('Error loading recordings:', error);
            this.showEmptyState();
        }
    }

    async renderRecordings() {
        const grid = document.getElementById('recordingsGrid');
        grid.innerHTML = '';
        grid.style.display = 'grid';

        for (const recording of this.recordings) {
            const card = await this.createRecordingCard(recording);
            grid.appendChild(card);
        }
    }

    async createRecordingCard(recording) {
        const card = document.createElement('div');
        card.className = 'recording-card';

        const date = new Date(recording.timestamp);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        const duration = this.formatDuration(recording.duration);
        const size = this.formatSize(recording.size);

        card.innerHTML = `
            <div class="recording-header">
                <div class="recording-title">Recording ${recording.id.split('_')[1]}</div>
                <div class="recording-date">${formattedDate}</div>
            </div>
            
            <div class="recording-info">
                <div class="info-row">
                    <span class="info-label">Duration:</span>
                    <span>${duration}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Size:</span>
                    <span>${size}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Quality:</span>
                    <span>${recording.settings.quality}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">FPS:</span>
                    <span>${recording.settings.fps}</span>
                </div>
            </div>

            <div class="recording-preview" id="preview_${recording.id}">
                <div class="preview-placeholder">🎬</div>
            </div>

            <div class="recording-actions">
                <button class="btn btn-primary" data-action="view" data-id="${recording.id}">
                    👁️ View
                </button>
                <button class="btn btn-success" data-action="download" data-id="${recording.id}">
                    ⬇️ Download
                </button>
                <button class="btn btn-danger" data-action="delete" data-id="${recording.id}">
                    🗑️ Delete
                </button>
            </div>
        `;

        // Add event listeners to buttons
        const viewBtn = card.querySelector('[data-action="view"]');
        const downloadBtn = card.querySelector('[data-action="download"]');
        const deleteBtn = card.querySelector('[data-action="delete"]');

        viewBtn.addEventListener('click', () => this.viewRecording(recording.id));
        downloadBtn.addEventListener('click', () => this.downloadRecording(recording.id));
        deleteBtn.addEventListener('click', () => this.deleteRecording(recording.id));

        // Try to create video preview
        this.createVideoPreview(recording.id);

        return card;
    }

    async viewRecording(recordingId) {
        try {
            console.log('Viewing recording:', recordingId);
            const result = await chrome.storage.local.get([`recording_${recordingId}`]);
            const recording = result[`recording_${recordingId}`];

            if (recording) {
                this.showRecordingModal(recording);
            } else {
                console.error('Recording not found:', recordingId);
                alert('Recording not found');
            }
        } catch (error) {
            console.error('Error viewing recording:', error);
            alert('Error loading recording');
        }
    }

    showRecordingModal(recording) {
        console.log('Showing modal for recording:', recording.id);
        const modal = document.getElementById('recordingModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');

        const date = new Date(recording.timestamp);
        modalTitle.textContent = `🎬 Recording from ${date.toLocaleDateString()} - ${date.toLocaleTimeString()}`;

        // Clear modal content
        modalContent.innerHTML = '';

        // Check if we have video data
        if (recording.videoData && recording.size > 0) {
            // Create video player
            const videoContainer = document.createElement('div');
            videoContainer.style.marginBottom = '20px';

            const video = document.createElement('video');
            video.controls = true;
            video.autoplay = true;
            video.style.width = '100%';
            video.style.maxHeight = '400px';
            video.style.borderRadius = '8px';
            video.style.background = '#000';

            // Convert base64 to blob URL
            fetch(recording.videoData)
                .then(response => response.blob())
                .then(blob => {
                    video.src = URL.createObjectURL(blob);
                })
                .catch(err => {
                    console.error('Error creating video blob:', err);
                    video.innerHTML = '<p style="color: white; text-align: center; padding: 20px;">Error loading video</p>';
                });

            videoContainer.appendChild(video);
            modalContent.appendChild(videoContainer);
        } else {
            // Show error message for recordings without video data
            const errorContainer = document.createElement('div');
            errorContainer.style.background = 'rgba(239, 68, 68, 0.2)';
            errorContainer.style.border = '1px solid rgba(239, 68, 68, 0.5)';
            errorContainer.style.borderRadius = '8px';
            errorContainer.style.padding = '20px';
            errorContainer.style.marginBottom = '20px';
            errorContainer.style.textAlign = 'center';
            errorContainer.innerHTML = `
                <h3>⚠️ No Video Data</h3>
                <p>This recording was saved but contains no video data.</p>
                <p>This might happen if the MediaRecorder failed to capture video chunks.</p>
            `;
            modalContent.appendChild(errorContainer);
        }

        // Create action buttons
        const actionButtons = document.createElement('div');
        actionButtons.style.display = 'flex';
        actionButtons.style.gap = '12px';
        actionButtons.style.marginBottom = '20px';

        if (recording.videoData && recording.size > 0) {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'btn btn-success';
            downloadBtn.textContent = '⬇️ Download Recording';
            downloadBtn.addEventListener('click', () => this.downloadRecording(recording.id));
            actionButtons.appendChild(downloadBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = '🗑️ Delete Recording';
        deleteBtn.addEventListener('click', () => {
            if (confirm('Delete this recording?')) {
                this.deleteRecording(recording.id);
                this.closeModal();
            }
        });
        actionButtons.appendChild(deleteBtn);

        modalContent.appendChild(actionButtons);

        // Create details section
        const details = document.createElement('div');
        details.innerHTML = `
            <h3 style="margin-bottom: 16px;">📊 Recording Details</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div>
                    <strong>⏱️ Duration:</strong> ${this.formatDuration(recording.duration)}<br>
                    <strong>💾 Size:</strong> ${this.formatSize(recording.size)}<br>
                    <strong>🎥 Quality:</strong> ${recording.settings.quality}<br>
                    <strong>🎬 FPS:</strong> ${recording.settings.fps}
                </div>
                <div>
                    <strong>🎯 Auto Zoom:</strong> ${recording.settings.autoZoom ? 'Enabled' : 'Disabled'}<br>
                    <strong>📄 Format:</strong> ${recording.mimeType}<br>
                    <strong>🖱️ Cursor Events:</strong> ${recording.cursorEvents?.length || 0}<br>
                    <strong>📅 Created:</strong> ${date.toLocaleDateString()}
                </div>
            </div>
        `;

        modalContent.appendChild(details);

        // Show success message if this was just recorded
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('id') === recording.id) {
            const successMsg = document.createElement('div');
            successMsg.style.background = 'rgba(34, 197, 94, 0.2)';
            successMsg.style.border = '1px solid rgba(34, 197, 94, 0.5)';
            successMsg.style.borderRadius = '8px';
            successMsg.style.padding = '12px';
            successMsg.style.marginBottom = '16px';
            successMsg.style.textAlign = 'center';
            successMsg.innerHTML = '✅ <strong>Recording completed!</strong> ' +
                (recording.size > 0 ? 'Your video is ready.' : 'Recording saved but video data may be missing.');

            modalContent.insertBefore(successMsg, modalContent.firstChild);

            // Remove the ID from URL
            window.history.replaceState({}, '', window.location.pathname);
        }

        modal.style.display = 'block';
    }

    async downloadRecording(recordingId) {
        try {
            await chrome.runtime.sendMessage({
                action: 'DOWNLOAD_RECORDING',
                data: { recordingId }
            });
        } catch (error) {
            console.error('Error downloading recording:', error);
            alert('Error downloading recording');
        }
    }

    async deleteRecording(recordingId) {
        if (!confirm('Are you sure you want to delete this recording?')) {
            return;
        }

        try {
            await chrome.runtime.sendMessage({
                action: 'DELETE_RECORDING',
                data: { recordingId }
            });

            // Reload the page to refresh the list
            location.reload();
        } catch (error) {
            console.error('Error deleting recording:', error);
            alert('Error deleting recording');
        }
    }

    async createVideoPreview(recordingId) {
        try {
            // Get full recording data
            const result = await chrome.storage.local.get([`recording_${recordingId}`]);
            const recording = result[`recording_${recordingId}`];

            if (recording && recording.videoData) {
                const previewContainer = document.getElementById(`preview_${recordingId}`);

                // Convert base64 to blob
                const response = await fetch(recording.videoData);
                const blob = await response.blob();
                const videoUrl = URL.createObjectURL(blob);

                const video = document.createElement('video');
                video.className = 'recording-video';
                video.src = videoUrl;
                video.controls = false;
                video.muted = true;
                video.preload = 'metadata';

                // Replace placeholder with video
                previewContainer.innerHTML = '';
                previewContainer.appendChild(video);

                // Clean up URL after some time
                setTimeout(() => URL.revokeObjectURL(videoUrl), 30000);
            }
        } catch (error) {
            console.error('Error creating video preview:', error);
        }
    }

    updateStats() {
        const totalRecordings = this.recordings.length;
        const totalDuration = this.recordings.reduce((sum, r) => sum + r.duration, 0);
        const totalSize = this.recordings.reduce((sum, r) => sum + r.size, 0);
        const lastRecording = this.recordings.length > 0 ?
            new Date(Math.max(...this.recordings.map(r => r.timestamp))) : null;

        document.getElementById('totalRecordings').textContent = totalRecordings;
        document.getElementById('totalDuration').textContent = this.formatDuration(totalDuration);
        document.getElementById('totalSize').textContent = this.formatSize(totalSize);
        document.getElementById('lastRecording').textContent =
            lastRecording ? this.formatRelativeTime(lastRecording) : 'Never';
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffMinutes > 0) {
            return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }

    showEmptyState() {
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('recordingsGrid').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
}

// Global functions for button handlers
async function viewRecording(recordingId) {
    try {
        const result = await chrome.storage.local.get([`recording_${recordingId}`]);
        const recording = result[`recording_${recordingId}`];

        if (recording) {
            showRecordingModal(recording);
        }
    } catch (error) {
        console.error('Error viewing recording:', error);
        alert('Error loading recording');
    }
}

async function downloadRecording(recordingId) {
    try {
        await chrome.runtime.sendMessage({
            action: 'DOWNLOAD_RECORDING',
            data: { recordingId }
        });
    } catch (error) {
        console.error('Error downloading recording:', error);
        alert('Error downloading recording');
    }
}

async function deleteRecording(recordingId) {
    if (!confirm('Are you sure you want to delete this recording?')) {
        return;
    }

    try {
        await chrome.runtime.sendMessage({
            action: 'DELETE_RECORDING',
            data: { recordingId }
        });

        // Reload the page to refresh the list
        location.reload();
    } catch (error) {
        console.error('Error deleting recording:', error);
        alert('Error deleting recording');
    }
}

function showRecordingModal(recording) {
    const modal = document.getElementById('recordingModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    const date = new Date(recording.timestamp);
    modalTitle.textContent = `🎬 Recording from ${date.toLocaleDateString()} - ${date.toLocaleTimeString()}`;

    // Create video player with autoplay for new recordings
    const videoContainer = document.createElement('div');
    videoContainer.style.marginBottom = '20px';

    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = true; // Auto-play when opened
    video.style.width = '100%';
    video.style.maxHeight = '400px';
    video.style.borderRadius = '8px';
    video.style.background = '#000';

    // Convert base64 to blob URL
    fetch(recording.videoData)
        .then(response => response.blob())
        .then(blob => {
            video.src = URL.createObjectURL(blob);
        });

    videoContainer.appendChild(video);

    // Create action buttons
    const actionButtons = document.createElement('div');
    actionButtons.style.display = 'flex';
    actionButtons.style.gap = '12px';
    actionButtons.style.marginBottom = '20px';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-success';
    downloadBtn.textContent = '⬇️ Download Recording';
    downloadBtn.addEventListener('click', () => this.downloadRecording(recording.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '🗑️ Delete Recording';
    deleteBtn.addEventListener('click', () => {
        if (confirm('Delete this recording?')) {
            this.deleteRecording(recording.id);
            this.closeModal();
        }
    });

    actionButtons.appendChild(downloadBtn);
    actionButtons.appendChild(deleteBtn);

    // Create details section
    const details = document.createElement('div');
    details.innerHTML = `
            <h3 style="margin-bottom: 16px;">📊 Recording Details</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div>
                    <strong>⏱️ Duration:</strong> ${this.formatDuration(recording.duration)}<br>
                    <strong>💾 Size:</strong> ${this.formatSize(recording.size)}<br>
                    <strong>🎥 Quality:</strong> ${recording.settings.quality}<br>
                    <strong>🎬 FPS:</strong> ${recording.settings.fps}
                </div>
                <div>
                    <strong>🎯 Auto Zoom:</strong> ${recording.settings.autoZoom ? 'Enabled' : 'Disabled'}<br>
                    <strong>📄 Format:</strong> ${recording.mimeType}<br>
                    <strong>🖱️ Cursor Events:</strong> ${recording.cursorEvents?.length || 0}<br>
                    <strong>📅 Created:</strong> ${date.toLocaleDateString()}
                </div>
            </div>
        `;

    modalContent.innerHTML = '';
    modalContent.appendChild(videoContainer);
    modalContent.appendChild(actionButtons);
    modalContent.appendChild(details);

    modal.style.display = 'block';

    // Show a success message if this was just recorded
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('id') === recording.id) {
        const successMsg = document.createElement('div');
        successMsg.style.background = 'rgba(34, 197, 94, 0.2)';
        successMsg.style.border = '1px solid rgba(34, 197, 94, 0.5)';
        successMsg.style.borderRadius = '8px';
        successMsg.style.padding = '12px';
        successMsg.style.marginBottom = '16px';
        successMsg.style.textAlign = 'center';
        successMsg.innerHTML = '✅ <strong>Recording completed successfully!</strong> Your video is ready to view and download.';

        modalContent.insertBefore(successMsg, modalContent.firstChild);

        // Remove the ID from URL to avoid showing success message on refresh
        window.history.replaceState({}, '', window.location.pathname);
    }
}

function closeModal() {
    document.getElementById('recordingModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('recordingModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Global debug function
async function debugStorage() {
    if (recordingsManager) {
        const data = await recordingsManager.debugStorage();
        alert('Check console for storage data');
    }
}

// Initialize the recordings manager
let recordingsManager;
document.addEventListener('DOMContentLoaded', () => {
    recordingsManager = new RecordingsManager();
});