

const AdminAPI = (() => {

  
  async function _req(method, path, body) {
    return FlyWay.api(method, path, body);
  }

  
  async function fetchStats() {
    return _req('GET', '/api/admin/stats');
  }

  
  async function fetchBookings() {
    return _req('GET', '/api/admin/bookings');
  }

  async function updateBooking(id, patch) {
    return _req('PATCH', `/api/admin/bookings/${id}`, patch);
  }

  async function deleteBooking(id) {
    return _req('DELETE', `/api/admin/bookings/${id}`);
  }

  async function deleteAllBookings() {
    return _req('DELETE', '/api/admin/bookings');
  }

  
  async function fetchTransactions() {
    return _req('GET', '/api/admin/transactions');
  }

  async function deleteTransaction(id) {
    return _req('DELETE', `/api/admin/transactions/${encodeURIComponent(id)}`);
  }

  async function deleteAllTransactions() {
    return _req('DELETE', '/api/admin/transactions');
  }

  
  async function fetchUsers() {
    return _req('GET', '/api/admin/users');
  }

  async function toggleUser(id) {
    return _req('PATCH', `/api/admin/users/${id}/toggle`, {});
  }

  async function deleteUser(id) {
    return _req('DELETE', `/api/admin/users/${id}`);
  }

  
  async function fetchMessages() {
    return _req('GET', '/api/admin/messages');
  }

  async function updateMessage(id, patch) {
    return _req('PATCH', `/api/admin/messages/${id}`, patch);
  }

  async function deleteMessage(id) {
    return _req('DELETE', `/api/admin/messages/${id}`);
  }

  async function deletePaymentReview(id) {
    return _req('DELETE', `/api/admin/payments/${encodeURIComponent(id)}`);
  }

  async function deleteAllMessages() {
    return _req('DELETE', '/api/admin/messages');
  }

  
  async function fetchPromos() {
    return _req('GET', '/api/admin/promos');
  }

  async function createPromo(data) {
    return _req('POST', '/api/admin/promos', data);
  }

  async function updatePromo(id, patch) {
    return _req('PATCH', `/api/admin/promos/${id}`, patch);
  }

  async function deletePromo(id) {
    return _req('DELETE', `/api/admin/promos/${id}`);
  }

  
  async function fetchLicenses() {
    return _req('GET', '/api/admin/licenses');
  }

  async function createLicense(data) {
    return _req('POST', '/api/admin/licenses', data);
  }

  async function updateLicense(key, patch) {
    return _req('PATCH', `/api/admin/licenses/${encodeURIComponent(key)}`, patch);
  }

  async function deleteLicense(key) {
    return _req('DELETE', `/api/admin/licenses/${encodeURIComponent(key)}`);
  }

  
  async function fetchUploads() {
    return _req('GET', '/api/admin/uploads');
  }

  async function deleteAllUploads() {
    return _req('DELETE', '/api/admin/uploads');
  }

  async function deleteUpload(filename) {
    return _req('DELETE', `/api/admin/uploads/${encodeURIComponent(filename)}`);
  }

  async function fetchLogs() {
    return _req('GET', '/api/admin/access-logs');
  }

  async function deleteLog(id) {
    return _req('DELETE', `/api/admin/access-logs/${encodeURIComponent(id)}`);
  }

  async function deleteAllLogs() {
    return _req('DELETE', '/api/admin/access-logs');
  }

  async function deleteAllPayments() {
    return _req('DELETE', '/api/admin/payments');
  }

  async function sendNotification(userId, type, title, message) {
    return _req('POST', '/api/admin/notify-user', { userId, type, title, message });
  }

  async function broadcastNotification(type, title, message) {
    return _req('POST', '/api/admin/notify-all', { type, title, message });
  }

  
  return {
    fetchStats, fetchBookings, updateBooking, deleteBooking, deleteAllBookings,
    fetchTransactions, deleteTransaction, deleteAllTransactions, fetchUsers, toggleUser, deleteUser,
    deletePaymentReview,
    fetchMessages, updateMessage, deleteMessage, deleteAllMessages,
    fetchPromos, createPromo, updatePromo, deletePromo,
    fetchLicenses, createLicense, updateLicense, deleteLicense,
    fetchUploads, deleteUpload, deleteAllUploads, fetchLogs, deleteLog, deleteAllLogs, deleteAllPayments,
    sendNotification, broadcastNotification,
  };
})();

window.AdminAPI = AdminAPI;
