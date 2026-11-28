const os = require('node:os');
const net = require('node:net');

function ipv4(ip) { return ip.split('.').reduce((n, part) => (n << 8) | Number(part), 0); }
function candidates(endpoints, adapters = [], interfaces = os.networkInterfaces()) {
  const routes = [];
  for (const peer of endpoints) {
    if (Date.now() - peer.seen > 45000) continue;
    for (const [name, addresses] of Object.entries(interfaces)) {
      for (const address of addresses || []) {
        if (!net.isIPv4(peer.ip) || address.family !== 'IPv4' ||
            ((ipv4(address.address) ^ ipv4(peer.ip)) & ipv4(address.netmask)) !== 0) continue;
        const a = adapters.find(item => item.name === name);
        const desc = name+' '+(a?.description || '');
        const spec = desc.match(/Thunderbolt(?:\(TM\)|™)?\s*[345]\b|USB\s*4(?:NET)?|USB\s*3\.2(?:\s+Gen\s*[12](?:x[12])?)?/i);
        const type = spec?.[0] || (/thunderbolt/i.test(desc) ? 'Thunderbolt' : a?.kind==='wifi'||/wi-?fi|wlan/i.test(desc) ? 'Wi-Fi' : a?.kind==='ethernet'?'Ethernet':name);
        routes.push({key:name,localAddress:address.address,peer, label:type+(spec && a?.kind==='ethernet' && /3\.2/.test(type)?' Ethernet':''),speed:a?.sendBps||0});
      }
    }
  }
  return routes.sort((a,b)=>b.speed-a.speed || b.peer.seen-a.peer.seen);
}
module.exports={candidates};
