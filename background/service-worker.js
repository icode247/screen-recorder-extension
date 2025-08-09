// CursorFlow Background Service Worker
class CursorFlowRecorder {
    constructor() {
        this.isRecording = false;
        this.currentSession = null;
        this.recordedChunks = [];
        this.cursorEvents = [];
        this.settings = null;
        this.init();
    }

    init() {
        this.bindEvents();
        console.log('CursorFlow service worker initialized');
    }

    bindEvents() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        chrome.action.onClicked.addListener(() => {
            chrome.action.openPopup();
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'GET_STATUS':
                    sendResponse({ isRecording: this.isRecording });
                    break;

                case 'START_RECORDING':
                    const result = await this.startRecording(message.data);
                    sendResponse(result);
                    break;

                case 'STOP_RECORDING':
                    const stopResult = await this.stopRecording();
                    sendResponse(stopResult);
                    break;

                case 'GET_RECORDINGS':
                    const recordings = await this.getRecordings();
                    sendResponse({ success: true, recordings });
                    break;

                case 'DOWNLOAD_RECORDING':
                    await this.downloadRecording(message.data.recordingId);
                    sendResponse({ success: true });
                    break;

                case 'DELETE_RECORDING':
                    await this.deleteRecording(message.data.recordingId);
                    sendResponse({ success: true });
                    break;

                case 'OPEN_RECORDINGS_TAB':
                    await this.openRecordingsTab();
                    sendResponse({ success: true });
                    break;

                case 'CURSOR_EVENT':
                    this.handleCursorEvent(message.data);
                    sendResponse({ success: true });
                    break;

                case 'RECORD_CHUNK':
                    if (message.data && message.data instanceof Blob) {
                        console.log('Received blob chunk:', message.data.size, 'bytes');
                        this.recordedChunks.push(message.data);
                    } else if (message.data) {
                        // Handle ArrayBuffer data
                        console.log('Received buffer chunk');
                        const uint8Array = new Uint8Array(message.data);
                        this.recordedChunks.push(uint8Array);
                    }
                    console.log('Total chunks so far:', this.recordedChunks.length);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async startRecording(settings) {
        if (this.isRecording) {
            return { success: false, error: 'Already recording' };
        }

        try {
            this.settings = settings;
            this.currentSession = {
                id: `recording_${Date.now()}`,
                startTime: Date.now(),
                settings: settings
            };

            // Initialize recording directly through content script
            const result = await this.initializeRecordingFromContentScript(settings);

            if (!result.success) {
                return { success: false, error: result.error };
            }

            this.isRecording = true;
            this.recordedChunks = [];
            this.cursorEvents = [];

            await this.notifyContentScript('START_CURSOR_TRACKING', {
                sessionId: this.currentSession.id,
                settings: settings
            });

            console.log('Recording started:', this.currentSession.id);
            return { success: true, sessionId: this.currentSession.id };

        } catch (error) {
            console.error('Error starting recording:', error);
            this.isRecording = false;
            this.currentSession = null;
            return { success: false, error: error.message };
        }
    }

    async stopRecording() {
        if (!this.isRecording) {
            return { success: false, error: 'Not recording' };
        }

        try {
            // Stop the MediaRecorder first
            await this.notifyContentScript('STOP_RECORDING', {
                sessionId: this.currentSession.id
            });

            // Wait longer for chunks to arrive
            console.log('Waiting for recording chunks...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('Total chunks received:', this.recordedChunks.length);

            let savedRecordingId = null;
            if (this.recordedChunks.length > 0) {
                savedRecordingId = await this.saveRecording();
            } else {
                console.warn('No recording chunks received - saving metadata only');
                // Save at least the metadata even if no video data
                savedRecordingId = await this.saveEmptyRecording();
            }

            this.isRecording = false;

            const sessionId = this.currentSession.id;
            this.currentSession = null;

            // Auto-open the recording that was just created
            if (savedRecordingId) {
                await this.openRecordingViewer(savedRecordingId);
            }

            console.log('Recording stopped and opened:', sessionId);
            return { success: true, sessionId, recordingId: savedRecordingId };

        } catch (error) {
            console.error('Error stopping recording:', error);
            this.isRecording = false;
            this.currentSession = null;
            return { success: false, error: error.message };
        }
    }

    async startRecording(settings) {
        if (this.isRecording) {
            return { success: false, error: 'Already recording' };
        }

        try {
            this.settings = settings;
            this.currentSession = {
                id: `recording_${Date.now()}`,
                startTime: Date.now(),
                settings: settings
            };

            // Get the active tab first
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Request screen capture from service worker but pass tab info
            const streamId = await this.requestScreenCapture(tab);

            if (!streamId) {
                return { success: false, error: 'Screen capture permission denied' };
            }

            await this.initializeRecording(streamId, tab.id);

            this.isRecording = true;
            this.recordedChunks = [];
            this.cursorEvents = [];

            await this.notifyContentScript('START_CURSOR_TRACKING', {
                sessionId: this.currentSession.id,
                settings: settings
            });

            console.log('Recording started:', this.currentSession.id);
            return { success: true, sessionId: this.currentSession.id };

        } catch (error) {
            console.error('Error starting recording:', error);
            this.isRecording = false;
            this.currentSession = null;
            return { success: false, error: error.message };
        }
    }

    requestScreenCapture(tab) {
        return new Promise((resolve, reject) => {
            chrome.desktopCapture.chooseDesktopMedia(
                ['screen', 'window', 'tab'],
                tab,  // Pass the tab object
                (streamId) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(streamId);
                    }
                }
            );
        });
    }

    async initializeRecording(streamId, tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: function (streamId, settings) {
                    const constraints = {
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: streamId,
                                maxWidth: settings.resolution.width,
                                maxHeight: settings.resolution.height,
                                maxFrameRate: settings.fps
                            }
                        },
                        audio: true
                    };

                    navigator.mediaDevices.getUserMedia(constraints)
                        .then(stream => {
                            const mediaRecorder = new MediaRecorder(stream, {
                                mimeType: 'video/webm;codecs=vp9'
                            });

                            mediaRecorder.ondataavailable = (event) => {
                                if (event.data.size > 0) {
                                    console.log('MediaRecorder chunk received:', event.data.size, 'bytes');
                                    chrome.runtime.sendMessage({
                                        action: 'RECORD_CHUNK',
                                        data: event.data
                                    }).catch(err => console.log('Send chunk error:', err));
                                }
                            };

                            mediaRecorder.onstop = () => {
                                console.log('MediaRecorder stopped');
                                // Force send any remaining data
                                mediaRecorder.requestData();
                                stream.getTracks().forEach(track => track.stop());
                            };

                            mediaRecorder.start(1000); // Record in 1-second chunks
                            console.log('MediaRecorder started');
                            window.cursorFlowRecorder = mediaRecorder;
                        })
                        .catch(error => {
                            console.error('Error accessing media:', error);
                        });
                },
                args: [streamId, this.settings]
            });

        } catch (error) {
            throw new Error('Failed to initialize recording: ' + error.message);
        }
    }

    handleCursorEvent(eventData) {
        if (this.isRecording && this.currentSession) {
            this.cursorEvents.push({
                ...eventData,
                sessionId: this.currentSession.id,
                timestamp: Date.now()
            });
        }
    }

    async notifyContentScript(action, data) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (action === 'STOP_RECORDING') {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: function () {
                        if (window.cursorFlowRecorder && window.cursorFlowRecorder.state === 'recording') {
                            console.log('Stopping MediaRecorder...');
                            window.cursorFlowRecorder.stop();
                        }
                    }
                });
            }

            await chrome.tabs.sendMessage(tab.id, { action, data });
        } catch (error) {
            console.log('Note: Content script notification failed (normal for extension pages):', error.message);
        }
    }

    async saveRecording() {
        if (!this.currentSession || this.recordedChunks.length === 0) {
            console.error('No recording data to save. Chunks:', this.recordedChunks.length);
            throw new Error('No recording data to save');
        }

        try {
            console.log('Saving recording with', this.recordedChunks.length, 'chunks');

            // Create blob from chunks
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            console.log('Created blob of size:', blob.size);

            const base64Data = await this.blobToBase64(blob);
            console.log('Converted to base64, length:', base64Data.length);

            const recording = {
                id: this.currentSession.id,
                timestamp: this.currentSession.startTime,
                settings: this.currentSession.settings,
                duration: Date.now() - this.currentSession.startTime,
                cursorEvents: this.cursorEvents,
                videoData: base64Data,
                size: blob.size,
                mimeType: 'video/webm'
            };

            await this.saveToStorage(recording);
            console.log('Recording saved successfully:', recording.id);

            return recording.id;

        } catch (error) {
            console.error('Error saving recording:', error);
            throw error;
        }
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async saveToStorage(recording) {
        const storageKey = `recording_${recording.id}`;

        await chrome.storage.local.set({
            [storageKey]: recording
        });

        const result = await chrome.storage.local.get(['recordings_list']);
        const recordingsList = result.recordings_list || [];

        recordingsList.unshift({
            id: recording.id,
            timestamp: recording.timestamp,
            duration: recording.duration,
            size: recording.size,
            settings: recording.settings
        });

        const updatedList = recordingsList.slice(0, 10);

        await chrome.storage.local.set({
            recordings_list: updatedList
        });
    }

    async getRecordings() {
        try {
            const result = await chrome.storage.local.get(['recordings_list']);
            return result.recordings_list || [];
        } catch (error) {
            console.error('Error getting recordings:', error);
            return [];
        }
    }

    async downloadRecording(recordingId) {
        try {
            const result = await chrome.storage.local.get([`recording_${recordingId}`]);
            const recording = result[`recording_${recordingId}`];

            if (!recording) {
                throw new Error('Recording not found');
            }

            const response = await fetch(recording.videoData);
            const blob = await response.blob();

            const url = URL.createObjectURL(blob);
            const filename = `cursorflow_${new Date(recording.timestamp).toISOString().slice(0, 19).replace(/[:.]/g, '-')}.webm`;

            await chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            });

            setTimeout(() => URL.revokeObjectURL(url), 1000);

        } catch (error) {
            console.error('Error downloading recording:', error);
            throw error;
        }
    }

    async deleteRecording(recordingId) {
        try {
            await chrome.storage.local.remove([`recording_${recordingId}`]);

            const result = await chrome.storage.local.get(['recordings_list']);
            const recordingsList = result.recordings_list || [];

            const updatedList = recordingsList.filter(r => r.id !== recordingId);

            await chrome.storage.local.set({
                recordings_list: updatedList
            });

        } catch (error) {
            console.error('Error deleting recording:', error);
            throw error;
        }
    }

    async openRecordingsTab() {
        const url = chrome.runtime.getURL('editor/recordings.html');
        await chrome.tabs.create({ url });
    }

    async saveEmptyRecording() {
        try {
            const recording = {
                id: this.currentSession.id,
                timestamp: this.currentSession.startTime,
                settings: this.currentSession.settings,
                duration: Date.now() - this.currentSession.startTime,
                cursorEvents: this.cursorEvents,
                videoData: null, // No video data
                size: 0,
                mimeType: 'video/webm',
                error: 'No video data received'
            };

            await this.saveToStorage(recording);
            console.log('Empty recording saved:', recording.id);

            return recording.id;
        } catch (error) {
            console.error('Error saving empty recording:', error);
            throw error;
        }
    }
}

// Initialize the recorder
const recorder = new CursorFlowRecorder();