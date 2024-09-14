const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const PROTO_PATH = path.join(__dirname, '..','proto','name_service.proto');

console.log(PROTO_PATH)

const services = [];

const packageDefinition = protoLoader.loadSync(
  PROTO_PATH,
  {}
);

const nameServiceProto = grpc.loadPackageDefinition(packageDefinition).NameService;


function registerService(call, callback) {
  const { name, url } = call.request;
  const index = services.findIndex(service => service.url === url);
  if (index !== -1) {
    services.splice(index, 1);
  }
  services.push({ name, url, timestamp: Date.now() });
  callback(null, { success: true, message: 'Service registered successfully.' });
}

function getServices(call, callback) {
  const now = Date.now();
  const ttl = 10000
  for (let i = services.length - 1; i >= 0; i--) {
    if (now - services[i].timestamp > ttl) {
      console.log(`Removendo serviço inativo: ${services[i].url}`);
      services.splice(i, 1);
    }
  }
  callback(null, { services });
}

function main() {
  const server = new grpc.Server();
  server.addService(nameServiceProto.service, { registerService, getServices });
  server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    server.start();
    console.log('Name server running on port 50051');
  });
}

main();