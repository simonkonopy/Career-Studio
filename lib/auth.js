'use strict';
const { randomBytes, scrypt: derive, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { StoreError, hash } = require('./store');
const scrypt = promisify(derive);
const secret = () => randomBytes(32).toString('base64url');
const recoveryCode = () => randomBytes(24).toString('base64url');
function equal(a, b) { const x=Buffer.from(String(a)),y=Buffer.from(String(b)); return x.length===y.length && timingSafeEqual(x,y); }
function email(value) { if(typeof value!=='string'||value.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw new StoreError(400,'Enter a valid email address.'); return value.trim().toLowerCase(); }
function password(value) { if(typeof value!=='string'||value.length<12||value.length>128)throw new StoreError(400,'Use a password with 12 to 128 characters.'); return value; }
async function passwordHash(value) { password(value); const salt=randomBytes(16).toString('hex'); const key=await scrypt(value,salt,64); return salt+':'+key.toString('hex'); }
async function verifyPassword(value, stored) { if(typeof value!=='string'||value.length>128)return false; const [salt,expected]=String(stored||'00000000000000000000000000000000:'+ '0'.repeat(128)).split(':'); const key=await scrypt(value,salt,64); return equal(key.toString('hex'),expected); }
function limiter({max=20,windowMs=15*60000,now=()=>Date.now()}={}) {
  const values=new Map();
  return key => { const time=now(); let entry=values.get(key); if(!entry||entry.until<=time){entry={count:0,until:time+windowMs};values.set(key,entry);} entry.count++; if(values.size>5000)for(const [k,v]of values)if(v.until<=time)values.delete(k); if(values.size>10000||entry.count>max)throw new StoreError(429,'Too many attempts. Please wait before trying again.','RATE_LIMIT'); };
}
module.exports={secret,recoveryCode,equal,email,passwordHash,verifyPassword,limiter,hash};
