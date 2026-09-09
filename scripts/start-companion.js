'use strict';
process.env.LOCAL_COMPANION='1';
const {createApp}=require('../server');
const app=createApp();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));
app.server.listen(app.config.port,app.config.host,()=>console.log(`Career Studio: ${app.config.origin}\nLocal ChatGPT companion: connect in Your account\nExperimental preview; authentication ends when this server stops.`));
