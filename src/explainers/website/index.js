import { defineExplainer } from '../../framework/index.js';
import { smooth } from '../../framework/motion.js';
import meta from './meta.js';
import { buildWebsite } from './model.js';

// Every step loops while active: `phase` sweeps 0 -> 1 once per lap, every
// packet stream advances a whole number of laps, the fans turn 6 whole turns
// and the platters 4, and every one-shot event (a page painting, a head
// seeking, three layers landing) is shaped as a triangle that returns to zero.
// So the wrap pose is the start pose, always.
function run({ duration, extra }) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => {
        handles.set({ phase: s.t });
        if (extra) extra(s.t, handles);
      },
    });
  };
}

// 0 -> 1 -> 0 across the lap: a one-shot event that is still seamless.
const tri = (t) => 1 - Math.abs(1 - 2 * t);
const paintPulse = (t, h) => h.set({ paint: smooth(tri(t)) });

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildWebsite({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: '1 · Two computers and a cable',
      body: 'Everything you have ever called a website is this. A machine in front of you, a machine you will never see, and a conversation between them that is usually over in a third of a second. Your laptop holds none of the site — no text, no pictures, nothing. It holds a browser, which is a program for asking. The metal box on the right holds the actual files and the actual data, and it has never heard of you. Between them floats the only part that belongs to neither: the name. A note on scale — the cabinet here is a 12U, about waist high. Racks in a real data centre are 42U, over three times their own width tall, and there are thousands of them in rows.',
      hint: 'Drag to orbit. Green is what you send; amber is what comes back.',
      camera: { position: [-1.5, 4.7, 15.8], target: [-2.8, 1.45, 0] },
      focus: ['The frontend — your browser', 'The backend — one server'],
      onEnter: ({ handles }) => {
        handles.set({
          reqAmt: 1, respAmt: 1, hsAmt: 0, dnsAmt: 0, dnsShow: 0, plaqueShow: 1, innerAmt: 0,
          reqCardAmt: 0, respCardAmt: 0, door: 0, appOut: 0, dbOpen: 0, dbAmt: 0,
          fans: 1, build: 0, lock: 1, lid: 1, paint: 1,
        });
        handles.setLabels('overview');
      },
      timeline: run({ duration: 9000, extra: paintPulse }),
    },
    {
      id: 'dns',
      heading: '2 · The name is rented, and it points at a number',
      body: 'You do not buy a domain. You lease it, a year at a time, through a registrar — and the registry that files it does not store your website at all. It stores one thing: which nameservers speak for your name. Those nameservers hold the actual address, a number like 203.0.113.42. So before your browser can send anything, it has to ask: resolver, then the root, then the .com registry, then the nameserver that finally answers. That is why moving your site to a new host means repointing a name rather than buying a new one — and why the change takes hours to show up everywhere. Every answer along the way is cached until its time-to-live expires.',
      hint: '203.0.113.42 is a documentation address — reserved, so it can never go stale.',
      camera: { position: [-1.3, 3.3, 7.4], target: [-0.7, 2.9, 0] },
      focus: ['Registry: nameservers only', 'The A record lives here'],
      onEnter: ({ handles }) => {
        handles.set({
          reqAmt: 0, respAmt: 0, hsAmt: 0, dnsAmt: 1, dnsShow: 1, plaqueShow: 1, innerAmt: 0,
          reqCardAmt: 0, respCardAmt: 0, door: 0, appOut: 0, dbOpen: 0, dbAmt: 0,
          fans: 1, build: 0, lock: 0, lid: 1, paint: 0,
        });
        handles.setLabels('dns');
      },
      timeline: run({ duration: 7000 }),
    },
    {
      id: 'request',
      heading: '3 · The request is smaller than a text message',
      body: 'Now your browser has an address, and it sends the smallest thing in this whole story: a method, a path, and a handful of headers. GET /index.html — fetch me that file, here is who I am and what formats I can read. But it cannot just shout it down the wire. First the two machines shake hands: three messages to open a reliable connection, then a longer negotiation to agree on encryption keys. Around eight round trips before one byte of your page is asked for. That is the padlock in the address bar — not decoration, the receipt for a conversation that already happened.',
      camera: { position: [-2.6, 2.35, 6.9], target: [-3.4, 1.25, 0] },
      focus: ['Method + path + headers', 'Handshake first: ~8 round trips'],
      onEnter: ({ handles }) => {
        handles.set({
          reqAmt: 0.3, respAmt: 0, hsAmt: 1, dnsAmt: 0, dnsShow: 0, plaqueShow: 1, innerAmt: 0,
          reqCardAmt: 1, respCardAmt: 0, door: 0, appOut: 0, dbOpen: 0, dbAmt: 0,
          fans: 1, build: 0, lock: 1, lid: 1, paint: 0,
        });
        handles.setLabels('request');
      },
      timeline: run({ duration: 6500 }),
    },
    {
      id: 'server',
      heading: '4 · The web server answers what it can off disk',
      body: 'Open the cabinet and the first thing your request meets is the web server — the top sleds, running something like nginx. Its job is narrow and fast: if you asked for a file that simply exists, it hands the file back and the conversation is over. A logo, a stylesheet, the JavaScript bundle. No thinking required. There are three of them because one machine is a single point of failure, and because the same request can go to whichever is least busy. But the moment you ask for something that depends on who is asking — your name, your cart, your feed — this tier cannot answer. It passes the request deeper.',
      camera: { position: [2.1, 3.05, 5.9], target: [3.1, 2.28, 0.6] },
      focus: ['Web server tier'],
      onEnter: ({ handles }) => {
        handles.set({
          reqAmt: 1, respAmt: 0.3, hsAmt: 0, dnsAmt: 0, dnsShow: 0, plaqueShow: 0, innerAmt: 1,
          reqCardAmt: 0, respCardAmt: 0, door: 1, appOut: 0, dbOpen: 0, dbAmt: 0,
          fans: 1, build: 0, lock: 1, lid: 1, paint: 0,
        });
        handles.setLabels('server');
      },
      timeline: run({ duration: 5000 }),
    },
    {
      id: 'backend',
      heading: '5 · The backend is where your code actually runs',
      body: 'Pull the application sled out on its rails and there is no mystery inside — a processor under a heatsink, memory beside it, fans dragging air front to back. This is the backend. When a request arrives here, a program you wrote wakes up, looks at the path and at whatever proves who you are, and decides what this particular visitor should see. That decision is the whole reason the tier exists: the same URL has to produce a different page for every person who asks. But the code does not know anything by itself. To answer, it has to go and look something up.',
      camera: { position: [2.5, 2.95, 5.0], target: [3.4, 1.5, 1.45] },
      focus: ['Your code runs here'],
      onEnter: ({ handles }) => {
        handles.set({
          reqAmt: 0.5, respAmt: 0.2, hsAmt: 0, dnsAmt: 0, dnsShow: 0, plaqueShow: 0, innerAmt: 1,
          reqCardAmt: 0, respCardAmt: 0, door: 1, appOut: 1, dbOpen: 0, dbAmt: 0,
          fans: 1, build: 0, lock: 1, lid: 1, paint: 0,
        });
        handles.setLabels('backend');
      },
      timeline: run({ duration: 5000 }),
    },
    {
      id: 'db',
      heading: '6 · The database finds one row without reading the rest',
      body: 'The bottom unit is the database, and this is the part that should feel impossible. The table might hold forty million rows. Your query wants one. It does not look at the other thirty-nine million — watch the head: it does not sweep the disc, it goes straight to a track and stops. An index keeps the keys sorted in a branching tree, so finding a row is a handful of hops down that tree rather than a walk through the whole table. About thirty steps for a billion rows. The row comes back up to the application, which drops it into a page and hands the finished thing to the web server.',
      hint: 'Drop the index and the same query reads every row. Sites die this way.',
      camera: { position: [2.7, 2.45, 4.1], target: [3.6, 0.92, 1.55] },
      focus: ['Index seek — not a scan'],
      onEnter: ({ handles }) => {
        handles.set({
          reqAmt: 0.4, respAmt: 0.3, hsAmt: 0, dnsAmt: 0, dnsShow: 0, plaqueShow: 0, innerAmt: 1,
          reqCardAmt: 0, respCardAmt: 0, door: 1, appOut: 0, dbOpen: 1, dbAmt: 1,
          fans: 1, build: 0, lock: 1, lid: 1, paint: 0,
        });
        handles.setLabels('db');
      },
      timeline: run({ duration: 5200 }),
    },
    {
      id: 'response',
      heading: '7 · 200 OK, and the first 14 kilobytes',
      body: 'The answer comes back shaped like the question: a status line, some headers, then the body. 200 OK means the server understood and is sending what you asked for. The headers say what the body is and how long it runs. And the first slice that arrives is only about 14 kilobytes — not because the connection is slow, but because a fresh connection deliberately starts cautious and doubles its pace only once it sees packets getting through. Which is why the top of a page so often appears before the rest: the browser starts building with whatever it has.',
      camera: { position: [-1.6, 2.7, 8.2], target: [-2.6, 1.4, 0] },
      focus: ['Status + headers + body', 'First chunk: about 14 KB'],
      onEnter: ({ handles }) => {
        handles.set({
          reqAmt: 0.25, respAmt: 1, hsAmt: 0, dnsAmt: 0, dnsShow: 0, plaqueShow: 0, innerAmt: 0,
          reqCardAmt: 0, respCardAmt: 1, door: 1, appOut: 0, dbOpen: 0, dbAmt: 0,
          fans: 1, build: 0, lock: 1, lid: 1, paint: 0,
        });
        handles.setLabels('response');
      },
      timeline: run({ duration: 6500, extra: paintPulse }),
    },
    {
      id: 'frontend',
      heading: '8 · The frontend builds the page out of three layers',
      body: 'What arrived is text. Turning it back into a page takes three passes, and you can watch them land. The HTML becomes a tree of nodes — the structure, the nesting, what contains what. The CSS becomes a second tree of rules, and nothing can be drawn until it is complete, because a rule further down can still overrule one above. Combine the two and the browser knows what is visible and how it should look; then it works out where every box sits, and only then paints pixels. JavaScript runs on that same single thread, which is why one heavy script freezes the whole page. The budget for all of it is under 17 milliseconds a frame.',
      camera: { position: [-4.4, 1.6, 3.8], target: [-4.9, 1.15, 0] },
      focus: ['HTML becomes the DOM', 'CSS becomes the CSSOM'],
      onEnter: ({ handles }) => {
        handles.set({
          reqAmt: 0, respAmt: 0, hsAmt: 0, dnsAmt: 0, dnsShow: 0, plaqueShow: 0, innerAmt: 0,
          reqCardAmt: 0, respCardAmt: 0, door: 0, appOut: 0, dbOpen: 0, dbAmt: 0,
          fans: 0.3, build: 0, lock: 1, lid: 1, paint: 0,
        });
        handles.setLabels('frontend');
      },
      timeline: run({
        duration: 6000,
        extra: (t, h) => h.set({ build: smooth(tri(t)), paint: smooth(tri(t)) }),
      }),
    },
    {
      id: 'run',
      heading: '9 · Run it',
      body: 'Name to number, handshake, request, web server, application, database, and all the way back to be rebuilt as pixels. Every tap of every link you make does this, and the only part you were ever meant to notice is the last one.',
      hint: 'Drag to look around.',
      camera: { position: [2.2, 2.05, 16.1], target: [-3.05, 1.5, 0] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.set({
          reqAmt: 1, respAmt: 1, hsAmt: 0, dnsAmt: 0, dnsShow: 0, plaqueShow: 1, innerAmt: 0.5,
          reqCardAmt: 0, respCardAmt: 0, door: 0, appOut: 0, dbOpen: 0, dbAmt: 0,
          fans: 1, build: 0, lock: 1, lid: 1, paint: 1,
        });
        handles.setLabels(false);
      },
      timeline: run({ duration: 4600, extra: paintPulse }),
    },
  ],
});
