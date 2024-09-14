const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '..', 'proto', 'agenda_service.proto');
const NAME_SERVICE_PROTO_PATH = path.join(__dirname, '..', 'proto', 'name_service.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {});
const agendaProto = grpc.loadPackageDefinition(packageDefinition).AgendaService;

const nameServiceDefinition = protoLoader.loadSync(NAME_SERVICE_PROTO_PATH, {});
const nameServiceProto = grpc.loadPackageDefinition(nameServiceDefinition).NameService;

const contacts = {};
const subscribers = [];
const connectedAgendas = new Set();
const connectedStreams = [];

function addContact(call, callback) {
  const { name, phone } = call.request;
  if (contacts[name]) {
    return callback(null, { success: false, message: 'Contact already exists.' });
  }
  contacts[name] = phone;
  callback(null, { success: true, message: 'Contact added.' });


  notifySubscribers('add', { name, phone });


  broadcastChange('add', { name, phone });
}

function updateContact(call, callback) {
  const { name, phone } = call.request;
  if (!contacts[name]) {
    return callback(null, { success: false, message: 'Contact does not exist.' });
  }
  contacts[name] = phone;
  callback(null, { success: true, message: 'Contact updated.' });


  notifySubscribers('update', { name, phone });


  broadcastChange('update', { name, phone });
}

function removeContact(call, callback) {
  const { name } = call.request;
  if (!contacts[name]) {
    return callback(null, { success: false, message: 'Contact does not exist.' });
  }
  delete contacts[name];
  callback(null, { success: true, message: 'Contact removed.' });


  notifySubscribers('remove', { name });


  broadcastChange('remove', { name });
}

function getContact(call, callback) {
  const { name } = call.request;
  if (!contacts[name]) {
    return callback(null, { contact: null });
  }
  callback(null, { contact: { name, phone: contacts[name] } });
}

function getAllContacts(call, callback) {
  const contactList = Object.keys(contacts).map(name => ({ name, phone: contacts[name] }));
  callback(null, { contacts: contactList });
}

function syncContacts(call, callback) {
  const receivedContacts = call.request.contacts;
  if (Array.isArray(receivedContacts)) {
    receivedContacts.forEach(({ name, phone }) => {
      contacts[name] = phone;
    });
    callback(null, { success: true, message: 'Contacts synchronized.' });
  } else {
    callback(null, { success: false, message: 'Invalid contacts data.' });
  }
}

function exchangeUpdates(call) {

  subscribers.push(call);
  console.log('Novo stream bidirecional estabelecido. Total de streams:', subscribers.length);


  call.on('data', (change) => {
    const { type, contact } = change;
    const { name, phone } = contact;
    if (type === 'add' || type === 'update') {
      contacts[name] = phone;
      console.log(`Contato ${name} atualizado via stream (${type}) recebido de um cliente.`);
    
      notifySubscribers(type, contact, call);
    
      broadcastChange(type, contact, call);
    } else if (type === 'remove') {
      delete contacts[name];
      console.log(`Contato ${name} removido via stream recebido de um cliente.`);
    
      notifySubscribers(type, contact, call);
    
      broadcastChange(type, contact, call);
    }
  });


  call.on('end', () => {
    const index = subscribers.indexOf(call);
    if (index !== -1) {
      subscribers.splice(index, 1);
      console.log('Stream bidirecional encerrado. Total de streams:', subscribers.length);
    }
    call.end();
  });


  call.on('error', (err) => {
    console.error('Erro no stream bidirecional:', err);
    const index = subscribers.indexOf(call);
    if (index !== -1) {
      subscribers.splice(index, 1);
    }
  });
}

function notifySubscribers(type, contact, originCall) {
  subscribers.forEach(subscriber => {
    if (subscriber !== originCall) {
      subscriber.write({ type, contact });
    }
  });
}

function broadcastChange(type, contact, originCall) {
  connectedStreams.forEach(stream => {
    if (stream !== originCall) {
      stream.write({ type, contact });
    }
  });
}

function registerInNameServer(agendaPort) {
  const client = new nameServiceProto('localhost:50051', grpc.credentials.createInsecure());
  const agendaUrl = `localhost:${agendaPort}`;
  client.registerService({ name: 'AgendaService', url: agendaUrl }, (err, response) => {
    if (err) {
      console.error('Erro ao registrar serviço:', err);
    } else {
      console.log(response.message);
    }
  });
}

function updateServiceRegistration(agendaPort) {
  setInterval(() => {
    const client = new nameServiceProto('localhost:50051', grpc.credentials.createInsecure());
    const agendaUrl = `localhost:${agendaPort}`;
    client.registerService({ name: 'AgendaService', url: agendaUrl }, (err) => {
      if (err) {
        console.error(`Agenda na porta ${agendaPort}: Erro ao atualizar registro:`, err);
      }
    });
  }, 5000);
}

function connectToOtherAgendas(agendaPort) {
  const client = new nameServiceProto('localhost:50051', grpc.credentials.createInsecure());
  client.getServices({}, (err, response) => {
    if (err) {
      console.error('Erro ao obter serviços:', err);
    } else {
      const services = response.services;
      services.forEach(service => {
        if (service.name === 'AgendaService' && service.url !== `localhost:${agendaPort}`) {
          if (!connectedAgendas.has(service.url)) {
            connectedAgendas.add(service.url);
            const agendaClient = new agendaProto(service.url, grpc.credentials.createInsecure());

          
            agendaClient.getAllContacts({}, (err, response) => {
              if (err) {
                console.error('Erro ao sincronizar contatos:', err);
              } else if (response && response.contacts) {
                response.contacts.forEach(({ name, phone }) => {
                  contacts[name] = phone;
                });
                console.log(`Contatos sincronizados com ${service.url}`);
              } else {
                console.error('Resposta inválida ao sincronizar contatos:', response);
              }
            });

          
            const call = agendaClient.exchangeUpdates();

          
            connectedStreams.push(call);

          
            call.on('data', (change) => {
              const { type, contact } = change;
              const { name, phone } = contact;
              if (type === 'add' || type === 'update') {
                contacts[name] = phone;
                console.log(`Contato ${name} atualizado via stream (${type}).`);
              
                notifySubscribers(type, contact, call);
              } else if (type === 'remove') {
                delete contacts[name];
                console.log(`Contato ${name} removido via stream.`);
              
                notifySubscribers(type, contact, call);
              }
            });

            call.on('error', (err) => {
              console.error('Erro no stream bidirecional:', err);
            
              connectedAgendas.delete(service.url);
              const index = connectedStreams.indexOf(call);
              if (index !== -1) {
                connectedStreams.splice(index, 1);
              }
            });

            call.on('end', () => {
              console.log('Stream bidirecional encerrado.');
              connectedAgendas.delete(service.url);
              const index = connectedStreams.indexOf(call);
              if (index !== -1) {
                connectedStreams.splice(index, 1);
              }
            });

            console.log(`Agenda na porta ${agendaPort}: Estabelecido stream bidirecional com ${service.url}`);
          }
        }
      });
    }
  });
}

function main() {

  const portArg = process.argv[2];
  const agendaPort = portArg ? parseInt(portArg, 10) : 50052;

  const server = new grpc.Server();
  server.addService(agendaProto.service, {
    addContact,
    updateContact,
    removeContact,
    getContact,
    getAllContacts,
    syncContacts,
    exchangeUpdates,
  });

  server.bindAsync(`0.0.0.0:${agendaPort}`, grpc.ServerCredentials.createInsecure(), () => {
    server.start();
    console.log(`Agenda service running on port ${agendaPort}`);
    registerInNameServer(agendaPort);
    updateServiceRegistration(agendaPort);
    connectToOtherAgendas(agendaPort);
  });
}

main();
