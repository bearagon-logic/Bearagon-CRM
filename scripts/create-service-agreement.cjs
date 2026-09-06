const {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} = require("docx");
const fs = require("fs");

const navy = "0B2545";
const blue = "2D7FB8";
const gray = "52677B";
const placeholder = "[Client Legal Name]";
const meta = (text) => new Paragraph({
  children: [new TextRun({ text, color: gray, size: 18 })],
  spacing: { after: 120 },
});
const clause = (title, text) => new Paragraph({
  children: [new TextRun({ text: `${title}. `, bold: true }), new TextRun(text)],
  spacing: { after: 80 },
  alignment: AlignmentType.JUSTIFIED,
});
const bullet = (text) => new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 70 } });
const heading = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 145, after: 80 } });

const children = [
  new Paragraph({
    children: [new TextRun({ text: "DRAFT — ATTORNEY REVIEW REQUIRED BEFORE SIGNATURE", bold: true, color: "A33B3B", size: 18 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 260 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "BEARAGON", bold: true, color: blue, size: 24 })],
    alignment: AlignmentType.CENTER,
  }),
  new Paragraph({
    children: [new TextRun({ text: "CLIENT SERVICES AGREEMENT", bold: true, color: navy, size: 36 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
  }),
  meta(`Service Provider: Bearagon [insert legal entity name, address, and state of formation] ("Bearagon")`),
  meta(`Client: ${placeholder} [insert entity type, address, and state of formation] ("Client")`),
  meta("Effective Date: [Effective Date]"),
  new Paragraph({
    children: [new TextRun("This Client Services Agreement (the “Agreement”) sets the terms under which Bearagon will implement, maintain, and support the Client’s approved automation and operational systems. Each statement of work, quote, order form, or proposal accepted by both parties under this Agreement is a “Quote.”")],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 180, after: 180 },
  }),
  heading("1. Engagement and Scope"),
  clause("1.1 Quotes control the work", "The parties will describe the setup work, deliverables, assumptions, timing, acceptance criteria, setup fees, and recurring monthly fee in one or more Quotes. A Quote becomes binding when signed or otherwise accepted in writing by authorized representatives of both parties. If a Quote conflicts with this Agreement, the Quote controls only for that conflict."),
  clause("1.2 Setup services", "Bearagon will perform the implementation, configuration, integration coordination, testing support, documentation, and training expressly described in the applicable Quote. Bearagon is not responsible for work outside the Quote, including changes requested after approval, unless the parties approve a written change order or replacement Quote."),
  clause("1.3 Ongoing services", "After the setup work, Bearagon will provide the ongoing maintenance and support expressly included in the applicable Quote. Unless a Quote says otherwise, ongoing services are operational maintenance and advisory services, not a guarantee of uninterrupted system availability, revenue, regulatory compliance, or any particular business result."),
  heading("2. Fees, Billing, and Taxes"),
  clause("2.1 Quote-based pricing", "All fees are scoped in the applicable Quote. Setup fees, monthly fees, optional services, and third-party costs must be stated there. Bearagon is not required to begin work until the applicable initial invoice is paid, unless the Quote expressly states otherwise."),
  clause("2.2 Monthly fees billed in advance", "Bearagon will invoice recurring monthly fees in advance of the month of service. The first recurring invoice is due before the first month of ongoing service, and each later recurring invoice is due before the applicable renewal month. Payments are non-refundable for a month that has begun, except where required by law or expressly agreed in writing."),
  clause("2.3 Payment terms", "Invoices are due within [15] days after the invoice date unless the applicable Quote states another due date. Client will pay all undisputed amounts without setoff. Overdue amounts may accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law, plus reasonable collection costs."),
  clause("2.4 Taxes and third-party services", "Fees exclude taxes, duties, and similar government charges, except taxes based on Bearagon’s net income. Client is responsible for third-party subscriptions, licenses, usage fees, and taxes identified in a Quote or otherwise approved by Client."),
  heading("3. Term, Renewal, and Non-Renewal"),
  clause("3.1 Initial term", "This Agreement begins on the Effective Date. The setup services continue through completion, expiration, or termination of the applicable Quote. Ongoing services begin on the date stated in the applicable Quote and continue in monthly service periods."),
  clause("3.2 Monthly renewal", "Ongoing services automatically renew for successive monthly service periods unless either party gives written notice of non-renewal at least [30] days before the next service period begins. A non-renewal ends services after the paid current service period; it is not a mid-month cancellation or refund right."),
  clause("3.3 Suspension and termination for cause", "Bearagon may suspend affected services on written notice for nonpayment, a material security risk, unlawful use, or Client’s material breach. Either party may terminate an affected Quote for material breach if the breach is not cured within [15] days after written notice, except that Bearagon may terminate immediately where continued performance would be unlawful or materially unsafe."),
  clause("3.4 Effect of ending services", "On expiration or termination, Client will pay all amounts accrued through the end of the paid service period and any approved non-cancelable third-party costs. On written request, Bearagon will provide a reasonable transition handoff described in the applicable Quote or at Bearagon’s then-current professional-services rate."),
  heading("4. Client Responsibilities"),
  bullet("Provide accurate, timely business requirements, decisions, access, approvals, and points of contact."),
  bullet("Maintain its own rights to data, systems, accounts, and third-party services used with the services."),
  bullet("Review and approve automation boundaries, permissions, escalation rules, and production launch decisions."),
  bullet("Use human review for material decisions and remain responsible for its own business, legal, financial, employment, and compliance decisions."),
  clause("4.1 Delays", "Bearagon is not responsible for delays or missed dates caused by Client, Client vendors, third-party platforms, or incomplete requirements. The parties will reasonably adjust timelines when those dependencies change."),
  heading("5. Automation, Data, and Security"),
  clause("5.1 Automation boundaries", "Bearagon may configure automations only within the approved scope and permissions documented in the applicable Quote or onboarding materials. Client authorizes Bearagon to access Client systems only as needed to perform the services and subject to the access controls agreed by the parties."),
  clause("5.2 Client data", "As between the parties, Client retains ownership of Client data. Client grants Bearagon a limited right to process Client data solely to provide, secure, maintain, and improve the services for Client. Bearagon will use commercially reasonable administrative, technical, and organizational measures appropriate to the nature of the data and services."),
  clause("5.3 Sensitive data", "Client will not provide regulated, highly sensitive, or special-category data unless the applicable Quote expressly identifies it and the parties have executed any required data-protection, security, or business-associate addendum. Client remains responsible for determining whether its intended use complies with applicable law."),
  clause("5.4 Third-party platforms", "Third-party platforms are governed by their own terms and availability. Bearagon does not control them and is not responsible for their outages, changes, security incidents, or discontinuation, but will reasonably assist Client in assessing material impacts within the agreed scope."),
  heading("6. Intellectual Property and Confidentiality"),
  clause("6.1 Background materials", "Each party retains ownership of its pre-existing materials, systems, know-how, templates, and intellectual property. Bearagon retains ownership of its reusable methodologies, tools, prompts, configurations, templates, and general know-how, even if used while providing the services."),
  clause("6.2 Client deliverables", "After Client pays all applicable fees, Bearagon grants Client a non-exclusive, perpetual license to use the client-specific deliverables identified in the applicable Quote for Client’s internal business purposes. This license does not transfer ownership of Bearagon’s background materials."),
  clause("6.3 Confidentiality", "Each party will protect the other party’s non-public business, technical, financial, and customer information using reasonable care and will use it only to perform or receive services under this Agreement. Confidential information does not include information that is public without breach, already known without duty, independently developed, or rightfully received from another source."),
  heading("7. Warranties, Liability, and Indemnity"),
  clause("7.1 Limited service warranty", "Bearagon warrants that it will perform professional services in a workmanlike manner. Client’s exclusive remedy for breach of this warranty is re-performance of the affected services, provided Client reports the breach within [30] days after delivery."),
  clause("7.2 Disclaimer", "EXCEPT FOR THE EXPRESS WARRANTY ABOVE, THE SERVICES AND DELIVERABLES ARE PROVIDED “AS IS.” BEARAGON DISCLAIMS ALL IMPLIED WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTY THAT AUTOMATIONS OR THIRD-PARTY SYSTEMS WILL BE ERROR-FREE, UNINTERRUPTED, OR PRODUCE A PARTICULAR RESULT."),
  clause("7.3 Limitation of liability", "TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY WILL BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR LOST-PROFIT DAMAGES. BEARAGON’S TOTAL LIABILITY ARISING FROM AN APPLICABLE QUOTE WILL NOT EXCEED THE FEES PAID OR PAYABLE TO BEARAGON UNDER THAT QUOTE IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO LIABILITY. This limit does not apply to Client’s payment obligations, either party’s fraud or willful misconduct, or liability that cannot lawfully be limited."),
  clause("7.4 Client indemnity", "Client will defend and indemnify Bearagon from third-party claims arising from Client data, Client instructions, Client’s unlawful use of the services, or Client’s breach of this Agreement, except to the extent caused by Bearagon’s breach of this Agreement or willful misconduct."),
  heading("8. General Terms"),
  clause("8.1 Independent contractors", "The parties are independent contractors. This Agreement does not create a partnership, joint venture, employment, agency, or fiduciary relationship."),
  clause("8.2 Publicity", "Neither party may use the other’s name or marks in public marketing without prior written consent, except that Bearagon may identify Client internally as a customer for service delivery."),
  clause("8.3 Notices", "Notices under this Agreement must be in writing and delivered by email to the notice addresses stated below, with confirmation of transmission, or by nationally recognized courier. A party may update its notice address by written notice."),
  clause("8.4 Assignment, force majeure, and waiver", "Neither party may assign this Agreement without the other’s consent, except to a successor in connection with a merger, acquisition, or sale of substantially all assets. Neither party is liable for delay caused by events beyond reasonable control. A waiver must be in writing and applies only to the specific instance."),
  clause("8.5 Governing law and venue", "This Agreement is governed by the laws of [State], excluding conflict-of-law rules. The state and federal courts located in [County, State] have exclusive jurisdiction, and each party consents to that jurisdiction and venue."),
  clause("8.6 Entire agreement and electronic signatures", "This Agreement and accepted Quotes are the complete agreement on their subject matter and may be amended only in a writing signed by both parties. Counterparts and electronic signatures are effective to the extent permitted by applicable law."),
  heading("9. Signatures"),
  new Paragraph({ text: "The undersigned represent that they are authorized to bind their respective organizations.", spacing: { after: 200 } }),
  new Paragraph({ text: "BEARAGON", bold: true, spacing: { after: 95 } }),
  new Paragraph({ text: "By: ____________________________________", spacing: { after: 90 } }),
  new Paragraph({ text: "Name / Title: ____________________________", spacing: { after: 90 } }),
  new Paragraph({ text: "Date: __________________________________", spacing: { after: 220 } }),
  new Paragraph({ text: placeholder.toUpperCase(), bold: true, spacing: { after: 95 } }),
  new Paragraph({ text: "By: ____________________________________", spacing: { after: 90 } }),
  new Paragraph({ text: "Name / Title: ____________________________", spacing: { after: 90 } }),
  new Paragraph({ text: "Date: __________________________________", spacing: { after: 170 } }),
  new Paragraph({
    children: [new TextRun({ text: "Implementation note: attach the client-specific Quote describing setup scope, one-time setup fees, monthly recurring fee, third-party costs, and service start date before sending for signature.", italics: true, color: gray, size: 18 })],
    border: { top: { color: "B5C5D4", style: BorderStyle.SINGLE, size: 6 } },
    spacing: { before: 120 },
  }),
];

const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
    headers: { default: new (require("docx").Header)({ children: [new Paragraph({ children: [new TextRun({ text: "BEARAGON · CLIENT SERVICES AGREEMENT", color: blue, bold: true, size: 16 })] })] }) },
    footers: { default: new (require("docx").Footer)({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Draft for attorney review · Page ", color: gray, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: gray, size: 16 })] })] }) },
    children,
  }],
  styles: { default: { document: { run: { font: "Aptos", size: 20, color: "1A2F45" }, paragraph: { spacing: { line: 276 } } } }, paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Aptos Display", bold: true, color: navy, size: 26 } }] },
});

const output = process.argv[2];
if (!output) throw new Error("Pass the output .docx path.");
Packer.toBuffer(doc).then((buffer) => fs.writeFileSync(output, buffer));
