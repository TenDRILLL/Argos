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
    }, {
        name: "d2stats",
        description: "Get Destiny 2 statistics of yourself or the requested user.",
        options: [
            {
                type: 1,
                name: "summary",
                description: "Requested user's general statistics Argos monitors.",
                options: [
                    {
                        type: 6,
                        name: "user",
                        description: "The Discord user whose stats you wish to request.",
                        required: false
                    }
                ]
            }, {
                type: 1,
                name: "raids",
                description: "Requested user's raid completions per raid.",
                options: [
                    {
                        type: 6,
                        name: "user",
                        description: "The Discord user whose stats you wish to request.",
                        required: false
                    }
                ]
            }, {
                type: 1,
                name: "dungeons",
                description: "Requested user's dungeon completions per dungeon.",
                options: [
                    {
                        type: 6,
                        name: "user",
                        description: "The Discord user whose stats you wish to request.",
                        required: false
                    }
                ]
            }, {
                type: 1,
                name: "grandmasters",
                description: "Requested user's Grandmaster Nightfall completions per Grandmaster Nightfall.",
                options: [
                    {
                        type: 6,
                        name: "user",
                        description: "The Discord user whose stats you wish to request.",
                        required: false
                    }
                ]
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.discordToken);

rest.put(Routes.applicationCommands(process.env.discordId), { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);