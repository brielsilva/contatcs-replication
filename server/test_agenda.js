const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const NAME_SERVICE_PROTO_PATH = '../proto/name_service.proto';
const AGENDA_SERVICE_PROTO_PATH = '../proto/agenda_service.proto';

const nameServiceDefinition = protoLoader.loadSync(
  NAME_SERVICE_PROTO_PATH,
  {}
);
const nameServiceProto = grpc.loadPackageDefinition(nameServiceDefinition).NameService;

const agendaServiceDefinition = protoLoader.loadSync(
  AGENDA_SERVICE_PROTO_PATH,
  {}
);
const agendaServiceProto = grpc.loadPackageDefinition(agendaServiceDefinition).AgendaService;

function getAvailableAgendas(callback) {
  const client = new nameServiceProto('localhost:50051', grpc.credentials.createInsecure());
  client.getServices({}, (err, response) => {
    if (err) {
      console.error('Erro ao obter serviços:', err);
      callback(err, null);
    } else {
      const agendas = response.services?.filter(service => service.name === 'AgendaService');
      callback(null, agendas);
    }
  });
}

function testAgenda(agendaUrl) {
  const client = new agendaServiceProto(agendaUrl, grpc.credentials.createInsecure());

  const port = agendaUrl.split(':')[1]
   

  console.log(`\nTestando agenda em ${agendaUrl}`);

  // 1. Adicionar contato
  client.addContact({ name: 'Alice', phone: '123456789' }, (err, response) => {
    if (err) {
      console.error('Erro ao adicionar contato:', err);
    } else {
      console.log('Adicionar contato:', response.message);

      // 2. Atualizar contato
      client.updateContact({ name: 'Alice', phone: '123456789' }, (err, response) => {
        if (err) {
          console.error('Erro ao atualizar contato:', err);
        } else {
          console.log('Atualizar contato:', response.message);

          // 3. Obter contato
          client.getContact({ name: 'Alice' }, (err, response) => {
            if (err) {
              console.error('Erro ao obter contato:', err);
            } else {
              console.log('Contato obtido:', response.contact);

              // 5. Obter todos os contatos
              client.getAllContacts({}, (err, response) => {
                if (err) {
                  console.error('Erro ao obter todos os contatos:', err);
                } else {
                  console.log('Todos os contatos:', response.contacts);
                }
              });
            //   // 4. Remover contato
            //   client.removeContact({ name: 'Alice' }, (err, response) => {
            //     if (err) {
            //       console.error('Erro ao remover contato:', err);
            //     } else {
            //       console.log('Remover contato:', response.message);

            //     }
            //   });
            }
          });
        }
      }, port);
    }
  }, port);
}

// Função principal do teste
function mainTest() {
  getAvailableAgendas((err, agendas) => {
    if (err || agendas.length === 0) {
      console.error('Nenhuma agenda disponível para testar.');
    } else {
      // Testar em todas as agendas disponíveis
      agendas.forEach((agenda,idx) => {
        if(idx == 0) {
            testAgenda(agenda.url);
        }
      });

      // Testar sincronização após um tempo
      setTimeout(() => {
        console.log('\nTestando sincronização entre agendas...');
        agendas.forEach(agenda => {
          const client = new agendaServiceProto(agenda.url, grpc.credentials.createInsecure());
          client.getAllContacts({}, (err, response) => {
            if (err) {
              console.error(`Erro ao obter contatos de ${agenda.url}:`, err);
            } else {
              console.log(`Contatos em ${agenda.url}:`, response.contacts);
            }
          });
        });
      }, 5000); // Aguardar 5 segundos para sincronização
    }
  });
}

mainTest();