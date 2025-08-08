// src/background/recording-manager.js
export class RecordingManager {
    constructor() {
      this.activeSessions = new Map();
      this.recordingId = 0;
    }
  
    async startRecording(options) {
      const sessionId = `session_${++this.recordingId}_${Date.now()}`;
      
      const session = {
        id: sessionId,
        tabId: options.tabId,
        streamId: options.streamId,
        startTime: Date.now(),
        state: 'starting',
        cursorEvents: [],
        videoBlobs: [],
        settings: {
          quality: options.quality || 'high',
          fps: options.fps || 30,
          autoZoom: options.autoZoom !== false,
          zoomLevel: options.zoomLevel || 2,
          zoomDuration: options.zoomDuration || 300,
          ...options.settings
        }
      };
  
      this.activeSessions.set(sessionId, session);
      
      try {
        // Initialize media recording
        await this.initializeMediaRecorder(session);
        
        // Start cursor tracking
        await this.startCursorTracking(session);
        
        session.state = 'recording';
        console.log(`Recording started: ${sessionId}`);
        
        return session;
      } catch (error) {
        this.activeSessions.delete(sessionId);
        throw error;
      }
    }
  
    async initializeMediaRecorder(session) {
      console.log('Initializing media recorder for session:', session.id);
      
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Media recorder initialization timeout after 15 seconds'));
        }, 15000);
  
        try {
          chrome.tabs.sendMessage(session.tabId, {
            action: 'INIT_MEDIA_RECORDER',
            data: {
              sessionId: session.id,
              streamId: session.streamId,
              settings: session.settings
            }
          }, (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              console.error('Failed to send message to content script:', chrome.runtime.lastError);
              reject(new Error(`Content script communication failed: ${chrome.runtime.lastError.message}`));
              return;
            }
            
            if (response?.success) {
              console.log('Media recorder initialized successfully');
              resolve();
            } else {
              const errorMsg = response?.error || 'Content script failed to initialize media recorder';
              console.error('Media recorder initialization failed:', errorMsg);
              reject(new Error(errorMsg));
            }
          });
        } catch (error) {
          clearTimeout(timeoutId);
          reject(new Error(`Failed to communicate with content script: ${error.message}`));
        }
      });
    }
  
    async startCursorTracking(session) {
      // Send message to content script to start cursor tracking
      chrome.tabs.sendMessage(session.tabId, {
        action: 'START_CURSOR_TRACKING',
        data: { sessionId: session.id }
      });
    }
  
    async stopRecording(sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Recording session not found: ${sessionId}`);
      }
  
      session.state = 'stopping';
      session.endTime = Date.now();
  
      try {
        // Stop media recorder
        await this.stopMediaRecorder(session);
        
        // Stop cursor tracking
        await this.stopCursorTracking(session);
        
        // Generate project data
        const projectData = await this.generateProjectData(session);
        
        session.state = 'stopped';
        this.activeSessions.delete(sessionId);
        
        return {
          success: true,
          sessionId,
          duration: session.endTime - session.startTime,
          projectData
        };
      } catch (error) {
        session.state = 'error';
        throw error;
      }
    }
  
    async stopMediaRecorder(session) {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(session.tabId, {
          action: 'STOP_MEDIA_RECORDER',
          data: { sessionId: session.id }
        }, (response) => {
          if (response?.success) {
            session.videoBlobs = response.videoBlobs || [];
            resolve();
          } else {
            reject(new Error(response?.error || 'Failed to stop media recorder'));
          }
        });
      });
    }
  
    async stopCursorTracking(session) {
      chrome.tabs.sendMessage(session.tabId, {
        action: 'STOP_CURSOR_TRACKING',
        data: { sessionId: session.id }
      });
    }
  
    async pauseRecording(sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (!session || session.state !== 'recording') {
        throw new Error('Invalid session state for pause');
      }
  
      session.state = 'paused';
      session.pauseTime = Date.now();
  
      chrome.tabs.sendMessage(session.tabId, {
        action: 'PAUSE_RECORDING',
        data: { sessionId }
      });
  
      return { success: true, state: 'paused' };
    }
  
    async resumeRecording(sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (!session || session.state !== 'paused') {
        throw new Error('Invalid session state for resume');
      }
  
      session.state = 'recording';
      const pauseDuration = Date.now() - session.pauseTime;
      session.totalPauseDuration = (session.totalPauseDuration || 0) + pauseDuration;
  
      chrome.tabs.sendMessage(session.tabId, {
        action: 'RESUME_RECORDING',
        data: { sessionId }
      });
  
      return { success: true, state: 'recording' };
    }
  
    async addCursorEvent(eventData) {
      const session = this.activeSessions.get(eventData.sessionId);
      if (!session) return { success: false, error: 'Session not found' };
  
      const event = {
        ...eventData,
        timestamp: Date.now() - session.startTime,
        relativeTime: Date.now() - session.startTime - (session.totalPauseDuration || 0)
      };
  
      session.cursorEvents.push(event);
      return { success: true };
    }
  
    async generateProjectData(session) {
      const project = {
        id: `project_${session.id}`,
        name: `Recording ${new Date().toLocaleString()}`,
        createdAt: session.startTime,
        updatedAt: Date.now(),
        duration: session.endTime - session.startTime,
        settings: session.settings,
        timeline: {
          duration: session.endTime - session.startTime,
          cursorEvents: session.cursorEvents,
          videoSegments: session.videoBlobs.map((blob, index) => ({
            id: `segment_${index}`,
            startTime: index * 1000, // Approximate
            duration: 1000, // Approximate
            blobId: `${session.id}_${index}`,
            size: blob.size,
            type: blob.type
          }))
        },
        export: {
          formats: ['mp4', 'webm'],
          quality: session.settings.quality,
          resolution: '1920x1080' // Will be detected from actual recording
        }
      };
  
      // Store video blobs
      for (let i = 0; i < session.videoBlobs.length; i++) {
        const blobId = `${session.id}_${i}`;
        await this.storeBlobData(blobId, session.videoBlobs[i]);
      }
  
      return project;
    }
  
    async storeBlobData(blobId, blob) {
      // Convert blob to base64 for storage
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          chrome.storage.local.set({
            [`blob_${blobId}`]: {
              data: reader.result,
              type: blob.type,
              size: blob.size,
              createdAt: Date.now()
            }
          }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  
    async exportVideo(data) {
      const { projectId, format = 'mp4', quality = 'high' } = data;
      
      // This would integrate with the video processing pipeline
      // For now, return the stored blobs
      const project = await this.loadProjectData(projectId);
      if (!project) {
        throw new Error('Project not found');
      }
  
      // In a full implementation, this would:
      // 1. Load all video segments
      // 2. Apply cursor-following zoom transforms
      // 3. Render to canvas with WebCodecs or fallback
      // 4. Export using MediaRecorder or ffmpeg.wasm
      
      return {
        success: true,
        downloadUrl: await this.generateDownloadUrl(project),
        format,
        quality
      };
    }
  
    async generateDownloadUrl(project) {
      // Combine all video segments and return blob URL
      // This is a simplified implementation
      const blobs = [];
      
      for (const segment of project.timeline.videoSegments) {
        const blobData = await this.getBlobData(segment.blobId);
        if (blobData) {
          blobs.push(this.base64ToBlob(blobData.data, blobData.type));
        }
      }
      
      if (blobs.length === 0) {
        throw new Error('No video data found');
      }
      
      // For multiple blobs, you'd need to concatenate them properly
      const combinedBlob = blobs[0]; // Simplified
      return URL.createObjectURL(combinedBlob);
    }
  
    async getBlobData(blobId) {
      return new Promise((resolve) => {
        chrome.storage.local.get([`blob_${blobId}`], (result) => {
          resolve(result[`blob_${blobId}`]);
        });
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
  
    isRecording(tabId) {
      for (const session of this.activeSessions.values()) {
        if (session.tabId === tabId && session.state === 'recording') {
          return true;
        }
      }
      return false;
    }
  
    async getState() {
      const sessions = Array.from(this.activeSessions.values()).map(session => ({
        id: session.id,
        tabId: session.tabId,
        state: session.state,
        startTime: session.startTime,
        duration: Date.now() - session.startTime
      }));
  
      return {
        isRecording: sessions.some(s => s.state === 'recording'),
        sessions
      };
    }
  
    async cleanupTab(tabId) {
      const sessionsToCleanup = [];
      
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (session.tabId === tabId) {
          sessionsToCleanup.push(sessionId);
        }
      }
      
      for (const sessionId of sessionsToCleanup) {
        try {
          await this.stopRecording(sessionId);
        } catch (error) {
          console.warn(`Error cleaning up session ${sessionId}:`, error);
          this.activeSessions.delete(sessionId);
        }
      }
    }
  }