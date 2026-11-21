const fs=require('fs'),path=require('path'),Database=require('better-sqlite3');
const root=process.argv[2];if(!root||!path.basename(path.dirname(root)).startsWith('ll-install-test-'))throw new Error('Expected isolated installer test directory');
const file=path.join(root,'legacy-file.txt');fs.writeFileSync(file,'keep original');
const db=new Database(path.join(root,'orbit.db'));
db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('locallink.transfers',JSON.stringify([{id:'legacy-transfer',peerId:'localsend:test-phone',name:'legacy-file.txt',path:file,status:'received',direction:'incoming',size:13,time:12345}]));
db.close();
