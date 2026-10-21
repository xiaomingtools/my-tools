import http from 'node:http';
import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const allowed=new Set(['/cgi-bin/stable_token','/cgi-bin/draft/add','/cgi-bin/draft/batchget','/cgi-bin/draft/get','/cgi-bin/material/add_material','/cgi-bin/media/uploadimg']);
const limit=22000000;
export function createGateway({secret,upstreamFetch=fetch,now=Date.now}={}){
 if(!secret||secret.length<32)throw Error('WECHAT_GATEWAY_SECRET must contain at least 32 characters');
 const seen=new Map();
 return http.createServer(async(req,res)=>{
 const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(req.method==='GET'&&req.url==='/health')return reply(200,{status:'ok',service:'flowdraft-wechat-egress'});
 if(req.method!=='POST'||req.url!=='/forward')return reply(404,{error:'Not found'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return reply(415,{error:'JSON required'});
 let size=0;const chunks=[];try{for await(const chunk of req){size+=chunk.length;if(size>limit){reply(413,{error:'Request too large'});req.destroy();return;}chunks.push(chunk);}}catch{return reply(400,{error:'Invalid request'});}
 const raw=Buffer.concat(chunks),stamp=String(req.headers['x-flowdraft-timestamp']||''),nonce=String(req.headers['x-flowdraft-nonce']||''),sig=String(req.headers['x-flowdraft-signature']||'');
 if(!/^\d{13}$/.test(stamp)||Math.abs(now()-Number(stamp))>60000||!/^[a-f0-9]{32}$/.test(nonce)||!/^[a-f0-9]{64}$/.test(sig))return reply(401,{error:'Invalid authentication'});
 const expected=createHmac('sha256',secret).update(stamp+'\n'+nonce+'\n'+createHash('sha256').update(raw).digest('hex')).digest();
 if(!timingSafeEqual(expected,Buffer.from(sig,'hex')))return reply(401,{error:'Invalid authentication'});
 for(const [n,t] of seen)if(t<now()-120000)seen.delete(n);
 if(seen.has(nonce))return reply(409,{error:'Replay rejected'});if(seen.size>=10000)return reply(429,{error:'Busy'});seen.set(nonce,now());
 let body;try{body=JSON.parse(raw);}catch{return reply(400,{error:'Invalid JSON'});}
 if(typeof body.path!=='string'||!body.path.startsWith('/cgi-bin/')||body.path.includes('#'))return reply(400,{error:'Invalid endpoint'});
 const url=new URL(body.path,'https://api.weixin.qq.com');
 if(url.origin!=='https://api.weixin.qq.com'||!allowed.has(url.pathname))return reply(403,{error:'Endpoint not allowed'});
 if([...url.searchParams.keys()].some(k=>!['access_token','type'].includes(k)))return reply(400,{error:'Query not allowed'});
 if(typeof body.body_base64!=='string'||body.body_base64.length>20000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.body_base64))return reply(400,{error:'Invalid body'});
 const contentType=String(body.content_type||'');if(contentType!=='application/json'&&!/^multipart\/form-data; boundary=[-\w]{1,100}$/.test(contentType))return reply(400,{error:'Invalid content type'});
 try{const result=await upstreamFetch(url.href,{method:'POST',headers:{'Content-Type':contentType},body:Buffer.from(body.body_base64,'base64'),redirect:'error',signal:AbortSignal.timeout(25000)});const responseBody=await result.arrayBuffer();if(responseBody.byteLength>10000000)return reply(502,{error:'Response too large'});res.writeHead(result.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(Buffer.from(responseBody));}catch{return reply(502,{error:'Upstream request failed; outcome may be unknown'});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const server=createGateway({secret:process.env.WECHAT_GATEWAY_SECRET});server.requestTimeout=35000;server.headersTimeout=10000;server.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('FlowDraft egress gateway is listening'));}
