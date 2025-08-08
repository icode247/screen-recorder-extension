// src/content/cursor-tracker.js
class CursorTracker {
    constructor() {
        this.isTracking = false;
        this.sessionId = null;
        this.mediaRecorder = null;
        this.recordedBlobs = [];
        this.startTime = null;
        this.stream = null;

        this.throttleDelay = 16; // ~60fps
        this.lastEventTime = 0;

        this.init();
    }

    init() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

        // Prevent multiple instances
        if (window.cursorTrackerInstance) {
            return;
        }
        window.cursorTrackerInstance = this;
    }

    async handleMessage(message, sender, sendResponse) {
        console.log('Content script received message:', message.action);

        const { action, data } = message;

        try {
            let result;

            switch (action) {
                case 'INIT_MEDIA_RECORDER':
                    result = await this.initMediaRecorder(data);
                    break;

                case 'START_CURSOR_TRACKING':
                    result = this.startCursorTracking(data);
                    break;

                case 'STOP_MEDIA_RECORDER':
                    result = await this.stopMediaRecorder(data);
                    break;

                case 'STOP_CURSOR_TRACKING':
                    result = this.stopCursorTracking(data);
                    break;

                case 'PAUSE_RECORDING':
                    result = this.pauseRecording(data);
                    break;

                case 'RESUME_RECORDING':
                    result = this.resumeRecording(data);
                    break;

                default:
                    result = { success: false, error: `Unknown action: ${action}` };
            }

            console.log('Content script sending response:', result);
            sendResponse(result);

        } catch (error) {
            console.error(`Error handling ${action}:`, error);
            sendResponse({ success: false, error: error.message });
        }

        return true; // Keep message channel open
    }

    async initMediaRecorder(data) {
        console.log('Content script initializing media recorder with stream ID:', data.streamId);

        try {
            // Get the screen capture stream using the provided stream ID
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: false, // Start without audio to simplify
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: data.streamId,
                        maxWidth: data.settings.quality === 'high' ? 1920 : 1280,
                        maxHeight: data.settings.quality === 'high' ? 1080 : 720,
                        maxFrameRate: data.settings.fps || 30
                    }
                }
            });

            console.log('Got media stream:', this.stream);

            // Initialize MediaRecorder
            const options = {
                mimeType: this.getSupportedMimeType(),
                videoBitsPerSecond: this.getVideoBitrate(data.settings.quality)
            };

            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.recordedBlobs = [];
            this.sessionId = data.sessionId;

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                console.log('Media recorder data available:', event.data.size);
                if (event.data && event.data.size > 0) {
                    this.recordedBlobs.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped, total blobs:', this.recordedBlobs.length);
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
            };

            this.mediaRecorder.onstart = () => {
                console.log('MediaRecorder started successfully');
            };

            // Start recording
            this.mediaRecorder.start(1000); // Collect data every second
            this.startTime = Date.now();

            console.log('MediaRecorder started with state:', this.mediaRecorder.state);
            return { success: true };

        } catch (error) {
            console.error('Failed to initialize media recorder:', error);
            return { success: false, error: error.message };
        }
    }

    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm',
            'video/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return ''; // Let MediaRecorder choose
    }

    getVideoBitrate(quality) {
        const bitrates = {
            low: 1000000,    // 1 Mbps
            medium: 2500000, // 2.5 Mbps
            high: 5000000,   // 5 Mbps
            ultra: 10000000  // 10 Mbps
        };

        return bitrates[quality] || bitrates.high;
    }

    startCursorTracking(data) {
        if (this.isTracking) {
            return { success: false, error: 'Already tracking' };
        }

        this.isTracking = true;
        this.sessionId = data.sessionId;

        // Add event listeners
        this.addEventListeners();

        console.log('Cursor tracking started');
        return { success: true };
    }

    addEventListeners() {
        // Mouse movement
        document.addEventListener('mousemove', this.handleMouseMove.bind(this), {
            passive: true,
            capture: true
        });

        // Mouse clicks
        document.addEventListener('mousedown', this.handleMouseDown.bind(this), {
            passive: true,
            capture: true
        });

        document.addEventListener('mouseup', this.handleMouseUp.bind(this), {
            passive: true,
            capture: true
        });

        // Mouse wheel
        document.addEventListener('wheel', this.handleWheel.bind(this), {
            passive: true,
            capture: true
        });

        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this), {
            passive: true,
            capture: true
        });

        document.addEventListener('keyup', this.handleKeyUp.bind(this), {
            passive: true,
            capture: true
        });

        // Window events
        window.addEventListener('resize', this.handleWindowResize.bind(this), {
            passive: true
        });

        window.addEventListener('scroll', this.handleScroll.bind(this), {
            passive: true
        });
    }

    removeEventListeners() {
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        document.removeEventListener('wheel', this.handleWheel.bind(this));
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        document.removeEventListener('keyup', this.handleKeyUp.bind(this));
        window.removeEventListener('resize', this.handleWindowResize.bind(this));
        window.removeEventListener('scroll', this.handleScroll.bind(this));
    }

    handleMouseMove(event) {
        if (!this.shouldRecordEvent()) return;

        this.sendCursorEvent({
            type: 'mousemove',
            x: event.clientX,
            y: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            screenX: event.screenX,
            screenY: event.screenY,
            target: this.getElementInfo(event.target)
        });
    }

    handleMouseDown(event) {
        this.sendCursorEvent({
            type: 'mousedown',
            button: event.button,
            buttons: event.buttons,
            x: event.clientX,
            y: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            target: this.getElementInfo(event.target)
        });
    }

    handleMouseUp(event) {
        this.sendCursorEvent({
            type: 'mouseup',
            button: event.button,
            buttons: event.buttons,
            x: event.clientX,
            y: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            target: this.getElementInfo(event.target)
        });
    }

    handleWheel(event) {
        this.sendCursorEvent({
            type: 'wheel',
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaZ: event.deltaZ,
            deltaMode: event.deltaMode,
            x: event.clientX,
            y: event.clientY,
            target: this.getElementInfo(event.target)
        });
    }

    handleKeyDown(event) {
        this.sendCursorEvent({
            type: 'keydown',
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            target: this.getElementInfo(event.target)
        });
    }

    handleKeyUp(event) {
        this.sendCursorEvent({
            type: 'keyup',
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            target: this.getElementInfo(event.target)
        });
    }

    handleWindowResize(event) {
        this.sendCursorEvent({
            type: 'resize',
            width: window.innerWidth,
            height: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight
        });
    }

    handleScroll(event) {
        if (!this.shouldRecordEvent()) return;

        this.sendCursorEvent({
            type: 'scroll',
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            target: this.getElementInfo(event.target)
        });
    }

    shouldRecordEvent() {
        const now = Date.now();
        if (now - this.lastEventTime < this.throttleDelay) {
            return false;
        }
        this.lastEventTime = now;
        return true;
    }

    getElementInfo(element) {
        if (!element) return null;

        return {
            tagName: element.tagName?.toLowerCase(),
            id: element.id || null,
            className: element.className || null,
            textContent: element.textContent?.slice(0, 100) || null,
            href: element.href || null,
            src: element.src || null,
            rect: element.getBoundingClientRect()
        };
    }

    sendCursorEvent(eventData) {
        if (!this.isTracking || !this.sessionId) return;

        chrome.runtime.sendMessage({
            action: 'CURSOR_EVENT',
            data: {
                sessionId: this.sessionId,
                ...eventData,
                timestamp: Date.now(),
                url: window.location.href,
                title: document.title,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    scrollX: window.scrollX,
                    scrollY: window.scrollY
                }
            }
        });
    }

    async stopMediaRecorder(data) {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
            return { success: false, error: 'No active recording' };
        }

        return new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                // Stop all tracks
                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                }

                resolve({
                    success: true,
                    videoBlobs: this.recordedBlobs,
                    duration: Date.now() - this.startTime
                });
            };

            this.mediaRecorder.stop();
        });
    }

    stopCursorTracking(data) {
        if (!this.isTracking) {
            return { success: false, error: 'Not tracking' };
        }

        this.isTracking = false;
        this.removeEventListeners();

        console.log('Cursor tracking stopped');
        return { success: true };
    }

    pauseRecording(data) {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
        }
        this.isTracking = false;
        return { success: true };
    }

    resumeRecording(data) {
        if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
        }
        this.isTracking = true;
        return { success: true };
    }
}

// Initialize cursor tracker
if (typeof window !== 'undefined') {
    new CursorTracker();
}