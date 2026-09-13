import { publicWebsite } from '../company-research';
export type PublicPage={url:string;text:string;links:string[];emails:string[];phones:string[]};
export function publicAddress(ip:string):boolean {
  if(ip.includes(':'))return /^[23][0-9a-f]{3}:/i.test(ip)&&!/^2001:(?:db8|0):/i.test(ip)&&!/^2002:/i.test(ip);
  const parts=ip.split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  const [a,b]=parts;return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51)||a===203&&b===0);
}
export async function publicHost(host:string,requestFetch:typeof fetch=fetch){
  const results=await Promise.all(['A','AAAA'].map(async type=>{
    const r=await requestFetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(5000),redirect:'manual'});
    if(!r.ok)throw Error('Unable to verify the public website address.');
    const d=JSON.parse(await boundedText(r,50000)) as {Status?:number;Answer?:{type:number;data:string}[]};
    if(d.Status!==0)throw Error('Unable to resolve the public website address.');
    return (d.Answer||[]).filter(a=>[1,28].includes(a.type)).map(a=>a.data);
  }));
  const addresses=results.flat();if(!addresses.length||addresses.some(a=>!publicAddress(a)))throw Error('This address is not a public company website.');
}
export async function boundedText(response:Pick<Response,'headers'|'body'>,limit=750_000){
  if(Number(response.headers.get('content-length')||0)>limit)throw Error('The page is too large. Try a more specific company page.');
  const reader=response.body?.getReader();if(!reader)throw Error('The website returned an empty page.');
  const decoder=new TextDecoder();let text='',bytes=0;
  try { while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>limit){await reader.cancel();throw Error('The page is too large. Try a more specific company page.');}text+=decoder.decode(r.value,{stream:true});}return text+decoder.decode(); }
  finally{reader.releaseLock();}
}
export async function readPublicPage(input:string,requestFetch:typeof fetch=fetch):Promise<PublicPage>{
  let url=publicWebsite(input),response:Response|undefined;
  for(let i=0;i<4;i++){
    await publicHost(new URL(url).hostname,requestFetch);
    response=await requestFetch(url,{redirect:'manual',headers:{accept:'text/html','user-agent':'Bearagon-Company-Research/1.0'},signal:AbortSignal.timeout(10000)});
    if(response.status>=300&&response.status<400){const next=response.headers.get('location');await response.body?.cancel();if(!next)throw Error('The website redirect is unavailable.');url=publicWebsite(new URL(next,url).href);response=undefined;continue;}break;
  }
  if(!response?.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('This public page could not be read. Try the company’s About or Contact page.');
  const html=await boundedText(response);
  const clean=await new HTMLRewriter().on('script,style,noscript,svg,template,iframe,[hidden],[aria-hidden="true"]',{element(e){e.remove();}}).transform(new Response(html)).text();
  let text='';const links=new Set<string>(),emails=new Set<string>(),phones=new Set<string>();
  await new HTMLRewriter().on('a[href]',{element(e){const href=e.getAttribute('href')||'';
    if(/^mailto:/i.test(href)){const email=href.slice(7).split('?')[0];if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))emails.add(email);}
    else if(/^tel:/i.test(href)){const phone=href.slice(4);if(/^[+\d(). -]{7,30}$/.test(phone))phones.add(phone);}
    else {try {const next=publicWebsite(new URL(href,url).href);if(new URL(next).hostname===new URL(url).hostname&&/about|contact|service|what-we-do|how-it-works/i.test(new URL(next).pathname))links.add(next);}catch{/* Ignore non-page links. */}}
  }}).on('p,div,li,h1,h2,h3,h4,br,footer,section',{element(e){e.prepend(' ');e.append(' ');}}).onDocument({text(chunk){text+=chunk.text;}}).transform(new Response(clean)).text();
  text=text.replace(/\s+/g,' ').trim().slice(0,18000);
  return {url,text,links:[...links].slice(0,3),emails:[...emails],phones:[...phones]};
}
export async function readCompanyPages(website:string):Promise<PublicPage[]>{
  const first=await readPublicPage(website);
  const others=await Promise.allSettled(first.links.filter(u=>u!==first.url).map(u=>readPublicPage(u)));
  return [first,...others.flatMap(r=>r.status==='fulfilled'?[r.value]:[])];
}

