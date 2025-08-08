// src/background/storage-manager.js
export class StorageManager {
  constructor() {
    this.defaultSettings = {
      quality: 'high',
      fps: 30,
      autoZoom: true,
      zoomLevel: 2,
      zoomDuration: 300,
      exportFormat: 'mp4',
      theme: 'light',
      notifications: true,
      autoSave: true,
      maxStorageUsage: 80 // percentage
    };
  }

  async initializeStorage() {
    try {
      // Check if first time setup
      const result = await this.getData('initialized');
      
      if (!result.initialized) {
        await this.performFirstTimeSetup();
      }

      // Run maintenance
      await this.performMaintenance();
      
      console.log('Storage initialized successfully');
    } catch (error) {
      console.error('Error initializing storage:', error);
    }
  }

  async performFirstTimeSetup() {
    const setupData = {
      initialized: true,
      installDate: Date.now(),
      version: '1.0.0',
      user_settings: this.defaultSettings,
      recent_projects: [],
      usage_stats: {
        recordingsCreated: 0,
        totalRecordingTime: 0,
        lastUsed: Date.now()
      }
    };

    await this.setData(setupData);
    console.log('First time setup completed');
  }

  async performMaintenance() {
    try {
      // Check storage usage
      const usage = await this.getStorageUsage();
      
      if (usage && usage.percentage > this.defaultSettings.maxStorageUsage) {
        console.warn(`Storage usage high: ${usage.percentage}%`);
        await this.cleanupStorage();
      }

      // Update last maintenance timestamp
      await this.setData({ lastMaintenance: Date.now() });
    } catch (error) {
      console.error('Error during maintenance:', error);
    }
  }

  async cleanupStorage() {
    try {
      console.log('Starting storage cleanup...');
      
      // Get all data
      const allData = await this.getAllData();
      let freedSpace = 0;

      // Clean up old temporary data
      const tempKeys = Object.keys(allData).filter(key => 
        key.startsWith('temp_') || key.startsWith('cache_')
      );
      
      if (tempKeys.length > 0) {
        await this.removeData(tempKeys);
        freedSpace += tempKeys.length;
        console.log(`Removed ${tempKeys.length} temporary files`);
      }

      // Clean up old blobs (older than 30 days and not referenced by projects)
      const blobKeys = Object.keys(allData).filter(key => key.startsWith('blob_'));
      const projectIds = this.getProjectIdsFromData(allData);
      
      const orphanedBlobs = [];
      const oldBlobs = [];
      
      for (const blobKey of blobKeys) {
        const blobData = allData[blobKey];
        const blobId = blobKey.replace('blob_', '');
        
        // Check if blob is referenced by any project
        const isReferenced = projectIds.some(projectId => blobId.includes(projectId));
        
        if (!isReferenced) {
          orphanedBlobs.push(blobKey);
        } else if (blobData.createdAt && (Date.now() - blobData.createdAt) > (30 * 24 * 60 * 60 * 1000)) {
          oldBlobs.push(blobKey);
        }
      }

      // Remove orphaned blobs first
      if (orphanedBlobs.length > 0) {
        await this.removeData(orphanedBlobs);
        freedSpace += orphanedBlobs.length;
        console.log(`Removed ${orphanedBlobs.length} orphaned blobs`);
      }

      // Remove old blobs if still over limit
      const usageAfterOrphans = await this.getStorageUsage();
      if (usageAfterOrphans && usageAfterOrphans.percentage > this.defaultSettings.maxStorageUsage) {
        // Remove oldest blobs first
        const blobsToRemove = oldBlobs.slice(0, Math.ceil(oldBlobs.length / 2));
        if (blobsToRemove.length > 0) {
          await this.removeData(blobsToRemove);
          freedSpace += blobsToRemove.length;
          console.log(`Removed ${blobsToRemove.length} old blobs`);
        }
      }

      console.log(`Storage cleanup completed. Freed ${freedSpace} items.`);
      
      // Update cleanup stats
      await this.updateCleanupStats(freedSpace);
      
    } catch (error) {
      console.error('Error during storage cleanup:', error);
    }
  }

  getProjectIdsFromData(allData) {
    return Object.keys(allData)
      .filter(key => key.startsWith('project_'))
      .map(key => allData[key]?.id)
      .filter(Boolean);
  }

  async updateCleanupStats(itemsFreed) {
    const stats = await this.getData('cleanup_stats');
    const currentStats = stats.cleanup_stats || {
      totalCleanups: 0,
      totalItemsFreed: 0,
      lastCleanup: null
    };

    const updatedStats = {
      totalCleanups: currentStats.totalCleanups + 1,
      totalItemsFreed: currentStats.totalItemsFreed + itemsFreed,
      lastCleanup: Date.now()
    };

    await this.setData({ cleanup_stats: updatedStats });
  }

