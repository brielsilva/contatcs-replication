const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

let mainWindow;
let agendaClient;
let nameServiceClient;

let updateStream;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true, 
      preload: path.join(__dirname, 'preload.js'), 
    },
  });

  mainWindow.loadFile('index.html');

  
  connectToNameService();
}

function connectToNameService() {
  
  const nameServiceProtoPath = path.join(__dirname, '..', 'proto', 'name_service.proto');
  const nameServicePackageDef = protoLoader.loadSync(nameServiceProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const nameServiceProto = grpc.loadPackageDefinition(nameServicePackageDef);

  
  nameServiceClient = new nameServiceProto.NameService('localhost:50051', grpc.credentials.createInsecure());

  
  nameServiceClient.GetServices({}, (error, response) => {
    if (error) {
      console.error('Erro ao conectar ao Servidor de Nomes:', error);
      dialog.showErrorBox('Erro', 'Não foi possível conectar ao Servidor de Nomes.');
    } else {
      let services = response.services;
      
      let agendaServices = services.filter((s) => s.name === 'AgendaService');

      if (agendaServices.length === 0) {
        dialog.showErrorBox('Nenhum Serviço de Agenda', 'Nenhum Serviço de Agenda está disponível.');
      } else {
        
        let agendaUrls = agendaServices.map((s) => s.url);
        dialog
          .showMessageBox(mainWindow, {
            type: 'info',
            buttons: agendaUrls,
            title: 'Selecione o Serviço de Agenda',
            message: 'Por favor, selecione um Serviço de Agenda para se conectar:',
          })
          .then((result) => {
            let selectedUrl = agendaUrls[result.response];
            
            connectToAgendaService(selectedUrl);
          });
      }
    }
  });
}

function connectToAgendaService(url) {
  
  const agendaServiceProtoPath = path.join(__dirname, '..', 'proto', 'agenda_service.proto');
  const agendaServicePackageDef = protoLoader.loadSync(agendaServiceProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const agendaServiceProto = grpc.loadPackageDefinition(agendaServicePackageDef);

  if (updateStream) {
    console.log('Encerrando o stream anterior antes de se conectar a uma nova agenda.');
    updateStream.removeAllListeners(); 
    updateStream.end(); 
  }

  agendaClient = new agendaServiceProto.AgendaService(url, grpc.credentials.createInsecure());
  
  mainWindow.webContents.send('agenda-service-connected',url);

  
  startHeartbeat();

  exchangeUpdates();
}

function exchangeUpdates() {
  if (updateStream) {
    console.log('Encerrando o stream anterior antes de se conectar a uma nova agenda.');
    updateStream.removeAllListeners(); 
    updateStream.end();
  } 
  if(updateStream !== null)  {
    updateStream = agendaClient.ExchangeUpdates();
  
    
    updateStream.on('data', (changeRequest) => {
      mainWindow.webContents.send('contact-changed', changeRequest);
    });
  
    updateStream.on('error', (error) => {
      console.error('Erro no stream bidirecional:', error);
      
      setTimeout(exchangeUpdates, 5000);
    });
  
    updateStream.on('end', () => {
      console.log('Stream bidirecional encerrado pelo servidor');
      
      setTimeout(exchangeUpdates, 5000);
    });
  }

  
  
}

let heartbeatInterval;

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(() => {
    
    agendaClient.GetAllContacts({}, (error, response) => {
      if (error) {
        console.error('AgendaService caiu:', error);
        
        mainWindow.webContents.send('agenda-service-down');
        
        connectToNameService();
      } else {
        
      }
    });
  }, 5000); 
}


ipcMain.handle('add-contact', async (event, contact) => {
  return new Promise((resolve, reject) => {
    agendaClient.AddContact(contact, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
});

ipcMain.handle('update-contact', async (event, contact) => {
  return new Promise((resolve, reject) => {
    agendaClient.UpdateContact(contact, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
});

ipcMain.handle('get-all-contacts', async (event) => {
  return new Promise((resolve, reject) => {
    agendaClient.GetAllContacts({}, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response.contacts);
      }
    });
  });
});

ipcMain.handle('remove-contact', async (event, contactRequest) => {
  return new Promise((resolve, reject) => {
    agendaClient.RemoveContact(contactRequest, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
