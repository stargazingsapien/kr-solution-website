import http from 'node:http';
import {readFile,writeFile,mkdir,rename,stat,cp} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {randomBytes,randomUUID,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {initialProducts,isVisible} from './inventory.mjs';
const derive=promisify(scrypt);
const failure=(status,message)=>Object.assign(new Error(message),{status});
const text=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw failure(400,'Please complete all required fields and respect the character limits.');return v.trim();};
async function passwordRecord(password){const salt=randomBytes(24).toString('hex');return {salt,hash:(await derive(password,salt,64)).toString('hex')};}
async function passwordMatches(password,record){return typeof password==='string'&&password.length<=256&&timingSafeEqual(await derive(password,record.salt,64),Buffer.from(record.hash,'hex'));}
async function readJSON(file){return JSON.parse(await readFile(file,'utf8'));}
async function atomic(file,value){const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2),{mode:0o600});await rename(tmp,file);}
async function body(req,max=100000){if(!req.headers['content-type']?.startsWith('application/json'))throw failure(415,'Send JSON data.');const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw failure(413,'The upload is too large.');parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString());}catch{throw failure(400,'Invalid JSON.');}}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml'};
export async function createApplication({root,dataDir=resolve(root,'private'),bootstrapPassword,publicOrigin='',seedDir}={}){
  let publicURL;
  if(publicOrigin){publicURL=new URL(publicOrigin);if(!['http:','https:'].includes(publicURL.protocol)||publicURL.username||publicURL.password||publicURL.pathname!=='/'||publicURL.search||publicURL.hash)throw new Error('PUBLIC_ORIGIN must be a full origin, such as https://preview.example.com, without a path.');if(publicURL.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(publicURL.hostname))throw new Error('Use HTTPS for a public domain.');publicOrigin=publicURL.origin;}
  const secureCookie=publicURL?.protocol==='https:'?'; Secure':'';
  await mkdir(dataDir,{recursive:true});await mkdir(resolve(dataDir,'uploads'),{recursive:true});
  const storeFile=resolve(dataDir,'catalogue.json'),authFile=resolve(dataDir,'admin.json');
  if(seedDir&&resolve(seedDir)!==resolve(dataDir)){
    try{await stat(storeFile);}catch(error){if(error.code!=='ENOENT')throw error;try{const seed=await readJSON(resolve(seedDir,'catalogue.json'));try{await cp(resolve(seedDir,'uploads'),resolve(dataDir,'uploads'),{recursive:true,force:false});}catch(e){if(e.code!=='ENOENT')throw e;}await atomic(storeFile,seed);}catch(e){if(e.code!=='ENOENT')throw e;}}
    try{await stat(authFile);}catch(error){if(error.code!=='ENOENT')throw error;try{await atomic(authFile,await readJSON(resolve(seedDir,'admin.json')));}catch(e){if(e.code!=='ENOENT')throw e;}}
  }
  let store,auth,initialCredential;
  try{store=await readJSON(storeFile);}catch(e){if(e.code!=='ENOENT')throw e;store={revision:1,categories:['Laptops','Desktops','Monitors','Printers','Accessories','CCTV & Security'],products:structuredClone(initialProducts).map(p=>({...p,sample:true,version:1}))};await atomic(storeFile,store);}
  try{auth=await readJSON(authFile);}catch(e){if(e.code!=='ENOENT')throw e;initialCredential=bootstrapPassword||'KR-'+randomBytes(12).toString('base64url');auth={username:'admin',...await passwordRecord(initialCredential)};await atomic(authFile,auth);}
  const sessions=new Map(),attempts=new Map();let queue=Promise.resolve();
  function change(fn){const result=queue.then(async()=>{const next=structuredClone(store);const value=await fn(next);next.revision++;await atomic(storeFile,next);store=next;return value;});queue=result.catch(()=>{});return result;}
  function session(req){const id=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('kr_admin='))?.slice(9);const s=sessions.get(id);if(!s||s.expires<Date.now()){sessions.delete(id);throw failure(401,'Please sign in to continue.');}return {id,...s};}
  async function validateProduct(input,current,next){
    const name=text(input.name,120,true),category=text(input.category,80,true),brand=text(input.brand,60),spec=text(input.spec,500),description=text(input.description,4000);
    if(!next.categories.includes(category))throw failure(400,'Choose an existing category.');
    if(!['New','Refurbished'].includes(input.condition))throw failure(400,'Choose New or Refurbished.');
    if(!Number.isInteger(input.stock)||input.stock<0||input.stock>99999)throw failure(400,'Stock must be a whole number from 0 to 99,999.');
    if(typeof input.price!=='number'||!Number.isFinite(input.price)||input.price<0||input.price>100000000)throw failure(400,'Enter a valid price.');
    if(typeof input.active!=='boolean')throw failure(400,'Invalid publication status.');
    const image=text(input.image,160,true);let imageFile;
    if(/^uploads\/[a-f0-9-]+\.(jpg|png|webp|avif)$/.test(image))imageFile=resolve(dataDir,image);
    else if(/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/.test(image))imageFile=resolve(root,'assets',image);
    else throw failure(400,'Upload a JPG, PNG, WebP or AVIF product image.');
    try{await stat(imageFile);}catch{throw failure(400,'The chosen image could not be found.');}
    const details={};for(const key of ['Processor','Memory','Storage','Display','Condition','Warranty'])if(input.details?.[key])details[key]=text(input.details[key],250);
    return {id:current?.id||randomUUID(),name,category,brand,spec,description,image,details,price:Math.round(input.price*100)/100,stock:input.stock,active:input.active,condition:input.condition,discontinued:input.discontinued===true,sample:input.sample===true,deleted:false,version:(current?.version||0)+1,updatedAt:new Date().toISOString()};
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try{
      const host=(req.headers.host||'').toLowerCase();if(host!==publicURL?.host&&!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))throw failure(403,'Invalid host.');
      const url=new URL(req.url,'http://'+host),path=url.pathname;
      if(path==='/healthz'&&req.method==='GET'){send(res,200,{ok:true});return;}
      if(path.startsWith('/api/')){
        if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==(publicOrigin||'http://'+host))throw failure(403,'Request origin was not accepted.');
        if(path==='/api/catalogue'&&req.method==='GET'){send(res,200,{revision:store.revision,products:store.products.filter(p=>!p.deleted&&isVisible(p)),categories:store.categories.filter(c=>store.products.some(p=>!p.deleted&&isVisible(p)&&p.category===c))});return;}
        if(path==='/api/login'&&req.method==='POST'){
          const ip=req.socket.remoteAddress||'local';let attempt=attempts.get(ip);if(!attempt||attempt.until<Date.now()){attempt={count:0,until:Date.now()+15*60*1000};attempts.set(ip,attempt);}if(attempt.count>=10)throw failure(429,'Too many login attempts. Try again in 15 minutes.');attempt.count++;
          const input=await body(req,5000);const matches=await passwordMatches(input.password,auth);if(input.username!==auth.username||!matches)throw failure(401,'Username or password is incorrect.');attempts.delete(ip);
          for(const [id,s] of sessions)if(s.expires<Date.now())sessions.delete(id);
          const id=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');sessions.set(id,{csrf,expires:Date.now()+8*60*60*1000});res.setHeader('Set-Cookie',`kr_admin=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie}`);send(res,200,{username:auth.username,csrf});return;
        }
        const s=session(req);
        if(req.method!=='GET'&&req.headers['x-csrf-token']!==s.csrf)throw failure(403,'Please refresh the admin page and try again.');
        if(path==='/api/session'&&req.method==='GET'){send(res,200,{username:auth.username,csrf:s.csrf});return;}
        if(path==='/api/logout'&&req.method==='POST'){sessions.delete(s.id);res.setHeader('Set-Cookie',`kr_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}`);send(res,200,{ok:true});return;}
        if(path==='/api/admin/catalogue'&&req.method==='GET'){send(res,200,store);return;}
        if(path==='/api/admin/password'&&req.method==='POST'){const input=await body(req,5000);if(!await passwordMatches(input.currentPassword,auth))throw failure(400,'Current password is incorrect.');if(typeof input.newPassword!=='string'||input.newPassword.length<12||input.newPassword.length>256)throw failure(400,'Use a password with 12 to 256 characters.');const nextAuth={username:auth.username,...await passwordRecord(input.newPassword)};await atomic(authFile,nextAuth);auth=nextAuth;for(const id of sessions.keys())if(id!==s.id)sessions.delete(id);send(res,200,{ok:true});return;}
        if(path==='/api/admin/upload'&&req.method==='POST'){
          const input=await body(req,7500000);if(typeof input.data!=='string'||!input.data.match(/^[A-Za-z0-9+/]+={0,2}$/))throw failure(400,'Invalid image file.');const bytes=Buffer.from(input.data,'base64');if(bytes.length>5*1024*1024||bytes.length<16)throw failure(400,'Upload an image smaller than 5 MB.');
          let ext;if(bytes.subarray(0,3).equals(Buffer.from([255,216,255])))ext='jpg';else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')ext='webp';else if(bytes.toString('ascii',4,8)==='ftyp'&&['avif','avis'].includes(bytes.toString('ascii',8,12)))ext='avif';else throw failure(400,'Use a JPG, PNG, WebP or AVIF image. SVG and HTML files are not accepted.');
          const image='uploads/'+randomUUID()+'.'+ext;await writeFile(resolve(dataDir,image),bytes,{flag:'wx'});send(res,201,{image});return;
        }
        if(path==='/api/admin/products'&&req.method==='POST'){const input=await body(req);const product=await change(async next=>{const p=await validateProduct(input,null,next);next.products.push(p);return p;});send(res,201,product);return;}
        const match=path.match(/^\/api\/admin\/products\/([a-z0-9-]+)(\/restore)?$/);
        if(match){const input=req.method==='PUT'||req.method==='DELETE'?await body(req):{};const product=await change(async next=>{const i=next.products.findIndex(p=>p.id===match[1]);if(i<0)throw failure(404,'Product not found.');const current=next.products[i];
          if(req.method==='POST'&&match[2]){if(!current.deleted)throw failure(409,'Product is already active.');next.products[i]={...current,deleted:false,active:false,version:(current.version||1)+1};}
          else if(['PUT','DELETE'].includes(req.method)&&!match[2]){if(input.version!==current.version)throw failure(409,'This product changed in another session. Refresh and try again.');if(req.method==='DELETE')next.products[i]={...current,deleted:true,active:false,version:current.version+1};else{if(current.deleted)throw failure(409,'Restore this product before editing it.');next.products[i]=await validateProduct(input,current,next);}}
          else throw failure(405,'Method not allowed.');return next.products[i];});send(res,200,product);return;}
        if(path==='/api/admin/categories'&&['POST','PUT','DELETE'].includes(req.method)){const input=await body(req,5000);await change(next=>{const name=text(input.name,80,true);if(req.method==='POST'){if(next.categories.some(c=>c.toLowerCase()===name.toLowerCase()))throw failure(409,'This category already exists.');next.categories.push(name);}else{const index=next.categories.indexOf(name);if(index<0)throw failure(404,'Category not found.');if(req.method==='DELETE'){if(next.products.some(p=>p.category===name))throw failure(409,'Move all products out of this category first, including archived products.');next.categories.splice(index,1);}else{const replacement=text(input.newName,80,true);if(next.categories.some(c=>c!==name&&c.toLowerCase()===replacement.toLowerCase()))throw failure(409,'This category already exists.');next.categories[index]=replacement;next.products.forEach(p=>{if(p.category===name){p.category=replacement;p.version=(p.version||1)+1;}});}}});send(res,200,{ok:true});return;}
        throw failure(404,'API endpoint not found.');
      }
      if(!['GET','HEAD'].includes(req.method))throw failure(405,'Method not allowed.');
      let file;if(path==='/'||path==='/index.html')file=resolve(root,'index.html');else if(['/admin','/admin/','/admin.html'].includes(path))file=resolve(root,'admin.html');
      else if(['/app.js','/style.css','/inventory.mjs','/admin.js','/admin.css'].includes(path))file=resolve(root,path.slice(1));
      else if(/^\/assets\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif|svg)$/.test(path))file=resolve(root,path.slice(1));
      else if(/^\/uploads\/[a-f0-9-]+\.(jpg|png|webp|avif)$/.test(path))file=resolve(dataDir,path.slice(1));
      else throw failure(404,'Not found.');
      const data=await readFile(file);res.writeHead(200,{'Content-Type':MIME[extname(file)]||'text/plain','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
    }catch(error){send(res,error.status|| (error.code==='ENOENT'?404:500),{error:error.status?error.message:error.code==='ENOENT'?'Not found.':'Unable to complete the request. Please try again.'});}
  });
  return {server,initialCredential};
}
