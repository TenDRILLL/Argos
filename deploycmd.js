const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
require("dotenv").config({path: "./build/.env"});

const commands = [
    {
        name: "register",
        description: "Register to Argos with a registration code.",
        options: [
            {
                type: 3,
                name: "code",
                description: "Registration code",
                required: true
            }
        ]
    }, {
        name: "testraids",
        description: "Test raids",
        options: [
            {
                type: 6,
                name: "user",
                description: "The Discord user whose raids you wish to test.",
                required: false
            }
        ]
    }, {
        name: "teststats",
        description: "Test stats",
        options: [
            {
                type: 6,
                name: "user",
                description: "The Discord user whose stats you wish to test.",
                required: false
            }
        ]
    }, {
        name: "registrationlink",
        description: "Send registration link."
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.discordToken);

rest.put(Routes.applicationCommands(process.env.discordId), { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);