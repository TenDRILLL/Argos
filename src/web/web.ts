import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import {Client} from "discord.js";

import gearRouter from "./endpoints/gear";
import preloadRouter from "./endpoints/preload";
import siteRouter from "./endpoints/site";
import authorizationRouter from "./endpoints/authorization";
import makeOauthRouter from "./endpoints/oauth";
import makeRegisterRouter from "./endpoints/register";
import panelRouter from "./endpoints/panel";
import makeUnregisterRouter from "./endpoints/unregister";
import logoutRouter from "./endpoints/logout";
import resourceRouter from "./endpoints/resource";
import errorRouter from "./endpoints/error";
import catchallRouter from "./endpoints/catchall";

export function buildApp(client: Client): import("express").Application {
    const app = express();
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    app.use(cookieParser());
    app.set('views', './html/pages');
    app.set('view engine', 'ejs');

    app.use("/", siteRouter);
    app.use("/authorization", authorizationRouter);
    app.use("/api/oauth", makeOauthRouter(client));
    app.use("/register", makeRegisterRouter(client));
    app.use("/api/gear", gearRouter);
    app.use("/panel", preloadRouter);
    app.use("/api/panel", panelRouter);
    app.use("/unregister", makeUnregisterRouter(client));
    app.use("/logout", logoutRouter);
    app.use("/resource", resourceRouter);
    app.use("/error", errorRouter);
    app.use("/{*path}", catchallRouter);

    return app;
}

export function initWeb(port: number, client: Client): void {
    buildApp(client).listen(port, () => {
        console.log(`Web server running on port ${port}`);
    });
}