  async getStorageUsage() {
    try {
      const bytesInUse = await new Promise((resolve) => {
        chrome.storage.local.getBytesInUse(null, resolve);
      });

      const quota = chrome.storage.local.QUOTA_BYTES || (10 * 1024 * 1024); // 10MB fallback
      
      return {
        used: bytesInUse,
        quota: quota,
        percentage: Math.round((bytesInUse / quota) * 100),
        available: quota - bytesInUse,
        formattedUsed: this.formatBytes(bytesInUse),
        formattedQuota: this.formatBytes(quota),
        formattedAvailable: this.formatBytes(quota - bytesInUse)
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return null;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async getUserSettings() {
    const result = await this.getData('user_settings');
    return { ...this.defaultSettings, ...result.user_settings };
  }

  async updateUserSettings(newSettings) {
    const currentSettings = await this.getUserSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    
    await this.setData({ user_settings: updatedSettings });
    return updatedSettings;
  }

  async resetUserSettings() {
    await this.setData({ user_settings: this.defaultSettings });
    return this.defaultSettings;
  }

  async updateUsageStats(stats) {
    const result = await this.getData('usage_stats');
    const currentStats = result.usage_stats || {
      recordingsCreated: 0,
      totalRecordingTime: 0,
      lastUsed: Date.now()
    };

    const updatedStats = {
      ...currentStats,
      ...stats,
      lastUsed: Date.now()
    };

    await this.setData({ usage_stats: updatedStats });
    return updatedStats;
  }

  async getUsageStats() {
    const result = await this.getData('usage_stats');
    return result.usage_stats || {
      recordingsCreated: 0,
      totalRecordingTime: 0,
      lastUsed: Date.now()
    };
  }

  async incrementRecordingCount() {
    const stats = await this.getUsageStats();
    return await this.updateUsageStats({
      recordingsCreated: stats.recordingsCreated + 1
    });
  }

  async addRecordingTime(duration) {
    const stats = await this.getUsageStats();
    return await this.updateUsageStats({
      totalRecordingTime: stats.totalRecordingTime + duration
    });
  }

  async saveTemporaryData(key, data, expirationMs = 3600000) { // 1 hour default
    const tempData = {
      data: data,
      createdAt: Date.now(),
      expiresAt: Date.now() + expirationMs
    };

    await this.setData({ [`temp_${key}`]: tempData });
  }

  async getTemporaryData(key) {
    const result = await this.getData(`temp_${key}`);
    const tempData = result[`temp_${key}`];

    if (!tempData) {
      return null;
    }

    // Check if expired
    if (Date.now() > tempData.expiresAt) {
      await this.removeData(`temp_${key}`);
      return null;
    }

    return tempData.data;
  }

  async clearTemporaryData() {
    const allData = await this.getAllData();
    const tempKeys = Object.keys(allData).filter(key => key.startsWith('temp_'));
    
    if (tempKeys.length > 0) {
      await this.removeData(tempKeys);
      console.log(`Cleared ${tempKeys.length} temporary data items`);
    }
  }

  async exportAllData() {
    try {
      const allData = await this.getAllData();
      const exportData = {
        exported_at: Date.now(),
        version: '1.0',
        data: allData
      };

      return {
        data: JSON.stringify(exportData, null, 2),
        filename: `cursorflow_backup_${Date.now()}.json`,
        mimeType: 'application/json'
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importAllData(importData, options = {}) {
    try {
      const { overwrite = false, skipBlobs = false } = options;
      
      let parsedData;
      if (typeof importData === 'string') {
        parsedData = JSON.parse(importData);
      } else {
        parsedData = importData;
      }

      if (!parsedData.data) {
        throw new Error('Invalid backup data format');
      }

      const dataToImport = parsedData.data;
      
      if (!overwrite) {
        // Merge with existing data, don't overwrite
        const existingData = await this.getAllData();
        Object.assign(existingData, dataToImport);
        await this.setData(existingData);
      } else {
        // Clear existing data first
        if (skipBlobs) {
          // Keep existing blobs, import everything else
          const existingData = await this.getAllData();
          const existingBlobs = {};
          
          Object.keys(existingData).forEach(key => {
            if (key.startsWith('blob_')) {
              existingBlobs[key] = existingData[key];
            }
          });
          
          await this.clearAllData();
          await this.setData({ ...dataToImport, ...existingBlobs });
        } else {
          await this.clearAllData();
          await this.setData(dataToImport);
        }
      }

      console.log('Data import completed successfully');
      return { success: true };
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  async getSystemInfo() {
    const usage = await this.getStorageUsage();
    const settings = await this.getUserSettings();
    const stats = await this.getUsageStats();
    
    return {
      storage: usage,
      settings: settings,
      stats: stats,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    };
  }

  // Core storage methods
  async getData(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  async setData(data) {
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

  async removeData(keys) {
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

  async getAllData() {
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

  // Event listeners for storage changes
  addStorageListener(callback) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        callback(changes);
      }
    });
  }

  removeStorageListener(callback) {
    chrome.storage.onChanged.removeListener(callback);
  }
}