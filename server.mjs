import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createApplication} from './backend.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT||8098),publicOrigin=process.env.PUBLIC_ORIGIN||'';
const host=process.env.HOST||(publicOrigin?'0.0.0.0':'127.0.0.1');
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.');
const dataDir=resolve(root,process.env.DATA_DIR||'private');
const {server,initialCredential}=await createApplication({root,dataDir,publicOrigin,seedDir:resolve(root,'private')});
server.listen(port,host,()=>{
  const address=publicOrigin||`http://127.0.0.1:${port}`;
  console.log(`Store: ${address}/\nAdmin: ${address}/admin\nPersistent catalogue: ${dataDir}`);
  if(initialCredential)console.log('Initial administrator credentials (shown once):\nUsername: admin\nPassword: '+initialCredential);
});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
