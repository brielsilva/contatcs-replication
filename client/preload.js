const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  addContact: (contact) => ipcRenderer.invoke('add-contact', contact),
  updateContact: (contact) => ipcRenderer.invoke('update-contact', contact),
  getAllContacts: () => ipcRenderer.invoke('get-all-contacts'),
  removeContact: (contactRequest) => ipcRenderer.invoke('remove-contact', contactRequest),
  onAgendaServiceConnected: (callback) => ipcRenderer.on('agenda-service-connected', (event,url) => callback(url)),
  onAgendaServiceDown: (callback) => ipcRenderer.on('agenda-service-down', callback),
  onContactChanged: (callback) => ipcRenderer.on('contact-changed', (event, changeRequest) => callback(changeRequest)),
});