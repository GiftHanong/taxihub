import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'TaxiHub',
  storeName: 'taxihub_data',
  description: 'TaxiHub offline storage'
});

export const storage = {
  // Save taxi ranks
  async saveTaxiRanks(ranks) {
    return await localforage.setItem('taxi_ranks', ranks);
  },

  // Get taxi ranks
  async getTaxiRanks() {
    return await localforage.getItem('taxi_ranks');
  },

  // Save user's last search
  async saveLastSearch(search) {
    return await localforage.setItem('last_search', search);
  },

  // Get user's last search
  async getLastSearch() {
    return await localforage.getItem('last_search');
  },

  // Save queue data
  async saveQueueData(data) {
    return await localforage.setItem('queue_data', data);
  },

  // Get queue data
  async getQueueData() {
    return await localforage.getItem('queue_data');
  },

  // Clear all data
  async clearAll() {
    return await localforage.clear();
  }
};

export default storage;