import Link from 'next/link';

const destinations = [
  {href:'/communications',label:'Inbox'},
  {href:'/approvals',label:'Approvals'},
  {href:'/operations',label:'Operations'},
];

export function WorkNavigation({current}:{current:string}) {
  return <nav className="work-navigation" aria-label="Work views">
    {destinations.map(item=><Link key={item.href} href={item.href} aria-current={current===item.href?'page':undefined}>{item.label}</Link>)}
  </nav>;
}
