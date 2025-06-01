"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
const User_1 = require("../models/User");
const auth = (req, res, next) => {
    var _a;
    try {
        const token = (_a = req.header('Authorization')) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
        if (!token) {
            throw new Error();
        }
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        User_1.UserModel.findOne({ id: decoded.id }, (err, user) => {
            if (err || !user) {
                return res.status(401).json({ message: 'Please authenticate' });
            }
            req.user = user;
            next();
        });
    }
    catch (error) {
        res.status(401).json({ message: 'Please authenticate' });
    }
};
exports.auth = auth;
