// src/background/service-worker.js
import { RecordingManager } from './recording-manager.js';
import { ProjectManager } from './project-manager.js';
import { StorageManager } from './storage-manager.js';

class ServiceWorker {
  constructor() {
    this.recordingManager = new RecordingManager();
    this.projectManager = new ProjectManager();
    this.storageManager = new StorageManager();
    this.init();
  }

  init() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener(this.handleInstall.bind(this));
    
    // Handle messages from popup and content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Handle tab updates for recording state management
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    
    // Handle tab removal for cleanup
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
  }

  async handleInstall(details) {
    if (details.reason === 'install') {
      await this.storageManager.initializeStorage();
      console.log('CursorFlow extension installed');
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('Service worker received message:', message.action);
    
    const { action, data } = message;
    
    // Immediately call sendResponse to keep the port open
    const processMessage = async () => {
      try {
        let result;
        
        switch (action) {
          case 'START_RECORDING':
            result = await this.startRecording(data, sender);
            break;
          
          case 'STOP_RECORDING':
            result = await this.stopRecording(data);
            break;
          
          case 'PAUSE_RECORDING':
            result = await this.pauseRecording(data);
            break;
          
          case 'RESUME_RECORDING':
            result = await this.resumeRecording(data);
            break;
          
          case 'GET_RECORDING_STATE':
            result = await this.getRecordingState();
            break;
          
          case 'SAVE_PROJECT':
            result = await this.saveProject(data);
            break;
          
          case 'LOAD_PROJECT':
            result = await this.loadProject(data);
            break;
          
          case 'EXPORT_VIDEO':
            result = await this.exportVideo(data);
            break;
          
          case 'CURSOR_EVENT':
            result = await this.recordingManager.addCursorEvent(data);
            break;
          
          default:
            result = { success: false, error: `Unknown action: ${action}` };
        }
        
        console.log('Service worker sending response:', result);
        sendResponse(result);
        
      } catch (error) {
        console.error(`Error handling action ${action}:`, error);
        sendResponse({ success: false, error: error.message });
      }
    };

    // Process message asynchronously
    processMessage();
    
    // Return true to indicate we will respond asynchronously
    return true;
  }

  async startRecording(options, sender) {
    try {
      // Get the current active tab if sender.tab is not available
      let currentTab = sender.tab;
      
      if (!currentTab) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0) {
          currentTab = tabs[0];
        } else {
          throw new Error('No active tab found');
        }
      }

      // Request screen capture with proper error handling
      const streamId = await new Promise((resolve, reject) => {
        try {
          chrome.desktopCapture.chooseDesktopMedia(
            ['screen', 'window', 'tab'],
            currentTab,
            (streamId) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              
              if (streamId) {
                resolve(streamId);
              } else {
                reject(new Error('User cancelled screen capture or no permission granted'));
              }
            }
          );
        } catch (error) {
          reject(new Error(`Desktop capture failed: ${error.message}`));
        }
      });

      // Initialize recording session
      const recordingSession = await this.recordingManager.startRecording({
        streamId,
        tabId: currentTab.id,
        ...options
      });

      // Update extension badge
      try {
        chrome.action.setBadgeText({
          text: 'REC',
          tabId: currentTab.id
        });
        
        chrome.action.setBadgeBackgroundColor({
          color: '#ff0000',
          tabId: currentTab.id
        });
      } catch (badgeError) {
        console.warn('Could not set badge:', badgeError);
        // Don't fail the recording for badge issues
      }

      return { success: true, sessionId: recordingSession.id };
    } catch (error) {
      console.error('Failed to start recording:', error);
      return { success: false, error: error.message };
    }
  }

  async stopRecording(data) {
    const result = await this.recordingManager.stopRecording(data.sessionId);
    
    // Clear badge
    chrome.action.setBadgeText({ text: '' });
    
    // Auto-save project
    if (result.projectData) {
      await this.projectManager.saveProject(result.projectData);
    }
    
    return result;
  }

  async pauseRecording(data) {
    return await this.recordingManager.pauseRecording(data.sessionId);
  }

  async resumeRecording(data) {
    return await this.recordingManager.resumeRecording(data.sessionId);
  }

  async getRecordingState() {
    try {
      const state = await this.recordingManager.getState();
      console.log('Getting recording state:', state);
      return state;
    } catch (error) {
      console.error('Error getting recording state:', error);
      return {
        isRecording: false,
        sessions: []
      };
    }
  }

  async saveProject(data) {
    return await this.projectManager.saveProject(data.project);
  }

  async loadProject(data) {
    return await this.projectManager.loadProject(data.projectId);
  }

  async exportVideo(data) {
    return await this.recordingManager.exportVideo(data);
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && this.recordingManager.isRecording(tabId)) {
      // Reinject content script if needed
      await this.reinjectContentScript(tabId);
    }
  }

  async handleTabRemoved(tabId) {
    // Clean up any recordings for the closed tab
    await this.recordingManager.cleanupTab(tabId);
  }

  async reinjectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/cursor-tracker.js']
      });
    } catch (error) {
      console.warn('Failed to reinject content script:', error);
    }
  }
}

// Initialize service worker
new ServiceWorker();