class CursorTracker {
    constructor() {
        this.isTracking = false;
        this.sessionId = null;
        this.settings = null;
        this.lastEvent = null;
        this.throttleDelay = 16; // ~60fps tracking

        this.init();
    }

    init() {
        this.bindEvents();
        console.log('CursorFlow cursor tracker initialized');
    }

    bindEvents() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        // Mouse event listeners
        this.throttledMouseMove = this.throttle(this.handleMouseMove.bind(this), this.throttleDelay);
        this.throttledMouseClick = this.throttle(this.handleMouseClick.bind(this), this.throttleDelay);
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'START_CURSOR_TRACKING':
                this.startTracking(message.data);
                sendResponse({ success: true });
                break;

            case 'STOP_CURSOR_TRACKING':
                this.stopTracking();
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }

    startTracking(data) {
        if (this.isTracking) {
            return;
        }

        this.isTracking = true;
        this.sessionId = data.sessionId;
        this.settings = data.settings;

        // Add event listeners
        document.addEventListener('mousemove', this.throttledMouseMove, true);
        document.addEventListener('click', this.throttledMouseClick, true);
        document.addEventListener('scroll', this.handleScroll.bind(this), true);

        console.log('Cursor tracking started for session:', this.sessionId);
    }

    stopTracking() {
        if (!this.isTracking) {
            return;
        }

        this.isTracking = false;

        // Remove event listeners
        document.removeEventListener('mousemove', this.throttledMouseMove, true);
        document.removeEventListener('click', this.throttledMouseClick, true);
        document.removeEventListener('scroll', this.handleScroll.bind(this), true);

        this.sessionId = null;
        this.settings = null;

        console.log('Cursor tracking stopped');
    }

    handleMouseMove(event) {
        if (!this.isTracking) return;

        const eventData = this.createEventData('mousemove', event);
        this.sendEventToBackground(eventData);
    }

    handleMouseClick(event) {
        if (!this.isTracking) return;

        const eventData = this.createEventData('click', event);
        this.sendEventToBackground(eventData);
    }

    handleScroll(event) {
        if (!this.isTracking) return;

        const eventData = this.createEventData('scroll', event);
        this.sendEventToBackground(eventData);
    }

    createEventData(type, event) {
        const rect = document.documentElement.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        const eventData = {
            type: type,
            x: event.clientX,
            y: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            screenX: event.screenX,
            screenY: event.screenY,
            viewport: viewport,
            scroll: {
                x: window.scrollX,
                y: window.scrollY
            },
            timestamp: Date.now(),
            url: window.location.href,
            title: document.title
        };

        // Add target element info for clicks
        if (type === 'click' && event.target) {
            eventData.target = {
                tagName: event.target.tagName,
                className: event.target.className,
                id: event.target.id,
                textContent: event.target.textContent?.slice(0, 50) || ''
            };
        }

        // Add scroll info for scroll events
        if (type === 'scroll') {
            eventData.scrollTop = event.target.scrollTop || window.scrollY;
            eventData.scrollLeft = event.target.scrollLeft || window.scrollX;
        }

        return eventData;
    }

    sendEventToBackground(eventData) {
        try {
            chrome.runtime.sendMessage({
                action: 'CURSOR_EVENT',
                data: eventData
            });
        } catch (error) {
            console.error('Error sending cursor event:', error);
        }
    }

    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;

        return function (...args) {
            const currentTime = Date.now();

            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }
}

// Initialize cursor tracker
const cursorTracker = new CursorTracker();