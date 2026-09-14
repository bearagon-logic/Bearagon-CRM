import type { ReactNode } from 'react';

export type CompanyContact = {id:string;displayName:string;email:string;phone:string;jobTitle:string;relationshipRole:string;isPrimary:boolean};
type Company = {companyName:string;website:string;contactName:string;email:string;phone:string;notes:string};
function Fact({label,value}:{label:string;value?:ReactNode}) {
  return <div><dt>{label}</dt><dd>{value||<span className="company-missing">Not supplied yet</span>}</dd></div>;
}
function websiteLink(value:string) {
  try { const url=new URL(/^https?:\/\//i.test(value)?value:`https://${value}`); return ['https:','http:'].includes(url.protocol)?url.href:null; } catch { return null; }
}
export function CompanyInformation({client,contacts=[]}:{client:Company;contacts?:CompanyContact[]}) {
  const website=client.website.trim(), href=website?websiteLink(website):null;
  const additional=contacts.filter(c=>!c.isPrimary);
  return <section className="company-panel company-information"><h2>Company information</h2>
    <dl className="company-facts company-basic-facts">
      <Fact label="Company name" value={client.companyName}/>
      <Fact label="Website" value={href?<a href={href} target="_blank" rel="noreferrer">{website}</a>:website}/>
      <Fact label="Primary contact" value={client.contactName}/>
      <Fact label="Email" value={client.email}/>
      <Fact label="Phone" value={client.phone}/>
    </dl>
    <div className="company-saved-context"><h3>Business summary & company notes</h3>{client.notes.trim()?<p>{client.notes}</p>:<p className="company-missing">Not supplied yet</p>}</div>
    {additional.length>0&&<div className="company-additional-contacts"><h3>Other contacts</h3>{additional.map(c=><article key={c.id}><h4>{c.displayName||'Contact name not supplied'}</h4><dl className="company-facts company-basic-facts"><Fact label="Role" value={[c.jobTitle,c.relationshipRole].filter(Boolean).join(' · ')}/><Fact label="Email" value={c.email}/><Fact label="Phone" value={c.phone}/></dl></article>)}</div>}
  </section>;
}
