(function(root) {
  class PreviewCache {
    constructor(load, {concurrency=4, maxEntries=100, maxBytes=Infinity}={}) {
      this.load=load;this.concurrency=concurrency;this.maxEntries=maxEntries;this.maxBytes=maxBytes;
      this.cache=new Map();this.pending=new Map();this.queue=[];this.bytes=0;this.active=0;this.generation=0;
    }
    get(id, needed=()=>true) {
      if(!needed())return Promise.resolve(null);
      if(this.cache.has(id)){const value=this.cache.get(id);this.cache.delete(id);this.cache.set(id,value);return Promise.resolve(value);}
      const previous=this.pending.get(id);
      if(previous){previous.needed.push(needed);return previous.promise;}
      const job={id,needed:[needed],generation:this.generation};
      job.promise=new Promise(resolve=>{job.resolve=resolve;});this.pending.set(id,job);this.queue.push(job);this.drain();return job.promise;
    }
    clear() {
      this.generation++;this.cache.clear();this.bytes=0;
      for(const job of this.queue)job.resolve(null);
      this.queue=[];this.pending.clear();
    }
    drain() {
      while(this.active<this.concurrency&&this.queue.length){
        const job=this.queue.shift();
        if(!job.needed.some(needed=>needed())){this.pending.delete(job.id);job.resolve(null);continue;}
        this.active++;
        Promise.resolve().then(()=>this.load(job.id)).catch(()=>null).then(value=>{
          if(job.generation!==this.generation)value=null;
          // Budget conservatively for UTF-16 strings, rather than count alone.
          if(typeof value==='string'&&value.length*2<=this.maxBytes){
            this.cache.set(job.id,value);this.bytes+=value.length*2;
            while(this.cache.size>this.maxEntries||this.bytes>this.maxBytes){const key=this.cache.keys().next().value;this.bytes-=this.cache.get(key).length*2;this.cache.delete(key);}
          }
          job.resolve(value);
        }).finally(()=>{this.active--;if(this.pending.get(job.id)===job)this.pending.delete(job.id);this.drain();});
      }
    }
  }
  if(typeof module==='object'&&module.exports)module.exports=PreviewCache;else root.PreviewCache=PreviewCache;
})(globalThis);
