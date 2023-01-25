const {Client} = require("discord-http-interactions");
require("dotenv").config({path: "./build/.env"});

const client = new Client({
        token: process.env.discordToken,
        publicKey: process.env.discordKey,
        port: 11542,
        endpoint: "/api/interactions"
});

client.rest.put(`/applications/${process.env.discordId}/role-connections/metadata`, {body: [{
        type: 7,
        key: "registered",
        name: "Connected to Argos",
        description: "The user has registered to Argos, the Planetary Core."
}]}).then(x=>console.log(x)).catch(e=>console.log(e));